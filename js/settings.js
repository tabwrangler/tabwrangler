

define(['tabmanager'], function(tabmanager) {

  /**
   * @type {Object}
   */
  Settings = {
    ititialized: false,
    defaults: {
      checkInterval: 5000, // How often we check for old tabs.
      badgeCounterInterval: 6000, // How often we update the # of closed tabs in the badge.
      minutesInactive: 20, // How many minutes before we consider a tab "stale" and ready to close.
      minTabs: 5, // Stop acting if there are only minTabs tabs open.
      maxTabs: 100, // Just to keep memory / UI in check.  No UI for this.
      purgeClosedTabs: false, // Save closed tabs in between browser sessions.
      showBadgeCount: true, // Save closed tabs in between browser sessions.
      lockedIds: [],  // An array of tabids which have been explicitly locked by the user.
      whitelist: ["chrome://*"], // An array of patterns to check against.  If a URL matches a pattern, it is never locked.
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
        for (var i in items) {
          if (items.hasOwnProperty(i)) {
            self.cache[i] = items[i];
          }
        }
      });
      ititialized = true;
    },
    cache: {}
  };



  /**
   * Returns the number of milliseconds that tabs should stay open for without being used.
   *
   * @return {Number}
   */
  Settings.stayOpen = function() {
    return parseInt(this.get('minutesInactive'), 10) * 60000;
  };

  /**
   *
   * @param value
   * @see Settings.set
   */
  Settings.setminutesInactive = function(value) {
    if ( isNaN(parseInt(value, 10)) || parseInt(value, 10) <= 0 || parseInt(value, 10) > 720 ){
      throw Error("Minutes Inactive must be greater than 0 and less than 720");
    }
    // Reset the tabTimes since we changed the setting
    tabmanager.tabTimes = {};
    chrome.tabs.query({windowType: 'normal'}, tabmanager.initTabs);

    Settings.setValue('minutesInactive', value);
  };

  /**
   *
   * @param value
   * @see Settings.set
   */
  Settings.setminTabs = function(value) {
    if ( isNaN(parseInt(value, 10)) || parseInt(value, 10) <= 0 || parseInt(value, 10) > 30 ){
      throw Error("Minimum tabs must be a number between 0 and 30");
    }
    Settings.setValue('minTabs', value);
  };

  /**
   *
   * @param value
   * @see Settings.set
   */
  Settings.setmaxTabs = function(value) {
    if ( isNaN(parseInt(value, 10)) || parseInt(value, 10) <= 1 || parseInt(value, 10) > 500 ){
      throw Error("Max tabs must be a number between 1 and 500. Setting this too high can cause performance issues");
    }
    Settings.setValue('maxTabs', value);
  };

  /**
   *
   * @param value
   * @see Settings.set
   */
  Settings.setshowBadgeCount = function(value) {
    if (value === false) {
      // Clear out the current badge setting
      chrome.browserAction.setBadgeText({text: ""});
    }
    Settings.setValue('showBadgeCount', value);
  };

  /**
   * @param value
   * @see Settings.set
   */
  Settings.setwhitelist = function(value) {
    // It should be an array, but JS is stupid: http://javascript.crockford.com/remedial.html
    if (typeof(value) != 'object') {
      throw new Error('Whitelist should be an array, ' + typeof(value) + ' given');
    }
    
    Settings.setValue('whitelist', value);
  };

  Settings.setpaused = function(value) {
    console.log(value);
    if (value === false) {
      // The user has just unpaused, immediately set all tabs to the current time
      // so they will not be closed.
      chrome.tabs.query({
      windowType: 'normal'
    }, tabmanager.initTabs);
    }
    Settings.setValue('paused', value);
  };

  /**
   * Either calls a getter function or retunrs directly from storage.
   * @param key
   * @param fx
   *  Callback function after value is received.
   * @return {*}
   */
  Settings.get = function(key, fx) {
    if (typeof this[key] == 'function') {
      return this[key]();
    }
    return this.cache[key];
  };

  Settings.setValue = function (key, value, fx) {
    var items = {};
    this.cache[key] = value;
    items[key] = value;
    chrome.storage.sync.set(items, fx);
  };

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
  Settings.set = function(key, value) {
    // Magic setter functions are set{fieldname}
    if (typeof this["set" + key] == 'function') {
      return this["set" + key](value);
    }
    Settings.setValue(key, value);
  };

  return Settings;

});