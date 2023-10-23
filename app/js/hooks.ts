import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SETTINGS_DEFAULTS } from "./settings";
import { getStorageSyncPersist } from "./queries";
import { useEffect } from "react";

const STORAGE_LOCAL_PERSIST_QUERY_KEY = ["storageLocalQuery", { type: "persist" }];
export function useStorageLocalPersistQuery() {
  const queryClient = useQueryClient();
  useEffect(() => {
    function handleChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: chrome.storage.AreaName
    ) {
      if (areaName === "local" && "persist:localStorage" in changes)
        queryClient.invalidateQueries(STORAGE_LOCAL_PERSIST_QUERY_KEY);
    }
    chrome.storage.onChanged.addListener(handleChanged);
    return () => {
      chrome.storage.onChanged.removeListener(handleChanged);
    };
  }, [queryClient]);
  return useQuery({
    queryFn: async () => {
      // `local` was managed by redux-persit, which prefixed the data with "persist:"
      const data = await chrome.storage.local.get({ "persist:localStorage": {} });
      return data["persist:localStorage"];
    },
    queryKey: STORAGE_LOCAL_PERSIST_QUERY_KEY,
  });
}

const STORAGE_SYNC_PERSIST_QUERY_KEY = ["storageSyncQuery", { type: "persist" }];
export function useStorageSyncPersistQuery() {
  const queryClient = useQueryClient();
  useEffect(() => {
    function handleChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: chrome.storage.AreaName
    ) {
      if (areaName === "sync" && "persist:settings" in changes)
        queryClient.invalidateQueries({ queryKey: STORAGE_SYNC_PERSIST_QUERY_KEY });
    }
    chrome.storage.onChanged.addListener(handleChanged);
    return () => chrome.storage.onChanged.removeListener(handleChanged);
  }, [queryClient]);
  return useQuery({
    queryFn: getStorageSyncPersist,
    queryKey: STORAGE_SYNC_PERSIST_QUERY_KEY,
  });
}

export function useStorageSyncQuery() {
  return useQuery({
    queryFn: () => chrome.storage.sync.get(SETTINGS_DEFAULTS),
    queryKey: ["storageSyncQuery"],
  });
}
