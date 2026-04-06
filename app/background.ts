import { ASYNC_LOCK, migrateLocal } from "./js/storage";
import {
  StorageLocalPersistState,
  getStorageLocalPersist,
  getStorageSyncPersist,
} from "./js/queries";
import {
  initTabs,
  isTabLocked,
  makeTabPersistKey,
  makeWindowPersistKey,
  onNewTab,
  removeTab,
  shouldTabBeClosed,
  updateClosedCount,
  updateLastAccessed,
  wrangleTabs,
  wrangleTabsAndPersist,
} from "./js/tabUtil";
import Menus from "./js/menus";
import { debounce } from "lodash-es";
import { removeAllSavedTabs } from "./js/actions/localStorageActions";
import settings from "./js/settings";

const menus = new Menus();

// Flag to prevent onNewTab from resetting tab times during startup. Chrome fires tabs.onCreated
// for restored tabs on restart, which would reset their countdowns before the startup migration can
// preserve them.
let startupComplete = false;

// Resolves with the list of tabs restored from the previous session. During restoration, Chrome
// fires tabs.onCreated for each restored tab. We wait up to 5s for the first event to arrive; if
// none arrives, there is nothing to restore. Once restoration starts, we debounce: the promise
// resolves 1s after the last onCreated event, indicating the burst of restored tabs has settled.
const TABS_RESTORED_FIRST_EVENT_MS = 5_000;
const TABS_RESTORED_DEBOUNCE_MS = 1_000;
let resolveTabsRestored!: (tabs: chrome.tabs.Tab[]) => void;
const tabsRestoredPromise = new Promise<chrome.tabs.Tab[]>((resolve) => {
  resolveTabsRestored = resolve;
});

const restoredTabs: chrome.tabs.Tab[] = [];
let tabsRestoredTimeout: ReturnType<typeof setTimeout> | null = setTimeout(
  () => resolveTabsRestored(restoredTabs),
  TABS_RESTORED_FIRST_EVENT_MS,
);

const ICON_LOCKED_PATH = "img/icon-locked.png";
const ICON_PATH = "img/icon.png";
const ICON_PAUSED_PATH = "img/icon-paused.png";

let updateIconGeneration = 0;
async function updateIcon(tab?: chrome.tabs.Tab): Promise<void> {
  const generation = ++updateIconGeneration;
  const storageSyncPersist = await getStorageSyncPersist();

  // Ignore any but the most recent callback.
  if (generation !== updateIconGeneration) return;

  if (storageSyncPersist.paused) {
    await chrome.action.setIcon({ path: ICON_PAUSED_PATH });
    return;
  }

  // Use the provided tab, or fall back to the active tab in the last focused window.
  let activeTab = tab;
  if (activeTab == null) {
    [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (generation !== updateIconGeneration) return;
  }

  const lockOptions = {
    filterAudio: settings.get("filterAudio"),
    filterGroupedTabs: settings.get("filterGroupedTabs"),
    lockedIds: settings.get("lockedIds"),
    lockedWindowIds: settings.get("lockedWindowIds"),
    whitelist: settings.get("whitelist"),
  };

  await chrome.action.setIcon({
    path: activeTab != null && isTabLocked(activeTab, lockOptions) ? ICON_LOCKED_PATH : ICON_PATH,
  });
}

const debouncedUpdateLastAccessed = debounce(updateLastAccessed, 1000);
chrome.runtime.onInstalled.addListener(async () => {
  await settings.init();
  if (settings.get("createContextMenu")) Menus.create();
  migrateLocal();
});

let onActivatedGeneration = 0;
chrome.tabs.onActivated.addListener(async function onActivated(tabInfo) {
  const generation = ++onActivatedGeneration;
  await settings.init();

  // *Always* update last accessed because onActivated always matters for each tab
  if (settings.get("debounceOnActivated")) debouncedUpdateLastAccessed(tabInfo.tabId);
  else updateLastAccessed(tabInfo.tabId);

  // Ignore any but the most recent callback.
  if (generation !== onActivatedGeneration) return;

  if (settings.get("createContextMenu")) menus.updateContextMenus(tabInfo.tabId);

  const tab = await chrome.tabs.get(tabInfo.tabId);

  // Ignore any but the most recent callback.
  if (generation !== onActivatedGeneration) return;

  updateIcon(tab);
});

chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
  // During startup, accumulate restored tabs. The first event switches from the 5s first-event
  // timeout to a 1s debounce; each subsequent event resets that debounce. Once 1s passes without a
  // new onCreated event, tabsRestoredPromise resolves with the full list.
  if (!startupComplete) {
    restoredTabs.push(tab);
    if (tabsRestoredTimeout != null) clearTimeout(tabsRestoredTimeout);
    tabsRestoredTimeout = setTimeout(
      () => resolveTabsRestored(restoredTabs),
      TABS_RESTORED_DEBOUNCE_MS,
    );
    return;
  }
  onNewTab(tab);
});

