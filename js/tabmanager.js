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
  closedTabs: new Array()
};

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
 * Takes a tabId or a tab object and updates the accessed time if
 * the tab has already been registered.
 * @param {mixed} tabId Tab ID or Tab object.
 */
TW.TabManager.updateLastAccessed = function (tabId) {
  if (typeof tabId == "object") {
    tabId = tabId.id
  }
  
  if (typeof tabId != 'number') {
    console.log('Error: ' + tabId.toString() + ' is not an number', tabId);
    return;
  }
  
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

/**
 * @param time the time to use as the condition.
 * @return the array of all tab ids not accessed since time.
 *     all tab ids if time is null
 */
TW.TabManager.getOlderThan = function(time) {
  var ret = Array();
  
  for (var i in this.openTabs) {
    if (time == null || this.openTabs[i] < time) {
      ret.push(parseInt(i));
    }
  }

  return ret;
}

/**
 * Wrapper function to get all tabs regardless of time inactive
 * @return {Array}
 */
TW.TabManager.getAll = function() {
  return TW.TabManager.getOlderThan();
};

/**
 * Closes all tabs that have been open too long if there are more than minTabs tabs.
 */
TW.TabManager.checkToClose = function() {
  
  if (TW.settings.get('paused')) {
    return;
  }
  
  var cutOff = new Date().getTime() - TW.settings.get('stayOpen');
  var minTabs = TW.settings.get('minTabs');
  
  // Tabs which have been locked via the checkbox.
  var lockedIds = TW.settings.get("lockedIds");

  // Update the selected one to make sure it doesn't get closed.
  chrome.tabs.getSelected(null, TW.TabManager.updateLastAccessed);

  var toCut = TW.TabManager.getOlderThan(cutOff);
  var tabsToSave = new Array();
  var allTabs = TW.TabManager.getAll();

  // If we have more tabs than minTabs tabs, remove enough to get to minTabs.
  if (allTabs.length > minTabs) {
    toCut = toCut.splice(0, allTabs.length - minTabs);
  } else {
    return;
  }

  // there aren't enough expired tabs; abort.
  if (toCut.length == 0) {
    return;
  }

  for (var i=0; i < toCut.length; i++) {
    var tabIdToCut = toCut[i];
    // @todo: move to TW.TabManager.
    if (lockedIds.indexOf(tabIdToCut) != -1) {
      // Update its time so it gets checked less frequently.
      // Would also be smart to just never add it.
      // @todo: fix that.
      TW.TabManager.updateLastAccessed(tabIdToCut);
      continue;
    }

    chrome.tabs.get(tabIdToCut, function(tab) {
      if (tab.pinned) {
        return;
      }
      if (TW.TabManager.isWhitelisted(tab.url)) {
        return;
      }
      
      TW.TabManager.closedTabs.saveTabs([tab]);
      // Close it in Chrome.
      chrome.tabs.remove(tab.id);
    });
  }
}

TW.TabManager.closedTabs = {
  tabs: []
};

TW.TabManager.searchTabs = function (cb, filters) {
  var tabs = TW.TabManager.closedTabs.tabs;
  if (filters) {
    for (i = 0; i < filters.length; i++) {
      tabs = _.filter(tabs, filters[i]);
    }
  }
  cb(tabs);
};

TW.TabManager.filters = {};

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
    }
  });
};

TW.TabManager.closedTabs.removeTab = function(tabId) {
  return TW.TabManager.closedTabs.tabs.splice(TW.TabManager.closedTabs.findPositionById(tabId), 1);
};

// @todo: move to filter system for consistency
TW.TabManager.closedTabs.findPositionById = function(id) {
  for (var i = 0; i < this.tabs.length; i++) {
    if(this.tabs[i].id == id) {
      return i;
    }
  }
};

TW.TabManager.closedTabs.saveTabs = function(tabs) {
  var maxTabs = TW.settings.get('maxTabs');
  for (var i=0; i < tabs.length; i++) {
    if (tabs[i] === null) {
      console.log('Weird bug, backtrace this...');
    }
    tabs[i].closedAt = new Date().getTime();
    this.tabs.unshift(tabs[i]);
  }

  if ((this.tabs.length - maxTabs) > 0) {
    this.tabs = this.tabs.splice(0, maxTabs);
  }
  chrome.storage.local.set({savedTabs: this.tabs});
};

TW.TabManager.closedTabs.clear = function() {
  this.tabs = [];
  chrome.storage.local.remove('savedTabs');
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

TW.TabManager.isLocked = function(tabId) {
  var lockedIds = TW.settings.get("lockedIds");
  if (lockedIds.indexOf(tabId) != -1) {
    return true;
  }
  return false;
}

TW.TabManager.lockTab = function(tabId) {
  var lockedIds = TW.settings.get("lockedIds");

  if (tabId > 0 && lockedIds.indexOf(tabId) == -1) {
    lockedIds.push(tabId);
  }
  TW.settings.set('lockedIds', lockedIds);
}

TW.TabManager.unlockTab = function(tabId) {  
  var lockedIds = TW.settings.get("lockedIds");
  if (lockedIds.indexOf(tabId) > -1) {
    lockedIds.splice(lockedIds.indexOf(tabId), 1);
  }
  TW.settings.set('lockedIds', lockedIds);
}

TW.TabManager.updateClosedCount = function() {
  if (TW.settings.get('showBadgeCount') == false) {
    return;
  }
  var storedTabs = TW.TabManager.closedTabs.tabs.length;
  if (storedTabs == 0) {
    storedTabs = '';
  }
  chrome.browserAction.setBadgeText({text: storedTabs.toString()});
}