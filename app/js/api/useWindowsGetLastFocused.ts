import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const WINDOWS_LAST_FOCUSED_QUERY_KEY = ["windowsLastFocusedQuery"] as const;

/**
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/getLastFocused
 */
export default function useWindowsGetLastFocused() {
  const queryClient = useQueryClient();
  useEffect(() => {
    function invalidateQuery() {
      queryClient.invalidateQueries({ queryKey: WINDOWS_LAST_FOCUSED_QUERY_KEY });
    }
    chrome.windows.onFocusChanged.addListener(invalidateQuery);
    return () => {
      chrome.windows.onFocusChanged.removeListener(invalidateQuery);
    };
  }, [queryClient]);
  return useQuery({
    queryFn: () => chrome.windows.getLastFocused(),
    queryKey: WINDOWS_LAST_FOCUSED_QUERY_KEY,
  });
}