chrome.tabs.onRemoved.addListener(removeTab);

chrome.tabs.onReplaced.addListener(function replaceTab(addedTabId: number, removedTabId: number) {
  ASYNC_LOCK.acquire(["local.tabTimes", "persist:settings"], async () => {
    // Read from both storage areas in parallel (they are independent).
    const [{ lockedIds }, { tabTimes }] = await Promise.all([
      chrome.storage.sync.get({ lockedIds: [] }),
      chrome.storage.local.get({ tabTimes: {} }),
    ]);

    // Replace tab ID in array of locked IDs if the removed tab was locked
    if (lockedIds.indexOf(removedTabId) !== -1) {
      lockedIds.splice(lockedIds.indexOf(removedTabId), 1, addedTabId);
      await chrome.storage.sync.set({ lockedIds });
      console.debug("[onReplaced] Re-locked tab: removedId, addedId", removedTabId, addedTabId);
    }

    // Replace tab ID in object of tab times keeping the same time remaining for the added tab ID
    tabTimes[addedTabId] = tabTimes[removedTabId];
    delete tabTimes[removedTabId];
    await chrome.storage.local.set({
      tabTimes,
    });
    console.debug("[onReplaced] Replaced tab time: removedId, addedId", removedTabId, addedTabId);
  });
});

// Clean up locked window IDs when windows are closed.
chrome.windows.onRemoved.addListener((windowId: number) => {
  settings.unlockWindow(windowId);
});

chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case "lock-unlock-active-tab":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        settings.toggleTabs(tabs);
      });
      break;
    case "wrangle-current-tab":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        wrangleTabsAndPersist(tabs);
      });
      break;
    default:
      break;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  switch (areaName) {
    case "local": {
      updateClosedCount();
      break;
    }

    case "sync": {
      if (changes.minutesInactive || changes.secondsInactive) {
        // Reset stored `tabTimes` because setting was changed otherwise old times may exceed new
        // setting value.
        initTabs();
      }

      if (changes["persist:settings"]) {
        if (
          changes["persist:settings"]?.newValue.paused !==
          changes["persist:settings"]?.oldValue?.paused
        ) {
          updateIcon();
        }
      }

      if (changes.lockedIds || changes.lockedWindowIds) {
        updateIcon();
      }

      if (changes.showBadgeCount) {
        updateClosedCount(changes.showBadgeCount.newValue);
      }
      break;
    }
  }
});

function getTabsOlderThan(
  tabTimes: StorageLocalPersistState["tabTimes"],
  time: number,
): Array<number> {
  const ret: Array<number> = [];
  for (const [tabId, tabTime] of Object.entries(tabTimes)) {
    if (!time || tabTime < time) ret.push(parseInt(tabId, 10));
  }
  return ret;
}

let checkToCloseTimeout: NodeJS.Timeout | undefined;
function scheduleCheckToClose() {
  if (checkToCloseTimeout != null) clearTimeout(checkToCloseTimeout);
  checkToCloseTimeout = setTimeout(checkToClose, 5000);
}

