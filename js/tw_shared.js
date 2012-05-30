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

TW.settings.get = function(key) {
  TW.settings.lazyLoad();
  if (typeof this[key] == 'function') {
    return this[key]();
  }

  if (this.cache[key]) {
    return this.cache[key];
  }

  if (this.defaults[key]) {
    return this.defaults[key];
  }

  throw Error('Undefined setting "' + key + '"');
}

TW.settings.stayOpen = function() {
  return parseInt(this.get('minutesInactive')) * 60000;
}

TW.settings.resetToDefaults = function() {
  this.loaded = false;
  this.cache = {};
}

TW.settings.lazyLoad = function() {
  if (this.loaded == false) {
    this.load();
  }
}

TW.settings.set = function(key, value) {
  TW.settings.lazyLoad();
  this.cache[key] = value;
}

TW.settings.save = function() {
  TW.settings.lazyLoad();
  localStorage['TWSettings'] = JSON.stringify(this.cache);
}

TW.settings.validate = function() {
  var errors = {}
  if (parseInt(this.cache['maxTabs']) != this.cache['maxTabs']) {
    errors['maxTabs'] = "Max tabs must be a number";
  }
  if ( parseInt(this.cache['minutesInactive']) < 0 || parseInt(this.cache['minutesInactive']) > 720 ){
    errors['minutesInactive'] = "Minutes Inactive must be greater than 0 and less than 720";
  }

  for(var i in errors) {
    if (errors.hasOwnProperty(i)) {
      return errors;
    }
  }
  return false;
}

TW.settings.load = function() {
  if (localStorage['TWSettings'] == '') {
    this.loaded = true;
    return;
  }
  this.cache = JSON.parse(localStorage['TWSettings']);
  this.loaded = true;
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
 * Would be better probably to just store the lastModified => id hash.
 * The other data is redundant.
 * @type {Object}
 */
TW.TabManager = {
  tabs: {},
  tabTimes: {}
};

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
  var closedTabs = new Array();
  var maxTabs = TW.settings.get('maxTabs');
  if (localStorage['closedTabs']) {
    closedTabs = JSON.parse(localStorage['closedTabs']);
  }

  for (i in tabs) {
    tabs[i].closedAt = new Date().getTime();
    closedTabs.unshift(tabs[i]);
  }

  if (closedTabs.length - maxTabs) {
    closedTabs = closedTabs.splice(0, maxTabs);
  }

  localStorage['closedTabs'] = JSON.stringify(closedTabs);
  console.log('Saved ' + closedTabs.length + ' tabs to localStorage');

}

TW.TabManager.loadClosedTabs = function() {
  if (!localStorage['closedTabs']) {
    return new Array();
  }
  return JSON.parse(localStorage['closedTabs']);
}

function checkAutoLock(tab_id,url) {
  var wl_data = TW.settings.get("whitelist");
  var wl_len = wl_data.length;
  var lockedIds = TW.settings.get("lockedIds");

  for ( var i=0;i<wl_len;i++ ) {
    if ( url.indexOf(wl_data[i]) != -1 ) {
      if ( tab_id > 0 && lockedIds.indexOf(tab_id) == -1 ) {
	lockedIds.push(tab_id);
      }
    }
  }
  TW.settings.set('lockedIds', lockedIds);
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





