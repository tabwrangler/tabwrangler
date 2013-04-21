/**
 * @file: Initializes Tab Wrangler on startup.
 */

function startup() {
  TW.settings.init();
  TW.Updater.run();
  TW.TabManager.closedTabs.init();
  
  // Move this to a function somehwere so we can restart the process.
  chrome.tabs.query({ windowType: 'normal', pinned: false }, TW.TabManager.initTabs);
  chrome.tabs.onCreated.addListener(TW.TabManager.registerNewTab);
  
  // Handles pinning and unpinning a tab
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (_.has(changeInfo, 'pinned')) {
      if (changeInfo.pinned) {
        clearTimeout(TW.TabManager.openTabs[tabId].scheduledClose);
        TW.TabManager.tabPinned(tabId);
      } else {
        TW.TabManager.registerNewTab(tab);
      }
    }
  });
  
  chrome.tabs.onRemoved.addListener(TW.TabManager.removeTab);
  chrome.tabs.onActivated.addListener(function(tabInfo) {
    TW.contextMenuHandler.updateContextMenus(tabInfo.tabId);
    TW.TabManager.updateLastAccessed(tabInfo.tabId)
  });
  chrome.tabs.onReplaced.addListener(TW.TabManager.replaceTab);
  
  // Create the "lock tab" context menu:
  TW.contextMenuHandler.createContextMenus();
}


window.onload = startup;