define(['settings', 'tabmanager', 'util'], function(settings, tabmanager, util) {
  /**
   * Creates and updates context menus and page action menus.
   */
  ContextMenuHandler = {
    lockActionId: null,

    getPageActionButtons: function() {
      return {
        'lockTab': "Never close this tab",
        'lockDomain': "Never close anything on this domain",
        'corralTab': 'Close tab and save URL immediately',
      };
    },

    handlePageAction: function (actionId, currentTab) {
      ContextMenuHandler.pageSpecificActions[actionId]({}, currentTab);
    },

    pageSpecificActions: {
      lockTab: function(onClickData, selectedTab) {
        tabmanager.lockTab(selectedTab.id);
      },
      lockDomain: function(onClickData, selectedTab) {
        whitelist = settings.get('whitelist');
        domain = util.getDomain(selectedTab.url);
        whitelist.push(domain);
        settings.set('whitelist', whitelist);
      },
      corralTab: function(onClickData, selectedTab) {
        tabmanager.closedTabs.saveTabs([selectedTab]);
        // Close it in Chrome.
        chrome.tabs.remove(selectedTab.id);
      }
    },

    createContextMenus: function () {
      var lockTab = {
        'type': 'checkbox',
        'title': "Never close this tab",
        'onclick': this.pageSpecificActions['lockTab']
      };

      var lockDomain = {
        'type': 'checkbox',
        'title': "Never close anything on this domain",
        'onclick': this.pageSpecificActions['lockDomain']
      };

      var corralTab = {
        'type': 'normal',
        'title': "Close tab and save URL immediately",
        'onclick': this.pageSpecificActions['corralTab']
      };

      this.lockTabId = chrome.contextMenus.create(lockTab);
      this.lockDomainId = chrome.contextMenus.create(lockDomain);
      chrome.contextMenus.create(corralTab);
    },
    
    updateContextMenus: function(tabId) {
      self = this;
      // Little bit of a kludge, would be nice to be DRY here but this was simpler.
      // Sets the title again for each page.
      chrome.pageAction.show(tabId);
      chrome.tabs.get(tabId, function(tab) {
        try {
          var currentDomain = util.getDomain(tab.url);
          chrome.contextMenus.update(self.lockDomainId, {'title': 'Never close anything on ' + currentDomain});
        } catch (e) {
          console.log(tab, "Error in updating menu");
          throw e;
        }
      });
      chrome.contextMenus.update(this.lockTabId, {'checked': tabmanager.isLocked(tabId)});
    }
  };
  return ContextMenuHandler;
});