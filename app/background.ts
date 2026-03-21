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

let updateIconGeneration = 0;
async function updateIcon(tabId?: number): Promise<void> {
  const generation = ++updateIconGeneration;

  let nextIconPath;
  const storageSyncPersist = await getStorageSyncPersist();
  if (storageSyncPersist.paused) {
    nextIconPath = "img/icon-paused.png";
  } else {
    let activeTabId = tabId;
    if (activeTabId == null) {
      const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      activeTabId = activeTabs[0]?.id;
    }

    if (activeTabId != null) {
      const tab = await chrome.tabs.get(activeTabId);
      if (
        tab != null &&
        isTabLocked(tab, {
          filterAudio: settings.get("filterAudio"),
          filterGroupedTabs: settings.get("filterGroupedTabs"),
          lockedIds: settings.get("lockedIds"),
          lockedWindowIds: settings.get("lockedWindowIds"),
          whitelist: settings.get("whitelist"),
        })
      ) {
        nextIconPath = "img/icon-locked.png";
      }
    }
  }

  if (nextIconPath == null) nextIconPath = "img/icon.png";

  // Ignore any but the most recent callback. Because of the above awaits it is possible for the
  // callbacks to happen out-of-order.
  if (generation !== updateIconGeneration) return Promise.resolve();

  return chrome.action.setIcon({ path: nextIconPath });
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

  // Ignore any but the most recent callback. Because of the above `await` it is possible for the
  // callbacks to happen out-of-order.
  if (generation !== onActivatedGeneration) return;

  if (settings.get("createContextMenu")) menus.updateContextMenus(tabInfo.tabId);
  updateIcon(tabInfo.tabId);
});

chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
  // During startup, Chrome fires onCreated for all restored tabs. Skip
  // updateLastAccessed for these to avoid resetting their preserved countdowns.
  if (!startupComplete) {
    console.debug("[onCreated] Skipping during startup for tab", tab.id);
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
  for (const i in tabTimes) {
    if (Object.prototype.hasOwnProperty.call(tabTimes, i)) {
      if (!time || tabTimes[i] < time) {
        ret.push(parseInt(i, 10));
      }
    }
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

      let candidateTabs: chrome.tabs.Tab[] = [];
      if (settings.get("minTabsStrategy") === "allWindows") {
        // * "allWindows" - sum tabs across all open browser windows
        candidateTabs = findTabsToCloseCandidates(allTabs);
      } else {
        // * "givenWindow" (default) - count tabs within any given window
        const windows = await chrome.windows.getAll({ populate: true });
        candidateTabs = windows
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

      await chrome.storage.local.set({
        lockedTabPersistKeys,
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
 * @returns List of tab IDs that should be re-locked
 */
async function migratePersistedData(): Promise<number[]> {
  return await ASYNC_LOCK.acquire("local.tabTimes", async () => {
    const now = Date.now();
    const [allTabs, { lastSeenAt, lockedTabPersistKeys, tabTimes, tabTimesByPersistKey }] =
      await Promise.all([
        chrome.tabs.query({}),
        chrome.storage.local.get({
          lastSeenAt: null,
          lockedTabPersistKeys: [],
          tabTimes: {},
          tabTimesByPersistKey: {},
        }),
      ]);

    // Time the browser was closed. Applied to migrated timestamps so that offline time
    // is not counted against a tab's countdown.
    let migratedTabsCount = 0;
    const offlineGap = lastSeenAt == null ? 0 : Math.max(0, now - lastSeenAt);
    const lockedTabPersistKeySet = new Set(lockedTabPersistKeys);
    const tabIdsToRelock: number[] = [];
    const nextTabTimes: { [key: string]: number } = {};
    const nextTabTimesByPersistKey: { [key: string]: number } = {};
    const nextLockedTabPersistKeys: string[] = [];
    for (const tab of allTabs) {
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
        if (lockedTabPersistKeySet.has(tabPersistKey)) {
          tabIdsToRelock.push(tab.id);
          nextLockedTabPersistKeys.push(tabPersistKey);
        }
        migratedTabsCount++;
      } else {
        // No matching stored time - start a fresh countdown.
        tabTime = now;
      }

      nextTabTimes[tab.id] = tabTime;
      if (tabPersistKey != null) nextTabTimesByPersistKey[tabPersistKey] = tabTime;
    }

    await chrome.storage.local.set({
      lastSeenAt: now,
      lockedTabPersistKeys: nextLockedTabPersistKeys,
      tabTimes: nextTabTimes,
      tabTimesByPersistKey: nextTabTimesByPersistKey,
    });

    console.debug(`[startup] Migrated ${migratedTabsCount} tab timer(s) from previous session`);
    return tabIdsToRelock;
  });
}

async function startup() {
  // Load settings before proceeding; Settings reads from async browser storage.
  await settings.init();

  await Promise.all([
    // Match icon to lock status of active tab
    updateIcon(),
    // Because the badge count is external state, this side effect must be run once the value
    // is read from storage.
    updateClosedCount(),
  ]);

  if (settings.get("purgeClosedTabs") !== false) {
    await removeAllSavedTabs();
  }

  // Migrate tab times from previous session: after a browser restart.
  const tabIdsToRelock = await migratePersistedData();

  // Persisted locked IDs must be relocked because they may have been culled by `settings.init`
  // when the IDs changeed.
  await settings.lockTabs(tabIdsToRelock);

  // Mark startup complete so onNewTab starts tracking new tabs normally.
  startupComplete = true;

  // Kick off checking for tabs to close
  scheduleCheckToClose();
}

startup();

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
