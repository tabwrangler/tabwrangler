import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const TABS_QUERY_KEY = ["tabsQuery"] as const;

export default function useTabsQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function invalidateTabsQuery() {
      queryClient.invalidateQueries({ queryKey: TABS_QUERY_KEY });
    }
    chrome.tabs.onActivated.addListener(invalidateTabsQuery);
    chrome.tabs.onCreated.addListener(invalidateTabsQuery);
    chrome.tabs.onMoved.addListener(invalidateTabsQuery);
    chrome.tabs.onRemoved.addListener(invalidateTabsQuery);
    chrome.tabs.onUpdated.addListener(invalidateTabsQuery);
    return () => {
      chrome.tabs.onActivated.removeListener(invalidateTabsQuery);
      chrome.tabs.onCreated.removeListener(invalidateTabsQuery);
      chrome.tabs.onMoved.removeListener(invalidateTabsQuery);
      chrome.tabs.onRemoved.removeListener(invalidateTabsQuery);
      chrome.tabs.onUpdated.removeListener(invalidateTabsQuery);
    };
  }, [queryClient]);

  return useQuery({
    queryFn: () => chrome.tabs.query({}),
    queryKey: TABS_QUERY_KEY,
  });
}
