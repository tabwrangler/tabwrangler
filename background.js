/**
 * @todo: refactor into "get the ones to close" and "close 'em"
 * So it can be tested.
 */
function checkToClose(cutOff) {
  if (TW.settings.get('paused') == true) {
    return;
  }
  var cutOff = cutOff || new Date().getTime() - TW.settings.get('stayOpen');
  var minTabs = TW.settings.get('minTabs');
  // Tabs which have been locked via the checkbox.
  var lockedIds = TW.settings.get("lockedIds");

  // Update the selected one to make sure it doesn't get closed.
  chrome.tabs.getSelected(null, TW.TabManager.updateLastAccessed);

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
      if (true == tab.pinned) {
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
  // Check if it exists in corral already
  // The 2nd argument is an array of filters, we add one filter
  // which checks for an exact URL match.  If we match throw the old
  // entry away.
  TW.TabManager.searchTabs(function(tabs) {
    if (tabs.length) {
      _.each(tabs, function(t) {
        TW.TabManager.closedTabs.removeTab(t.id);
      });
    }
  }, [TW.TabManager.filters.exactUrl(tab.url)]);

  // Add the new one;
  TW.TabManager.updateLastAccessed(tab.id);
};

function startup() {
  TW.settings.init();
  TW.Updater.run();
  TW.TabManager.closedTabs.init();
  
  if (TW.settings.get('purgeClosedTabs') != false) {
    TW.TabManager.closedTabs.clear();
  }
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


window.onload = startup;