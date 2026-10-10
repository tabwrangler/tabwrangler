import { type LegacyRuleSettings, buildTabRulesFromLegacySettings } from "./tabRules";
import { setTabTime, shiftTabTimes } from "./actions/localStorageActions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncLock from "async-lock";
import { SETTINGS_DEFAULTS } from "./settings";
import { getStorageSyncPersist } from "./queries";
import { useEffect } from "react";

/* Give an (arbitrary) maxExecutionTime to ensure no dead locks occur. Throwing an error is better
 * than a permanent deadlock. */
export const ASYNC_LOCK = new AsyncLock({ maxExecutionTime: 5_000 });
const STORAGE_LOCAL_VERSION = 1;

export async function migrateLocal() {
  const { storageVersion } = await chrome.storage.local.get("storageVersion");

  // New installation or migrating from unversioned -> versioned
  if (storageVersion == null) {
    // Move `tabTimes` from legacy "redux-persist" object into a root key so it can be read/written
    // without having to read the entirety of stored tabs.
    await ASYNC_LOCK.acquire(["local.tabTimes", "persist:localStorage"], async () => {
      let nextTabTimes;
      const data = await chrome.storage.local.get("persist:localStorage");
      const persistLocalStorage = data["persist:localStorage"];
      if (persistLocalStorage != null && "tabTimes" in persistLocalStorage) {
        nextTabTimes = persistLocalStorage.tabTimes;
        delete persistLocalStorage.tabTimes;
        await chrome.storage.local.set({ "persist:localStorage": persistLocalStorage });
      } else {
        nextTabTimes = {};
      }

      await chrome.storage.local.set({
        storageVersion: STORAGE_LOCAL_VERSION,
        tabTimes: nextTabTimes,
      });
    });

    console.debug("[migrateLocal]: Migrated to version 1");
  }
}

/**
 * Migrates settings in sync storage. Each step detects whether it already ran from the synced data
 * itself rather than a version marker in local storage, so a second device updating later cannot
 * overwrite what the first device migrated and the user has since edited.
 */
export async function migrateSync() {
  // Replaces `filterAudio`, `filterGroupedTabs`, `minutesInactive`, `secondsInactive`, and
  // `whitelist` with `tabRules`. The legacy settings are left in place so downgrading keeps working.
  const { tabRules, ...stored } = await chrome.storage.sync.get<
    Partial<LegacyRuleSettings> & { tabRules?: unknown }
  >([
    "filterAudio",
    "filterGroupedTabs",
    "minutesInactive",
    "secondsInactive",
    "tabRules",
    "whitelist",
  ]);
  if (tabRules != null) return;

  // New installs, and users who never changed the legacy settings, get the default rules.
  const storedLegacy = Object.fromEntries(
    Object.entries(stored).filter(([, value]) => value != null),
  );
  if (Object.keys(storedLegacy).length === 0) {
    await chrome.storage.sync.set({ tabRules: SETTINGS_DEFAULTS.tabRules });
    return;
  }

  // A long whitelist can produce rules over the sync quota for one item. Writing them would
  // reject, so leave `settings` deriving them from the legacy settings instead.
  const nextTabRules = buildTabRulesFromLegacySettings({
    filterAudio: SETTINGS_DEFAULTS.filterAudio,
    filterGroupedTabs: SETTINGS_DEFAULTS.filterGroupedTabs,
    minutesInactive: SETTINGS_DEFAULTS.minutesInactive,
    secondsInactive: SETTINGS_DEFAULTS.secondsInactive,
    whitelist: SETTINGS_DEFAULTS.whitelist,
    ...storedLegacy,
  });
  const bytes = new TextEncoder().encode(`tabRules${JSON.stringify(nextTabRules)}`).length;
  if (bytes > (chrome.storage.sync.QUOTA_BYTES_PER_ITEM ?? 8192)) {
    console.warn(`[migrateSync]: Tab Rules (${bytes} bytes) exceed the sync quota; not migrating`);
    return;
  }

  await chrome.storage.sync.set({ tabRules: nextTabRules });
  console.debug("[migrateSync]: Migrated legacy settings to Tab Rules");
}

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

/**
 * Records when the browser became idle. Once it is no longer idle, shifts tab times so time spent
 * idle does not count against them (same as unpausing).
 */
export async function setIdle(idle: boolean): Promise<void> {
  const { idleAt } = await chrome.storage.local.get<{ idleAt: number | null }>({ idleAt: null });
  if (idle && idleAt == null) {
    await chrome.storage.local.set({ idleAt: Date.now() });
  } else if (!idle && idleAt != null) {
    await shiftTabTimes(idleAt);
    await chrome.storage.local.remove("idleAt");
  }
}

export async function pauseExtension(): Promise<void> {
  // Pausing is user activity, so end any idle period now. Otherwise the idle period would overlap
  // the pause and tab times would be shifted for both.
  await setIdle(false);
  await Promise.all([
    mutateStorageSyncPersist({ key: "paused", value: true }),
    chrome.storage.local.set({ pausedAt: Date.now() }),
  ]);
}

export async function unpauseExtension(): Promise<void> {
  const { pausedAt } = await chrome.storage.local.get<{ pausedAt: number | null }>({
    pausedAt: null,
  });

  // Shift all tab times so time spent paused does not count against tab times. For example, if a
  // tab had 1 min remaining, extension paused for 45sec, tab should still have 1min on resume.
  if (pausedAt != null) await shiftTabTimes(pausedAt);

  await Promise.all([
    mutateStorageSyncPersist({ key: "paused", value: false }),
    chrome.storage.local.remove("pausedAt"),
  ]);
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

export function lockWindowId(windowId: number): Promise<void> {
  return ASYNC_LOCK.acquire("persist:settings", async () => {
    const { lockedWindowIds } = await chrome.storage.sync.get({ lockedWindowIds: [] });
    if (windowId > 0 && lockedWindowIds.indexOf(windowId) === -1) {
      lockedWindowIds.push(windowId);
      await chrome.storage.sync.set({ lockedWindowIds });
    }
  });
}

export function unlockWindowId(windowId: number): Promise<void> {
  return ASYNC_LOCK.acquire("persist:settings", async () => {
    const { lockedWindowIds } = await chrome.storage.sync.get({ lockedWindowIds: [] });
    const index = lockedWindowIds.indexOf(windowId);
    if (index !== -1) {
      lockedWindowIds.splice(index, 1);
      await chrome.storage.sync.set({ lockedWindowIds });
    }
  });
}

const STORAGE_LOCAL_PERSIST_QUERY_KEY = ["storageLocalQuery", { type: "persist" }];
export function useStorageLocalPersistQuery() {
  const queryClient = useQueryClient();
  useEffect(() => {
    function handleChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: chrome.storage.AreaName,
    ) {
      if (areaName === "local" && "persist:localStorage" in changes) {
        queryClient.invalidateQueries({ queryKey: STORAGE_LOCAL_PERSIST_QUERY_KEY });
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
      areaName: chrome.storage.AreaName,
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
