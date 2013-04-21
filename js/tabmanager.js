/**
 * @file: API functions for managing open and wrangled tabs.
 */

// Name space
var TW = TW || {};

/**
 * Stores the tabs in a separate variable to log Last Accessed time.
 * @type {Object}
 */
TW.TabManager = {
  openTabs: {},
  closedTabs: { tabs: [] },
  filters: {}
};

/* Gets the latest access time of the given tab ID. */
TW.TabManager.getTime = function(tabId) {
  return TW.TabManager.openTabs[tabId].time;
}

/** Given a list of tabs, calls registerNewTab on all of them. */
TW.TabManager.initTabs = function (tabs) {
  _.map(tabs, TW.TabManager.registerNewTab);
}

/**
 * Takes a tab object and registers it as a new tab in the tab times
 * only if it meets the criteria for a new tab.
 */
TW.TabManager.registerNewTab = function(tab) {
  if (!tab.pinned) {
    chrome.windows.get(tab.windowId, null, function(window) {
      if (window.type == 'normal') {
        TW.TabManager.openTabs[tab.id] = {
          // tab Id should either be removed from this object somehow or openTabs
          // should be a list of objects.
          id: tab.id,
          time: new Date(),
          locked: false
        };
        
        /* A new tab was just opened and registered, so it's possible that
         * we just exceeded the minimum tab limit.
         * Check to make sure and schedule the next close workflow if required.
         */
        TW.TabManager.scheduleNextClose();
      }
    });
  }
}

/**
 * Takes a tabId and updates the accessed time if the tab has already
 * been registered.
 * @param tabId the tab ID to update the time for.
 */
TW.TabManager.updateLastAccessed = function (tabId) {
  if (_.has(TW.TabManager.openTabs, tabId)) {
    var tab = TW.TabManager.openTabs[tabId];
    tab.time = new Date();
    
    // If this tab was scheduled to close, we must cancel the close and schedule a new one
    if (_.has(tab, 'scheduledClose')) {
      clearTimeout(tab.scheduledClose);
      delete tab['scheduledClose'];
      TW.TabManager.scheduleNextClose();
    }
  }
}

/* At this point, we have no idea if this was called because of the user closing a tab
 * or a scheduled tab close being called.
 * If this info can be obtained, then we should unschedule a close if the user closed a tab
 * and do nothing if it was closed by a scheduled tab closing.
 */
TW.TabManager.removeTab = function(tabId) {
  delete TW.TabManager.openTabs[tabId];
}

/**
 * Handler for onReplaced event.
 */
TW.TabManager.replaceTab = function(addedTabId, removedTabId) {
  if (_.has(TW.TabManager.openTabs, removedTabId)) {
    TW.TabManager.openTabs[addedTabId] = TW.TabManager.openTabs[removedTabId];
    TW.TabManager.removeTab(removedTabId);
    
    TW.TabManager.openTabs[addedTabId].id = addedTabId;
    
    // if the replaced tab was schedule to close then we must reschedule it.
    if (_.has(TW.TabManager.openTabs[addedTabId], 'scheduledClose')) {
      TW.TabManager.scheduleToClose(TW.TabManager.openTabs[addedTabId]);
    }
  }
}

/* Given a tab Id to close, close it and add it to the corral. */
TW.TabManager.wrangleAndClose = function(tabId) {
  
  // we don't want to close anything if we're paused on have less than minTabs tabs.
  if (TW.settings.get('paused') || _.size(TW.TabManager.openTabs) <= TW.settings.get('minTabs')) {
    return;
  }
  
  var closeTime = new Date();
  
  chrome.tabs.get(tabId, function(tab) {
    chrome.tabs.remove(tabId, function() {
      
      var tabToSave = _.extend(_.pick(tab, 'url', 'title', 'favIconUrl', 'id'), { closedAt: closeTime });
      TW.TabManager.closedTabs.tabs.push(tabToSave);
      
      chrome.storage.local.set({ savedTab: TW.TabManager.closedTabs.tabs });
      TW.TabManager.updateClosedCount();
    });
  });
}

