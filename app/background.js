/* @flow */

import _ from 'underscore';
import menus from './js/menus';
import settings from './js/settings';
import storageLocal from './js/storageLocal';
import tabmanager from './js/tabmanager';
import updater from './js/updater';

// Declare this global namespace so it can be used from popup.js
// @see startup();
const TW = window.TW = {};

/**
 * @todo: refactor into "get the ones to close" and "close 'em"
 * So it can be tested.
 */
const checkToClose = function(cutOff) {
  let i;
  cutOff = cutOff || new Date().getTime() - ((settings.get('stayOpen'): any): number);
  const minTabs = ((settings.get('minTabs'): any): number);

  // Tabs which have been locked via the checkbox.
  const lockedIds = ((settings.get('lockedIds'): any): Array<number>);
  const toCut = tabmanager.getOlderThen(cutOff);

  if (settings.get('paused') === true) {
    return;
  }

  // Update the selected one to make sure it doesn't get closed.
  chrome.tabs.query({active: true}, tabmanager.updateLastAccessed);

  chrome.windows.getAll({populate:true}, function(windows) {
    let tabs = []; // Array of tabs, populated for each window.
    windows.forEach(myWindow => {
      tabs = myWindow.tabs;
      if (tabs == null) return;

      // Filter out the pinned tabs
      tabs = tabs.filter(tab => tab.pinned === false);
      let tabsToCut = tabs.filter(t => t.id == null || toCut.indexOf(t.id) !== -1);
      if ((tabs.length - minTabs) <= 0) {
        // We have less than minTab tabs, abort.
        // Also, let's reset the last accessed time of our current tabs so they
        // don't get closed when we add a new one.
        for (i = 0; i < tabs.length; i++) {
          const tabId = tabs[i].id;
          if (tabId != null) tabmanager.updateLastAccessed(tabId);
        }
        return;
      }

      // If cutting will reduce us below 5 tabs, only remove the first N to get to 5.
      tabsToCut = tabsToCut.splice(0, tabs.length - minTabs);

      if (tabsToCut.length === 0) {
        return;
      }

      for (i = 0; i < tabsToCut.length; i++) {
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
};

const closeTab = function(tab) {
  if (true === tab.pinned) {
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
    tabmanager.searchTabs(function(tabs) {
      if (tabs.length) {
        tabs.forEach(t => {
          if (t.id == null) return;
          tabmanager.closedTabs.removeTab(t.id);
        });
      }
    }, [tabmanager.filters.exactUrl(tab.url)]);
  }

  // Add the new one;
  if (tab.id != null) tabmanager.updateLastAccessed(tab.id);
};

const startup = function() {
  settings.init();
  storageLocal.init();
  updater.run();
  tabmanager.closedTabs.init();

  TW.settings = settings;
  TW.storageLocal = storageLocal;
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
  chrome.tabs.query({
    windowType: 'normal',
  }, tabmanager.initTabs);
  chrome.tabs.onCreated.addListener(onNewTab);
  chrome.tabs.onUpdated.addListener(tabmanager.updateLastAccessed);
  chrome.tabs.onRemoved.addListener(tabmanager.removeTab);
  chrome.tabs.onActivated.addListener(function(tabInfo) {
    menus.updateContextMenus(tabInfo['tabId']);

    if (settings.get('debounceOnActivated')) {
      debouncedUpdateLastAccessed(tabInfo['tabId']);
    } else {
      tabmanager.updateLastAccessed(tabInfo['tabId']);
    }
  });
  window.setInterval(checkToClose, settings.get('checkInterval'));

  // Create the "lock tab" context menu:
  menus.createContextMenus();

  chrome.commands.onCommand.addListener(command => {
    switch (command) {
    case 'wrangle-current-tab':
      chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        tabmanager.closedTabs.wrangleTabs(tabs);
      });
      break;
    default:
      break;
    }
  });
};

startup();
