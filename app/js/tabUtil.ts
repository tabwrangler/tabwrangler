import { StorageLocalPersistState, TabTimes, getStorageLocalPersist } from "./queries";
import {
  incrementTotalTabsRemoved,
  removeTabTime,
  setTabTime,
  setTabTimes,
} from "./actions/localStorageActions";
import settings, { SettingsSchemaWrangleOption } from "./settings";
import { ACTIVE_TAB_TIMER_FREEZE_WINDOW_MS } from "./constants";

export const AVERAGE_TAB_BYTES_SIZE = 600;

export function findPositionByURL(savedTabs: chrome.tabs.Tab[], url: string | null = ""): number {
  return savedTabs.findIndex((item: chrome.tabs.Tab) => item.url === url && url != null);
}

export function findPositionByHostnameAndTitle(
  savedTabs: chrome.tabs.Tab[],
  url = "",
  title = "",
): number {
  const hostB = new URL(url).hostname;
  return savedTabs.findIndex((tab: chrome.tabs.Tab) => {
    const hostA = new URL(tab.url || "").hostname;
    return hostA === hostB && tab.title === title;
  });
}

export function getURLPositionFilterByWrangleOption(
  savedTabs: chrome.tabs.Tab[],
  option: SettingsSchemaWrangleOption,
): (tab: chrome.tabs.Tab) => number {
  if (option === "hostnameAndTitleMatch") {
    return (tab: chrome.tabs.Tab): number =>
      findPositionByHostnameAndTitle(savedTabs, tab.url, tab.title);
  } else if (option === "exactURLMatch") {
    return (tab: chrome.tabs.Tab): number => findPositionByURL(savedTabs, tab.url);
  }

  // `'withDupes'` && default
  return () => -1;
}

// Note: Mutates `storageLocalPersist`!
export function wrangleTabs(
  storageLocalPersist: StorageLocalPersistState,
  tabs: Array<chrome.tabs.Tab>,
) {
  // No tabs, nothing to do
  if (tabs.length === 0) return;

  const maxTabs = settings.get("maxTabs");
  const wrangleOption = settings.get("wrangleOption");
  const findURLPositionByWrangleOption = getURLPositionFilterByWrangleOption(
    storageLocalPersist.savedTabs,
    wrangleOption,
  );

  const tabIdsToRemove: Array<number> = [];
  for (let i = 0; i < tabs.length; i++) {
    const existingTabPosition = findURLPositionByWrangleOption(tabs[i]);
    const closingDate = Date.now();

    if (existingTabPosition > -1) {
      storageLocalPersist.savedTabs.splice(existingTabPosition, 1);
    }

    // @ts-expect-error `closedAt` is a TW expando property on tabs
    tabs[i].closedAt = closingDate;
    storageLocalPersist.savedTabs.unshift(tabs[i]);
    storageLocalPersist.totalTabsWrangled += 1;

    const tabId = tabs[i].id;
    if (tabId != null) {
      tabIdsToRemove.push(tabId);
    }
  }

  // Note: intentionally not awaiting tab removal! If removal does need to be awaited then this
  // function must be rewritten to get store values before/after async operations.
  if (tabIdsToRemove.length > 0) chrome.tabs.remove(tabIdsToRemove);

  // Trim saved tabs to the max allocated by the setting. Browser extension storage is limited and
  // thus cannot allow saved tabs to grow indefinitely.
  if (storageLocalPersist.savedTabs.length - maxTabs > 0) {
    const tabsToTrim = storageLocalPersist.savedTabs.splice(maxTabs);
    console.log("Exceeded maxTabs (%d), trimming older tabs:", maxTabs);
    console.log(tabsToTrim.map((t) => t.url));
    storageLocalPersist.savedTabs = storageLocalPersist.savedTabs.splice(0, maxTabs);
  }
}