/**
 * Schedules the next close expired tabs action.
 */
TW.TabManager.scheduleNextClose = function () {
  
  // If tab wrangler is paused then we don't need to schedule anything.
  if (TW.settings.get('paused') || _.size(TW.TabManager.openTabs) <= TW.settings.get('minTabs')) {
    return;
  }
  
  var unscheduledTabs = _.reject(TW.TabManager.openTabs, function(tab) {
    return _.has(tab, 'scheduledClose');
  });
  
  var earliestTab = _.min(unscheduledTabs, function(tab) { return tab.time; });
  TW.TabManager.scheduleToClose(earliestTab);
}

/* Given a tab object that is registered as an open tab, schedules it to close
 * at some time in the future.
 */
TW.TabManager.scheduleToClose = function(tab) {
  var timeout = tab.time.getTime() + TW.settings.get('stayOpen') - new Date();
  tab.scheduledClose = setTimeout(function() { TW.TabManager.wrangleAndClose(tab.id); }, timeout);
}


TW.TabManager.searchTabs = function (cb, filters) {
  var tabs = TW.TabManager.closedTabs.tabs;
  if (filters) {
    for (i = 0; i < filters.length; i++) {
      tabs = _.filter(tabs, filters[i]);
    }
  }
  cb(tabs);
};

// Matches either the title or URL containing "keyword"
TW.TabManager.filters.keyword = function(keyword) {
  return function(tab) {
    var test = new RegExp(keyword, 'i');
    return test.exec(tab.title) || test.exec(tab.url);
  };
};

// Matches when the URL is exactly matching
TW.TabManager.filters.exactUrl = function(url) {
  return function(tab) {
    return tab.url == url;
  };
};

/* Initializes the closedTabs variable from local storage, or clears local storage
 * if tabs shouldn't be saved across quits.
 */
TW.TabManager.closedTabs.init = function() {
  if (TW.settings.get('purgeClosedTabs')) {
    chrome.storage.local.remove('savedTabs');
  } else {
    chrome.storage.local.get({ savedTabs: [] }, function(items) {
      TW.TabManager.closedTabs.tabs = items['savedTabs'];
    });
  }
};

TW.TabManager.closedTabs.removeTab = function(tabId) {
  TW.TabManager.closedTabs.tabs.splice(TW.TabManager.closedTabs.findPositionById(tabId), 1);
  TW.TabManager.updateClosedCount();
};

// @todo: move to filter system for consistency
TW.TabManager.closedTabs.findPositionById = function(id) {
  for (var i = 0; i < this.tabs.length; i++) {
    if(this.tabs[i].id == id) {
      return i;
    }
  }
};


TW.TabManager.closedTabs.clear = function() {
  TW.TabManager.closedTabs.tabs = [];
  chrome.storage.local.remove('savedTabs');
  TW.TabManager.updateClosedCount();
};

TW.TabManager.isWhitelisted = function(url) {
  var whitelist = TW.settings.get("whitelist");
  for (var i=0; i < whitelist.length; i++) {
    if (url.indexOf(whitelist[i]) != -1) {
      return true;
    }
  }
  return false;
}

/** Sets the given tab ID to be locked. */
TW.TabManager.lockTab = function(tabId) {
  TW.TabManager.openTabs[tabId].locked = true;
}

/** Removes the given tab ID from the lock list. */
TW.TabManager.unlockTab = function(tabId) {
  TW.TabManager.openTabs[tabId].locked = false;
}

/** Returns the lock status of the given tabId. */
TW.TabManager.isLocked = function(tabId) {
  return TW.TabManager.openTabs[tabId].locked;
}

/** Updates the closed count on the badge icon. */
TW.TabManager.updateClosedCount = function() {
  if (TW.settings.get('showBadgeCount') == false) {
    return;
  }
  var storedTabs = TW.TabManager.closedTabs.tabs.length;
  if (storedTabs == 0) {
    storedTabs = '';
  }
  chrome.browserAction.setBadgeText({ text: storedTabs.toString() });
}