import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IDLE_PERMISSIONS } from "../constants";
import { useEffect } from "react";

const IDLE_PERMISSION_QUERY_KEY = ["idlePermissionQuery"] as const;

export default function useIdlePermissionQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleChanged(permissions: chrome.permissions.Permissions) {
      if (permissions.permissions?.includes("idle"))
        queryClient.invalidateQueries({ queryKey: IDLE_PERMISSION_QUERY_KEY });
    }
    chrome.permissions.onAdded.addListener(handleChanged);
    chrome.permissions.onRemoved.addListener(handleChanged);
    return () => {
      chrome.permissions.onAdded.removeListener(handleChanged);
      chrome.permissions.onRemoved.removeListener(handleChanged);
    };
  }, [queryClient]);

  return useQuery({
    queryFn: () => chrome.permissions.contains(IDLE_PERMISSIONS),
    queryKey: IDLE_PERMISSION_QUERY_KEY,
  });
}
