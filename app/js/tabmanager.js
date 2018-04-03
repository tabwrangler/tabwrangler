/* @flow */
/* global TW */

import _ from 'lodash';

type WrangleOption = 'exactURLMatch' | 'hostnameAndTitleMatch' | 'withDuplicates';

/**
 * Stores the tabs in a separate variable to log Last Accessed time.
 * @type {Object}
 */
const TabManager = {

  closedTabs: {
    tabs: [],

    init(): Promise<void> {
      return new Promise(resolve => {
        chrome.storage.local.get('savedTabs', items => {
          if (typeof items['savedTabs'] != 'undefined') {
            this.tabs = items['savedTabs'];
            TabManager.updateClosedCount();
          }
          resolve();
        });
      });
    },

    clear() {
      this.tabs = [];
      chrome.storage.local.remove('savedTabs');
      TabManager.updateClosedCount();
    },

    // @todo: move to filter system for consistency
    findPositionById(id: number): ?number {
      for (let i = 0; i < this.tabs.length; i++) {
        if (this.tabs[i].id === id) {
          return i;
        }
      }
      return null;
    },

    findPositionByURL(url: string = ''): number {
      return _.findIndex(this.tabs, (item) => { return item.url === url && !_.isUndefined(url); });
    },

    findPositionByHostnameAndTitle(url: string = '', title: string = ''): number {
      const hostB = new URL(url).hostname;
      return _.findIndex(this.tabs, (tab) => {
        const hostA = new URL(tab.url || '').hostname;
        return hostA === hostB && tab.title === title;
      });
    },

    removeTab(tabId: number) {
      const tabIndex = TabManager.closedTabs.findPositionById(tabId);
      if (tabIndex == null) return null;

      const output = TabManager.closedTabs.tabs.splice(tabIndex, 1);
      TabManager.closedTabs.save();
      TabManager.updateClosedCount();
      return output;
    },

    save() {
      // persists this.tabs to local storage
      chrome.storage.local.set({savedTabs: this.tabs});
    },

    unwrangleTabs(sessionTabs: Array<{session: ?chrome$Session, tab: chrome$Tab}>) {
      const installDate = TW.storageLocal.get('installDate');
      let countableTabsUnwrangled = 0;
      sessionTabs.forEach(sessionTab => {
        if (sessionTab.session == null || sessionTab.session.tab == null) {
          chrome.tabs.create({active: false, url: sessionTab.tab.url});
        } else {
          chrome.sessions.restore(sessionTab.session.tab.sessionId);
        }
        this.removeTab(sessionTab.tab.id);

        // Count only those tabs closed after install date because users who upgrade will not have
        // an accurate count of all tabs closed. The updaters' install dates will be the date of
        // the upgrade, after which point TW will keep an accurate count of closed tabs.
        // $FlowFixMe
        if (sessionTab.tab.closedAt >= installDate) countableTabsUnwrangled++;
      });

      const totalTabsUnwrangled = TW.storageLocal.get('totalTabsUnwrangled');
      TW.storageLocal.set('totalTabsUnwrangled', totalTabsUnwrangled + countableTabsUnwrangled);
      TabManager.updateClosedCount();
    },

    getURLPositionFilterByWrangleOption(option: WrangleOption): (tab: chrome$Tab) => number {
      if (option === 'hostnameAndTitleMatch') {
        return (tab: chrome$Tab): number => {
          return TabManager.closedTabs.findPositionByHostnameAndTitle(tab.url, tab.title);
        };
      } else if (option === 'exactURLMatch') {
        return (tab: chrome$Tab): number => {
          return TabManager.closedTabs.findPositionByURL(tab.url);
        };
      }

      // `'withDupes'` && default
      return () => { return -1; };
    },

    wrangleTabs(tabs: Array<Object>) {
      const maxTabs = TW.settings.get('maxTabs');
      let totalTabsWrangled = TW.storageLocal.get('totalTabsWrangled');
      const wrangleOption = TW.settings.get('wrangleOption');
      const findURLPositionByWrangleOption =
        this.getURLPositionFilterByWrangleOption(wrangleOption);

      for (let i = 0; i < tabs.length; i++) {
        if (tabs[i] === null) {
          console.log('Weird bug, backtrace this...');
        }

        const existingTabPosition = findURLPositionByWrangleOption(tabs[i]);
        const closingDate = new Date().getTime();

        if (existingTabPosition > -1) {
          this.tabs.splice(existingTabPosition, 1);
        }

        tabs[i].closedAt = closingDate;
        this.tabs.unshift(tabs[i]);
        totalTabsWrangled += 1;

        // Close it in Chrome.
        chrome.tabs.remove(tabs[i].id);
      }

      if ((this.tabs.length - maxTabs) > 0) {
        this.tabs = this.tabs.splice(0, maxTabs);
      }

      TW.storageLocal.set('totalTabsWrangled', totalTabsWrangled);
      TabManager.closedTabs.save();
      TabManager.updateClosedCount();
    },
  },

  filters: {
    // Matches when the URL is exactly matching
    exactUrl(url: string) {
      return function(tab: chrome$Tab) {
        return tab.url === url;
      };
    },

    // Matches either the title or URL containing "keyword"
    keyword(keyword: string) {
      return function(tab: chrome$Tab) {
        const test = new RegExp(keyword, 'i');
        return (tab.title != null && test.exec(tab.title)) ||
          (tab.url != null && test.exec(tab.url));
      };
    },
  },

  initTabs(tabs: Array<chrome$Tab>) {
    const purgeTabTimes = TW.settings.get('purgeTabTimes');
    const initialTabTimes = TW.storageLocal.get('tabTimes');
    const relevantTabIds = {};
    tabs.forEach(tab => {
      // TODO: What should happen if a tab has an undefined ID?
      if (tab.id == null) return;

      // * If `purgeTabTimes` is true, always reset tab timers
      // * Else, update tab timer only if it's not already initialized. Tabs whose close times were
      //   persisted to local storage will already exist in the `initialTabTimes` Object.
      if (purgeTabTimes || initialTabTimes[tab.id] == null) TabManager.updateLastAccessed(tab);

      // Track all relevant tab IDs so others can be deleted from local storage.
      relevantTabIds[tab.id] = true;
    });

    // Delete any irrelevant tab IDs, i.e. those not currently in use.
    const postTabTimes = TW.storageLocal.get('tabTimes');
    Object.keys(postTabTimes)
      .filter(tabId => !relevantTabIds[tabId])
      .forEach(tabId => { delete postTabTimes[tabId]; });
    TW.storageLocal.set('tabTimes', postTabTimes);
  },

  /**
   * Wrapper function to get all tab times regardless of time inactive
   */
  getAll(): Array<number> {
    return TabManager.getOlderThen();
  },

  /**
   * Returns tabs older than the given `time`.
   *
   * @param time If null, returns all.
   */
  getOlderThen(time?: number): Array<number> {
    const ret = [];
    const tabTimes = TW.storageLocal.get('tabTimes');
    Object.keys(tabTimes).forEach(tabId => {
      if (!time || tabTimes[tabId] < time) {
        ret.push(parseInt(tabId, 10));
      }
    });
    return ret;
  },

  getWhitelistMatch(url: string) {
    const whitelist = TW.settings.get('whitelist');
    for (let i = 0; i < whitelist.length; i++) {
      if (url.indexOf(whitelist[i]) !== -1) {
        return whitelist[i];
      }
    }
    return false;
  },

  isLocked(tabId: number) {
    const lockedIds = TW.settings.get('lockedIds');
    if (lockedIds.indexOf(tabId) !== -1) {
      return true;
    }
    return false;
  },

  isWhitelisted(url: string) {
    return this.getWhitelistMatch(url) !== false;
  },

  lockTab(tabId: number) {
    const lockedIds = TW.settings.get('lockedIds');

    if (tabId > 0 && lockedIds.indexOf(tabId) === -1) {
      lockedIds.push(tabId);
    }
    TW.settings.set('lockedIds', lockedIds);
  },

  // `addListener` intersection results in incorrect function type
  // $FlowFixMe
  removeTab(tabId: number) {
    const totalTabsRemoved = TW.storageLocal.get('totalTabsRemoved');
    TW.storageLocal.set('totalTabsRemoved', totalTabsRemoved + 1);

    const tabTimes = TW.storageLocal.get('tabTimes');
    delete tabTimes[tabId];
    TW.storageLocal.set('tabTimes', tabTimes);
  },

  // `addListener` intersection results in incorrect function type
  // $FlowFixMe
  replaceTab(addedTabId: number, removedTabId: number) {
    TabManager.removeTab(removedTabId);
    TabManager.updateLastAccessed(addedTabId);
  },

  searchTabs(
    cb: (tabs: Array<chrome$Tab>) => void,
    filters: Array<(tab: chrome$Tab) => boolean>
  ) {
    let tabs = TabManager.closedTabs.tabs;
    if (filters) {
      for (let i = 0; i < filters.length; i++) {
        tabs = _.filter(tabs, filters[i]);
      }
    }
    cb(tabs);
  },

  unlockTab(tabId: number) {
    const lockedIds = TW.settings.get('lockedIds');
    if (lockedIds.indexOf(tabId) > -1) {
      lockedIds.splice(lockedIds.indexOf(tabId), 1);
    }
    TW.settings.set('lockedIds', lockedIds);
  },

  updateClosedCount() {
    if (TW.settings.get('showBadgeCount') === false) {
      return;
    }
    let storedTabs = TabManager.closedTabs.tabs.length;
    if (storedTabs === 0) {
      storedTabs = '';
    }
    chrome.browserAction.setBadgeText({text: storedTabs.toString()});
  },

  updateLastAccessed(tabOrTabId: chrome$Tab | number | Array<chrome$Tab>) {
    let tabId;
    if (Array.isArray(tabOrTabId)) {
      tabOrTabId.map(TabManager.updateLastAccessed.bind(this));
      return;
    } else if (typeof tabOrTabId === 'number') {
      tabId = tabOrTabId;
    } else {
      tabId = tabOrTabId.id;
    }

    if (typeof tabId !== 'number') {
      console.log('Error: `tabId` is not an number', tabId);
      return;
    }

    const tabTimes = TW.storageLocal.get('tabTimes');
    tabTimes[tabId] = new Date().getTime();
    TW.storageLocal.set('tabTimes', tabTimes);
  },
};

export default TabManager;
