import { useContext } from "react";
import { ThresholdsContext } from "../context/thresholds";

// Institution-defined thresholds (mastery, At-Risk rules, AI review threshold, ...).
export function useThresholds() {
  return useContext(ThresholdsContext);
}
