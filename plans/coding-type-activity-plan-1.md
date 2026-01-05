# Production-Ready Coding Activity System

## Overview

A comprehensive coding assessment system integrated with Judge0, enabling instructors to create
coding challenges and students to submit, test, and receive automated feedback on their solutions.

**Architecture**: Extends existing Activity/Block system with new `TYPE_CODE_CHALLENGE` activity type,
leveraging the deployed Judge0 instance (judge0_server:2358 + judge0_workers) in docker-compose.

## Core Components

### 1. Activity Type Definition

**Backend Models** (`apps/api/src/db/courses/activities.py`):

```python
# Add to ActivityTypeEnum
TYPE_CODE_CHALLENGE = "TYPE_CODE_CHALLENGE"

# Add to ActivitySubTypeEnum
SUBTYPE_CODE_GENERAL = "SUBTYPE_CODE_GENERAL"
SUBTYPE_CODE_COMPETITIVE = "SUBTYPE_CODE_COMPETITIVE"  # For leaderboard-enabled challenges
```

- **Key Characteristics**:
  - Supports all programming languages provided by Judge0 (70+ languages)
  - Automated testing via Judge0 API (http://judge0_server:2358)
  - Hidden and visible test cases stored in activity.content JSON field
  - Time and memory limit enforcement via Judge0
  - Real-time feedback through async submission processing
  - Multiple submission attempts with full history
  - Anti-cheating measures (submission timestamps, code similarity detection)
  - XP rewards integration with existing gamification system

### 2. Instructor Interface (Challenge Creation)

**New Database Models** (`apps/api/src/db/courses/code_challenges.py`):

```python
from enum import Enum
from sqlalchemy import JSON, Column
from sqlmodel import Field
from src.db.strict_base_model import SQLModelStrictBaseModel

class DifficultyLevel(str, Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"

class GradingStrategy(str, Enum):
    ALL_OR_NOTHING = "ALL_OR_NOTHING"
    PARTIAL_CREDIT = "PARTIAL_CREDIT"
    BEST_SUBMISSION = "BEST_SUBMISSION"
    LATEST_SUBMISSION = "LATEST_SUBMISSION"

class CodeChallengeSettings(SQLModelStrictBaseModel):
    """Settings stored in activity.details JSON field"""
    difficulty: DifficultyLevel = DifficultyLevel.EASY
    allowed_languages: list[int] = Field(default_factory=list)  # Judge0 language IDs
    time_limit: int = 5  # seconds per test case
    memory_limit: int = 256  # MB
    grading_strategy: GradingStrategy = GradingStrategy.PARTIAL_CREDIT
    allow_custom_input: bool = True
    points: int = 100
    due_date: str | None = None
    starter_code: dict[str, str] = Field(default_factory=dict)  # {language_id: code}
    visible_tests: list[dict] = Field(default_factory=list)
    hidden_tests: list[dict] = Field(default_factory=list)
```

#### Challenge Configuration

- **Basic Settings**:
  - Title and description (TipTap editor with existing EditorWrapper component)
  - Difficulty level (Easy/Medium/Hard)
  - Tags/categories for organization
  - Points/weight for grading (integrates with gamification XP system)
  - Due date and late submission policies
  - Allowed programming languages (multi-select from Judge0 /languages endpoint)

- **Code Setup**:
  - Problem statement with examples (stored in activity.content as rich HTML from TipTap)
  - Input/output format specifications (Markdown in activity.content.io_spec)
  - Constraints and edge cases (Markdown in activity.content.constraints)
  - Starter code templates per language stored in activity.details.starter_code
  - Reference solution code (encrypted in activity.details.reference_solution, admin only)

- **Test Case Management**:

  **Test Case Model** (stored in activity.details JSON):

  ```python
  class TestCase(PydanticStrictBaseModel):
      id: str  # ULID
      input: str
      expected_output: str
      is_visible: bool
      weight: int = 1  # for partial credit
      description: str | None = None
      group: str = "default"  # basic, edge, performance
      time_limit_override: int | None = None
  ```

  - **Visible Test Cases** (shown to students): is_visible=True
  - **Hidden Test Cases** (validation only): is_visible=False with weight allocation
  - Bulk import via CSV/JSON parser endpoint
  - Test case grouping UI using shadcn Accordion components

- **Execution Settings**:
  - Time limit per test case (seconds)
  - Memory limit (MB)
  - Custom Judge0 configuration overrides
  - Enable/disable custom input testing by students

- **Grading Configuration**:
  - Grading strategy (GradingStrategy enum)
  - Auto-grading thresholds with XP rewards:

    ```python
    # Integration with apps/api/src/db/gamification.py
    XP_REWARDS["code_challenge_completion"] = 50  # base XP
    XP_REWARDS["code_challenge_perfect"] = 100  # all tests passed
    XP_REWARDS["code_challenge_first_solve"] = 25  # bonus
    ```

  - Manual review flag for plagiarism-detected submissions
  - Coding Leaderboard integration for competitive challenges

### 3. Student Interface (Challenge Submission)

**New Frontend Component** (`apps/web/components/features/courses/CodeChallengeEditor.tsx`):

```tsx
import { Editor } from '@monaco-editor/react';  // Add to package.json
import { useTranslations } from 'next-intl';
import { Button } from '@components/ui/button';
import { Select } from '@base-ui/react/Select';

interface CodeChallengeEditorProps {
  activityUuid: string;
  allowedLanguages: number[];
  starterCode: Record<string, string>;
}
```

#### Code Editor

- **Editor Library**: Monaco Editor (same as VS Code)
  - Add dependency: `@monaco-editor/react: ^4.7.0`
  - Server-side rendering: Use dynamic import with ssr: false
- **Editor Features**:
  - Syntax highlighting via Monaco's built-in Monarch grammars
  - IntelliSense auto-completion for supported languages
  - Language selection dropdown (shadcn Select component)
  - Theme toggle (integrates with next-themes)
  - Font size adjustment via toolbar
  - Line numbers, minimap, code folding (Monaco defaults)
  - Vim/Emacs keybindings (optional Monaco configuration)
  - Auto-save to localStorage with debounce (useDebounce hook exists)

#### Testing & Submission Flow

1. **Pre-submission Testing**:
   - "Run Tests" button (runs visible test cases only via Judge0 batch API)
   - "Custom Input" tab (if activity.details.allow_custom_input=True)
   - Real-time output display using SWR polling:

     ```tsx
     const { data } = useSWR(
       submissionToken ? `/api/judge0/submission/${submissionToken}` : null,
       { refreshInterval: 1000 }
     );
     ```

   - Judge0 Status Mapping:
     - Status 3: ✅ Accepted (green)
     - Status 4: ❌ Wrong Answer (red)
     - Status 5: ⏱️ Time Limit Exceeded (yellow)
     - Status 6: 🔧 Compilation Error (orange with stderr)
     - Status 7-12: 💥 Runtime Error (red with sanitized stderr)
     - Status 13-14: 🔥 Internal Error (retry prompt)
   - Diff view for actual vs expected output (Monaco DiffEditor)
   - Execution stats: time (ms), memory (KB) from Judge0 response

2. **Submission**:

   **API Endpoint** (`apps/api/src/routers/courses/code_challenges.py`):

   ```python
   @router.post("/activities/{activity_uuid}/submit")
   async def submit_code_challenge(
       activity_uuid: str,
       submission: CodeSubmission,
       current_user: Annotated[PublicUser, Depends(get_current_user)],
       db: Annotated[Session, Depends(get_db_session)],
       background_tasks: BackgroundTasks
   ) -> SubmissionResponse:
       # Create submission record
       # Enqueue Judge0 batch submission
       # Return submission_uuid for polling
   ```

   - "Submit Solution" button with loading spinner (Spinner)
   - Confirmation dialog using shadcn AlertDialog
   - Background processing via FastAPI BackgroundTasks
   - Progress indicator shows test execution count (e.g., "Testing: 15/20")
   - Results display:
     - Overall score/percentage with radial progress (shadcn Progress)
     - Per test case results (visible: full details, hidden: pass/fail only)
     - Color-coded status badges (shadcn Badge component)
     - Expandable test details using shadcn Collapsible
     - XP earned animation using motion (existing dependency)

3. **Submission History**:

   **Database Model** (`apps/api/src/db/courses/code_submissions.py`):

   ```python
   class CodeSubmission(SQLModelStrictBaseModel, table=True):
       id: int | None = Field(default=None, primary_key=True)
       submission_uuid: str
       activity_id: int = Field(foreign_key="activity.id")
       user_id: int = Field(foreign_key="user.id")
       org_id: int = Field(foreign_key="organization.id")
       language_id: int  # Judge0 language ID
       source_code: str  # Base64 encoded
       test_results: dict = Field(sa_column=Column(JSON))  # Judge0 responses
       score: float  # 0-100
       passed_tests: int
       total_tests: int
       execution_time_ms: float | None
       memory_kb: float | None
       created_at: str
       plagiarism_score: float | None = None  # MOSS integration
   ```

   - Submissions list with infinite scroll (use existing pattern from assignments)
   - Display: timestamp (date-fns with locale), language badge, score progress bar
   - Code diff viewer
   - Best submission highlighted with crown icon (lucide-react Crown)
   - Clone submission button (pre-fills editor with previous code)

### 4. Judge0 Integration Layer

#### Submission Pipeline

```text
Student Code → Base64 Encode → Judge0 Batch API → Redis Cache → Poll Results → Update DB → WebSocket/SSE Notify
```

#### Implementation Details

**Service Layer** (`apps/api/src/services/code_challenges/judge0_service.py`):

```python
import httpx
from typing import AsyncGenerator
from fastapi import BackgroundTasks

class Judge0Service:
    BASE_URL = "http://judge0_server:2358"  # Internal docker network. Add proper env variable

    async def create_batch_submission(
        self,
        submissions: list[dict]
    ) -> list[str]:  # Returns submission tokens
        """Create batch submission for all test cases"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.BASE_URL}/submissions/batch",
                json={"submissions": submissions},
                params={"base64_encoded": "true"}
            )
            return [s["token"] for s in response.json()]

    async def poll_batch_results(
        self,
        tokens: list[str]
    ) -> AsyncGenerator[dict, None]:
        """Poll for results with exponential backoff"""
        # Implementation with async polling
```

- **Async Submission Handling**:
  - FastAPI BackgroundTasks for non-blocking processing
  - Redis for result caching (existing redis:8001 instance)
  - httpx for async HTTP calls to Judge0
  - Exponential backoff: 0.5s, 1s, 2s, 4s (max 4 retries)
  - 30s timeout per Judge0 API call
  - Rate limiting: 10 submissions/minute per user (use existing Redis)

- **Judge0 API Endpoints Used**:
  - `POST /submissions/batch?base64_encoded=true` - Create batch submissions
  - `GET /submissions/batch?tokens={token1,token2,...}` - Get batch results
  - `GET /languages` - Fetch available languages for UI dropdown
  - `GET /statuses` - Get status descriptions for error messages
  - `GET /config_info` - Validate Judge0 configuration on startup

- **Judge0 Status Code Handling**:

  ```python
  class Judge0Status(IntEnum):
      IN_QUEUE = 1
      PROCESSING = 2
      ACCEPTED = 3
      WRONG_ANSWER = 4
      TIME_LIMIT_EXCEEDED = 5
      COMPILATION_ERROR = 6
      RUNTIME_ERROR_SIGSEGV = 7
      RUNTIME_ERROR_SIGXFSZ = 8
      RUNTIME_ERROR_SIGFPE = 9
      RUNTIME_ERROR_SIGABRT = 10
      RUNTIME_ERROR_NZEC = 11
      RUNTIME_ERROR_OTHER = 12
      INTERNAL_ERROR = 13
      EXEC_FORMAT_ERROR = 14
  ```

- **Security Measures**:
  - Code sanitization: Strip ANSI codes, limit length (10MB max)
  - Execution in Judge0 sandbox (cgroups v2 isolation, privileged container)
  - Resource limits enforced by Judge0:
    - CPU time: configurable per challenge (default 5s)
    - Memory: configurable (default 256MB)
    - Stack size: Judge0 default (64MB)
    - Processes: 60 max (Judge0 default)
  - Rate limiting via Redis:

    ```python
    @limiter.limit("10/minute")  # Use existing slowapi integration
    async def submit_code_challenge(...)
    ```

  - Request logging with user_id, org_id, activity_id, timestamp
  - Code stored base64-encoded in DB (prevent injection)

#### Test Case Execution Strategy

- **Batch Execution** (Judge0 native support):
  - All test cases submitted in single batch API call (max 20 submissions/batch)
  - Judge0 workers process in parallel (docker-compose has judge0_workers service)
  - Results polled together every 500ms
  - For >20 tests, split into multiple batches sequentially

- **Execution Modes**:
  - **Fast Feedback** (practice mode): Stop polling on first failure, return partial results
  - **Complete Feedback** (graded mode): Poll all results before returning
  - Configurable via activity.details.execution_mode

- **Optimization**:
  - Identical code submissions cached in Redis (TTL: 1 hour)
  - Cache key: `sha256(source_code + language_id + test_input)`

### 5. Results & Analytics

#### Student View

**Component** (`apps/web/app/orgs/[orgslug]/courses/[courseuuid]/activities/[activityuuid]/analytics/page.tsx`):

- **Performance Dashboard** (reuse existing dashboard components from `components/Dashboard`):
  - Completion rate: Recharts Pie Chart
  - Average score: Radial Progress with animation
  - Language distribution: Bar Chart (shadcn chart component)
  - Time spent: Line Chart showing attempt history
  - Class comparison: Percentile rank with distribution curve
  - Personal best times leaderboard

- **Data Fetching**:

  ```tsx
  // Server Component
  const analytics = await fetch(
    `${getAPIUrl()}code-challenges/${activityUuid}/analytics/${userId}`,
    { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
  );
  ```

#### Instructor View

**Component** (`apps/web/app/orgs/[orgslug]/dash/code-challenges/[activityuuid]/analytics/page.tsx`):

- **Challenge Analytics Dashboard**:
  - Submission rate: Total submissions / enrolled students
  - Completion rate: Students with score ≥ passing threshold
  - Score distribution: Histogram using recharts
  - Common errors: Top 10 compilation/runtime errors (grouped by stderr)
  - Failing test cases: Heatmap showing failure rate per test
  - Time to complete: Box plot distribution
  - Language popularity: Pie chart

- **Student Performance Table**:
  - Data Table component (shadcn Table) with sorting/filtering
  - Columns: Name, Attempts, Best Score, Time Spent, Last Attempt, Status
  - Red flag indicators:
    - >10 attempts without passing
    - Plagiarism score >0.8 (MOSS integration)
    - Suspicious timing patterns (e.g., identical submission times)

- **Export Functionality**:
  - CSV: Use papaparse library
  - PDF: jspdf (existing dependency) with autoTable plugin
  - Includes: submissions, scores, timestamps, code (optionally)

### 6. Additional Features

#### Code Review & Feedback

**Component** (`apps/web/components/features/courses/CodeReview.tsx`):

- **Instructor Actions**:
  - View submissions: Monaco Editor in read-only mode with submission metadata
  - Inline comments: Monaco decorations API for line-level comments

    ```tsx
    editor.deltaDecorations([], [{
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        glyphMarginClassName: 'comment-glyph',
        hoverMessage: { value: commentText }
      }
    }]);
    ```

  - Grade override: Modal form with justification field (required)
  - Request revision: Creates notification using existing notification system
  - Share exemplary solutions: Adds to activity.content.example_solutions (anonymized)

#### Leaderboard

**Integration** with existing gamification system (`apps/api/src/routers/gamification.py`):

```python
@router.get("/code-challenges/{activity_uuid}/leaderboard")
async def get_code_challenge_leaderboard(
    activity_uuid: str,
    timeframe: Literal["all", "week", "month"] = "all",
    db: Session = Depends(get_db_session)
) -> LeaderboardRead:
    # Query best submissions per user
    # Calculate composite score: 0.6*score + 0.3*speed + 0.1*(1/attempts)
    # Return top 100
```

**Component** (`apps/web/components/features/courses/CodeChallengeLeaderboard.tsx`):

- Real-time updates via SWR with 60s refresh interval
- Ranking criteria (weighted composite):
  - Test score: 60%
  - Time to first AC: 30% (normalized)
  - Attempt efficiency: 10% (1/attempts)
- Filters: All-time, This Week, This Month (shadcn Tabs)
- User highlighting: Current user row highlighted in gold
- Rank icons: 🥇🥈🥉 for top 3

#### Hints & Resources

**Hints System** (stored in activity.content.hints):

```python
class Hint(PydanticStrictBaseModel):
    id: str
    order: int
    content: str  # Markdown
    xp_penalty: int = 5  # XP deducted per hint viewed
    unlocked_at: str | None = None  # timestamp when user unlocked
```

- Progressive reveal: Hints unlock sequentially after N minutes or M attempts
- XP penalty system: Integrated with gamification.award_xp (negative amount)
- UI: Expandable accordion, each hint shows penalty before reveal

**Resources**:

- Related materials: Links to course activities (stored in activity.content.related_uuids)
- External resources: Curated links with descriptions
- Discussion: Reuse existing discussion system (apps/api/src/routers/discussions.py)
- FAQ: Collapsible Q&A section in activity description

#### Accessibility

- Keyboard navigation: Monaco Editor built-in support
- Screen reader: ARIA labels on all interactive elements

### 7. Technical Requirements

#### Frontend Components

**File Structure**:

```text
apps/web/
├── app/orgs/[orgslug]/
│   ├── courses/[courseuuid]/
│   │   └── activities/[activityuuid]/
│   │       ├── page.tsx  (Code editor + test runner)
│   │       ├── submissions/page.tsx  (History)
│   │       └── analytics/page.tsx  (Student analytics)
│   └── dash/code-challenges/
│       └── [activityuuid]/
│           ├── edit/page.tsx  (Challenge editor)
│           ├── analytics/page.tsx  (Instructor analytics)
│           └── submissions/page.tsx  (All submissions)
├── components/features/courses/
│   ├── CodeChallengeEditor.tsx  (Monaco wrapper)
│   ├── CodeTestRunner.tsx  (Test execution UI)
│   ├── CodeSubmissionHistory.tsx
│   ├── CodeChallengeForm.tsx  (Instructor creation form)
│   ├── TestCaseManager.tsx  (Add/edit/import tests)
│   └── CodeReview.tsx  (Instructor review)
└── components/ui/  (shadcn components - reused)
```

- **New Reusable Components**:
  - `<CodeEditor />`: Monaco wrapper with language selector, theme sync
  - `<TestCaseCard />`: Individual test result with expandable details
  - `<SubmissionStatusBadge />`: Color-coded status with icon
  - `<LanguageSelector />`: Combobox with Judge0 languages
  - `<ChallengeTimer />`: Countdown with auto-submit on expiry
  - `<CodeDiffViewer />`: Side-by-side or unified diff

#### Backend Services

**API Router** (`apps/api/src/routers/courses/code_challenges.py`):

```python
from fastapi import APIRouter, BackgroundTasks, Depends
from typing import Annotated

router = APIRouter(prefix="/code-challenges", tags=["Code Challenges"])

# Challenge CRUD
@router.post("/", response_model=ActivityRead)
async def create_code_challenge(...)  # Creates Activity with TYPE_CODE_CHALLENGE

@router.get("/{activity_uuid}", response_model=CodeChallengeRead)
async def get_code_challenge(...)

@router.patch("/{activity_uuid}", response_model=CodeChallengeRead)
async def update_code_challenge(...)

# Submissions
@router.post("/{activity_uuid}/submit", response_model=SubmissionResponse)
async def submit_code(..., background_tasks: BackgroundTasks)

@router.post("/{activity_uuid}/test", response_model=TestRunResponse)
async def run_visible_tests(...)  # Run only visible tests

@router.post("/{activity_uuid}/custom-test", response_model=CustomTestResponse)
async def run_custom_test(...)  # User-provided input

@router.get("/{activity_uuid}/submissions", response_model=list[SubmissionRead])
async def get_submission_history(...)

@router.get("/submissions/{submission_uuid}", response_model=SubmissionDetail)
async def get_submission_detail(...)

# Analytics
@router.get("/{activity_uuid}/analytics/{user_id}", response_model=StudentAnalytics)
async def get_student_analytics(...)

@router.get("/{activity_uuid}/analytics", response_model=InstructorAnalytics)
async def get_challenge_analytics(...)  # Instructor only

# Leaderboard
@router.get("/{activity_uuid}/leaderboard", response_model=LeaderboardRead)
async def get_leaderboard(...)

# Test Cases
@router.post("/{activity_uuid}/test-cases/bulk", response_model=list[TestCaseRead])
async def import_test_cases(...)  # CSV/JSON import
```

**Background Tasks**:

- `process_judge0_batch_submission()`: Poll Judge0, update DB
- `calculate_submission_score()`: Apply grading strategy
- `award_challenge_xp()`: Integrate with gamification system
- `check_plagiarism()`: Run MOSS similarity check (optional)
- `update_leaderboard_cache()`: Refresh Redis leaderboard
- `cleanup_old_submissions()`: Archive submissions >6 months (configurable)

#### State Management

**Client-Side State** (React Server Components + Client Components):

```tsx
// Server Component (page.tsx) - fetches initial data
export default async function CodeChallengePage({ params }) {
  const activity = await fetchActivity(params.activityuuid);
  return <CodeChallengeEditor activity={activity} />;
}

// Client Component - handles interactive state
'use client';
export function CodeChallengeEditor({ activity }) {
  const [code, setCode] = useState(activity.starterCode);  // Auto-save to localStorage
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(activity.allowedLanguages[0]); // C by default

  // SWR for real-time submission status
  const { data: submission, error } = useSWR(
    submissionUuid ? `/api/submissions/${submissionUuid}` : null,
    { refreshInterval: 1000 }  // Poll every 1s while processing
  );
}
```

- **Loading States**:
  - Global: Suspense boundaries with skeleton loaders
  - Submissions: isSubmitting, isRunningTests, isPlagiarismChecking
  - Buttons: disabled state with spinner

- **Error Handling**:
  - Error boundaries at page level (existing global-error.tsx)
  - Retry mechanism: Exponential backoff with max 3 retries
  - User-friendly error messages with action buttons
  - Toast notifications for non-critical errors (sonner)

- **Real-time Updates**:
  - SWR polling during submission processing
  - Optional: Server-Sent Events for live leaderboard updates
  - WebSocket avoided (keep architecture simple)

- **Optimistic Updates**:
  - Code editor auto-save (debounced 2s)
  - Test case management (add/edit immediately, sync in background)
  - Submission list (append immediately, update on confirmation)

### 8. Error Handling & Edge Cases

#### User-Facing Errors

**Error Display Component** (`apps/web/components/features/courses/CodeErrorDisplay.tsx`):

```tsx
interface ErrorDisplayProps {
  type: 'compilation' | 'runtime' | 'tle' | 'mle' | 'network' | 'judge0';
  message: string;
  details?: {
    line?: number;
    column?: number;
    stderr?: string;
    stdout?: string;
  };
}

// Usage
<CodeErrorDisplay
  type="compilation"
  message="Compilation failed"
  details={{
    line: 15,
    stderr: sanitizedStderr
  }}
/>
```

- **Error Types**:
  - **Compilation**: Parse stderr for line/column, highlight in Monaco editor
  - **Runtime**: Sanitize stack trace (remove system paths), show exit code
  - **TLE/MLE**: Show resource usage chart, suggest optimizations
  - **Invalid Input**: Validation errors with specific field highlighting
  - **Network**: Retry button with countdown, offline indicator
  - **Judge0 Down**: Fallback message, admin notification sent

#### System Errors

**Health Check** (`apps/api/src/services/code_challenges/health.py`):

```python
import httpx
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

async def check_judge0_health() -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://judge0_server:2358/config_info")
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Judge0 health check failed: {e}")
        return False

@router.post("/submit")
async def submit_code(...):
    if not await check_judge0_health():
        # Fallback: Save submission as "pending_manual_review"
        # Send notification to instructors
        raise HTTPException(
            status_code=503,
            detail="Code execution service temporarily unavailable. Your submission has been saved for manual review."
        )
```

- **Graceful Degradation**:
  - Judge0 down → Save submissions with status "pending_judge0"
  - Background job retries every 5 minutes for 24 hours
  - Instructor notification via existing notification system

- **Monitoring**:
  - Health checks every 60s (background task)
  - Metrics: submission queue length, avg execution time, error rate
  - Logs: Structured JSON logs to apps/api/logs/code_challenges.log
  - Alerts: Integration with existing admin notification system

### 9. Performance Optimizations

- **Caching Strategy** (Redis):

  ```python
  # Cache keys
  SUBMISSION_CACHE = "code_challenge:submission:{sha256}:{language_id}:{test_id}"  # TTL: 1h
  LANGUAGES_CACHE = "code_challenge:languages"  # TTL: 24h
  LEADERBOARD_CACHE = "code_challenge:leaderboard:{activity_uuid}"  # TTL: 5m
  USER_RATE_LIMIT = "code_challenge:ratelimit:{user_id}"  # TTL: 60s
  ```

  - Submission results cached by code hash + language + test input
  - Judge0 languages list cached (refreshed daily)
  - Leaderboards cached with 5min TTL, invalidated on new high score
  - Challenge configurations cached until updated

- **Database Optimization**:

  ```sql
  -- Alembic migration
  CREATE INDEX idx_code_submissions_user_activity ON code_submissions(user_id, activity_id, created_at DESC);
  CREATE INDEX idx_code_submissions_score ON code_submissions(activity_id, score DESC, created_at ASC);
  CREATE INDEX idx_code_submissions_created ON code_submissions(created_at);
  ```

  - Pagination: 20 submissions per page (use cursor-based for large datasets)
  - Archival: Move submissions >1 year to cold storage table
  - Source code compression: Use ZSTD before storing in DB

- **Judge0 Optimization**:
  - HTTP/2 connection pooling via httpx (max 10 concurrent connections)
  - Batch API: Submit up to 20 tests per request
  - Worker scaling: docker-compose scale judge0_workers=4 (adjust per load)
  - Configuration (judge0.conf):

    ```
    ENABLE_COMPILER_OPTIONS=true
    ENABLE_WAIT_RESULT=true  # Synchronous for custom tests
    MAX_QUEUE_SIZE=200
    ```

### 10. Testing Strategy

#### Unit Tests (Pytest)

**File**: `apps/api/src/tests/test_code_challenges.py`

```python
import pytest
from src.services.code_challenges.grading import calculate_score
from src.services.code_challenges.sanitize import sanitize_code

def test_score_calculation_partial_credit():
    results = [
        {"passed": True, "weight": 2},
        {"passed": False, "weight": 1},
        {"passed": True, "weight": 1}
    ]
    assert calculate_score(results, "PARTIAL_CREDIT") == 75.0

def test_code_sanitization():
    malicious = "import os\nos.system('rm -rf /')"
    # Should not remove valid imports, only sanitize for display
    assert sanitize_code(malicious) is not None

def test_judge0_status_mapping():
    assert Judge0Status.from_code(3) == Judge0Status.ACCEPTED
```

#### Integration Tests

**File**: `apps/api/src/tests/test_judge0_integration.py`

```python
@pytest.mark.asyncio
async def test_judge0_submission_flow():
    # Requires Judge0 running
    service = Judge0Service()
    tokens = await service.create_batch_submission([{
        "source_code": base64.b64encode(b"print('Hello')").decode(),
        "language_id": 71,  # Python
        "stdin": ""
    }])
    assert len(tokens) == 1

    results = await service.poll_batch_results(tokens)
    assert results[0]["status"]["id"] == 3  # Accepted
```

## Security Considerations

1. **Input Validation**:

   ```python
   from pydantic import Field, validator

   class CodeSubmission(PydanticStrictBaseModel):
       source_code: str = Field(max_length=10_485_760)  # 10MB max
       language_id: int = Field(ge=1, le=100)

       @validator('source_code')
       def sanitize_code(cls, v):
           # Remove null bytes, limit lines
           if '\x00' in v:
               raise ValueError('Invalid characters in code')
           if v.count('\n') > 10000:
               raise ValueError('Code exceeds line limit')
           return v
   ```

2. **Authentication & Authorization**:

   ```python
   # Reuse existing auth system
   async def check_challenge_access(
       activity_uuid: str,
       user: PublicUser,
       db: Session,
       required_role: str = "student"
   ):
       # Check enrollment, role, activity published status
       # Integration with src/security/auth.py
   ```

3. **Rate Limiting** (existing slowapi integration):

   ```python
   from slowapi import Limiter
   from slowapi.util import get_remote_address

   limiter = Limiter(key_func=get_remote_address)

   @router.post("/submit")
   @limiter.limit("10/minute")  # 10 submissions per minute
   async def submit_code(...)
   ```

4. **Code Sandboxing**:
   - Judge0 runs in privileged Docker container
   - Isolation: separate network namespace, read-only filesystem
   - Never execute user code on API server (only Judge0 workers)

5. **Secure Storage**:
   - Source code: Base64 encoded + ZSTD compressed in DB
   - Sensitive fields: Reference solutions encrypted with Fernet
   - No PII in logs (user_id only, not names/emails)

6. **Audit Logging**:

   ```python
   logger.info("Code submission", extra={
       "user_id": user.id,
       "activity_uuid": activity_uuid,
       "language_id": language_id,
       "score": score,
       "timestamp": datetime.utcnow().isoformat()
   })
   ```

   - All submissions logged to apps/api/logs/code_challenges.log
   - Grade changes tracked with instructor_id and justification
   - Plagiarism scores logged separately for privacy

## Integration Points

### UI/UX Consistency

- **Design System**: Shadcn components (Button, Dialog, Select, Table, Badge, etc.)
- **Color Palette**: Match existing theme (CSS variables from styles/)
- **Typography**: Use existing font stack (lib/fonts.ts)
- **Icons**: lucide-react (existing dependency)
- **Animations**: motion library (existing dependency)

### Architecture Patterns

- **Routing**: Next.js 16 App Router with Server Components

  ```tsx
  // Server Component (default)
  export default async function CodeChallengePage({ params }) {
    const activity = await fetchActivity(params.activityuuid);
    return <ClientCodeEditor activity={activity} />;
  }

  // Client Component (mark explicitly)
  'use client';
  export function ClientCodeEditor({ activity }) {
    const [code, setCode] = useState(activity.starterCode);
    // ...
  }
  ```

- **Data Fetching**: Server-side fetch in RSC, SWR for client polling
- **Forms**: react-hook-form + zod validation (existing pattern)

### Localization (next-intl)

**Usage**:

```tsx
import { useTranslations } from 'next-intl';

export function CodeEditor() {
  const t = useTranslations('Activities.CodeChallenges.editor');
  return <Button>{t('submit')}</Button>;
}
```

### Gamification Integration

```python
# Award XP on challenge completion
from src.services.gamification import service as gamification_service

await gamification_service.award_xp(
    db=db,
    user_id=user.id,
    org_id=org_id,
    source=XPSource.CODE_CHALLENGE_COMPLETION,
    source_id=str(activity_id),
    amount=50 if score >= 70 else 25,  # Higher XP for passing
    idempotency_key=f"code_challenge_{submission_uuid}"
)
```
