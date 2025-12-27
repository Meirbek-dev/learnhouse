# Quiz Module Improvement Plan ✅

A focused plan to improve the Quiz module: make authoring easier, improve reliability and grading
accuracy, add richer student UX, increase test coverage, and enable analytics + caching for scale.
This document contains scope, proposed changes (frontend & backend), data and API changes, testing
plan, rollout timeline, success metrics, and risks.

---

## Goals 🎯

- **Reliability & Scalability:** Ensure consistent grading, idempotent submissions, and scalable
  endpoints (caching + rate limits).
- **Observability:** Track attempts, success rates, time-to-complete, and per-question stats for
  analytics.
- **Maintainability:** Clear APIs, database schema, and tests to make future changes low-risk.

---

## Current State (brief) 🔍

- Quiz block exists in editor (`QuizBlock`, `QuizBlockComponent`) with client-side question
  management.
- Server endpoint for quiz submissions at `POST /api/v1/blocks/quiz/{activity_id}`
  (`apps/web/services/blocks/Quiz/quiz.ts` → `apps/api` handler).
- Frontend and backend use simple JSON payloads; limited analytics and light validation.

---

## Key Pain Points / Issues ⚠️

- No robust client/server validation for question/answer formats; inconsistent error handling.
- Submission idempotency and retry semantics not clearly handled (risk of duplicate submissions or
  double grading).
- Limited analytics (no per-question item stats, no time metrics for quizzes).
- Missing server-side grading test matrix (randomized options, multiple correct answers, partial
  credit).
- Media-heavy quizzes could cause slow save/submit operations and poor UX on mobile.

---

## Proposed Improvements (high-level) 💡

1. UX / Editor
   - Enhance `QuizBlockComponent` UI: provide question templates, drag to reorder, duplicate
     question, preview mode for students, and import/export JSON.
   - Add validation UI for required fields and inconsistent answer configs.
   - Save drafts and autosave in editor.

2. Frontend behavior
   - Implement optimistic UI + server confirmation for submissions; show a clear pending state and
     allow retry.
   - Add progress/time tracking per quiz (start/end timestamps) to payloads.
   - Improve accessibility (keyboard navigation, ARIA attributes, screen reader text).

3. Backend API / validation
   - Strengthen validation on `POST /blocks/quiz/{activity_id}`: schema validation (Zod or
     Pydantic), consistent error codes, and payload versioning (v1/v2 payloads if breaking changes
     needed).
   - Add idempotency support via optional `idempotency_key` on submissions to prevent
     double-processing.
   - Accept and store timing metrics and per-question timestamps.

4. Grading
   - Move canonical grading logic server-side to a single, well-tested function (handles multiple
     correct, partial credit, negative scoring, randomized option order).
   - Return structured grading result: total score, per-question feedback, triggered events (e.g.,
     award XP via gamification).

5. Analytics & Observability
   - Store per-question stats and attempt metadata in `quiz_attempts` and `quiz_question_stats`
     tables.
   - Emit events for attempts (for later aggregation and streaming to e.g., analytics DB).

6. Performance & Caching
   - Ensure submission handler is idempotent and fast; cache static quiz definitions (e.g.,
     `revalidate_tag` approach used in `submitQuizBlock`).
   - Protect heavy endpoints with rate limits.

7. Security & Integrity
   - Verify user rights (`courses_rbac_check`) before allowing submissions for graded quizzes.
   - Sanitize any rich content in questions to prevent XSS in quiz preview or student view.

---

## Phases (recommended rollout)

Break the work into clear phases to reduce risk and enable incremental delivery. Each phase should
have a short validation checklist and a demoable artifact.

- Phase 1 — Backend Foundations (1–2 sprints)
  - Goals: add `quiz_attempt` and `quiz_question_stat` migrations, implement canonical grading
    function, and add idempotency handling.
  - Outputs: migrations, server grading module, unit tests (grading matrix), basic attempts
    endpoint.

