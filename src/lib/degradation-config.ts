/**
 * Degradation alert tuning — shared by evaluateDegradation() and UI that shows
 * the same rolling windows (keep numbers aligned).
 */
export const DEGRADATION_RECENT_WINDOW = 7;
export const DEGRADATION_BASELINE_WINDOW = 40;
export const DEGRADATION_BASELINE_MIN_SAMPLES = 20;
/** Recent avg must exceed baseline P75 × this (and MIN_RECENT_MS) to count as degraded. */
export const DEGRADATION_ENTER_RATIO = 2.85;
/** After an alert, episode clears only when recent avg falls below baseline × this. */
export const DEGRADATION_CLEAR_RATIO = 1.75;
/** Consecutive degraded checks before emailing. */
export const DEGRADATION_CONFIRM_COUNT = 5;
/** Recent avg must be at least this many ms to count as degraded (avoids noisy ratio spikes on very fast endpoints). */
export const DEGRADATION_MIN_RECENT_MS = 450;
