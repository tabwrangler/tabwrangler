import { Persistor } from "redux-persist";
import { Store } from "redux";
import configureStore from "./js/configureStore";
import debounce from "lodash.debounce";
import menus from "./js/menus";
import settings from "./js/settings";
import tabmanager from "./js/tabmanager";
import watch from "redux-watch";

const checkToClose = function (cutOff: number | null) {
  try {
    cutOff = cutOff || new Date().getTime() - settings.get<number>("stayOpen");
    const minTabs = settings.get<number>("minTabs");

    // Tabs which have been locked via the checkbox.
    const lockedIds = settings.get<Array<number>>("lockedIds");
    const toCut = tabmanager.getOlderThen(cutOff);

    if (!window.TW.store.getState().settings.paused) {
      // Update the selected one to make sure it doesn't get closed.
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabmanager.updateLastAccessed);

      if (settings.get("filterAudio") === true) {
        chrome.tabs.query({ audible: true }, tabmanager.updateLastAccessed);
      }

      chrome.windows.getAll({ populate: true }, function (windows) {
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

          let tabsToCut = tabs.filter((t) => t.id == null || toCut.indexOf(t.id) !== -1);
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
      });
    }
  } finally {
    scheduleCheckToClose();
  }
};

let checkToCloseTimeout: number | null;
function scheduleCheckToClose() {
  if (checkToCloseTimeout != null) window.clearTimeout(checkToCloseTimeout);
  checkToCloseTimeout = window.setTimeout(checkToClose, settings.get("checkInterval"));
}

// Updates closed count badge in the URL bar whenever the store updates.
function watchClosedCount(store: Store) {
  const savedTabsCountWatch = watch(store.getState, "localStorage.savedTabs");
  store.subscribe(
    savedTabsCountWatch(() => {
      tabmanager.updateClosedCount();
    })
  );
}

// Updates icon in tab bar when the extension is paused/resumed.
function watchPaused(store: Store) {
  const pausedWatch = watch(store.getState, "settings.paused");
  store.subscribe(
    pausedWatch((paused) => {
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
          tabmanager.initTabs
        );
      }
    })
  );
}

const closeTab = function (tab: chrome.tabs.Tab) {
  if (true === tab.pinned) {
    return;
  }

  if (settings.get("filterAudio") && tab.audible) {
    return;
  }

  if (tab.url != null && tabmanager.isWhitelisted(tab.url)) {
    return;
  }

  tabmanager.closedTabs.wrangleTabs([tab]);
};

const onNewTab = function (tab: chrome.tabs.Tab) {
  // Track new tab's time to close.
  if (tab.id != null) tabmanager.updateLastAccessed(tab.id);
};

const startup = function () {
  const { persistor, store } = configureStore();

  watchClosedCount(store);
  watchPaused(store);

  settings.init();

  // Declare this global namespace so it can be used from popup.js
  window.TW = {
    persistor,
    settings,
    store,
    tabmanager,
  };

  if (settings.get("purgeClosedTabs") !== false) {
    tabmanager.closedTabs.clear();
  }
  settings.set("lockedIds", []);

  const debouncedUpdateLastAccessed = debounce(
    tabmanager.updateLastAccessed.bind(tabmanager),
    1000
  );
  // Move this to a function somehwere so we can restart the process.
  chrome.tabs.query({ windowType: "normal" }, tabmanager.initTabs);
  chrome.tabs.onCreated.addListener(onNewTab);
  chrome.tabs.onRemoved.addListener(tabmanager.removeTab);
  chrome.tabs.onReplaced.addListener(tabmanager.replaceTab);
  chrome.tabs.onActivated.addListener(function (tabInfo) {
    menus.updateContextMenus(tabInfo["tabId"]);

    if (settings.get("debounceOnActivated")) {
      debouncedUpdateLastAccessed(tabInfo["tabId"]);
    } else {
      tabmanager.updateLastAccessed(tabInfo["tabId"]);
    }
  });
  scheduleCheckToClose();

  // Create the "lock tab" context menu:
  menus.createContextMenus();

  chrome.commands.onCommand.addListener((command) => {
    switch (command) {
      case "lock-unlock-active-tab":
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          tabmanager.toggleTabs(tabs);
        });
        break;
      case "wrangle-current-tab":
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          tabmanager.closedTabs.wrangleTabs(tabs);
        });
        break;
      default:
        break;
    }
  });
};

startup();

// Augment global `window` with the TabWrangler object that gets created on startup.
declare global {
  interface Window {
    TW: {
      persistor: Persistor;
      settings: typeof settings;
      store: Store;
      tabmanager: typeof tabmanager;
    };
  }
}
