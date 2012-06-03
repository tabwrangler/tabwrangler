var TW = TW || {};

TW.settings = {
  loaded: false,
  cache: {},
  defaults: {
    checkInterval: 5000,
    badgeCounterInterval: 6000,
    minutesInactive: 7,
    maxTabs: 30,
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

TW.settings.setmaxTabs = function(value) {
  if (parseInt(value) != value) {
    throw Error("Max tabs must be a number");
  }
  localStorage['maxTabs'] = value;
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
  for (i in tabs) {
    TW.TabManager.addTab(tabs[i]);
  }
}

TW.TabManager.addTab = function (tab, lastModified) {
  lastModified = lastModified  || new Date().getTime();
  if (typeof tab == 'undefined') {
    // console.log('Tab is undefined... this is a Chrome bug, continuing');
    // throw new Error('Undefined tab object... wtf?');
    return;
  }

  TW.TabManager.tabTimes[tab.id] = lastModified;
}

TW.TabManager.updateLastAccessed = function (tabId, lastModified) {
  TW.TabManager.tabTimes[tabId] = lastModified;
}

/**
 * Kinda frivolous.  Abstracterbation FTW!
 * @param tabId
 */
TW.TabManager.removeTab = function(tabId) {
  delete TW.TabManager.tabTimes[tabId];
}

TW.TabManager.getOlderThen = function(time) {
  var ret = Array();
  for (var i in this.tabTimes) {
    if (this.tabTimes.hasOwnProperty(i)) {
      if (this.tabTimes[i] < time) {
        ret.push(parseInt(i));
      }
    }
  }

  return ret;
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

// in case needs to be called from multiple places...
function cleanLocked() {
  var lockedIds = TW.settings.get("lockedIds");
  var cids = new Array();

  chrome.tabs.getAllInWindow(null, function (tabs) {

      var tlen = tabs.length;
      for ( var i=0;i<tlen;i++ ) {
          cids.push(tabs[i].id);
      }
      var lock_size = lockedIds.length;
      for ( var x=0;x<lock_size;x++ ) {
          if ( cids.indexOf(lockedIds[x]) == -1 ) {
	      //              alert("removing: " + lockedIds[x]);
              lockedIds.splice(lockedIds.indexOf(lockedIds[x]),1);
	  }
  }
  TW.settings.set('lockedIds', lockedIds);

 } );
  return true;
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





