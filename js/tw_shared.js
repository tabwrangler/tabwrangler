var TW = TW || {};

TW.settings = {
  loaded: false,
  cache: {},
  defaults: {
    checkInterval: 5000,
    badgeCounterInterval: 6000,
    minutesInactive: 7,
    minTabs: 5, // Stop acting if there are only minTabs tabs open.
    maxTabs: 100, // Just to keep memory / UI in check.  No UI for this.
    lockedIds: new Array(),
    whitelist: new Array()
  }
}

// Get/setters

TW.settings.stayOpen = function(value) {
  if (value) {
    throw new Error('This setting is immutable, it is meant to be set via minutesInactive');
  }
  return parseInt(this.get('minutesInactive')) * 60000;
}

TW.settings.setminutesInactive = function(value) {
  if ( parseInt(value) < 0 || parseInt(value) > 720 ){
    throw Error("Minutes Inactive must be greater than 0 and less than 720");
  }
  // Reset the tabTimes since we changed the setting
  TW.TabManager.tabTimes = {};


  localStorage['minutesInactive'] = value;
}

TW.settings.setminTabs = function(value) {
  if (parseInt(value) != value) {
    throw Error("Minimum tabs must be a number");
  }
  localStorage['minTabs'] = value;
}

TW.settings.setwhitelist = function(value) {
  // It should be an array, but JS is stupid: http://javascript.crockford.com/remedial.html
  if (typeof(value) != 'object') {
    throw new Error('Whitelist should be an array, ' + typeof(value) + ' given');
  }

  localStorage['whitelist'] = JSON.stringify(value);
}

// CRUD

TW.settings.get = function(key) {
  if (typeof this[key] == 'function') {
    return this[key]();
  }

  if(typeof localStorage[key] == 'undefined') {
    if (this.defaults[key]) {
      return this.defaults[key];
    }
    throw Error('Undefined setting "' + key + '"');
  }

  if (JSON.parse(localStorage[key])) {
    return JSON.parse(localStorage[key]);
  } else {
    return localStorage[key];
  }

}

TW.settings.resetToDefaults = function() {
  localStorage.clear();
}

TW.settings.set = function(key, value) {
  // Magic setter functions are set{fieldname}
  if (typeof this["set" + key] == 'function') {
    return this["set" + key](value);
  }
  if (typeof(value) == 'object') {
    value = JSON.stringify(value);
  }
  localStorage[key] = value;
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

TW.log = function(msg) {
  localStorage['log'].push(msg);
}

/**
 * Stores the tabs in a separate variable to log Last Accessed time.
 * @type {Object}
 */
TW.TabManager = {
  tabTimes: {},
  closedTabs: new Array()
};

TW.TabManager.initTabs = function (tabs) {
  for (var i=0; i < tabs.length; i++) {
    TW.TabManager.addTab(tabs[i]);
  }
}

TW.TabManager.addTab = function (tab, lastModified) {
  lastModified = lastModified  || new Date().getTime();
  if (typeof tab == 'undefined') {
     console.log('Tab is undefined... Is this is a Chrome bug? Continuing, but should be backtraced.');
     console.log(tab);
    return;
  }

  if (typeof tab.id == 'undefined') {
    throw new Error('Tab is in undefined format');
    return;
  }

  TW.TabManager.tabTimes[tab.id] = lastModified;
}

TW.TabManager.updateLastAccessed = function (tabId) {
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
 *
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
 * Wrapper function basically
 * @return {Array}
 */
TW.TabManager.getAll = function() {
  return TW.TabManager.getOlderThen();
}

TW.TabManager.saveClosedTabs = function(tabs) {
  var maxTabs = TW.settings.get('maxTabs');

  for (var i=0; i < tabs.length; i++) {
    if (tabs[i] == null) {
      console.log('Weird bug, backtrace this...');
    }
    tabs[i].closedAt = new Date().getTime();
    TW.TabManager.closedTabs.unshift(tabs[i]);
  }

  if ((TW.TabManager.closedTabs.length - maxTabs) > 0) {
    TW.TabManager.closedTabs = TW.TabManager.closedTabs.splice(0, maxTabs);
  }
  console.log('Saved ' + tabs.length + ' tabs');
}

TW.TabManager.loadClosedTabs = function() {
  return TW.TabManager.closedTabs;
}

TW.TabManager.clearClosedTabs = function() {
  TW.TabManager.closedTabs = new Array();
}

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
}


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





