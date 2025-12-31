# Production-Ready Coding Activity System

## Overview

A comprehensive coding assessment system integrated with Judge0, enabling instructors to create coding challenges and students to submit, test, and receive automated feedback on their solutions.

## Core Components

### 1. Activity Type Definition

- **Activity Type**: "Code Challenge"
- **Key Characteristics**:
  - Supports all programming languages provided by judge0
  - Automated testing via Judge0
  - Hidden and visible test cases
  - Time and memory limit enforcement
  - Real-time feedback
  - Multiple submission attempts with history
  - Anti-cheating measures (submission timestamps)

### 2. Instructor Interface (Challenge Creation)

#### Challenge Configuration

- **Basic Settings**:
  - Title and description (supports Markdown/rich text)
  - Difficulty level (Easy/Medium/Hard)
  - Tags/categories for organization
  - Points/weight for grading
  - Due date and late submission policies
  - Allowed programming languages (multi-select from Judge0 supported languages)

- **Code Setup**:
  - Problem statement with examples
  - Input/output format specifications
  - Constraints and edge cases
  - Starter code templates per language (optional)
  - Solution code (for reference, not shown to students)

- **Test Case Management**:
  - **Visible Test Cases** (shown to students):
    - Input data
    - Expected output
    - Description/hint
  - **Hidden Test Cases** (validation only):
    - Input data
    - Expected output
    - Weight/points allocation
  - Bulk import via CSV/JSON
  - Test case grouping (e.g., basic, edge cases, performance)

- **Execution Settings**:
  - Time limit per test case (seconds)
  - Memory limit (MB)
  - Custom Judge0 configuration overrides
  - Enable/disable custom input testing by students

- **Grading Configuration**:
  - Grading strategy:
    - All or nothing (pass all tests)
    - Partial credit (weighted by test cases)
    - Best submission
    - Latest submission
  - Auto-grading thresholds
  - Manual review flag for edge cases

### 3. Student Interface (Challenge Submission)

#### Code Editor

- **Editor Features**:
  - Syntax highlighting (Monaco Editor or CodeMirror,highlight.js or lowlight)
  - Auto-completion
  - Language selection dropdown
  - Theme toggle (light/dark)
  - Font size adjustment
  - Line numbers and code folding
  - Keyboard shortcuts
  - Auto-save to local storage (prevent loss)

#### Testing & Submission Flow

1. **Pre-submission Testing**:
   - "Run Tests" button (runs visible test cases only)
   - "Custom Input" tab for ad-hoc testing (If allowed by instructor)
   - Real-time output display with:
     - Execution status (Accepted, Wrong Answer, TLE, MLE, Runtime Error, Compilation Error)
     - Actual output vs expected output (for visible tests)
     - Execution time and memory usage
     - Compiler errors/warnings
     - Stack traces (sanitized)

2. **Submission**:
   - "Submit Solution" button (runs all test cases)
   - Submission confirmation dialog
   - Loading state with progress indicator
   - Results display:
     - Overall score/percentage
     - Per test case results (visible tests detailed, hidden tests summary)
     - Pass/fail status with color coding
     - Detailed feedback per failed test
     - Execution statistics

3. **Submission History**:
   - List of all previous submissions
   - Timestamp, language, score for each
   - View code diff between submissions
   - Highlight best submission
   - Re-run previous submission option

### 4. Judge0 Integration Layer

#### Submission Pipeline

```
Student Code → Pre-processing → Judge0 API → Post-processing → Result Display
```

#### Implementation Details

- **Job Queue System**:
  - Async submission handling (use job queue)
  - Batch submission support for test cases
  - Retry logic with exponential backoff
  - Timeout handling (if Judge0 is slow/down)
  - Rate limiting per student

- **Judge0 API Calls**:
  - Create submission endpoint
  - Batch creation
  - Get results
  - Poll for completion with configurable intervals
  - Handle Judge0 status codes:
    - Queue (1-2): In progress
    - Accepted (3): Correct
    - Wrong Answer (4): Incorrect
    - Time Limit Exceeded (5)
    - Compilation Error (6)
    - Runtime Error (7-12)
    - Internal Error (13-14)

- **Security Measures**:
  - Code sanitization before submission
  - Execution in isolated environment (Judge0 sandbox)
  - Resource limit enforcement
  - Rate limiting per user (prevent spam)
  - Source IP tracking

#### Test Case Execution Strategy

- **Sequential Execution** (default):
  - Stop on first failure (fast feedback)
  - Continue on failure (complete feedback)

