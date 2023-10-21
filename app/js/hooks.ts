import { SETTINGS_DEFAULTS } from "./settings";
import { useQuery } from "@tanstack/react-query";

export function useStorageLocalPersistQuery() {
  return useQuery({
    queryFn: async () => {
      // `local` was managed by redux-persit, which prefixed the data with "persist:"
      const data = await chrome.storage.local.get({ "persist:localStorage": {} });
      return data["persist:localStorage"];
    },
    queryKey: ["storageLocalQuery", { type: "persist" }],
  });
}

export function useStorageSyncPersistQuery() {
  return useQuery({
    queryFn: async () => {
      // `sync` was managed by redux-persit, which prefixed the data with "persist:"
      const data = await chrome.storage.sync.get({ "persist:settings": {} });
      return data["persist:settings"];
    },
    queryKey: ["storageSyncQuery", { type: "persist" }],
  });
}

export function useStorageSyncQuery() {
  return useQuery({
    queryFn: () => chrome.storage.sync.get(SETTINGS_DEFAULTS),
    queryKey: ["storageSyncQuery"],
  });
}
