/**
 * @file: Mostly API functions
 */

// Name space
var TW = TW || {};

/**
 * @type {Object}
 */
TW.settings = {
  ititialized: false,
  defaults: {
    checkInterval: 5000, // How often we check for old tabs.
    badgeCounterInterval: 6000, // How often we update the # of closed tabs in the badge.
    minutesInactive: 20, // How many minutes before we consider a tab "stale" and ready to close.
    minTabs: 5, // Stop acting if there are only minTabs tabs open.
    maxTabs: 100, // Just to keep memory / UI in check.  No UI for this.
    purgeClosedTabs: true, // Save closed tabs in between browser sessions.
    showBadgeCount: true, // Save closed tabs in between browser sessions.
    lockedIds: new Array(),  // An array of tabids which have been explicitly locked by the user.
    whitelist: new Array(), // An array of patterns to check against.  If a URL matches a pattern, it is never locked.
    paused: false, // If TabWrangler is paused (won't count down)
  },
  // Gets all settings from sync and stores them locally.
  init: function() {
    var self = this;
    var keys = [];
    for (var i in this.defaults) {
      if (this.defaults.hasOwnProperty(i)) {
        this.cache[i] = this.defaults[i];
        keys.push(i);
      }
    }
    chrome.storage.sync.get(keys, function(items) {
      for (i in items) {
        if (items.hasOwnProperty(i)) {
          self.cache[i] = items[i];
        }
      }
    });
    ititialized = true;
  },
  cache: {}
}



/**
 * Returns the number of milliseconds that tabs should stay open for without being used.
 *
 * @return {Number}
 */
TW.settings.stayOpen = function() {
  return parseInt(this.get('minutesInactive')) * 60000;
}

/**
 *
 * @param value
 * @see TW.settings.set
 */
TW.settings.setminutesInactive = function(value) {
  if ( isNaN(parseInt(value)) || parseInt(value) <= 0 || parseInt(value) > 720 ){
    throw Error("Minutes Inactive must be greater than 0 and less than 720");
  }
  // Reset the tabTimes since we changed the setting
  TW.TabManager.tabTimes = {};
  chrome.tabs.query({windowType: 'normal'}, TW.TabManager.initTabs);

  TW.settings.setValue('minutesInactive', value);
}

/**
 *
 * @param value
 * @see TW.settings.set
 */
TW.settings.setminTabs = function(value) {
  if ( isNaN(parseInt(value)) || parseInt(value) <= 0 || parseInt(value) > 30 ){
    throw Error("Minimum tabs must be a number between 0 and 30");
  }
  TW.settings.setValue('minTabs', value);
}

/**
 *
 * @param value
 * @see TW.settings.set
 */
TW.settings.setshowBadgeCount = function(value) {
  if (value == false) {
    // Clear out the current badge setting
    chrome.browserAction.setBadgeText({text: ""});
  }
  TW.settings.setValue('showBadgeCount', value);
}

/**
 * @param value
 * @see TW.settings.set
 */
TW.settings.setwhitelist = function(value) {
  // It should be an array, but JS is stupid: http://javascript.crockford.com/remedial.html
  if (typeof(value) != 'object') {
    throw new Error('Whitelist should be an array, ' + typeof(value) + ' given');
  }
  
  TW.settings.setValue('whitelist', value);
}

TW.settings.setpaused = function(value) {
  console.log(value);
  if (value == false) {
    // The user has just unpaused, immediately set all tabs to the current time
    // so they will not be closed.
    chrome.tabs.query({
    windowType: 'normal'
  }, TW.TabManager.initTabs);
  }
  TW.settings.setValue('paused', value);
}

/**
 * Either calls a getter function or retunrs directly from storage.
 * @param key
 * @param fx
 *  Callback function after value is received.
 * @return {*}
 */
TW.settings.get = function(key, fx) {
  if (typeof this[key] == 'function') {
    return this[key]();
  }
  return this.cache[key];
}

