import Menus from "./js/menus";
import TabManager from "./js/tabmanager";
import configureStore from "./js/configureStore";
import debounce from "lodash.debounce";
import { removeAllSavedTabs } from "./js/actions/localStorageActions";
import settings from "./js/settings";

async function startup() {
  // Ensure settings are loaded before proceeding; Settings reads from async browser storage.
  await settings.init();

  // Ensure store has rehydrated before proceeding; Store reads from async browser storage.
  const { store } = await new Promise<ReturnType<typeof configureStore>>((resolve) => {
    const storeConfig = configureStore(() => resolve(storeConfig));
  });

  const tabmanager = new TabManager(store);
  const menus = new Menus(tabmanager);

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

    tabmanager.wrangleTabs([tab]);
  }

  async function checkToClose(cutOff: number | null) {
    try {
      cutOff = cutOff || new Date().getTime() - settings.get<number>("stayOpen");
      const minTabs = settings.get<number>("minTabs");

      // Tabs which have been locked via the checkbox.
      const lockedIds = settings.get<Array<number>>("lockedIds");
      const toCut = tabmanager.getOlderThen(cutOff);

      if (!store.getState().settings.paused) {
        // Update the selected tabs to make sure they don't get closed.
        const activeTabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
          chrome.tabs.query({ active: true, lastFocusedWindow: true }, resolve);
        });
        tabmanager.updateLastAccessed(activeTabs);

        // Update audible tabs if the setting is enabled to prevent them from being closed.
        if (settings.get("filterAudio") === true) {
          const audibleTabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
            chrome.tabs.query({ audible: true }, resolve);
          });
          tabmanager.updateLastAccessed(audibleTabs);
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
              if (tabId != null && myWindow.focused) tabmanager.updateLastAccessed(tabId);
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
              tabmanager.updateLastAccessed(tabId);
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
    if (checkToCloseTimeout != null) window.clearTimeout(checkToCloseTimeout);
    checkToCloseTimeout = window.setTimeout(checkToClose, settings.get("checkInterval"));
  }

  function setPaused(paused: boolean) {
    if (paused) {
      chrome.browserAction.setIcon({ path: "img/icon-paused.png" });
    } else {
      chrome.browserAction.setIcon({ path: "img/icon.png" });

      // The user has just unpaused, immediately set all tabs to the current time so they will not
      // be closed.
      chrome.tabs.query(
        {
          windowType: "normal",
        },
        (tabs) => {
          tabmanager.initTabs(tabs);
        }
      );
    }
  }

  const debouncedUpdateLastAccessed = debounce(
    tabmanager.updateLastAccessed.bind(tabmanager),
    1000
  );

  chrome.tabs.query({ windowType: "normal" }, tabmanager.initTabs.bind(tabmanager));
  chrome.tabs.onCreated.addListener(tabmanager.onNewTab.bind(tabmanager));
  chrome.tabs.onRemoved.addListener(tabmanager.removeTab.bind(tabmanager));
  chrome.tabs.onReplaced.addListener(tabmanager.replaceTab.bind(tabmanager));
  chrome.tabs.onActivated.addListener(function (tabInfo) {
    menus.updateContextMenus(tabInfo["tabId"]);

    if (settings.get("debounceOnActivated")) {
      debouncedUpdateLastAccessed(tabInfo["tabId"]);
    } else {
      tabmanager.updateLastAccessed(tabInfo["tabId"]);
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
          tabmanager.wrangleTabs(tabs);
        });
        break;
      default:
        break;
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    switch (areaName) {
      case "local": {
        if (changes["savedTabs"]) {
          tabmanager.updateClosedCount();
        }
        break;
      }

      case "sync": {
        if (changes["minutesInactive"] || changes["secondsInactive"]) {
          // Reset the tabTimes since we changed the setting
          store.dispatch({ type: "RESET_TAB_TIMES" });
          chrome.tabs.query({ windowType: "normal" }, (tabs) => {
            tabmanager.initTabs(tabs);
          });
        }

        if (changes["persist:settings"]) {
          if (
            changes["persist:settings"].newValue["paused"] !==
            changes["persist:settings"].oldValue["paused"]
          ) {
            setPaused(changes["persist:settings"].newValue["paused"]);
          }
        }

        if (changes["showBadgeCount"]) {
          tabmanager.updateClosedCount(changes["showBadgeCount"].newValue);
        }
        break;
      }
    }
  });

  setPaused(store.getState().settings.paused);

  // Because the badge count is external state, this side effect must be run once the value
  // is read from storage. This could more elequently be handled in an action creator.
  tabmanager.updateClosedCount();

  if (settings.get("purgeClosedTabs") !== false) {
    store.dispatch(removeAllSavedTabs());
  }

  // Kick off checking for tabs to close
  scheduleCheckToClose();
}

startup();
