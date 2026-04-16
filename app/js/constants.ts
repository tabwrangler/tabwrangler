export const CHECK_TO_CLOSE_INTERVAL_MS = 5_000;

/**
 * When the active tab in the last-focused window is within this many seconds of auto-closing,
 * no "frozen" message is shown because the tab may auto-close. This is a heuristic based on the
 * `checkTcClose` interval.
 */
export const ACTIVE_TAB_TIMER_FREEZE_WINDOW_MS = CHECK_TO_CLOSE_INTERVAL_MS * 2;
