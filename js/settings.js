/**
 * @file: API functions for accessing and modifying settings
 */

// Name space
var TW = TW || {};

/**
 * @type {Object}
 */
TW.settings = {
  enableSync: true, // Enables reading settings from sync
  defaults: {
    minutesInactive: 20, // How many minutes before we consider a tab "stale" and ready to close.
    minTabs: 5, // Stop acting if there are only minTabs tabs open.
    purgeClosedTabs: false, // Save closed tabs in between browser sessions.
    showBadgeCount: true, // Save closed tabs in between browser sessions.
    whitelist: new Array(), // An array of patterns to check against.  If a URL matches a pattern, it is never locked.
  },
  cache: {}
}

// Gets all settings from sync and stores them locally.
TW.settings.init = function() {
  chrome.storage.local.get({ enableSync: TW.settings.enableSync }, function(sync) {

    TW.settings.enableSync = sync.enableSync;

    if (TW.settings.enableSync) {
      chrome.storage.sync.get(TW.settings.defaults, function(items) {
        _.extend(TW.settings.cache, items);
      });
    } else {
      chrome.storage.local.get(TW.settings.defaults, function(items) {
        _.extend(TW.settings.cache, items);
      });
    }
  });
}

// Whenever settings change in sync, copy them to cache
TW.settings.copySyncChanges = function(changes, area) {
  if (area == 'sync' && TW.settings.enableSync) {
    var changeList = _.map(changes, function(change, key) { return [ key, change.newValue ]; });
    var changeObject = _.object(changeList);
    _.extend(TW.settings.cache, changeObject);
  }
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

TW.settings.setValue = function (key, value) {
  var items = {};
  items[key] = value;
  TW.settings.cache[key] = value;

  // Set the appropriate storage location
  if (TW.settings.enableSync) {
    chrome.storage.sync.set(items);
  } else {
    chrome.storage.local.set(items);
  }
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

/**
 * Returns the number of milliseconds that tabs should stay open for without being used.
 *
 * @return {Number}
 */
TW.settings.stayOpen = function() {
  return parseInt(this.get('minutesInactive')) * 60000;
}

/* Sets the enableSync attribute, which is only stored locally. */
TW.settings.setenableSync = function(value) {
  if (TW.settings.enableSync == value) {
    return;
  }

  TW.settings.enableSync = value;

  chrome.storage.local.set({ enableSync: value }, function() {

    if (value) {
      TW.settings.init();
    } else {
      chrome.storage.local.set(TW.settings.cache);
    }
  });
}

/**
 *
 * @param value
 * @see TW.settings.set
 */
TW.settings.setminutesInactive = function(value) {
  if (isNaN(parseInt(value)) || parseInt(value) < 0){
    throw Error("Minutes Inactive must be greater than 0");
  }
  TW.settings.setValue('minutesInactive', value);

  // Reschedule all schedule tabs since we changed the setting
  TW.TabManager.rescheduleAllTabs();
}

/**
 *
 * @param value
 * @see TW.settings.set
 */
TW.settings.setminTabs = function(value) {
  if (isNaN(parseInt(value)) || parseInt(value) < 0){
    throw Error("Minimum tabs must be a number that is at least 0");
  }
  var oldValue = TW.settings.get('minTabs');
  TW.settings.setValue('minTabs', value);

  /* Make sure the tab scheduling is correct. */
  if (parseInt(value) > oldValue) {
    TW.TabManager.unscheduleAllTabs();
  }
  TW.TabManager.scheduleNextClose();
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
  TW.settings.setValue('whitelist', value);
  TW.TabManager.rescheduleAllTabs();
}