TW.settings.setValue = function (key, value, fx) {
  var items = {}
  this.cache[key] = value;
  items[key] = value;
  chrome.storage.sync.set(items, fx);
}

/**
 * Sets a value in localStorage.  Can also call a setter.
 *
 * If the value is a struct (object or array) it is JSONified.
 *
 * @param key
 *  Settings keyword string.
 * @param value
 * @return {*}
 */
TW.settings.set = function(key, value) {
  // Magic setter functions are set{fieldname}
  if (typeof this["set" + key] == 'function') {
    return this["set" + key](value);
  }
  TW.settings.setValue(key, value);
}

TW.idleChecker = {
  lastRun: null,
  logRun: function(time) {
    this.lastRun = time;
  },
  timeSinceLastRun: function(time) {
    if (this.lastRun == null) {
      return 0;
    }
    return parseInt(time) - parseInt(this.lastRun);
  }
}

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
 * @param time
 *  If null, returns all.
 * @return {Array}
 */
TW.TabManager.getOlderThen = function(time) {
  var ret = Array();
  for (var i in this.tabTimes) {
    if (this.tabTimes.hasOwnProperty(i)) {
      if (time == null || this.tabTimes[i] < time) {
        ret.push(parseInt(i));
      }
    }
  }

  return ret;
}

/**
 * Wrapper function to get all tabs regardless of time inactive
 * @return {Array}
 */
TW.TabManager.getAll = function() {
  return TW.TabManager.getOlderThen();
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

/**
 * Creates and updates context menus.
 */
TW.contextMenuHandler = {
  lockActionId: null,
  createContextMenus: function () {
    var lockTabAction = function(onClickData, selectedTab) {
      TW.TabManager.lockTab(selectedTab.id);
    };

    var lockDomainAction = function(onClickData, selectedTab) {
      whitelist = TW.settings.get('whitelist');
      domain = TW.util.getDomain(selectedTab.url);
      whitelist.push(domain);
      TW.settings.set('whitelist', whitelist);
    };

    var corralTabAction = function(onClickData, selectedTab) {
      TW.TabManager.closedTabs.saveTabs([selectedTab]);
      // Close it in Chrome.
      chrome.tabs.remove(selectedTab.id);
    };

    var lockTab = {
      'type': 'checkbox',
      'title': "Never close this tab",
      'onclick': lockTabAction
    };

    var lockDomain = {
      'type': 'checkbox',
      'title': "Never close anything on this domain",
      'onclick': lockDomainAction
    };

    var corralTab = {
      'type': 'normal',
      'title': "Close tab and save URL immediately",
      'onclick': corralTabAction
    };

    this.lockTabId = chrome.contextMenus.create(lockTab);
    this.lockDomainId = chrome.contextMenus.create(lockDomain);
    chrome.contextMenus.create(corralTab);
  },
  
  updateContextMenus: function(tabId) {
    self = this;
    // Little bit of a kludge, would be nice to be DRY here but this was simpler.
    // Sets the title again for each page.
    chrome.tabs.get(tabId, function(tab) {
      var currentDomain = TW.util.getDomain(tab.url);
      chrome.contextMenus.update(self.lockDomainId, {'title': 'Never close anything on ' + currentDomain});
    });
    chrome.contextMenus.update(this.lockTabId, {'checked': TW.TabManager.isLocked(tabId)});
  }
};

/**
 * Possible test, later...

TW.TabManager.addTab({id: 1, title: 'Google', url: 'http://google.com'});
console.log(TW.TabManager.tabs);

setTimeout(function() {
  TW.TabManager.addTab({id: 2, title: 'Yahoo', url: 'http://yahoo.com'});
  console.log(TW.TabManager.tabs);
}, 2000);

setTimeout(function() {
  TW.TabManager.addTab({id: 3, title: 'Facebook.com', url: 'http://facebook.com'});
  console.log(TW.TabManager.tabs);
}, 5000)

setTimeout(function() {
  TW.TabManager.addTab({id: 1, title: 'Google', url: 'http://google.com'});
  console.log(TW.TabManager.tabs);
}, 8000)
*/





