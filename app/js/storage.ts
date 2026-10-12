import { type ActiveHours, inactiveMs, isWithinActiveHours } from "./activeHours";
import { LEGACY_RULE_SETTINGS, type LegacyRuleSettings } from "./tabRules";
import { setTabTime, shiftTabTimes } from "./actions/localStorageActions";
import settings, { SETTINGS_DEFAULTS, buildTabRulesFromStoredLegacySettings } from "./settings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncLock from "async-lock";
import { TabTimes } from "./types";
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
  >([...LEGACY_RULE_SETTINGS, "tabRules"]);
  if (tabRules != null) return;

  // New installs, and users who never changed the legacy settings, store nothing and get the
  // default rules from `settings`. On a new device, synced legacy settings may not have arrived
  // yet, and storing the defaults would keep them from ever being migrated.
  const nextTabRules = buildTabRulesFromStoredLegacySettings(stored);
  if (nextTabRules == null) return;

  // A long whitelist can produce rules over the sync quota for one item. Writing them would
  // reject, so leave `settings` deriving them from the legacy settings instead.
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

export interface ClockState {
  // Tab times exclude time outside active hours up to here.
  clockCheckedAt: number | null;
  idleAt: number | null;
  pausedAt: number | null;
}

export const CLOCK_STATE_DEFAULTS: ClockState = {
  clockCheckedAt: null,
  idleAt: null,
  pausedAt: null,
};

/**
 * Returns `tabTime` shifted so time outside active hours until `untilMs` does not count against it,
 * starting from `clockCheckedAt` or the tab's own time if later. Time after a pause or idle period
 * began is left to the end of that period, which excludes all of it.
 */
export function excludeInactiveHours(
  tabTime: number,
  untilMs: number,
  clock: ClockState,
  paused: boolean,
  activeHours: ActiveHours,
): number {
  if (clock.clockCheckedAt == null) return tabTime;
  let endMs = untilMs;
  if (paused && clock.pausedAt != null) endMs = Math.min(endMs, clock.pausedAt);
  if (clock.idleAt != null) endMs = Math.min(endMs, clock.idleAt);
  return tabTime + inactiveMs(Math.max(tabTime, clock.clockCheckedAt), endMs, activeHours);
}

/**
 * Shifts tab times so time outside active hours does not count against them. Outside active hours
 * this waits until they begin again, or a pause or idle period starts, so countdowns stay where
 * they were when active hours ended.
 */
export function excludeTimeOutsideActiveHours(): Promise<void> {
  return shiftTabTimesForActiveHours(settings.get("activeHours"), true);
}

/**
 * Excludes time outside the active hours that were in effect until now. Must run when they change,
 * before anything measures the time since `clockCheckedAt` against the new ones.
 */
export function onActiveHoursChanged(previousActiveHours: ActiveHours): Promise<void> {
  return shiftTabTimesForActiveHours(previousActiveHours, false);
}

// Takes `activeHours` rather than reading it once the lock is acquired because a queued call must
// use the active hours from when it was made: they may have changed while it waited.
function shiftTabTimesForActiveHours(
  activeHours: ActiveHours,
  waitForActiveHours: boolean,
): Promise<void> {
  return ASYNC_LOCK.acquire("local.tabTimes", async () => {
    const now = Date.now();
    const [clock, { paused }] = await Promise.all([
      chrome.storage.local.get<ClockState>(CLOCK_STATE_DEFAULTS),
      getStorageSyncPersist(),
    ]);

    if (
      waitForActiveHours &&
      clock.clockCheckedAt != null &&
      !paused &&
      clock.idleAt == null &&
      !isWithinActiveHours(now, activeHours)
    )
      return;

    // Each tab's interval lies within the one since `clockCheckedAt`, so when that has no time
    // outside active hours, neither does any tab's.
    if (
      clock.clockCheckedAt == null ||
      excludeInactiveHours(clock.clockCheckedAt, now, clock, paused, activeHours) ===
        clock.clockCheckedAt
    ) {
      await chrome.storage.local.set({ clockCheckedAt: now });
      return;
    }

    const { tabTimes } = await chrome.storage.local.get<{ tabTimes: TabTimes }>({ tabTimes: {} });
    const nextTabTimes: TabTimes = {};
    for (const [tabId, tabTime] of Object.entries(tabTimes))
      nextTabTimes[tabId] = excludeInactiveHours(tabTime, now, clock, paused, activeHours);
    await chrome.storage.local.set({ clockCheckedAt: now, tabTimes: nextTabTimes });
  });
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
