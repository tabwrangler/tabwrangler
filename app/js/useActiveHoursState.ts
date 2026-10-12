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

  useEffect(() => {
    function refresh() {
      setNow(Date.now());
    }
    // `now` is stale when the schedule changes, so refresh it right away too.
    const timeouts = [window.setTimeout(refresh, 0)];
    if (state.nextChangeAt != null)
      timeouts.push(window.setTimeout(refresh, state.nextChangeAt - Date.now()));
    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
  }, [activeHours, state.nextChangeAt]);

  return { ...state, now };
}