- Phase 2 — Submission UX & Client Integration (1 sprint)
  - Goals: wire frontend to backend, implement optimistic/pending UX, start/end timestamps,
    idempotency-key generation, and autosave drafts.
  - Outputs: editor autosave, preview mode, submission UI with pending/retry, and client-side
    validation using Zod.

- Phase 4 — Advanced Features & Anti-cheat (1 sprint)
  - Goals: add anti-copy measures (configurable), single-question serving (optional),
    timing/enforcement, violation manager, and attempt-limits/time-limits per course settings.
  - Outputs: `useTestGuard` integration, server-side enforcement of attempt/time limits, and teacher
    UI for restrictions.
-
- Phase 5 — QA, Load Testing & Rollout (1–2 sprints)
  - Goals: finalize monitoring, finish automated grading edge-case tests, and perform staged rollout
    (feature flag / org opt-in).
  - Outputs: load test reports, dashboards, migration applied in staging, and rollback plan.

- Phase 6 — Monitor & Iterate (ongoing)
  - Goals: monitor metrics, gather instructor/student feedback, fix bugs, and iterate on UX and
    analytics queries.
  - Outputs: regular metrics reviews, and iterative improvements.

---

## Data Model & API Changes (concrete) 🔧

- DB additions (migrations)
  - `quiz_attempt` table: id, user_id, activity_id, attempt_uuid, start_ts, end_ts, score, duration,
    idempotency_key, created_at.
  - `quiz_question_stat` table: activity_id, question_id, attempts, correct_count, avg_time_seconds.

- API
  - POST /api/v1/blocks/quiz/{activity_id}
    - Request: { answers: [...], start_ts?, end_ts?, idempotency_key? }
    - Response: { total_score, per_question: [{ question_id, correct, score, feedback }],
      triggered_level_up?, awards? }
  - GET /api/v1/blocks/quiz/{activity_id}/attempts → list attempts, pagination (teachers only)
  - GET /api/v1/blocks/quiz/{activity_id}/stats → aggregated stats (teachers/org admins)

- Contracts
  - Use a Zod schema on frontend `transactions.ts` and server Pydantic/Zod schemas in API to avoid
    mismatches.

---

## Acceptance Criteria / Success Metrics ✅

- Grading consistency: Server-side grading unit tests cover at least 95% of logical permutations and
  pass in CI.
- Reliability: Duplicate submissions are prevented by `idempotency_key` behavior (integration test
  included).
- Performance: Average submission latency < 300ms under normal load (measured in staging), and 95th
  percentile < 1s.
- Analytics: Per-question stats are recorded and accessible via the new stats API.
- Accessibility: Score of 90+ on automated accessibility check for quiz components.

---

## Tasks (sprint-ready) ✅

- Backend
  - [ ] Add migrations: `quiz_attempt`, `quiz_question_stat` (owner: @backend)
  - [ ] Implement server grading function + unit tests (owner: @backend)
  - [ ] Add idempotency key handling + integration tests (owner: @backend)
  - [ ] Add stats API endpoints + permissions (owner: @backend)

- Frontend
  - [ ] Autosave draft + preview mode (owner: @frontend)
  - [ ] Submission UX: pending state, optimistic update, timings (owner: @frontend)
  - [ ] Accessibility improvements (owner: @frontend)

- QA & Ops
  - [ ] Add load tests for submission endpoint (owner: @ops)
  - [ ] Add dashboards: submission latency, attempts, errors (owner: @ops)

---

## Risks & Mitigation ⚠️

- Don't leave any legacy code
- No need for backward compat, just write an alembic migration (use "uv run alembic autogenerate")
- Increased DB write volume: use batched writes for stats, and a write-ahead queue if needed.

---

Добавь возможность чтобы автор курса мог ограничить количество попыток теста, ограничить время
прохождения теста, отсчёт начинается после нажатия на кнопку старта теста. Добавь возможность делать
так, чтобы после использования последующих попыток максимальный возможный балл можно было ограничить
(например если набрал 100 баллов, но со второй попытки, то баллы все равно будут ограничены
значением указанным преподавателем, например 70)

