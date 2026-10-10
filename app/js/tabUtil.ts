import { StorageLocalPersistState, getStorageLocalPersist } from "./queries";
import {
  type TabRule,
  type TabRulesConfig,
  findMatchingRule,
  getStaleAfterMs,
  shouldSaveToCorral,
} from "./tabRules";
import {
  incrementTotalTabsRemoved,
  removeTabTime,
  setTabTime,
  setTabTimes,
} from "./actions/localStorageActions";
import settings, { SettingsSchema, SettingsSchemaWrangleOption } from "./settings";
import { ACTIVE_TAB_TIMER_FREEZE_WINDOW_MS } from "./constants";
import { TabTimes } from "./types";

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
  tabRules?: TabRulesConfig,
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
    if (tabRules == null || shouldSaveToCorral(tabs[i], tabRules)) {
      const existingTabPosition = findURLPositionByWrangleOption(tabs[i]);
      const closingDate = Date.now();

      if (existingTabPosition > -1) {
        storageLocalPersist.savedTabs.splice(existingTabPosition, 1);
      }

      // @ts-expect-error `closedAt` is a TW expando property on tabs
      tabs[i].closedAt = closingDate;
      storageLocalPersist.savedTabs.unshift(tabs[i]);
    }
    storageLocalPersist.totalTabsWrangled += 1;

    const tabId = tabs[i].id;
    if (tabId != null) {
      tabIdsToRemove.push(tabId);
    }
  }

  if (tabIdsToRemove.length > 0)
    tabIdsToRemove.forEach((tabId) => {
      // * Intentionally not awaiting tab removal! If removal needs to be awaited then this func
      //   must be rewritten to get store values before/after async ops.
      // * Close 1 tab at a time because if an invalid/unclosable tabId is passed in array func
      //   signature then the *whole call* fails and closes nothing. Close all tabs possible.
      //   @see https://github.com/tabwrangler/tabwrangler/issues/597
      void chrome.tabs.remove(tabId);
    });

  // Trim saved tabs to the max allocated by the setting. Browser extension storage is limited and
  // thus cannot allow saved tabs to grow indefinitely.
  if (storageLocalPersist.savedTabs.length - maxTabs > 0) {
    const tabsToTrim = storageLocalPersist.savedTabs.splice(maxTabs);
    console.log("Exceeded maxTabs (%d), trimming older tabs:", maxTabs);
    console.log(tabsToTrim.map((t) => t.url));
    storageLocalPersist.savedTabs = storageLocalPersist.savedTabs.splice(0, maxTabs);
  }
}

export async function wrangleTabsAndPersist(
  tabs: Array<chrome.tabs.Tab>,
  tabRules?: TabRulesConfig,
) {
  if (tabs.length === 0) return;

  const storageLocalPersist = await getStorageLocalPersist();
  wrangleTabs(storageLocalPersist, tabs, tabRules);
  await chrome.storage.local.set({
    "persist:localStorage": storageLocalPersist,
  });
}

/**
 * Restarts the timer of each tab whose stale timeout got shorter than the time it has already been
 * inactive, so a Tab Rules change doesn't close it right away. Other tabs keep their progress.
 */
