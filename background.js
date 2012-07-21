/**
 * @todo: refactor into "get the ones to close" and "close 'em"
 * So it can be tested.
 */
function checkToClose(cutOff) {
  var cutOff = cutOff || new Date().getTime() - TW.settings.get('stayOpen');
  var minTabs = TW.settings.get('minTabs');
  // Tabs which have been locked via the checkbox.
  var lockedIds = TW.settings.get("lockedIds");

  // Update the selected one to make sure it doesn't get closed.
  chrome.tabs.getSelected(null, TW.TabManager.updateLastAccessed);

  /**
   * Idlechecker stuff, needs to be refactored
   *

  var sleepTime = TW.idleChecker.timeSinceLastRun(now) - TW.settings.checkInterval * 1.1;
  // sleepTime is the time elapsed between runs.  This is probably time when the computer was asleep.

  if (sleepTime < 0) {
    sleepTime = 0;
  }
  TW.idleChecker.logRun(now);

  */

  var toCut = TW.TabManager.getOlderThen(cutOff);
  var tabsToSave = new Array();
  var allTabs = TW.TabManager.getAll();

  // If cutting will reduce us below 5 tabs, only remove the first N to get to 5.
  if ((allTabs.length - minTabs) >= 0) {
    toCut = toCut.splice(0, allTabs.length - minTabs);
  } else {
    // We have less than minTab tabs, abort.
    // Also, let's reset the last accessed time of our current tabs so they
    // don't get closed when we add a new one.
    for (var i=0; i < allTabs.length; i++) {
      TW.TabManager.updateLastAccessed(allTabs[i]);
    }
    return;
  }

  if (toCut.length == 0) {
    return;
  }

  for (var i=0; i < toCut.length; i++) {
    var tabIdToCut = toCut[i];
    // @todo: move to TW.TabManager.
    if (lockedIds.indexOf(tabIdToCut) != -1) {
      // Update its time so it gets checked less frequently.
      // Would also be smart to just never add it.
      // @todo: fix that.
      TW.TabManager.updateLastAccessed(tabIdToCut);
      continue;
    }

    chrome.tabs.get(tabIdToCut, function(tab) {
      if (tab.pinned == true) {
        return;
      }
      if (TW.TabManager.isWhitelisted(tab.url)) {
        return;
      }
      
      TW.TabManager.closedTabs.saveTabs([tab]);
      // Close it in Chrome.
      chrome.tabs.remove(tab.id);
    });
  }
}

var onNewTab = function(tab) {
  TW.TabManager.updateLastAccessed(tab.id);
}

function startup() {
  updateFromOldVersion();
  TW.TabManager.closedTabs.clear();
  TW.settings.set('lockedIds', new Array());
  

  // Move this to a function somehwere so we can restart the process.
  chrome.tabs.query({
    windowType: 'normal'
  }, TW.TabManager.initTabs);
  chrome.tabs.onCreated.addListener(onNewTab);
  chrome.tabs.onUpdated.addListener(TW.TabManager.updateLastAccessed);
  chrome.tabs.onRemoved.addListener(TW.TabManager.removeTab);
  chrome.tabs.onActivated.addListener(function(tabInfo) {
    TW.contextMenuHandler.updateContextMenus(tabInfo['tabId'])
    TW.TabManager.updateLastAccessed(tabInfo['tabId'])
    });
  window.setInterval(checkToClose, TW.settings.get('checkInterval'));
  window.setInterval(TW.TabManager.updateClosedCount, TW.settings.get('badgeCounterInterval'));
  
  // Create the "lock tab" context menu:
  TW.contextMenuHandler.createContextMenus();
}

function updateFromOldVersion() {
  
  var updates = {};
  var firstInstall = function() {
    var notification = window.webkitNotifications.createNotification(
      'img/icon48.png',                      // The image.
      'Tab Wrangler is installed',
      'Tab wrangler is now auto-closing tabs after ' + TW.settings.get('minutesInactive') + ' minutes. \n\
  To change this setting, click on the TabWrangler icon on your URL bar.'
      );
    notification.show();
  };
  
  // These are also run for users with no currentVersion set.
  // This update is for the 1.x -> 2.x users
  updates[2.1] = {
    fx: function() {
      var map = {
        'minutes_inactive' : 'minutesInactive',
        'closed_tab_ids' : null,
        'closed_tab_titles': null,
        'closed_tab_urls' : null,
        'closed_tab_icons' : null,
        'closed_tab_actions': null,
        'locked_ids' : 'lockedIds',
        'popup_view' : null
      }
  
      var oldValue;
  
      for (var i in map) {
        if (map.hasOwnProperty(i)) {
          oldValue = localStorage[i];
          if (oldValue) {
            if (map[i] != null) {
              localStorage[map[i]] = oldValue;
            }
            localStorage.removeItem(i);
          }
        }
      }
    }
  }
  
  updates[2.2] = {
    fx: function() {
    // No-op
    },
    
    finished: function() {
      
      var updateTxt = "* Resets timer when minTabs is reached\n\
\n* syncs settings between computers\n\
\n*disable for a whole window";
      var notification = window.webkitNotifications.createNotification(
        'img/icon48.png',                      // The image.
        'Tab Wrangler 2.2 updates',
        updateTxt // The body.
        );
      notification.show();
    }
  }
  
  chrome.storage.sync.get('version', function(items) {
    // Whatever is set in chrome.storage (if anything)
    var currentVersion;
    
    // The version from the manifest file
    var manifestVersion = parseFloat(chrome.app.getDetails().version);
    
    // If items[version] is undefined, the app has either not been installed, 
    // or it is an upgrade from when we were not storing the version.
    if (typeof items['version'] != 'undefined') {
      currentVersion = items['version'];
    }
    
    if (!currentVersion) {
      // Hardcoded here to make the code simpler.
      // This is the first update for users upgrading from when we didn't store
      // a version.
      updates[2.1].fx();
      chrome.storage.sync.set({
        'version': manifestVersion
      },function() {
        firstInstall();
      });
    } else if (currentVersion < manifestVersion) {
      for (var i in updates) {
        if (updates.hasOwnProperty(i)) {
          if (i > currentVersion) {
            updates[i].fx();
          }
          
          // This is the version we are updating to.
          if (i == manifestVersion) {
            // Post 2.0 updates.
            chrome.storage.sync.set({
              'version': manifestVersion
            },function() {
              if (typeof updates[i].finished == 'function') {
                updates[i].finished();
              }
            });
          }
        }
      }
    }
  }); 
}

window.onload = startup;
