import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const TABS_QUERY_KEY = ["tabsQuery"] as const;

/**
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/query
 */
export default function useTabsQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function invalidateQuery() {
      queryClient.invalidateQueries({ queryKey: TABS_QUERY_KEY });
    }
    chrome.tabs.onActivated.addListener(invalidateQuery);
    chrome.tabs.onCreated.addListener(invalidateQuery);
    chrome.tabs.onMoved.addListener(invalidateQuery);
    chrome.tabs.onRemoved.addListener(invalidateQuery);
    chrome.tabs.onUpdated.addListener(invalidateQuery);
    return () => {
      chrome.tabs.onActivated.removeListener(invalidateQuery);
      chrome.tabs.onCreated.removeListener(invalidateQuery);
      chrome.tabs.onMoved.removeListener(invalidateQuery);
      chrome.tabs.onRemoved.removeListener(invalidateQuery);
      chrome.tabs.onUpdated.removeListener(invalidateQuery);
    };
  }, [queryClient]);

  return useQuery({
    queryFn: () => chrome.tabs.query({}),
    queryKey: TABS_QUERY_KEY,
  });
}