export async function wrangleTabsAndPersist(tabs: Array<chrome.tabs.Tab>) {
  // No tabs, nothing to do
  if (tabs.length === 0) return;

  const storageLocalPersist = await getStorageLocalPersist();
  wrangleTabs(storageLocalPersist, tabs);
  await chrome.storage.local.set({
    "persist:localStorage": storageLocalPersist,
  });
}

export async function initTabs() {
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  await setTabTimes(
    tabs.map((tab) => String(tab.id)),
    Date.now(),
  );
}

export function onNewTab(tab: chrome.tabs.Tab) {
  console.debug("[onNewTab] updating new tab", tab);
  // Track new tab's time to close.
  if (tab.id != null) updateLastAccessed(tab.id);
}

export async function removeTab(tabId: number) {
  await incrementTotalTabsRemoved();
  settings.unlockTab(tabId);
  await removeTabTime(String(tabId));
}

export async function updateClosedCount(
  showBadgeCount: boolean = settings.get("showBadgeCount"),
): Promise<void> {
  let text;
  if (showBadgeCount) {
    const localStorage = await getStorageLocalPersist();
    const savedTabsLength = localStorage.savedTabs.length;
    text = savedTabsLength === 0 ? "" : savedTabsLength.toString();
  } else {
    text = "";
  }
  chrome.action.setBadgeText({ text });
}

export async function updateLastAccessed(tabOrTabId: chrome.tabs.Tab | number): Promise<void> {
  let tabId;
  if (typeof tabOrTabId !== "number" && typeof tabOrTabId.id !== "number") {
    console.log("Error: `tabOrTabId.id` is not an number", tabOrTabId.id);
    return;
  } else if (typeof tabOrTabId === "number") {
    tabId = tabOrTabId;
    await setTabTime(String(tabId), Date.now());
  } else {
    tabId = tabOrTabId.id;
    await setTabTime(String(tabId), tabOrTabId?.lastAccessed ?? new Date().getTime());
  }
}

export function getWhitelistMatch(
  url: string | undefined,
  { whitelist }: { whitelist: string[] },
): string | null {
  if (url == null) return null;
  for (let i = 0; i < whitelist.length; i++) {
    if (url.indexOf(whitelist[i]) !== -1) {
      return whitelist[i];
    }
  }
  return null;
}

export type TabLockStatus =
  | { locked: false }
  | { locked: true; reason: "audible" }
  | { locked: true; reason: "grouped" }
  | { locked: true; reason: "manual" }
  | { locked: true; reason: "pinned" }
  | { locked: true; reason: "whitelist"; whitelistMatch: string }
  | { locked: true; reason: "window" };

export function getTabLockStatus(
  tab: chrome.tabs.Tab,
  {
    filterAudio,
    filterGroupedTabs,
    lockedIds,
    lockedWindowIds,
    whitelist,
  }: {
    filterAudio: boolean;
    filterGroupedTabs: boolean;
    lockedIds: number[];
    lockedWindowIds: number[];
    whitelist: string[];
  },
): TabLockStatus {
  if (tab.pinned) return { locked: true, reason: "pinned" };
  if (filterAudio && tab.audible) return { locked: true, reason: "audible" };
  if (filterGroupedTabs && "groupId" in tab && tab.groupId > 0)
    return { locked: true, reason: "grouped" };

  const whitelistMatch = getWhitelistMatch(tab.url, { whitelist });
  if (whitelistMatch != null) return { locked: true, reason: "whitelist", whitelistMatch };
  if (tab.id != null && lockedIds.indexOf(tab.id) !== -1) return { locked: true, reason: "manual" };
  if (lockedWindowIds.indexOf(tab.windowId) !== -1) return { locked: true, reason: "window" };

  return { locked: false };
}

export function isTabLocked(
  tab: chrome.tabs.Tab,
  options: {
    filterAudio: boolean;
    filterGroupedTabs: boolean;
    lockedIds: number[];
    lockedWindowIds: number[];
    whitelist: string[];
  },
): boolean {
  return getTabLockStatus(tab, options).locked;
}

