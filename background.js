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
  chrome.tabs.query({
    windowType: 'normal'
  }, TW.TabManager.initTabs);
  chrome.tabs.onCreated.addListener(TW.TabManager.onNewTab);
  chrome.tabs.onUpdated.addListener(TW.TabManager.updateLastAccessed);
  chrome.tabs.onRemoved.addListener(TW.TabManager.removeTab);
  chrome.tabs.onActivated.addListener(function(tabInfo) {
    TW.contextMenuHandler.updateContextMenus(tabInfo['tabId'])
    TW.TabManager.updateLastAccessed(tabInfo['tabId'])
  });
  window.setInterval(TW.TabManager.checkToClose, TW.settings.get('checkInterval'));
  window.setInterval(TW.TabManager.updateClosedCount, TW.settings.get('badgeCounterInterval'));
  
  // Create the "lock tab" context menu:
  TW.contextMenuHandler.createContextMenus();
}


window.onload = startup;