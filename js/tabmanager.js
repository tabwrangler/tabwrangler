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
  openTabs: {},
  closedTabs: { tabs: [] },
  filters: {},
  paused: false
};

/* Gets the latest access time of the given tab ID. */
TW.TabManager.getTime = function(tabId) {
  return TW.TabManager.openTabs[tabId].time;
}

/** Given a list of tabs, calls registerNewTab on all of them. */
TW.TabManager.initTabs = function (tabs) {
  _.map(tabs, TW.TabManager.registerNewTab);
}

/**
 * Takes a tab object and registers it as a new tab in the tab times
 * only if it meets the criteria for a new tab.
 */
TW.TabManager.registerNewTab = function(tab) {
  if (!tab.pinned) {
    chrome.windows.get(tab.windowId, null, function(window) {
      if (window.type == 'normal') {
        TW.TabManager.openTabs[tab.id] = {
          time: new Date(),
          locked: false
        };

        /* A new tab was just opened and registered, so it's possible that
         * we just exceeded the minimum tab limit.
         * Check to make sure and schedule the next close workflow if required.
         */
        TW.TabManager.scheduleNextClose();
      }
    });
  }
}

/**
 * Takes a tabId and updates the accessed time if the tab has already
 * been registered.
 * @param tabId the tab ID to update the time for.
 */
TW.TabManager.updateLastAccessed = function (tabId) {
  if (_.has(TW.TabManager.openTabs, tabId)) {
    var tab = TW.TabManager.openTabs[tabId];
    tab.time = new Date();

    // If this tab was scheduled to close, we must cancel the close and schedule a new one
    if (_.has(tab, 'scheduledClose')) {
      TW.TabManager.unscheduleTab(tab);
      TW.TabManager.scheduleNextClose();
    }
  }
}

/* Removes the given tab Id from the openTabs list, possibly unscheduling another tab
 * from closing as well.
 */
TW.TabManager.removeTab = function(tabId) {

  if (!_.has(TW.TabManager.openTabs, tabId)) {
    return;
  }

  var tab = TW.TabManager.openTabs[tabId];

  if (_.has(tab, 'scheduledClose')) {
    // If this case is true, then a scheduled tabs was closed (doesn't matter if it was
    // by the user or by a close event), so attmpt to unschedule it.
    TW.TabManager.unscheduleTab(tab);
  } else {
    // Otherwise an unscheduled tab was definitely closed by the user, so we may have to
    // unschedule another tab.
    TW.TabManager.unscheduleLatestClose();
  }

  delete TW.TabManager.openTabs[tabId];
}

/**
 * Handler for onReplaced event.
 */
TW.TabManager.replaceTab = function(addedTabId, removedTabId) {
  if (_.has(TW.TabManager.openTabs, removedTabId)) {
    TW.TabManager.openTabs[addedTabId] = TW.TabManager.openTabs[removedTabId];
    delete TW.TabManager.openTabs[removedTabId];

    TW.TabManager.openTabs[addedTabId].id = addedTabId;

    // if the replaced tab was schedule to close then we must reschedule it.
    if (_.has(TW.TabManager.openTabs[addedTabId], 'scheduledClose')) {
      TW.TabManager.scheduleToClose(TW.TabManager.openTabs[addedTabId]);
    }
  }
}

/* Given a tab Id to close, close it and add it to the corral. */
TW.TabManager.wrangleAndClose = function(tabId) {
  chrome.tabs.get(tabId, function(tab) {
    chrome.tabs.remove(tabId, function() {

      var tabToSave = _.extend(_.pick(tab, 'url', 'title', 'favIconUrl', 'id'), { closedAt: new Date().getTime() });
      TW.TabManager.closedTabs.tabs.push(tabToSave);

      chrome.storage.local.set({ savedTabs: TW.TabManager.closedTabs.tabs });
      TW.TabManager.updateClosedCount();
    });
  });
}

/**
 * Schedules all tabs that will need to be closed next.
 */
TW.TabManager.scheduleNextClose = function () {

  if (TW.TabManager.paused) { return; }

  chrome.tabs.query({ pinned: false, windowType: 'normal' }, function(tabs) {
    var tabsToSchedule = TW.TabManager.getTabsToSchedule(tabs);
    _.map(tabsToSchedule, TW.TabManager.scheduleToClose);
  });
}

/* Given a list of tab objects, returns the list of tabs than should be scheduled. */
TW.TabManager.getTabsToSchedule = function(tabs) {

  var minTabs = TW.settings.get('minTabs');

  if (tabs.length <= minTabs) {
    return [];
  } else {

    /* Do not schedule any tabs that are active, locked, or whitelisted. */
    var canSchedule = _.reject(tabs, function(tab) {
      return tab.active || TW.TabManager.isLocked(tab.id) || TW.TabManager.isWhitelisted(tab.url);
    });

    /* Sort tabs by time so that the older tabs are closed before newer ones. */
    var sortedByTime = _.sortBy(canSchedule, function(tab) { return TW.TabManager.getTime(tab.id); });

    /* Only take the minimum number of tabs requried to get to minTabs */
    return _.take(sortedByTime, tabs.length - minTabs);
  }
}

