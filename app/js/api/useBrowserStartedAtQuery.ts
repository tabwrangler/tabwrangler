import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const BROWSER_STARTED_AT_QUERY_KEY = ["browserStartedAtQuery"] as const;

export default function useBrowserStartedAtQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: chrome.storage.AreaName,
    ) {
      if (areaName === "local" && "browserStartedAt" in changes)
        queryClient.invalidateQueries({ queryKey: BROWSER_STARTED_AT_QUERY_KEY });
    }
    chrome.storage.onChanged.addListener(handleChanged);
    return () => chrome.storage.onChanged.removeListener(handleChanged);
  }, [queryClient]);

  return useQuery({
    queryFn: async () => {
      const { browserStartedAt } = await chrome.storage.local.get<{ browserStartedAt?: number }>(
        "browserStartedAt",
      );
      return browserStartedAt ?? null;
    },
    queryKey: BROWSER_STARTED_AT_QUERY_KEY,
  });
}
