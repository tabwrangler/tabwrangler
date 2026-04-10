import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const TAB_GROUPS_QUERY_KEY = ["tabGroupsQuery"] as const;

export default function useTabGroupsQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!chrome.tabGroups) return () => {};
    function invalidateTabGroupsQuery() {
      queryClient.invalidateQueries({ queryKey: TAB_GROUPS_QUERY_KEY });
    }
    chrome.tabGroups.onCreated.addListener(invalidateTabGroupsQuery);
    chrome.tabGroups.onMoved.addListener(invalidateTabGroupsQuery);
    chrome.tabGroups.onRemoved.addListener(invalidateTabGroupsQuery);
    chrome.tabGroups.onUpdated.addListener(invalidateTabGroupsQuery);
    return () => {
      chrome.tabGroups.onCreated.removeListener(invalidateTabGroupsQuery);
      chrome.tabGroups.onMoved.removeListener(invalidateTabGroupsQuery);
      chrome.tabGroups.onRemoved.removeListener(invalidateTabGroupsQuery);
      chrome.tabGroups.onUpdated.removeListener(invalidateTabGroupsQuery);
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
