// Shared labels/helpers for the approval review dialogs (components/ApprovalReview.jsx).

export const PERIOD_LABELS = {
  prelim: "Prelim", midterm: "Midterm", semi_final: "Semi-Final", final: "Final",
};

export function courseLine(course) {
  if (!course) return null;
  return `${course.code} — ${course.title}`;
}
