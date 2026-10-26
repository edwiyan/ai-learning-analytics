import { createContext } from "react";

// Defaults match backend/services/institution_settings.py; the values in force are
// loaded from /institution-settings/ after sign-in (BTECH can change them).
export const DEFAULT_THRESHOLDS = {
  mastery_threshold: 75,
  at_risk_min_gaps: 3,
  grade_decline_pct: 15,
  excelling_avg: 85,
  proficient_threshold: 85,
  mapping_review_threshold: 0.75,
  mapping_auto_accept: false,
  early_warning_period: "prelim",
  intervention_target_school_days: 5,
};

export const ThresholdsContext = createContext({ ...DEFAULT_THRESHOLDS, refresh: () => {} });