export async function resetTabTimesPastTimeout(prev: TabRulesConfig, next: TabRulesConfig) {
  const [tabs, { tabTimes }] = await Promise.all([
    chrome.tabs.query({ windowType: "normal" }),
    chrome.storage.local.get<{ tabTimes: TabTimes }>({ tabTimes: {} }),
  ]);
  const now = Date.now();
  const tabIds = tabs.flatMap((tab) => {
    const tabTime = tabTimes[String(tab.id)];
    const staleAfterMs = getStaleAfterMs(next, tab);
    return tabTime != null &&
      now - tabTime > staleAfterMs &&
      staleAfterMs < getStaleAfterMs(prev, tab)
      ? [String(tab.id)]
      : [];
  });
  if (tabIds.length > 0) await setTabTimes(tabIds, now);
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

export type TabLockStatus =
  | { locked: false }
  | { locked: true; reason: "manual" }
  | { locked: true; reason: "rule"; rule: TabRule }
  | { locked: true; reason: "window" };

export function getTabLockStatus(
  tab: chrome.tabs.Tab,
  { lockedIds, lockedWindowIds, tabRules }: LockSettings,
): TabLockStatus {
  const rule = findMatchingRule(tab, tabRules);
  if (rule?.then.action === "lock") return { locked: true, reason: "rule", rule };
  if (tab.id != null && lockedIds.indexOf(tab.id) !== -1) return { locked: true, reason: "manual" };
  if (lockedWindowIds.indexOf(tab.windowId) !== -1) return { locked: true, reason: "window" };

  return { locked: false };
}

export function isTabLocked(tab: chrome.tabs.Tab, options: LockSettings): boolean {
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

/**
 * Returns the ID of the tab whose timer should be frozen: the active tab in the last focused
 * window. If that window is not accessible (e.g. a private window), falls back to the tab with the
 * most time remaining.
 */
export function findTabToFreeze(
  windows: chrome.windows.Window[],
  lastFocusedWindowId: number | undefined,
  tabTimes: TabTimes,
): number | undefined {
  const activeTabId = windows
    .find((win) => win.id === lastFocusedWindowId)
    ?.tabs?.find((tab) => tab.active)?.id;
  if (activeTabId != null) return activeTabId;

  let newestTabId: number | undefined;
  let newestTime = -Infinity;
  for (const win of windows) {
    for (const tab of win.tabs ?? []) {
      if (tab.id == null) continue;
      const time = tabTimes[tab.id];
      if (time != null && time > newestTime) {
        newestTime = time;
        newestTabId = tab.id;
      }
    }
  }
  return newestTabId;
}

export function shouldFreezeActiveTabTimer(timeRemainingSeconds: number): boolean {
  return timeRemainingSeconds >= ACTIVE_TAB_TIMER_FREEZE_WINDOW_MS / 1000;
}

type LockSettings = Pick<SettingsSchema, "lockedIds" | "lockedWindowIds" | "tabRules">;

export type WrangleNowSettings = LockSettings & Pick<SettingsSchema, "minTabs" | "minTabsStrategy">;

function filterUnlockedTabs(
  tabs: chrome.tabs.Tab[],
  lockSettings: LockSettings,
): chrome.tabs.Tab[] {
  return tabs.filter((tab) => !isTabLocked(tab, lockSettings));
}

export function findTabsToCloseCandidates(
  tabTimes: TabTimes,
  tabs: chrome.tabs.Tab[],
): chrome.tabs.Tab[] {
  const now = Date.now();
  const minTabs = settings.get("minTabs");
  const unlockedTabs = filterUnlockedTabs(tabs, {
    lockedIds: settings.get("lockedIds"),
    lockedWindowIds: settings.get("lockedWindowIds"),
    tabRules: settings.get("tabRules"),
  });

  if (unlockedTabs.length - minTabs <= 0) return [];

  const candidates = unlockedTabs.filter((tab) => {
    const tabTime = tab.id == null ? undefined : tabTimes[tab.id];
    return tabTime != null && tabTime < now - settings.stayOpen(tab);
  });
  candidates.sort((a, b) => {
    if (a.lastAccessed == null || b.lastAccessed == null) return 0;
    return a.lastAccessed - b.lastAccessed;
  });

  return candidates.splice(0, unlockedTabs.length - minTabs);
}

/**
 * Tabs "Wrangle Now" would close: ignores time remaining and closes unlocked tabs with the least
 * time remaining until only `minTabs` unlocked tabs are left, respecting `minTabsStrategy`. Tabs
 * that are not closed keep their current time remaining.
 */
export function findTabsToWrangleNow(
  tabTimes: TabTimes,
  tabs: chrome.tabs.Tab[],
  protectedTabId: number | undefined,
  { minTabs, minTabsStrategy, ...lockSettings }: WrangleNowSettings,
): chrome.tabs.Tab[] {
  const now = Date.now();

  function findInGroup(groupTabs: chrome.tabs.Tab[]): chrome.tabs.Tab[] {
    const unlockedTabs = filterUnlockedTabs(groupTabs, lockSettings);
    const excess = unlockedTabs.length - minTabs;
    if (excess <= 0) return [];
    return unlockedTabs
      .filter((tab) => tab.id != null && tab.id !== protectedTabId)
      .sort((a, b) => (tabTimes[a.id!] ?? now) - (tabTimes[b.id!] ?? now))
      .slice(0, excess);
  }

  switch (minTabsStrategy) {
    case "allWindows":
      return findInGroup(tabs);
    case "givenWindow": {
      const tabsByWindowId = new Map<number, chrome.tabs.Tab[]>();
      for (const tab of tabs) {
        const windowTabs = tabsByWindowId.get(tab.windowId) ?? [];
        windowTabs.push(tab);
        tabsByWindowId.set(tab.windowId, windowTabs);
      }
      return Array.from(tabsByWindowId.values()).flatMap(findInGroup);
    }
    default:
      minTabsStrategy satisfies never;
      return [];
  }
}

export function sessionFuzzyMatchesTab(
  session: chrome.sessions.Session,
  tab: chrome.tabs.Tab,
): boolean {
  // Sessions' `lastModified` is only accurate to the second in Chrome whereas `closedAt` is
  // accurate to the millisecond. Convert to ms if needed.
  const lastModifiedMs =
    session.lastModified < 10000000000 ? session.lastModified * 1000 : session.lastModified;

  return (
    session.tab != null &&
    // Tabs with no favIcons have the value `undefined`, but once converted into a session the tab
    // has an empty string (`''`) as its favIcon value. Account for that case for "equality".
    (session.tab.favIconUrl === tab.favIconUrl ||
      (session.tab.favIconUrl === "" && tab.favIconUrl == null)) &&
    session.tab.title === tab.title &&
    session.tab.url === tab.url &&
    // Ensure the browser's last modified time is within 1s of Tab Wrangler's close to as a fuzzy,
    // but likely always correct, match.
    // @ts-expect-error `closedAt` is a TW expando property on tabs
    Math.abs(lastModifiedMs - tab.closedAt) < 1000
  );
}
