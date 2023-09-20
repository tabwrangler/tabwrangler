import Menus from "./js/menus";
import TabManager from "./js/tabmanager";
import configureStore from "./js/configureStore";
import debounce from "lodash.debounce";
import { removeAllSavedTabs } from "./js/actions/localStorageActions";
import settings from "./js/settings";

// Keep the (background script - Firefox) / (service worker - Chrome) alive so it can check for
// stale tabs as necessary.
// See https://stackoverflow.com/a/66618269/368697
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();

const tabManager = new TabManager();
const menus = new Menus();

function setPaused(paused: boolean) {
  if (paused) {
    chrome.action.setIcon({ path: "img/icon-paused.png" });
  } else {
    chrome.action.setIcon({ path: "img/icon.png" });

    // The user has just unpaused, immediately set all tabs to the current time so they will not
    // be closed.
    chrome.tabs.query(
      {
        windowType: "normal",
      },
      (tabs) => {
        tabManager.initTabs(tabs);
      }
    );
  }
}

const debouncedUpdateLastAccessed = debounce(tabManager.updateLastAccessed.bind(tabManager), 1000);
chrome.runtime.onInstalled.addListener(Menus.install);
chrome.tabs.onCreated.addListener(tabManager.onNewTab.bind(tabManager));
chrome.tabs.onRemoved.addListener(tabManager.removeTab.bind(tabManager));
chrome.tabs.onReplaced.addListener(tabManager.replaceTab.bind(tabManager));
chrome.tabs.onActivated.addListener(function (tabInfo) {
  menus.updateContextMenus(tabInfo.tabId);

  if (settings.get("debounceOnActivated")) {
    debouncedUpdateLastAccessed(tabInfo.tabId);
  } else {
    tabManager.updateLastAccessed(tabInfo.tabId);
  }
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
        tabManager.wrangleTabs(tabs);
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
        tabManager.updateClosedCount();
      }
      break;
    }

    case "sync": {
      if (changes.minutesInactive || changes.secondsInactive) {
        // Reset stored `tabTimes` because setting was changed otherwise old times may exceed new
        // setting value.
        tabManager.resetTabTimes();
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
        tabManager.updateClosedCount(changes.showBadgeCount.newValue);
      }
      break;
    }
  }
});

async function startup() {
  // Load settings before proceeding; Settings reads from async browser storage.
  await settings.init();

  // Rehydrate store before proceeding; Store reads from async browser storage.
  const { store } = await new Promise<ReturnType<typeof configureStore>>((resolve) => {
    const storeConfig = configureStore(() => resolve(storeConfig));
  });

  tabManager.setStore(store);
  menus.setTabManager(tabManager);

  function closeTab(tab: chrome.tabs.Tab) {
    if (true === tab.pinned) {
      return;
    }

    if (settings.get("filterAudio") && tab.audible) {
      return;
    }

    if (tab.url != null && settings.isWhitelisted(tab.url)) {
      return;
    }

    tabManager.wrangleTabs([tab]);
  }

  async function checkToClose(cutOff: number | null) {
    try {
      cutOff = cutOff || new Date().getTime() - settings.get<number>("stayOpen");
      const minTabs = settings.get<number>("minTabs");

      // Tabs which have been locked via the checkbox.
      const lockedIds = settings.get<Array<number>>("lockedIds");
      const toCut = tabManager.getOlderThen(cutOff);

      if (!store.getState().settings.paused) {
        // Update the selected tabs to make sure they don't get closed.
        const activeTabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
          chrome.tabs.query({ active: true, lastFocusedWindow: true }, resolve);
        });
        tabManager.updateLastAccessed(activeTabs);

        // Update audible tabs if the setting is enabled to prevent them from being closed.
        if (settings.get("filterAudio") === true) {
          const audibleTabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
            chrome.tabs.query({ audible: true }, resolve);
          });
          tabManager.updateLastAccessed(audibleTabs);
        }

        const windows = await new Promise<chrome.windows.Window[]>((resolve) => {
          chrome.windows.getAll({ populate: true }, resolve);
        });

        // Array of tabs, populated for each window.
        let tabs: Array<chrome.tabs.Tab> | undefined;
        windows.forEach((myWindow) => {
          tabs = myWindow.tabs;
          if (tabs == null) return;

          // Filter out the pinned tabs
          tabs = tabs.filter((tab) => tab.pinned === false);
          // Filter out audible tabs if the option to do so is checked
          tabs = settings.get("filterAudio") ? tabs.filter((tab) => !tab.audible) : tabs;
          // Filter out tabs that are in a group if the option to do so is checked
          tabs = settings.get("filterGroupedTabs")
            ? tabs.filter((tab) => !("groupId" in tab) || tab.groupId <= 0)
            : tabs;

          let tabsToCut = tabs.filter((tab) => tab.id == null || toCut.indexOf(tab.id) !== -1);
          if (tabs.length - minTabs <= 0) {
            // We have less than minTab tabs, abort.
            // Also, let's reset the last accessed time of our current tabs so they
            // don't get closed when we add a new one.
            for (let i = 0; i < tabs.length; i++) {
              const tabId = tabs[i].id;
              if (tabId != null && myWindow.focused) tabManager.updateLastAccessed(tabId);
            }
            return;
          }

          // If cutting will reduce us below 5 tabs, only remove the first N to get to 5.
          tabsToCut = tabsToCut.splice(0, tabs.length - minTabs);

          if (tabsToCut.length === 0) {
            return;
          }

          for (let i = 0; i < tabsToCut.length; i++) {
            const tabId = tabsToCut[i].id;
            if (tabId == null) continue;

            if (lockedIds.indexOf(tabId) !== -1) {
              // Update its time so it gets checked less frequently.
              // Would also be smart to just never add it.
              // @todo: fix that.
              tabManager.updateLastAccessed(tabId);
              continue;
            }
            closeTab(tabsToCut[i]);
          }
        });
      }
    } finally {
      scheduleCheckToClose();
    }
  }

  let checkToCloseTimeout: number | null;
  function scheduleCheckToClose() {
    if (checkToCloseTimeout != null) clearTimeout(checkToCloseTimeout);
    checkToCloseTimeout = setTimeout(checkToClose, settings.get("checkInterval"));
  }

  chrome.tabs.query({ windowType: "normal" }, tabManager.initTabs.bind(tabManager));

  setPaused(store.getState().settings.paused);

  // Because the badge count is external state, this side effect must be run once the value
  // is read from storage. This could more elequently be handled in an action creator.
  tabManager.updateClosedCount();

  if (settings.get("purgeClosedTabs") !== false) {
    store.dispatch(removeAllSavedTabs());
  }

  // Kick off checking for tabs to close
  scheduleCheckToClose();
}

startup();