Ограничь копирование и выделение текста в тестах. Задача — **усложнить и отбить массовое
копирование**. Используй tailwind, где возможно

---

## 1. Запрет выделения текста (CSS)

Самый простой и эффективный базовый слой.

```css
.no-select {
  user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
}
```

```tsx
<div className="no-select">Текст вопроса теста</div>
```

⚠️ Минус: через DevTools текст всё равно доступен.

---

## 2. Блокировка копирования / вставки / контекстного меню (JS)

### React / Next.js (Client Component)

```tsx
'use client';

import { useEffect } from 'react';

export default function AntiCopyWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();

    document.addEventListener('copy', prevent);
    document.addEventListener('cut', prevent);
    document.addEventListener('paste', prevent);
    document.addEventListener('contextmenu', prevent);

    return () => {
      document.removeEventListener('copy', prevent);
      document.removeEventListener('cut', prevent);
      document.removeEventListener('paste', prevent);
      document.removeEventListener('contextmenu', prevent);
    };
  }, []);

  return <div>{children}</div>;
}
```

Использование:

```tsx
<AntiCopyWrapper>
  <TestContent />
</AntiCopyWrapper>
```

---

## 3. Перехват горячих клавиш (Ctrl+C, Ctrl+A, Ctrl+U)

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['c', 'a', 'u', 's'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  };

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []);
```

Блокирует:

- Ctrl + C (копирование)
- Ctrl + A (выделить всё)
- Ctrl + U (view source)
- Ctrl + S (сохранить)

---

## 4. Рендер текста как HTML Canvas (очень эффективно)

**Один из лучших вариантов для тестов.** Текст становится _пикселями_, а не DOM.

### Пример

```tsx
'use client';

import { useEffect, useRef } from 'react';

export function CanvasText({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 120;

    ctx.font = '18px Arial';
    ctx.fillStyle = '#000';
    ctx.fillText(text, 10, 50);
  }, [text]);

  return <canvas ref={ref} />;
}
```

```tsx
<CanvasText text="Сколько будет 2 + 2?" />
```

✅ Нельзя выделить ✅ Нельзя скопировать ❌ Нельзя искать текст ❌ OCR всё равно возможен

---

## 5. Серверная защита (обязательно)

Даже если фронт «закрыт», **данные нельзя отдавать открыто**.

### Рекомендации

- Загружать вопросы **по одному**
- Отдавать **временные токены**
- Логировать:
  - уход со страницы
  - потерю фокуса
  - resize / devtools open

- Ограничивать время ответа

---

## 6. Детект открытия DevTools (опционально)

```tsx
useEffect(() => {
  const threshold = 160;
  const check = () => {
    if (
      window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold
    ) {
      console.warn('DevTools detected');
    }
  };

  const interval = setInterval(check, 1000);
  return () => clearInterval(interval);
}, []);
```

⚠️ Использовать **только как сигнал**, не как блокировку.

---

## 7. Лучший реальный стек для LMS (рекомендую)

**Комбинация:**

1. `user-select: none`
2. JS-блокировка copy / contextmenu
3. Canvas для текста вопросов
4. Серверный контроль сессии
5. Таймер + one-question-per-request

👉 Именно так делают Coursera / Stepik / Udemy (с вариациями).

---

Ниже — **строгая, но реалистичная схема**, которую используют LMS и онлайн-экзамены.

---

## 1. Модель нарушений (база)

### Что считаем нарушением

1. Потеря фокуса вкладки / переход с страницы
2. Открытие DevTools
3. Попытка копирования / выделения (опционально)
4. Resize окна (часто признак DevTools)

### Правила, которые может задавать преподаватель при создании и редактировании теста

Например:

- **1-е нарушение** → предупреждение
- **2-е нарушение** → блок теста + серверная фиксация

---

# 2. Центральный менеджер нарушений (React Hook)

```tsx
'use client';

import { useEffect, useRef } from 'react';

type ViolationType = 'BLUR' | 'DEVTOOLS' | 'COPY' | 'RESIZE';