export function makeTabPersistKey(tab: chrome.tabs.Tab): string | undefined {
  return tab.index == null ? tab.url : `${tab.index}::${tab.url}`;
}

export function makeWindowPersistKey(tabs: chrome.tabs.Tab[]): string | undefined {
  const keys = tabs
    .map(makeTabPersistKey)
    .filter((k): k is string => k != null)
    .sort();
  return keys.length > 0 ? keys.join("|") : undefined;
}

type TabWithCloseableStatus =
  | { closable: true; tab: chrome.tabs.Tab }
  | { closable: false; reason: "active"; tab: chrome.tabs.Tab }
  | { closable: false; reason: "locked"; tab: chrome.tabs.Tab; tabLockStatus: TabLockStatus };

export function getTabClosableStatus(tab: chrome.tabs.Tab): TabWithCloseableStatus {
  const tabLockStatus = getTabLockStatus(tab, {
    filterAudio: settings.get("filterAudio"),
    filterGroupedTabs: settings.get("filterGroupedTabs"),
    lockedIds: settings.get("lockedIds"),
    lockedWindowIds: settings.get("lockedWindowIds"),
    whitelist: settings.get("whitelist"),
  });
  if (tabLockStatus.locked) return { closable: false, reason: "locked", tab, tabLockStatus };
  if (tab.active) return { closable: false, reason: "active", tab };
  return { closable: true, tab };
}

/** Returns tab IDs from `tabTimes` whose times are older than `time`. */
export function getTabIdsOlderThan(tabTimes: TabTimes, time: number): Set<number> {
  const ret: Set<number> = new Set();
  for (const [tabId, tabTime] of Object.entries(tabTimes)) {
    if (!time || tabTime < time) ret.add(parseInt(tabId, 10));
  }
  return ret;
}

export function shouldFreezeActiveTabTimer(timeRemainingSeconds: number): boolean {
  return timeRemainingSeconds >= ACTIVE_TAB_TIMER_FREEZE_WINDOW_MS / 1000;
}

/**
 * Given a snapshot of tab times and a list of tabs, returns the subset that should be closed:
 * tabs that are closable (not active, not locked), old enough to exceed `stayOpen`, and whose
 * removal would not reduce the window below `minTabs`.
 */
export function findTabsToCloseCandidates(
  tabTimes: TabTimes,
  tabs: chrome.tabs.Tab[],
): chrome.tabs.Tab[] {
  const cutOff = Date.now() - settings.stayOpen();
  const minTabs = settings.get("minTabs");

  const tabClosableStatuses = tabs.map(getTabClosableStatus);
  const closableTabsWithStatuses = tabClosableStatuses.filter((tabStatus) => tabStatus.closable);
  const activeNonLockedTabsWithStatuses = tabClosableStatuses.filter(
    (tabStatus) => !tabStatus.closable && tabStatus.reason === "active",
  );

  const countableTabs = activeNonLockedTabsWithStatuses.length + closableTabsWithStatuses.length;
  if (countableTabs - minTabs <= 0) {
    return [];
  }

  const tabIdsToCut = getTabIdsOlderThan(tabTimes, cutOff);
  let tabsWithStatusesToCut = closableTabsWithStatuses.filter(
    (tabWithStatus) => tabWithStatus.tab.id != null && tabIdsToCut.has(tabWithStatus.tab.id),
  );
  tabsWithStatusesToCut.sort((a, b) => {
    if (a.tab.lastAccessed == null || b.tab.lastAccessed == null) return 0;
    return a.tab.lastAccessed - b.tab.lastAccessed;
  });

  // If cutting will reduce below `minTabs`, only remove the first N to get to `minTabs`.
  tabsWithStatusesToCut = tabsWithStatusesToCut.splice(0, countableTabs - minTabs);
  return tabsWithStatusesToCut.map((tabWithStatus) => tabWithStatus.tab);
}
