import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncLock from "async-lock";
import { SETTINGS_DEFAULTS } from "./settings";
import { getStorageSyncPersist } from "./queries";
import { setTabTime } from "./actions/localStorageActions";
import { useEffect } from "react";

export const ASYNC_LOCK = new AsyncLock();

export function mutateStorageSyncPersist({
  key,
  value,
}: {
  key: string;
  value: unknown;
}): Promise<void> {
  return ASYNC_LOCK.acquire("persist:settings", async () => {
    const data = await chrome.storage.sync.get({ "persist:settings": {} });
    return chrome.storage.sync.set({
      "persist:settings": { ...data["persist:settings"], [key]: value },
    });
  });
}

export function mutateStorageSync({ key, value }: { key: string; value: unknown }): Promise<void> {
  return chrome.storage.sync.set({ [key]: value });
}

export function lockTabId(tabId: number) {
  return ASYNC_LOCK.acquire("persist:settings", async () => {
    const { lockedIds } = await chrome.storage.sync.get({ lockedIds: [] });
    if (tabId > 0 && lockedIds.indexOf(tabId) === -1) {
      lockedIds.push(tabId);
      await chrome.storage.sync.set({ lockedIds });
    }
  });
}

export async function unlockTabId(tabId: number) {
  await ASYNC_LOCK.acquire("persist:settings", async () => {
    const { lockedIds } = await chrome.storage.sync.get({ lockedIds: [] });
    if (lockedIds.indexOf(tabId) !== -1) {
      lockedIds.splice(lockedIds.indexOf(tabId), 1);
      await chrome.storage.sync.set({ lockedIds });
    }
  });

  // Reset tab time so the freshly-unlocked tab is not immediately wrangled.
  await setTabTime(String(tabId), Date.now());
}

const STORAGE_LOCAL_PERSIST_QUERY_KEY = ["storageLocalQuery", { type: "persist" }];
export function useStorageLocalPersistQuery() {
  const queryClient = useQueryClient();
  useEffect(() => {
    function handleChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: chrome.storage.AreaName
    ) {
      if (areaName === "local" && "persist:localStorage" in changes) {
        queryClient.invalidateQueries(STORAGE_LOCAL_PERSIST_QUERY_KEY);
      }
    }
    chrome.storage.onChanged.addListener(handleChanged);
    return () => {
      chrome.storage.onChanged.removeListener(handleChanged);
    };
  }, [queryClient]);
  return useQuery({
    queryFn: async () => {
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

const STORAGE_SYNC_QUERY_KEY = ["storageSyncQuery"];
export function useStorageSyncQuery() {
  const queryClient = useQueryClient();
  useEffect(() => {
    function handleChanged(_changes: unknown, areaName: chrome.storage.AreaName) {
      if (areaName === "sync") queryClient.invalidateQueries({ queryKey: STORAGE_SYNC_QUERY_KEY });
    }
    chrome.storage.onChanged.addListener(handleChanged);
    return () => chrome.storage.onChanged.removeListener(handleChanged);
  }, [queryClient]);
  return useQuery({
    queryFn: () => chrome.storage.sync.get(SETTINGS_DEFAULTS),
    queryKey: ["storageSyncQuery"],
  });
}
