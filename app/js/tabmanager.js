'use strict';

/* global chrome, TW */

import _ from 'underscore';

/**
 * Stores the tabs in a separate variable to log Last Accessed time.
 * @type {Object}
 */
const TabManager = {
  tabTimes: {}, // An array of tabId => timestamp
  closedTabs: []
};

TabManager.initTabs = function (tabs) {
  for (let i=0; i < tabs.length; i++) {
    TabManager.updateLastAccessed(tabs[i]);
  }
};

/**
 * Takes a tabId or a tab object
 * @param {mixed} tabId
 *  Tab ID or Tab object.
 */
TabManager.updateLastAccessed = function (tabId) {
  if (typeof tabId == "object") {
    tabId = tabId.id;
  }

  if (typeof tabId != 'number') {
    console.log('Error: ' + tabId.toString() + ' is not an number', tabId);
    return;
  }
  TabManager.tabTimes[tabId] = new Date().getTime();
};

/**
 * Kinda frivolous.  Abstracterbation FTW!
 * @param tabId
 */
TabManager.removeTab = function(tabId) {
  delete TabManager.tabTimes[tabId];
};

/**
 * Returns tab times (hash of tabId : lastAccess)
 * @param time
 *  If null, returns all.
 * @return {Array}
 */
TabManager.getOlderThen = function(time) {
  const ret = Array();
  for (const i in this.tabTimes) {
    if (this.tabTimes.hasOwnProperty(i)) {
      if (!time || this.tabTimes[i] < time) {
        ret.push(parseInt(i, 10));
      }
    }
  }

  return ret;
};

/**
 * Wrapper function to get all tab times regardless of time inactive
 * @return {Array}
 */
TabManager.getAll = function() {
  return TabManager.getOlderThen();
};

TabManager.closedTabs = {
  tabs: []
};

TabManager.searchTabs = function (cb, filters) {
  let tabs = TabManager.closedTabs.tabs;
  if (filters) {
    for (let i = 0; i < filters.length; i++) {
      tabs = _.filter(tabs, filters[i]);
    }
  }
  cb(tabs);
};

TabManager.filters = {};

// Matches either the title or URL containing "keyword"
TabManager.filters.keyword = function(keyword) {
  return function(tab) {
    const test = new RegExp(keyword, 'i');
    return test.exec(tab.title) || test.exec(tab.url);
  };
};

// Matches when the URL is exactly matching
TabManager.filters.exactUrl = function(url) {
  return function(tab) {
    return tab.url == url;
  };
};

TabManager.closedTabs.init = function() {
  const self = this;
  chrome.storage.local.get('savedTabs', function(items) {
    if (typeof items['savedTabs'] != 'undefined') {
      self.tabs = items['savedTabs'];
    }
  });
};

TabManager.closedTabs.removeTab = function(tabId) {
  const output = TabManager.closedTabs.tabs.splice(TabManager.closedTabs.findPositionById(tabId), 1);
  TabManager.closedTabs.save();
  return output;
};

// @todo: move to filter system for consistency
TabManager.closedTabs.findPositionById = function(id) {
  for (let i = 0; i < this.tabs.length; i++) {
    if(this.tabs[i].id == id) {
      return i;
    }
  }
};

TabManager.closedTabs.save = function() {
  // persists this.tabs to local storage
  chrome.storage.local.set({savedTabs: this.tabs});
};

TabManager.closedTabs.saveTabs = function(tabs) {
  const maxTabs = TW.settings.get('maxTabs');
  for (let i = 0; i < tabs.length; i++) {
    if (tabs[i] === null) {
      console.log('Weird bug, backtrace this...');
    }
    tabs[i].closedAt = new Date().getTime();
    this.tabs.unshift(tabs[i]);
  }

  if ((this.tabs.length - maxTabs) > 0) {
    this.tabs = this.tabs.splice(0, maxTabs);
  }

  TabManager.closedTabs.save();
};

TabManager.closedTabs.clear = function() {
  this.tabs = [];
  chrome.storage.local.remove('savedTabs');
};

TabManager.getWhitelistMatch = function(url) {
  const whitelist = TW.settings.get("whitelist");
  for (let i=0; i < whitelist.length; i++) {
    if (url.indexOf(whitelist[i]) != -1) {
      return whitelist[i];
    }
  }
  return false;
};

TabManager.isWhitelisted = function(url) {
  return this.getWhitelistMatch(url) !== false;
};

TabManager.isLocked = function(tabId) {
  const lockedIds = TW.settings.get("lockedIds");
  if (lockedIds.indexOf(tabId) != -1) {
    return true;
  }
  return false;
};

TabManager.lockTab = function(tabId) {
  const lockedIds = TW.settings.get("lockedIds");

  if (tabId > 0 && lockedIds.indexOf(tabId) == -1) {
    lockedIds.push(tabId);
  }
  TW.settings.set('lockedIds', lockedIds);
};

TabManager.unlockTab = function(tabId) {
  const lockedIds = TW.settings.get("lockedIds");
  if (lockedIds.indexOf(tabId) > -1) {
    lockedIds.splice(lockedIds.indexOf(tabId), 1);
  }
  TW.settings.set('lockedIds', lockedIds);
};

TabManager.updateClosedCount = function() {
  if (TW.settings.get('showBadgeCount') === false) {
    return;
  }
  let storedTabs = TabManager.closedTabs.tabs.length;
  if (storedTabs === 0) {
    storedTabs = '';
  }
  chrome.browserAction.setBadgeText({text: storedTabs.toString()});
};

export default TabManager;
