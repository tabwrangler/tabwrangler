/* @flow */

import * as tempStorageActions from './js/actions/tempStorageActions';
import _ from 'lodash';
import configureStore from './js/configureStore';
import menus from './js/menus';
import { removeSavedTabId } from './js/actions/localStorageActions';
import settings from './js/settings';
import tabmanager from './js/tabmanager';
import updater from './js/updater';

// Declare this global namespace so it can be used from popup.js
// @see startup();
const TW = (window.TW = {});

/**
 * @todo: refactor into "get the ones to close" and "close 'em" So it can be tested.
 */
const checkToClose = function(cutOff: ?number) {
  try {
    cutOff = cutOff || new Date().getTime() - ((settings.get('stayOpen'): any): number);
    const minTabs = ((settings.get('minTabs'): any): number);

    // Tabs which have been locked via the checkbox.
    const lockedIds = ((settings.get('lockedIds'): any): Array<number>);
    const toCut = tabmanager.getOlderThen(cutOff);

    if (!settings.get('paused')) {
      // Update the selected one to make sure it doesn't get closed.
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabmanager.updateLastAccessed);

      if (settings.get('filterAudio') === true) {
        chrome.tabs.query({ audible: true }, tabmanager.updateLastAccessed);
      }

      chrome.windows.getAll({ populate: true }, function(windows) {
        let tabs = []; // Array of tabs, populated for each window.
        windows.forEach(myWindow => {
          tabs = myWindow.tabs;
          if (tabs == null) return;

          // Filter out the pinned tabs
          tabs = tabs.filter(tab => tab.pinned === false);
          // Filter out audible tabs if the option to do so is checked
          tabs = tabs.filter(tab => (tab.audible && settings.get('filterAudio')) === false);

          let tabsToCut = tabs.filter(t => t.id == null || toCut.indexOf(t.id) !== -1);
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

let checkToCloseTimeout: ?number;
function scheduleCheckToClose() {
  if (checkToCloseTimeout != null) window.clearTimeout(checkToCloseTimeout);
  checkToCloseTimeout = window.setTimeout(checkToClose, settings.get('checkInterval'));
}

const closeTab = function(tab) {
  if (true === tab.pinned) {
    return;
  }

  if (settings.get('filterAudio') && tab.audible) {
    return;
  }

  if (tab.url != null && tabmanager.isWhitelisted(tab.url)) {
    return;
  }

  tabmanager.closedTabs.wrangleTabs([tab]);
};

const onNewTab = function(tab) {
  // Check if it exists in corral already. The 2nd argument is an array of filters, we add one
  // filter which checks for an exact URL match. If we match, throw the old entry away.
  if (tab.url != null) {
    const matchingTabs = tabmanager.searchTabs([tabmanager.filters.exactUrl(tab.url)]);
    matchingTabs.forEach(t => {
      if (t.id == null) return;
      TW.store.dispatch(removeSavedTabId(t.id));
    });
  }

  // Add the new one;
  if (tab.id != null) tabmanager.updateLastAccessed(tab.id);
};

const startup = function() {
  const { persistor, store } = configureStore();
  TW.store = store;
  TW.persistor = persistor;

  settings.init();
  updater.run();

  TW.settings = settings;
  TW.updater = updater;
  TW.tabmanager = tabmanager;

  if (settings.get('purgeClosedTabs') !== false) {
    tabmanager.closedTabs.clear();
  }
  settings.set('lockedIds', []);

  const debouncedUpdateLastAccessed = _.debounce(
    tabmanager.updateLastAccessed.bind(tabmanager),
    1000
  );
  // Move this to a function somehwere so we can restart the process.
  chrome.tabs.query(
    {
      windowType: 'normal',
    },
    tabmanager.initTabs
  );
  chrome.tabs.onCreated.addListener(onNewTab);
  chrome.tabs.onRemoved.addListener(tabmanager.removeTab);
  chrome.tabs.onReplaced.addListener(tabmanager.replaceTab);
  chrome.tabs.onActivated.addListener(function(tabInfo) {
    menus.updateContextMenus(tabInfo['tabId']);

    if (settings.get('debounceOnActivated')) {
      debouncedUpdateLastAccessed(tabInfo['tabId']);
    } else {
      tabmanager.updateLastAccessed(tabInfo['tabId']);
    }
  });
  scheduleCheckToClose();

  // Create the "lock tab" context menu:
  menus.createContextMenus();

  chrome.commands.onCommand.addListener(command => {
    switch (command) {
      case 'wrangle-current-tab':
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          tabmanager.closedTabs.wrangleTabs(tabs);
        });
        break;
      default:
        break;
    }
  });

  chrome.commands.getAll(commands => {
    store.dispatch(tempStorageActions.setCommands(commands));
  });

  function updateSessionsRecentlyClosed() {
    chrome.sessions.getRecentlyClosed(sessions => {
      store.dispatch(tempStorageActions.setSessions(sessions));
    });
  }
  chrome.sessions.onChanged.addListener(updateSessionsRecentlyClosed);
  updateSessionsRecentlyClosed();
};

startup();
