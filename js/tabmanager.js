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
  tabTimes: {}, // An array of tabId => timestamp
  closedTabs: new Array()
};

TW.TabManager.initTabs = function (tabs) {
  for (var i=0; i < tabs.length; i++) {
    TW.TabManager.updateLastAccessed(tabs[i]);
  }
}

/**
 * Takes a tabId or a tab object
 * @param {mixed} tabId
 *  Tab ID or Tab object.
 */
TW.TabManager.updateLastAccessed = function (tabId) {
  if (typeof tabId == "object") {
    tabId = tabId.id
  }
  
  if (typeof tabId != 'number') {
    console.log('Error: ' + tabId.toString() + ' is not an number', tabId);
    return;
  }
  TW.TabManager.tabTimes[tabId] = new Date().getTime();
}

/**
 * Kinda frivolous.  Abstracterbation FTW!
 * @param tabId
 */
TW.TabManager.removeTab = function(tabId) {
  delete TW.TabManager.tabTimes[tabId];
}

/**
 * @param time the time to use as the condition.
 * @return the array of all tab ids not accessed since time.
 *     all tab ids if time is null
 */
TW.TabManager.getOlderThan = function(time) {
  var ret = Array();
  this.removeBadTabIds();
  
  for (var i in this.tabTimes) {
    if (time == null || this.tabTimes[i] < time) {
      ret.push(parseInt(i));
    }
  }

  return ret;
}

/**
 * Removes any tabs from tabTimes that don't actually exists.
 * 
 * An assumption was made that a tab will always have the same tab ID in it's
 * lifetime, however this doesn't seem to hold (a good example is gmail.com, which
 * reports a different tab ID after it loads). This function removes bad tabs
 * to prevent a bug that causes tabs to close even if there are less than minTabs tabs.
 *
 * @todo: this is a hack, and a more permanent solution should be found.
 */
TW.TabManager.removeBadTabIds = function() {
  for (var i in this.tabTimes) {
    chrome.tabs.get(parseInt(i), function(tab) {
      if(tab == null) {
        TW.TabManager.removeTab(i);
      }
    }) 
  }
}

/**
 * Wrapper function to get all tabs regardless of time inactive
 * @return {Array}
 */
TW.TabManager.getAll = function() {
  return TW.TabManager.getOlderThan();
};

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