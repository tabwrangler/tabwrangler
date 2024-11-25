import { ASYNC_LOCK, migrateLocal } from "./js/storage";
import {
  StorageLocalPersistState,
  getStorageLocalPersist,
  getStorageSyncPersist,
} from "./js/queries";
import {
  initTabs,
  onNewTab,
  removeTab,
  updateClosedCount,
  updateLastAccessed,
  wrangleTabs,
  wrangleTabsAndPersist,
} from "./js/tabUtil";
import Menus from "./js/menus";
import debounce from "lodash.debounce";
import { removeAllSavedTabs } from "./js/actions/localStorageActions";
import settings from "./js/settings";

const menus = new Menus();

function setPaused(paused: boolean): Promise<void> {
  if (paused) {
    return chrome.action.setIcon({ path: "img/icon-paused.png" });
  } else {
    return chrome.action.setIcon({ path: "img/icon.png" });
  }
}

const debouncedUpdateLastAccessed = debounce(updateLastAccessed, 1000);
chrome.runtime.onInstalled.addListener(async () => {
  await settings.init();
  if (settings.get("createContextMenu")) Menus.create();
  migrateLocal();
});

chrome.tabs.onActivated.addListener(async function onActivated(tabInfo) {
  await settings.init();

  if (settings.get("createContextMenu")) menus.updateContextMenus(tabInfo.tabId);

  if (settings.get("debounceOnActivated")) {
    debouncedUpdateLastAccessed(tabInfo.tabId);
  } else {
    updateLastAccessed(tabInfo.tabId);
  }
});
chrome.tabs.onCreated.addListener(onNewTab);
chrome.tabs.onRemoved.addListener(removeTab);

chrome.tabs.onReplaced.addListener(function replaceTab(addedTabId: number, removedTabId: number) {
  ASYNC_LOCK.acquire(["local.tabTimes", "persist:settings"], async () => {
    // Replace tab ID in array of locked IDs if the removed tab was locked
    const { lockedIds } = await chrome.storage.sync.get({ lockedIds: [] });
    if (lockedIds.indexOf(removedTabId) !== -1) {
      lockedIds.splice(lockedIds.indexOf(removedTabId), 1, addedTabId);
      await chrome.storage.sync.set({ lockedIds });
      console.debug("[onReplaced] Re-locked tab: removedId, addedId", removedTabId, addedTabId);
    }

    // Replace tab ID in object of tab times keeping the same time remaining for the added tab ID
    const { tabTimes } = await chrome.storage.local.get({ tabTimes: {} });
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
      if (changes.savedTabs) {
        updateClosedCount();
      }
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
          changes["persist:settings"].newValue.paused !==
          changes["persist:settings"].oldValue?.paused
        ) {
          setPaused(changes["persist:settings"].newValue.paused);
        }
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

    const cutOff = new Date().getTime() - settings.get<number>("stayOpen");
    const minTabs = settings.get<number>("minTabs");
    let tabsToCloseCandidates: chrome.tabs.Tab[] = [];

    await ASYNC_LOCK.acquire("local.tabTimes", async () => {
      const { tabTimes } = await chrome.storage.local.get({ tabTimes: {} });

      // Tabs which have been locked via the checkbox.
      const lockedIds = settings.get<Array<number>>("lockedIds");
      const toCut = getTabsOlderThan(tabTimes, cutOff);
      const updatedAt = Date.now();

      // Update selected tabs to make sure they don't get closed.
      const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      activeTabs.forEach((tab) => {
        tabTimes[String(tab.id)] = updatedAt;
      });

      // Update audible tabs if the setting is enabled to prevent them from being closed.
      if (settings.get("filterAudio") === true) {
        const audibleTabs = await chrome.tabs.query({ audible: true });
        audibleTabs.forEach((tab) => {
          tabTimes[String(tab.id)] = updatedAt;
        });
      }

      function findTabsToCloseCandidates(
        tabs: chrome.tabs.Tab[],
        { resetIfNoCandidates }: { resetIfNoCandidates: boolean },
      ): chrome.tabs.Tab[] {
        // Filter out pinned tabs
        tabs = tabs.filter((tab) => tab.pinned === false);
        // Filter out audible tabs if the option to do so is checked
        tabs = settings.get<boolean>("filterAudio") ? tabs.filter((tab) => !tab.audible) : tabs;
        // Filter out tabs that are in a group if the option to do so is checked
        tabs = settings.get<boolean>("filterGroupedTabs")
          ? tabs.filter((tab) => !("groupId" in tab) || tab.groupId <= 0)
          : tabs;

        let tabsToCut = tabs.filter((tab) => tab.id == null || toCut.indexOf(tab.id) !== -1);
        if (tabs.length - minTabs <= 0) {
          // * We have less than minTab tabs, abort.
          // * Also, reset the last accessed time of our current tabs so they don't get closed
          //   when we add a new one
          for (let i = 0; i < tabs.length; i++) {
            const tabId = tabs[i].id;
            if (tabId != null && resetIfNoCandidates) tabTimes[tabId] = updatedAt;
          }
          return [];
        }

        // If cutting will reduce us below `minTabs`, only remove the first N to get to `minTabs`.
        tabsToCut = tabsToCut.splice(0, tabs.length - minTabs);
        if (tabsToCut.length === 0) {
          return [];
        }

        const candidates = [];
        for (let i = 0; i < tabsToCut.length; i++) {
          const tabId = tabsToCut[i].id;
          if (tabId == null) continue;
          if (lockedIds.indexOf(tabId) !== -1) {
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

      if (settings.get("minTabsStrategy") === "allWindows") {
        // * "allWindows" - sum tabs across all open browser windows
        const tabs = await chrome.tabs.query({});
        tabsToCloseCandidates = findTabsToCloseCandidates(tabs, {
          resetIfNoCandidates: false,
        });
      } else {
        // * "givenWindow" (default) - count tabs within any given window
        const windows = await chrome.windows.getAll({ populate: true });
        tabsToCloseCandidates = windows
          .map((win) =>
            win.tabs == null
              ? []
              : findTabsToCloseCandidates(win.tabs, { resetIfNoCandidates: win.focused }),
          )
          .reduce((acc, candidates) => acc.concat(candidates), []);
      }

      // Populate and cull `tabTimes` before storing again.
      // * Tab was missing from the object? the `tabs.query` will return it and its time will be
      //   populated
      // * Tab no longer exists? reducing `tabs.query` will not yield that dead tab ID and it will
      //   not exist in resulting `nextTabTimes`
      const allTabs = await chrome.tabs.query({});
      const nextTabTimes = allTabs.reduce(
        (acc, tab) => {
          if (tab.id != null) acc[tab.id] = tabTimes[tab.id] || updatedAt;
          return acc;
        },
        {} as { [key: string]: number },
      );

      await chrome.storage.local.set({ tabTimes: nextTabTimes });
    });

    const tabsToClose = tabsToCloseCandidates.filter(
      (tab) =>
        !(
          true === tab.pinned ||
          (settings.get("filterAudio") && tab.audible) ||
          (tab.url != null && !settings.isWhitelisted(tab.url, tab.title))
        ),
    );

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
    scheduleCheckToClose();
  }
}

async function startup() {
  // Load settings before proceeding; Settings reads from async browser storage.
  await settings.init();

  const storageSyncPersist = await getStorageSyncPersist();
  setPaused(storageSyncPersist.paused);

  // Because the badge count is external state, this side effect must be run once the value
  // is read from storage.
  updateClosedCount();

  if (settings.get("purgeClosedTabs") !== false) {
    await removeAllSavedTabs();
  }

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