/* Given a tab object that is registered as an open tab, schedules it to close
 * at some time in the future if it is not already scheduled.
 */
TW.TabManager.scheduleToClose = function(tab) {
  if (!_.has(TW.TabManager.openTabs[tab.id], 'scheduledClose')) {
    var timeout = TW.TabManager.getTime(tab.id).getTime() + TW.settings.get('stayOpen') - new Date();
    TW.TabManager.openTabs[tab.id].scheduledClose = setTimeout(function() {
      TW.TabManager.wrangleAndClose(tab.id);
    }, timeout);
  }
}

/* Reschedules all scheduled tabs */
TW.TabManager.rescheduleAllTabs = function() {
  TW.TabManager.unscheduleAllTabs();
  TW.TabManager.scheduleNextClose();
}

/**
 * Unschedules the most recently scheduled close event.
 */
TW.TabManager.unscheduleLatestClose = function () {

  var scheduledTabs = _.filter(TW.TabManager.openTabs, function(tab) {
    return _.has(tab, 'scheduledClose');
  });

  if (_.size(scheduledTabs) > 0) {
    var latestTab = _.max(scheduledTabs, function(tab) { return tab.time; });
    TW.TabManager.unscheduleTab(latestTab);
  }
}

/** Unschedules every scheduled tab. */
TW.TabManager.unscheduleAllTabs = function() {
  var scheduledTabs = _.filter(TW.TabManager.openTabs, function(tab) {
    return _.has(tab, 'scheduledClose');
  });
  _.map(scheduledTabs, TW.TabManager.unscheduleTab);
}

/* Given a tab object that is scheduled to close, unschedule it. */
TW.TabManager.unscheduleTab = function(tab) {
  clearTimeout(tab.scheduledClose);
  delete tab['scheduledClose'];
}

/** Handles pausing and resuming the closing of tabs. */
TW.TabManager.setPaused = function(pause) {
  TW.TabManager.paused = pause;

  if (pause) {
    TW.TabManager.unscheduleAllTabs();
  } else {
    TW.TabManager.scheduleNextClose();
  }
}

TW.TabManager.searchTabs = function (cb, filters) {
  var tabs = TW.TabManager.closedTabs.tabs;
  if (filters) {
    for (i = 0; i < filters.length; i++) {
      tabs = _.filter(tabs, filters[i]);
    }
  }
  cb(tabs);
};

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

/* Initializes the closedTabs variable from local storage, or clears local storage
 * if tabs shouldn't be saved across quits.
 */
TW.TabManager.closedTabs.init = function() {
  if (TW.settings.get('purgeClosedTabs')) {
    chrome.storage.local.remove('savedTabs');
  } else {
    chrome.storage.local.get({ savedTabs: [] }, function(items) {
      TW.TabManager.closedTabs.tabs = items['savedTabs'];
      TW.TabManager.updateClosedCount();
    });
  }
};

TW.TabManager.closedTabs.removeTab = function(tabId) {
  TW.TabManager.closedTabs.tabs.splice(TW.TabManager.closedTabs.findPositionById(tabId), 1);
  chrome.storage.local.set({ savedTabs: TW.TabManager.closedTabs.tabs });
  TW.TabManager.updateClosedCount();
};

// @todo: move to filter system for consistency
TW.TabManager.closedTabs.findPositionById = function(id) {
  for (var i = 0; i < this.tabs.length; i++) {
    if(this.tabs[i].id == id) {
      return i;
    }
  }
};


TW.TabManager.closedTabs.clear = function() {
  TW.TabManager.closedTabs.tabs = [];
  chrome.storage.local.remove('savedTabs');
  TW.TabManager.updateClosedCount();
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

/** Sets the given tab ID to be locked. */
TW.TabManager.lockTab = function(tabId) {
  var tab = TW.TabManager.openTabs[tabId]
  tab.locked = true;

  if (_.has(tab, 'scheduledClose')) {
    TW.TabManager.unscheduleTab(tab);
    TW.TabManager.scheduleNextClose();
  }
}

/** Removes the given tab ID from the lock list. */
TW.TabManager.unlockTab = function(tabId) {
  TW.TabManager.openTabs[tabId].locked = false;
  TW.TabManager.unscheduleLatestClose();
  TW.TabManager.scheduleNextClose();
}

/** Returns the lock status of the given tabId. */
TW.TabManager.isLocked = function(tabId) {
  return TW.TabManager.openTabs[tabId].locked;
}

/** Updates the closed count on the badge icon. */
TW.TabManager.updateClosedCount = function() {
  if (TW.settings.get('showBadgeCount') == false) {
    return;
  }
  var storedTabs = TW.TabManager.closedTabs.tabs.length;
  if (storedTabs == 0) {
    storedTabs = '';
  }
  chrome.browserAction.setBadgeText({ text: storedTabs.toString() });
}