export function useTestGuard({
  onViolation,
  maxViolations = 2,
}: {
  onViolation: (type: ViolationType, count: number) => void;
  maxViolations?: number;
}) {
  const violations = useRef(0);
  const locked = useRef(false);

  const report = (type: ViolationType) => {
    if (locked.current) return;

    violations.current += 1;
    onViolation(type, violations.current);

    if (violations.current >= maxViolations) {
      locked.current = true;
    }
  };

  return {
    report,
    isLocked: () => locked.current,
    count: () => violations.current,
  };
}
```

---

# 3. Запрет ухода со страницы / смены вкладки

```tsx
useEffect(() => {
  const onBlur = () => report('BLUR');
  const onVisibility = () => {
    if (document.hidden) report('BLUR');
  };

  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}, []);
```

✔️ Ловит:

- Alt+Tab
- Смена вкладки
- Сворачивание браузера

---

# 4. Детект DevTools (лучший из доступных)

```tsx
useEffect(() => {
  const threshold = 160;

  const checkDevTools = () => {
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;

    if (widthDiff > threshold || heightDiff > threshold) {
      report('DEVTOOLS');
    }
  };

  const interval = setInterval(checkDevTools, 1000);
  return () => clearInterval(interval);
}, []);
```

---

# 5. Блокировка copy / context menu / горячих клавиш

```tsx
useEffect(() => {
  const prevent = (e: Event) => {
    e.preventDefault();
    report('COPY');
  };

  const keydown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['c', 'a', 'u', 's', 'p'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      report('COPY');
    }
  };

  document.addEventListener('copy', prevent);
  document.addEventListener('contextmenu', prevent);
  document.addEventListener('keydown', keydown);

  return () => {
    document.removeEventListener('copy', prevent);
    document.removeEventListener('contextmenu', prevent);
    document.removeEventListener('keydown', keydown);
  };
}, []);
```

---

# 6. Предупреждение перед закрытием страницы

```tsx
useEffect(() => {
  const beforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };

  window.addEventListener('beforeunload', beforeUnload);
  return () => window.removeEventListener('beforeunload', beforeUnload);
}, []);
```

---

# 7. Финальный компонент `TestGuard`

```tsx
'use client';

import { useTestGuard } from './useTestGuard';

export function TestGuard({ children }: { children: React.ReactNode }) {
  const { report, isLocked, count } = useTestGuard({
    onViolation: (type, count) => {
      console.warn(`Violation ${type}, count: ${count}`);

      // 🔒 Серверная фиксация
      fetch('/api/test/violation', {
        method: 'POST',
        body: JSON.stringify({ type, count }),
      });

      if (count >= maxViolations) {
        fetch('/api/test/lock', { method: 'POST' });
        alert('Тест заблокирован из-за повторного нарушения.');
        window.location.href = '/test/locked';
      } else {
        alert('Предупреждение! Повторное нарушение заблокирует тест.');
      }
    },
  });

  if (isLocked()) {
    return <div>Тест заблокирован</div>;
  }

  return <div className="no-select">{children}</div>;
}
```

---

# 8. Сервер (FastAPI — обязательно)

❗ **Никогда не полагайся только на фронт**

Минимум:

- Хранить `violation_count`
- Проверять **перед каждым вопросом**
- Блокировать токен теста

```py
if violation_count >= max_violations:
    raise HTTPException(403, "Test locked")
```

---

# 9. Что реально невозможно запретить

| Действие      | Можно ли |
| ------------- | -------- |
| Screenshot    | ❌       |
| Телефон       | ❌       |
| OCR           | ❌       |
| DevTools 100% | ❌       |

Поэтому: 👉 **один вопрос за запрос** 👉 **рандомизация** 👉 **таймер** 👉 **логирование**

---

# 10. Итог — рекомендуемый уровень защиты

**Production LMS:**

- Canvas / non-select
- Focus + visibility guard
- DevTools detection
- X strikes → lock
- Серверная валидация
- Таймер
