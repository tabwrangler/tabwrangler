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
      if (window.type == "normal") {
        TW.TabManager.openTabs[tab.id] = {
          time: new Date(),
          locked: false
        };
      }
    })
  }
}

/**
 * Takes a tabId and updates the accessed time if the tab has already
 * been registered.
 * @param tabId the tab ID to update the time for.
 */
TW.TabManager.updateLastAccessed = function (tabId) {
  if (_.has(TW.TabManager.openTabs, tabId)) {
    TW.TabManager.openTabs[tabId].time = new Date();
  }
}

/**
 * Kinda frivolous.  Abstracterbation FTW!
 * @param tabId
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
  }
}

/* Calculates the list of tab IDs to close based on the constraints, then closes them. */
TW.TabManager.closeExpiredTabs = function() {
  
  var cutOff = new Date() - TW.settings.get('stayOpen');
  var minTabs = TW.settings.get('minTabs');
  
  /* Only consider tabs that are not pinned and are in a normal window. */
  chrome.tabs.query({ pinned: false, windowType: "normal" }, function(tabs) {
    
    /* Group the tabs by windowId so each window can be calculated separately */
    var windowGroups = _.groupBy(tabs, function(tab) { return tab.windowId; });
    
    /* Calculates the list of all tabs to close accross all windows. */
    var tabsToClose = _.flatten(_.map(windowGroups, function(tabGroup) {
      
      if (tabGroup.length <= minTabs) {
        
        return [];
        
      } else {
        
        /* Do not close any tabs that are unexpired, active, or locked.
         * @todo: whitelisted tabs also shouldn't be closed.
         */
        var canClose = _.reject(tabGroup, function(tab) {
          return tab.active || TW.TabManager.getTime(tab.id) > cutOff || TW.TabManager.isLocked(tab.id);
        });
        
        /* Sort tabs by time so that the older tabs are closed before newer ones. */
        var sortedByTime = _.sortBy(canClose, function(tab) { return TW.TabManager.getTime(tab.id); });
        
        /* Only take the minimum number of tabs requried to get to minTabs */
        return _.take(sortedByTime, tabGroup.length - minTabs);
      }
    }));
    
    /* Now that we have the tabs to close, close them. */
    TW.TabManager.wrangleAndClose(tabsToClose);
    
  });
}

/* Given a list of tabsIDs to close, wrangle and close them. */
TW.TabManager.wrangleAndClose = function(tabs) {
  var tabIds = _.pluck(tabs, 'id');
  var closeTime = new Date();
  chrome.tabs.remove(tabIds, function() {
    
    _.map(tabs, function(tab) {
      var tabToSave = _.extend(_.pick(tab, 'url', 'title', 'favIconUrl', 'id'), { closedAt: closeTime });
      TW.TabManager.closedTabs.tabs.push(tabToSave);
    });
    
    chrome.storage.local.set({ savedTabs: TW.TabManager.closedTabs.tabs });
    TW.TabManager.updateClosedCount();
  });
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

TW.TabManager.closedTabs.init = function() {
  var self = this;
  chrome.storage.local.get('savedTabs', function(items) {
    if (typeof items['savedTabs'] != 'undefined') {
      self.tabs = items['savedTabs'];
      TW.TabManager.updateClosedCount();
    }
  });
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