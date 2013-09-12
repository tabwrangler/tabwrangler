require(['settings', 'tabmanager'], function(settings, tabmanager) {
  /**
   * Creates and updates context menus.
   */
  ContextMenuHandler = {
    lockActionId: null,
    createContextMenus: function () {
      var lockTabAction = function(onClickData, selectedTab) {
        tabmanager.lockTab(selectedTab.id);
      };

      var lockDomainAction = function(onClickData, selectedTab) {
        whitelist = settings.get('whitelist');
        domain = TW.util.getDomain(selectedTab.url);
        whitelist.push(domain);
        settings.set('whitelist', whitelist);
      };

      var corralTabAction = function(onClickData, selectedTab) {
        tabmanager.closedTabs.saveTabs([selectedTab]);
        // Close it in Chrome.
        chrome.tabs.remove(selectedTab.id);
      };

      var lockTab = {
        'type': 'checkbox',
        'title': "Never close this tab",
        'onclick': lockTabAction
      };

      var lockDomain = {
        'type': 'checkbox',
        'title': "Never close anything on this domain",
        'onclick': lockDomainAction
      };

      var corralTab = {
        'type': 'normal',
        'title': "Close tab and save URL immediately",
        'onclick': corralTabAction
      };

      this.lockTabId = chrome.contextMenus.create(lockTab);
      this.lockDomainId = chrome.contextMenus.create(lockDomain);
      chrome.contextMenus.create(corralTab);
    },
    
    updateContextMenus: function(tabId) {
      self = this;
      // Little bit of a kludge, would be nice to be DRY here but this was simpler.
      // Sets the title again for each page.
      chrome.tabs.get(tabId, function(tab) {
        var currentDomain = TW.util.getDomain(tab.url);
        chrome.contextMenus.update(self.lockDomainId, {'title': 'Never close anything on ' + currentDomain});
      });
      chrome.contextMenus.update(this.lockTabId, {'checked': tabmanager.isLocked(tabId)});
    }
  };
  return ContextMenuHandler;
});