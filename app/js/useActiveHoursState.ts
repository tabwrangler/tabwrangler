import { type ActiveHoursState, getActiveHoursState } from "./activeHours";
import { useEffect, useState } from "react";
import useSetting from "./useSetting";

/**
 * Returns whether Tab Wrangler is within active hours, re-rendering when that changes.
 */
export default function useActiveHoursState(): ActiveHoursState & { now: number } {
  const activeHours = useSetting("activeHours");
  const [now, setNow] = useState(() => Date.now());
  const state = getActiveHoursState(now, activeHours);

  // `now` is stale when the schedule changes, so refresh it right away.
  useEffect(() => {
    const timeout = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timeout);
  }, [activeHours]);

  // Re-armed after every refresh because a timer can fire before `nextChangeAt` by the wall clock,
  // like when the clock is set back, and refreshing then changes nothing else.
  useEffect(() => {
    if (state.nextChangeAt == null) return undefined;
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, state.nextChangeAt - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [now, state.nextChangeAt]);

  return { ...state, now };
}
