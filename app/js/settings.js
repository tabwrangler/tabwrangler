'use strict';

/* global chrome */
/* @flow */

import tabmanager from './tabmanager';

/**
 * @type {Object}
 */
const Settings = {
  cache: {},

  defaults: {
    checkInterval: 5000, // How often we check for old tabs.
    lockedIds: [],  // An array of tabids which have been explicitly locked by the user.
    maxTabs: 100, // Just to keep memory / UI in check. No UI for this.
    minTabs: 5, // Stop acting if there are only minTabs tabs open.
    minutesInactive: 20, // How many minutes before we consider a tab "stale" and ready to close.
    paused: false, // If TabWrangler is paused (won't count down)
    purgeClosedTabs: false, // Save closed tabs in between browser sessions.
    showBadgeCount: true, // Save closed tabs in between browser sessions.
    whitelist: ['chrome://'], // An array of patterns to check against.  If a URL matches a pattern, it is never locked.
  },

  // Gets all settings from sync and stores them locally.
  init() {
    const keys = [];
    for (const i in this.defaults) {
      if (this.defaults.hasOwnProperty(i)) {
        this.cache[i] = this.defaults[i];
        keys.push(i);
      }
    }
    chrome.storage.sync.get(keys, items => {
      for (const i in items) {
        if (items.hasOwnProperty(i)) {
          this.cache[i] = items[i];
        }
      }
    });
  },

  /**
   * Either calls a getter function or returns directly from storage.
   * @param key
   * @param fx
   *  Callback function after value is received.
   * @return {*}
   */
  get(key: string): mixed {
    if (typeof this[key] == 'function') {
      return this[key]();
    }
    return this.cache[key];
  },

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
  set(key: string, value: mixed) {
    // Magic setter functions are set{fieldname}
    if (typeof this['set' + key] == 'function') {
      this['set' + key](value);
    } else {
      Settings.setValue(key, value);
    }
  },

  /**
   *
   * @param value
   * @see Settings.set
   */
  setmaxTabs(value: string) {
    if ( isNaN(parseInt(value, 10)) || parseInt(value, 10) <= 1 || parseInt(value, 10) > 500 ) {
      throw Error('Max tabs must be a number between 1 and 500. Setting this too high can cause performance issues');
    }
    Settings.setValue('maxTabs', value);
  },

  /**
   *
   * @param value
   * @see Settings.set
   */
  setminTabs(value: string) {
    if ( isNaN(parseInt(value, 10)) || parseInt(value, 10) < 0 || parseInt(value, 10) > 30 ) {
      throw Error('Minimum tabs must be a number between 0 and 30');
    }
    Settings.setValue('minTabs', value);
  },

  /**
   *
   * @param value
   * @see Settings.set
   */
  setminutesInactive(value: string) {
    if ( isNaN(parseInt(value, 10)) || parseInt(value, 10) <= 0 || parseInt(value, 10) > 7200 ) {
      throw Error('Minutes Inactive must be greater than 0 and less than 7200');
    }
    // Reset the tabTimes since we changed the setting
    tabmanager.tabTimes = {};
    chrome.tabs.query({windowType: 'normal'}, tabmanager.initTabs);

    Settings.setValue('minutesInactive', value);
  },

  setpaused(value: boolean) {
    if (value === false) {
      // The user has just unpaused, immediately set all tabs to the current time
      // so they will not be closed.
      chrome.tabs.query({
        windowType: 'normal',
      }, tabmanager.initTabs);
    }
    Settings.setValue('paused', value);
  },

  setshowBadgeCount(value: boolean) {
    if (value === false) {
      // Clear out the current badge setting
      chrome.browserAction.setBadgeText({text: ''});
    }
    Settings.setValue('showBadgeCount', value);
    tabmanager.updateClosedCount();
  },

  setValue(key: string, value: mixed, fx?: () => void) {
    this.cache[key] = value;
    chrome.storage.sync.set({[key]: value}, fx);
  },

  /**
   * Returns the number of milliseconds that tabs should stay open for without being used.
   *
   * @return {Number}
   */
  stayOpen() {
    return parseInt(this.get('minutesInactive'), 10) * 60000;
  },
};

export default Settings;
