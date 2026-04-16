import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const TAB_GROUPS_QUERY_KEY = ["tabGroupsQuery"] as const;

/**
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabGroups/query
 */
export default function useTabGroupsQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!chrome.tabGroups) return () => {};
    function invalidateQuery() {
      queryClient.invalidateQueries({ queryKey: TAB_GROUPS_QUERY_KEY });
    }
    chrome.tabGroups.onCreated.addListener(invalidateQuery);
    chrome.tabGroups.onMoved.addListener(invalidateQuery);
    chrome.tabGroups.onRemoved.addListener(invalidateQuery);
    chrome.tabGroups.onUpdated.addListener(invalidateQuery);
    return () => {
      chrome.tabGroups.onCreated.removeListener(invalidateQuery);
      chrome.tabGroups.onMoved.removeListener(invalidateQuery);
      chrome.tabGroups.onRemoved.removeListener(invalidateQuery);
      chrome.tabGroups.onUpdated.removeListener(invalidateQuery);
    };
  }, [queryClient]);

  return useQuery({
    queryFn: () => {
      if (!chrome.tabGroups) return [];
      return chrome.tabGroups.query({});
    },
    queryKey: TAB_GROUPS_QUERY_KEY,
  });
}
