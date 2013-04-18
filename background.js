/**
 * @file: Initializes Tab Wrangler on startup.
 */

function startup() {
  TW.settings.init();
  TW.Updater.run();
  TW.TabManager.closedTabs.init();
  
  if (TW.settings.get('purgeClosedTabs')) {
    TW.TabManager.closedTabs.clear();
  }
  
  // Move this to a function somehwere so we can restart the process.
  chrome.tabs.query({ windowType: 'normal', pinned: false }, TW.TabManager.initTabs);
  chrome.tabs.onCreated.addListener(TW.TabManager.registerNewTab);
  
  // Handles pinning and unpinning a tab
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (_.has(changeInfo, 'pinned')) {
      if (changeInfo.pinned) {
        TW.TabManager.removeTab(tabId);
      } else {
        TW.TabManager.registerNewTab(tab);
      }
    }
  });
  
  // Handles keeping track of the tab URL
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if(_.has(changeInfo, 'url')) {
      TW.TabManager.openTabs[tabId].url = tab.url;
      TW.TabManager.openTabs[tabId].title = tab.title;
      TW.TabManager.openTabs[tabId].favIconUrl = tab.favIconUrl;
    }
  })
  
  chrome.tabs.onRemoved.addListener(TW.TabManager.removeTab);
  chrome.tabs.onActivated.addListener(function(tabInfo) {
    TW.contextMenuHandler.updateContextMenus(tabInfo.tabId);
    TW.TabManager.updateLastAccessed(tabInfo.tabId)
  });
  chrome.tabs.onReplaced.addListener(TW.TabManager.replaceTab);
  //window.setInterval(TW.TabManager.checkToClose, TW.settings.get('checkInterval'));
  //window.setInterval(TW.TabManager.updateClosedCount, TW.settings.get('badgeCounterInterval'));
  
  // Create the "lock tab" context menu:
  TW.contextMenuHandler.createContextMenus();
}


window.onload = startup;