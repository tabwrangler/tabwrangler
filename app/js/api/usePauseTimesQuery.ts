import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const PAUSE_TIMES_QUERY_KEY = ["pauseTimesQuery"] as const;

/**
 * Returns when the extension was paused on this device and when the browser became idle. Tab
 * timers do not count down after either time.
 */
export default function usePauseTimesQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: chrome.storage.AreaName,
    ) {
      if (areaName === "local" && ("idleAt" in changes || "pausedAt" in changes))
        queryClient.invalidateQueries({ queryKey: PAUSE_TIMES_QUERY_KEY });
    }
    chrome.storage.onChanged.addListener(handleChanged);
    return () => chrome.storage.onChanged.removeListener(handleChanged);
  }, [queryClient]);

  return useQuery({
    queryFn: () =>
      chrome.storage.local.get<{ idleAt: number | null; pausedAt: number | null }>({
        idleAt: null,
        pausedAt: null,
      }),
    queryKey: PAUSE_TIMES_QUERY_KEY,
  });
}