async function checkToClose() {
  const startTime = Date.now();
  try {
    const storageSyncPersist = await getStorageSyncPersist();
    if (storageSyncPersist.paused) return; // Extension is paused, no work needs to be done.

    const cutOff = new Date().getTime() - settings.stayOpen();
    const minTabs = settings.get("minTabs");
    const tabsToCloseCandidates = await ASYNC_LOCK.acquire("local.tabTimes", async () => {
      const allTabs = await chrome.tabs.query({});
      const { tabTimes } = await chrome.storage.local.get({ tabTimes: {} });

      // Tabs which have been locked via the checkbox.
      const lockedIds = new Set(settings.get("lockedIds"));
      const lockedWindowIds = new Set(settings.get("lockedWindowIds"));
      const toCut = new Set(getTabsOlderThan(tabTimes, cutOff));
      const updatedAt = Date.now();

      // Update selected tabs to make sure they don't get closed.
      const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      activeTabs.forEach((tab) => {
        tabTimes[String(tab.id)] = updatedAt;
      });

      // Update audible tabs if the setting is enabled to prevent them from being closed.
      if (settings.get("filterAudio") === true) {
        // Note: This does not use the `audible:true` filter in `.query` because it is broken in
        // some Chromium browsers.
        // @see https://github.com/tabwrangler/tabwrangler/issues/519
        allTabs.forEach((tab) => {
          if (tab.audible) tabTimes[String(tab.id)] = updatedAt;
        });
      }

      function findTabsToCloseCandidates(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[] {
        tabs = tabs.filter(shouldTabBeClosed);

        let tabsToCut = tabs.filter((tab) => tab.id == null || toCut.has(tab.id));
        if (tabs.length - minTabs <= 0) {
          return [];
        }

        // Sort by lastAccessed ascending (oldest first) so the least recently used tabs are closed
        // first. `lastAccessed` is not available on all browsers/versions, so fall back to the
        // original tab order when it is absent.
        tabsToCut.sort((a, b) => {
          if (a.lastAccessed == null || b.lastAccessed == null) return 0;
          return a.lastAccessed - b.lastAccessed;
        });

        // If cutting will reduce us below `minTabs`, only remove the first N to get to `minTabs`.
        tabsToCut = tabsToCut.splice(0, tabs.length - minTabs);
        if (tabsToCut.length === 0) {
          return [];
        }

        const candidates = [];
        for (let i = 0; i < tabsToCut.length; i++) {
          const tabId = tabsToCut[i].id;
          if (tabId == null) continue;
          if (lockedIds.has(tabId)) {
            // Update its time so it gets checked less frequently.
            // Would also be smart to just never add it.
            // @todo: fix that.
            tabTimes[String(tabId)] = updatedAt;
            continue;
          }
          candidates.push(tabsToCut[i]);
        }
        return candidates;
      }

      const allWindows = await chrome.windows.getAll({ populate: true });
      let candidateTabs: chrome.tabs.Tab[] = [];
      if (settings.get("minTabsStrategy") === "allWindows") {
        // * "allWindows" - sum tabs across all open browser windows
        candidateTabs = findTabsToCloseCandidates(allTabs);
      } else {
        // * "givenWindow" (default) - count tabs within any given window
        candidateTabs = allWindows
          .map((win) => (win.tabs == null ? [] : findTabsToCloseCandidates(win.tabs)))
          .reduce((acc, candidates) => acc.concat(candidates), []);
      }

      // Populate and cull `tabTimes` before storing again.
      // * Tab was missing from the object? the `tabs.query` will return it and its time will be
      //   populated
      // * Tab no longer exists? reducing `tabs.query` will not yield that dead tab ID and it will
      //   not exist in resulting `nextTabTimes`
      const nextTabTimes: { [key: string]: number } = {};
      const nextTabTimesByPersistKey: { [key: string]: number } = {};
      const lockedTabPersistKeys: string[] = [];
      for (const tab of allTabs) {
        if (tab.id == null) continue;
        const time = tabTimes[tab.id] || updatedAt;
        nextTabTimes[tab.id] = time;
        // Store by persist key so countdowns survive browser restart (tab IDs change).
        const tabPersistKey = makeTabPersistKey(tab);
        if (tabPersistKey != null) {
          nextTabTimesByPersistKey[tabPersistKey] = time;
          if (lockedIds.has(tab.id)) lockedTabPersistKeys.push(tabPersistKey);
        }
      }

      const lockedWindowPersistKeys: string[] = [];
      for (const win of allWindows) {
        if (win.id != null && lockedWindowIds.has(win.id) && win.tabs != null) {
          const key = makeWindowPersistKey(win.tabs);
          if (key != null) lockedWindowPersistKeys.push(key);
        }
      }

      await chrome.storage.local.set({
        lockedTabPersistKeys,
        lockedWindowPersistKeys,
        tabTimes: nextTabTimes,
        tabTimesByPersistKey: nextTabTimesByPersistKey,
      });
      return candidateTabs;
    });

    const tabsToClose = tabsToCloseCandidates.filter(shouldTabBeClosed);

    if (tabsToClose.length > 0) {
      await ASYNC_LOCK.acquire("persist:localStorage", async () => {
        const storageLocalPersist = await getStorageLocalPersist();
        wrangleTabs(storageLocalPersist, tabsToClose);
        await chrome.storage.local.set({
          "persist:localStorage": storageLocalPersist,
        });
      });
    }
  } catch (error) {
    console.error("[checkToClose]", error);
  } finally {
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > 5_000)
      console.warn(`[checkToClose] Took longer than maxExecutionTime: ${elapsedTime}ms`);

    // Record the last time the browser was seen running so startup can correctly compute the
    // offline gap to apply to migrated tab timestamps.
    chrome.storage.local.set({ lastSeenAt: Date.now() });
    scheduleCheckToClose();
  }
}