- **Parallel Execution** (optional):
  - Batch all test cases to Judge0
  - Aggregate results
  - Faster for many test cases

### 5. Results & Analytics

#### Student View

- **Performance Dashboard**:
  - Completion rate across all challenges
  - Average score
  - Preferred languages
  - Time spent per challenge
  - Comparison with class average (non anonymized for competetiveness!)

#### Instructor View

- **Challenge Analytics**:
  - Submission rate and completion rate
  - Average score and score distribution
  - Most common errors
  - Test cases with highest failure rate
  - Time to complete distribution
  - Language usage statistics

- **Student Performance**:
  - Individual student progress
  - Struggling students identification
  - Plagiarism detection alerts (via external tools like MOSS)
  - Export to CSV/PDF for reporting

### 6. Additional Features

#### Code Review & Feedback

- **Instructor Actions**:
  - View any student submission
  - Add inline comments
  - Override automated grade
  - Request revision
  - Share exemplary solutions (anonymized)

#### Leaderboard

- Real-time ranking based on:
  - Score
  - Completion time
  - Number of attempts
- Filter by challenge, timeframe

#### Hints & Resources

- Progressive hint system (deduct points per hint)
- Link to relevant learning materials
- Discussion forum per challenge
- FAQ section

#### Accessibility

- Keyboard navigation support

### 7. Technical Requirements

#### Frontend Components

- **Pages/Views**:
  - Challenge list/catalog
  - Challenge detail/editor page
  - Submission history page
  - Results/feedback page
  - Instructor challenge creation/edit form
  - Analytics dashboard

- **Reusable Components**:
  - Code editor wrapper
  - Test case result card
  - Submission status indicator
  - Language selector
  - Timer/countdown widget

#### Backend Services

- **API Endpoints** (RESTful):
  - Create challenge
  - Get challenge details
  - Update challenge
  - Submit solution
  - Get submission history
  - Get submission detail
  - Run custom test
  - Get analytics

- **Background Jobs**:
  - Process Judge0 submissions
  - Calculate scores and update grades
  - Generate analytics
  - Clean up old submissions (can be configured in the admin dashboard)

#### State Management

- Loading states (submitting, testing, loading)
- Error states with retry options
- Real-time updates (WebSocket/polling for submission status)
- Optimistic UI updates where appropriate

### 8. Error Handling & Edge Cases

#### User-Facing Errors

- Clear error messages for:
  - Compilation errors (with line numbers)
  - Runtime errors (sanitized stack traces)
  - Time/memory limit exceeded
  - Invalid input format
  - Network/connection issues
  - Judge0 service unavailable

#### System Errors

- Graceful degradation if Judge0 is down
- Fallback to "manual grading required" mode
- Automated alerts to instructors
- Logging and monitoring integration

### 9. Performance Optimizations

- **Caching**:
  - Cache compiled code for repeated submissions
  - Cache test case results for identical code
  - Cache challenge configurations

- **Database Optimization**:
  - Index on submission timestamps, user IDs, challenge IDs
  - Pagination for submission history
  - Archive old submissions

- **Judge0 Optimization**:
  - Connection pooling
  - Batch submissions when possible
  - Configure Judge0 workers appropriately

### 10. Testing Strategy

#### Unit Tests

- Test case validation logic
- Score calculation algorithms
- Code sanitization functions

#### Integration Tests

- Judge0 API integration
- End-to-end submission flow
- Grading pipeline

#### User Testing

- Usability testing with students
- Cross-browser compatibility

## Implementation Phases

### Phase 1: MVP (Minimum Viable Product)

- Basic challenge creation (single language)
- Code editor with Judge0 integration
- Visible test cases only
- Simple submission and results display

### Phase 2: Core Features

- Multiple language support
- Hidden test cases
- Submission history
- Basic analytics
- Integrate with gamification system

### Phase 3: Advanced Features

- Anti-cheating measures
- Instructor code review
- Custom test input
- Partial credit grading

## Security Considerations

1. **Input Validation**: Sanitize all user inputs (code, test cases)
2. **Authentication**: Ensure proper authorization for all actions
3. **Rate Limiting**: Prevent abuse via submission spam
4. **Code Sandboxing**: Rely on Judge0's isolation (never execute user code on main server)
5. **Secure Storage**: Encrypt sensitive data at rest
6. **Audit Logging**: Track all submissions and grade changes

## Integration Points

- Use consistent UI/UX patterns
- Use shadcn-ui components and design system
- Use server components
- Localize using next-intl
