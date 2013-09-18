// Declare this global namespace so it can be used from popup.js
// @see startup();
var TW = {};

require([
  'settings',
  'tabmanager',
  'util',
  'updater',
  'menus'
], function(settings, tabmanager, util, updater, menus) {

/**
 * @todo: refactor into "get the ones to close" and "close 'em"
 * So it can be tested.
 */
var checkToClose = function(cutOff) {
  var i;

  if (settings.get('paused') === true) {
    return;
  }
  cutOff = cutOff || new Date().getTime() - settings.get('stayOpen');
  var minTabs = settings.get('minTabs');
  // Tabs which have been locked via the checkbox.
  var lockedIds = settings.get("lockedIds");

  // Update the selected one to make sure it doesn't get closed.
  chrome.tabs.getSelected(null, tabmanager.updateLastAccessed);

  /**
   * Idlechecker stuff, needs to be refactored
   *

  var sleepTime = TW.idleChecker.timeSinceLastRun(now) - settings.checkInterval * 1.1;
  // sleepTime is the time elapsed between runs.  This is probably time when the computer was asleep.

  if (sleepTime < 0) {
    sleepTime = 0;
  }
  TW.idleChecker.logRun(now);

  */

  var toCut = tabmanager.getOlderThen(cutOff);
  var tabsToSave = [];
  var allTabs = tabmanager.getNonPinnedTabs();

  // If cutting will reduce us below 5 tabs, only remove the first N to get to 5.
  if ((allTabs.length - minTabs) >= 0) {
    toCut = toCut.splice(0, allTabs.length - minTabs);
  } else {
    // We have less than minTab tabs, abort.
    // Also, let's reset the last accessed time of our current tabs so they
    // don't get closed when we add a new one.
    for (i = 0; i < allTabs.length; i++) {
      tabmanager.updateLastAccessed(allTabs[i]);
    }
    return;
  }

  if (toCut.length === 0) {
    return;
  }

  var closeTab = function(tab) {
    if (true === tab.pinned) {
        return;
      }
      if (tabmanager.isWhitelisted(tab.url)) {
        return;
      }
      
      tabmanager.closedTabs.saveTabs([tab]);
      // Close it in Chrome.
      chrome.tabs.remove(tab.id);
  };

  for (i=0; i < toCut.length; i++) {
    var tabIdToCut = toCut[i];
    // @todo: move to tabmanager.
    if (lockedIds.indexOf(tabIdToCut) != -1) {
      // Update its time so it gets checked less frequently.
      // Would also be smart to just never add it.
      // @todo: fix that.
      tabmanager.updateLastAccessed(tabIdToCut);
      continue;
    }

    chrome.tabs.get(tabIdToCut, closeTab);
  }
};

var onNewTab = function(tab) {
  // Check if it exists in corral already
  // The 2nd argument is an array of filters, we add one filter
  // which checks for an exact URL match.  If we match throw the old
  // entry away.
  tabmanager.searchTabs(function(tabs) {
    if (tabs.length) {
      _.each(tabs, function(t) {
        tabmanager.closedTabs.removeTab(t.id);
      });
    }
  }, [tabmanager.filters.exactUrl(tab.url)]);

  // Add the new one;
  tabmanager.updateLastAccessed(tab.id);
};

var startup = function() {
  settings.init();
  updater.run();
  tabmanager.closedTabs.init();

  TW.settings = settings;
  TW.updater = updater;
  TW.tabmanager = tabmanager;

  if (settings.get('purgeClosedTabs') !== false) {
    tabmanager.closedTabs.clear();
  }
  settings.set('lockedIds', []);
  

  // Move this to a function somehwere so we can restart the process.
  chrome.tabs.query({
    windowType: 'normal'
  }, tabmanager.initTabs);
  chrome.tabs.onCreated.addListener(onNewTab);
  chrome.tabs.onUpdated.addListener(tabmanager.updateLastAccessed);
  chrome.tabs.onRemoved.addListener(tabmanager.removeTab);
  chrome.tabs.onActivated.addListener(function(tabInfo) {
    menus.updateContextMenus(tabInfo['tabId']);
    tabmanager.updateLastAccessed(tabInfo['tabId']);
    });
  window.setInterval(checkToClose, settings.get('checkInterval'));
  window.setInterval(tabmanager.updateClosedCount, settings.get('badgeCounterInterval'));
  
  // Create the "lock tab" context menu:
  menus.createContextMenus();
};

startup();
});