/**
 * Migrates tab and window data using fingerprinting (not 100% accurate) because tab and window IDs
 * can be lost across browser restarts.
 * @returns Tabs and window IDs that should be re-locked
 */
async function migratePersistedData(
  tabs: chrome.tabs.Tab[],
): Promise<{ tabsToRelock: chrome.tabs.Tab[]; windowIdsToRelock: number[] }> {
  return await ASYNC_LOCK.acquire("local.tabTimes", async () => {
    const now = Date.now();
    const [
      windows,
      { lastSeenAt, lockedTabPersistKeys, lockedWindowPersistKeys, tabTimes, tabTimesByPersistKey },
    ] = await Promise.all([
      chrome.windows.getAll({ populate: true }),
      chrome.storage.local.get({
        lastSeenAt: null,
        lockedTabPersistKeys: [],
        lockedWindowPersistKeys: [],
        tabTimes: {},
        tabTimesByPersistKey: {},
      }),
    ]);

    // Time the browser was closed. Applied to migrated timestamps so that offline time
    // is not counted against a tab's countdown.
    let migratedLockedIds = 0;
    let migratedTabTimes = 0;
    const offlineGap = lastSeenAt == null ? 0 : Math.max(0, now - lastSeenAt);
    const lockedTabPersistKeySet = new Set(lockedTabPersistKeys);
    const tabsToRelock: chrome.tabs.Tab[] = [];
    const nextTabTimes: { [key: string]: number } = {};
    const nextTabTimesByPersistKey: { [key: string]: number } = {};
    const nextLockedTabPersistKeys: string[] = [];
    for (const tab of tabs) {
      if (tab.id == null) continue;

      let tabTime: number;
      const tabPersistKey = makeTabPersistKey(tab);
      if (tabTimes[tab.id] != null) {
        // Tab ID still exists in storage (no restart, or same ID reused) - keep as-is.
        tabTime = tabTimes[tab.id];
      } else if (tabPersistKey != null && tabTimesByPersistKey[tabPersistKey] != null) {
        // Tab ID changed (browser restart) - look up by persist key and shift the timestamp
        // forward by the offline gap so time spent with the browser closed is not counted.
        tabTime = tabTimesByPersistKey[tabPersistKey] + offlineGap;
        migratedTabTimes++;
      } else {
        tabTime = now;
      }

      if (tabPersistKey != null && lockedTabPersistKeySet.has(tabPersistKey)) {
        tabsToRelock.push(tab);
        nextLockedTabPersistKeys.push(tabPersistKey);
        migratedLockedIds++;
      }

      nextTabTimes[tab.id] = tabTime;
      if (tabPersistKey != null) nextTabTimesByPersistKey[tabPersistKey] = tabTime;
    }

    const windowIdsToRelock: number[] = [];
    const nextLockedWindowPersistKeys: string[] = [];
    const lockedWindowPersistKeySet = new Set(lockedWindowPersistKeys);
    let migratedLockedWindowIds = 0;
    for (const window of windows) {
      if (window.id == null || window.tabs == null) continue;
      const key = makeWindowPersistKey(window.tabs);
      if (key != null && lockedWindowPersistKeySet.has(key)) {
        windowIdsToRelock.push(window.id);
        nextLockedWindowPersistKeys.push(key);
        migratedLockedWindowIds++;
      }
    }

    await chrome.storage.local.set({
      lastSeenAt: now,
      lockedTabPersistKeys: nextLockedTabPersistKeys,
      lockedWindowPersistKeys: nextLockedWindowPersistKeys,
      tabTimes: nextTabTimes,
      tabTimesByPersistKey: nextTabTimesByPersistKey,
    });

    console.debug(
      `[startup] Migrated tabTimes:${migratedTabTimes} / lockedIds:${migratedLockedIds} / lockedWindowIds:${migratedLockedWindowIds}`,
    );

    return { tabsToRelock, windowIdsToRelock };
  });
}

