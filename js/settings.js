/**
 * @file: API functions for accessing and modifying settings
 */

// Name space
var TW = TW || {};

/**
 * @type {Object}
 */
TW.settings = {
  ititialized: false,
  defaults: {
    minutesInactive: 20, // How many minutes before we consider a tab "stale" and ready to close.
    minTabs: 5, // Stop acting if there are only minTabs tabs open.
    purgeClosedTabs: false, // Save closed tabs in between browser sessions.
    showBadgeCount: true, // Save closed tabs in between browser sessions.
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
  if ( isNaN(parseInt(value)) || parseInt(value) <= 0 || parseInt(value) > 30 ){
    throw Error("Minimum tabs must be a number between 0 and 30");
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