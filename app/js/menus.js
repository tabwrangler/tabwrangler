'use strict';

/* global chrome */

import settings from './settings';
import tabmanager from './tabmanager';

function getDomain(url) {
  return url.match(/[^:]+:\/\/([^\/]+)\//)[1];
}

/**
 * Creates and updates context menus and page action menus.
 */
export default {
  lockActionId: null,

  pageSpecificActions: {
    lockTab: function(onClickData, selectedTab) {
      tabmanager.lockTab(selectedTab.id);
    },
    lockDomain: function(onClickData, selectedTab) {
      const whitelist = settings.get('whitelist');
      const domain = getDomain(selectedTab.url);
      whitelist.push(domain);
      settings.set('whitelist', whitelist);
    },
    corralTab: function(onClickData, selectedTab) {
      tabmanager.closedTabs.saveTabs([selectedTab]);
      // Close it in Chrome.
      chrome.tabs.remove(selectedTab.id);
    },
  },

  createContextMenus: function () {
    const lockTab = {
      'type': 'checkbox',
      'title': "Never close this tab",
      'onclick': this.pageSpecificActions['lockTab'],
    };

    const lockDomain = {
      'type': 'checkbox',
      'title': "Never close anything on this domain",
      'onclick': this.pageSpecificActions['lockDomain'],
    };

    const corralTab = {
      'type': 'normal',
      'title': "Close tab and save URL immediately",
      'onclick': this.pageSpecificActions['corralTab'],
    };

    this.lockTabId = chrome.contextMenus.create(lockTab);
    this.lockDomainId = chrome.contextMenus.create(lockDomain);
    chrome.contextMenus.create(corralTab);
  },

  updateContextMenus: function(tabId) {
    const self = this;
    // Little bit of a kludge, would be nice to be DRY here but this was simpler.
    // Sets the title again for each page.
    chrome.tabs.get(tabId, function(tab) {
      try {
        const currentDomain = getDomain(tab.url);
        chrome.contextMenus.update(self.lockDomainId, {'title': 'Never close anything on ' + currentDomain});
      } catch (e) {
        console.log(tab, 'Error in updating menu');
        throw e;
      }
    });
    chrome.contextMenus.update(this.lockTabId, {'checked': tabmanager.isLocked(tabId)});
  },
};