async function startup() {
  const [restoredTabs] = await Promise.all([
    // Wait for browser to finish restoring tabs from the previous session before migrating data.
    tabsRestoredPromise,
    settings.init(),
  ]);

  await Promise.all([updateIcon(), updateClosedCount()]);

  if (settings.get("purgeClosedTabs") !== false) await removeAllSavedTabs();

  // Remove stale tab IDs from lockedIds. Use the restored tabs list on browser restart; otherwise
  // query current tabs (service worker restart with no session restore).
  const allTabs = restoredTabs.length > 0 ? restoredTabs : await chrome.tabs.query({});
  await settings.cleanupLockedIds(allTabs);

  // Migrate tab and window data from a browser restart. On a service worker restart,
  // restoredTabs is empty (no tabs.onCreated events fire), tab IDs are unchanged, and there is
  // nothing to migrate.
  if (restoredTabs.length > 0) {
    const { tabsToRelock, windowIdsToRelock } = await migratePersistedData(restoredTabs);
    await Promise.all([settings.lockTabs(tabsToRelock), settings.lockWindows(windowIdsToRelock)]);
  }

  startupComplete = true;
  scheduleCheckToClose();
}

// Keep the [service worker (Chrome) / background script (Firefox)] alive so background can check
// for tabs to close frequently.
// Self-contained workaround for https://crbug.com/1316588 (Apache License)
// Source: https://bugs.chromium.org/p/chromium/issues/detail?id=1316588#c99
let lastAlarm = 0;
(async function lostEventsWatchdog() {
  let quietCount = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 65000));
    const now = Date.now();
    const age = now - lastAlarm;
    console.debug(
      lastAlarm === 0
        ? `[lostEventsWatchdog]: first alarm`
        : `[lostEventsWatchdog]: last alarm ${age / 1000}s ago`,
    );
    if (age < 95000) {
      quietCount = 0; // alarm still works.
    } else if (++quietCount >= 3) {
      console.warn("[lostEventsWatchdog]: reloading!");
      return chrome.runtime.reload();
    } else {
      chrome.alarms.create(`lostEventsWatchdog/${now}`, { delayInMinutes: 0.5 });
    }
  }
})();

chrome.alarms.onAlarm.addListener(() => (lastAlarm = Date.now()));

chrome.runtime.onMessage.addListener((message) => {
  if (message === "reload") {
    console.warn("[runtime.onMessage]: Manual reload");
    chrome.runtime.reload();
    return true;
  } else return false;
});

startup();
