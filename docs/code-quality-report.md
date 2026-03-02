# Code Quality Report — High-ROI Issues

## TIER 3 — Medium Effort, Significant Long-term Gains

### 10. Massive monolithic components

**Effort: L | Gain: maintainability, testability, performance**

Several components massively exceed reasonable limits, making them hard to review, test, and reason about:

| File                           | Lines |
| ------------------------------ | ----- |
| `OrgEditLanding.tsx`           | 2078  |
| `UserProfileBuilder.tsx`       | 1674  |
| `activity.tsx` (activity page) | 1564  |
| `TaskQuizObject.tsx`           | 1487  |
| `VideoActivityModal.tsx`       | 1254  |

**Fix**: Apply the Single Responsibility Principle. Split by feature section. Each sub-component should be independently importable and testable. A target of ~500 lines per component is reasonable.

---
