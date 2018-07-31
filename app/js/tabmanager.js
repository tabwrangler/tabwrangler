/* @flow */
/* global TW */

import { exportData, importData } from './actions/importExportActions';
import {
  removeAllSavedTabs,
  removeSavedTabId,
  setSavedTabs,
  setTotalTabsRemoved,
  setTotalTabsUnwrangled,
  setTotalTabsWrangled,
} from './actions/localStorageActions';
import _ from 'lodash';

type WrangleOption = 'exactURLMatch' | 'hostnameAndTitleMatch' | 'withDuplicates';

/**
 * Stores the tabs in a separate variable to log Last Accessed time.
 * @type {Object}
 */
const TabManager = {
  tabTimes: {}, // An array of tabId => timestamp

  closedTabs: {
    clear() {
      TW.store.dispatch(removeAllSavedTabs());
    },

    // @todo: move to filter system for consistency
    findPositionById(id: number): ?number {
      const { savedTabs } = TW.store.getState().localStorage;
      for (let i = 0; i < savedTabs.length; i++) {
        if (savedTabs[i].id === id) {
          return i;
        }
      }
      return null;
    },

    findPositionByURL(url: ?string = ''): number {
      return _.findIndex(TW.store.getState().localStorage.savedTabs, item => {
        return item.url === url && !_.isUndefined(url);
      });
    },

    findPositionByHostnameAndTitle(url: string = '', title: string = ''): number {
      const hostB = new URL(url).hostname;
      return _.findIndex(TW.store.getState().localStorage.savedTabs, tab => {
        const hostA = new URL(tab.url || '').hostname;
        return hostA === hostB && tab.title === title;
      });
    },

    unwrangleTabs(sessionTabs: Array<{ session: ?chrome$Session, tab: chrome$Tab }>) {
      const { localStorage } = TW.store.getState();
      const installDate = localStorage.installDate;
      let countableTabsUnwrangled = 0;
      sessionTabs.forEach(sessionTab => {
        // TODO: What should actually happen if there's no tab ID? Is this even a possible use case
        // at this point?
        const tabId = sessionTab.tab.id;
        if (tabId == null) return;

        if (sessionTab.session == null || sessionTab.session.tab == null) {
          chrome.tabs.create({ active: false, url: sessionTab.tab.url });
        } else {
          chrome.sessions.restore(sessionTab.session.tab.sessionId);
        }
        TW.store.dispatch(removeSavedTabId(tabId));

        // Count only those tabs closed after install date because users who upgrade will not have
        // an accurate count of all tabs closed. The updaters' install dates will be the date of
        // the upgrade, after which point TW will keep an accurate count of closed tabs.
        // $FlowFixMe
        if (sessionTab.tab.closedAt >= installDate) countableTabsUnwrangled++;
      });

      const totalTabsUnwrangled = localStorage.totalTabsUnwrangled;
      TW.store.dispatch(setTotalTabsUnwrangled(totalTabsUnwrangled + countableTabsUnwrangled));
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
      return () => {
        return -1;
      };
    },

    wrangleTabs(tabs: Array<Object>) {
      const maxTabs = TW.settings.get('maxTabs');
      let totalTabsWrangled = TW.store.getState().localStorage.totalTabsWrangled;
      const wrangleOption = TW.settings.get('wrangleOption');
      const findURLPositionByWrangleOption = this.getURLPositionFilterByWrangleOption(
        wrangleOption
      );

      let nextSavedTabs = TW.store.getState().localStorage.savedTabs.slice();
      for (let i = 0; i < tabs.length; i++) {
        if (tabs[i] === null) {
          console.log('Weird bug, backtrace this...');
        }

        const existingTabPosition = findURLPositionByWrangleOption(tabs[i]);
        const closingDate = new Date().getTime();

        if (existingTabPosition > -1) {
          nextSavedTabs.splice(existingTabPosition, 1);
        }

        tabs[i].closedAt = closingDate;
        nextSavedTabs.unshift(tabs[i]);
        totalTabsWrangled += 1;

        // Close it in Chrome.
        chrome.tabs.remove(tabs[i].id);
      }

      if (nextSavedTabs.length - maxTabs > 0) {
        nextSavedTabs = nextSavedTabs.splice(0, maxTabs);
      }

      TW.store.dispatch(setSavedTabs(nextSavedTabs));
      TW.store.dispatch(setTotalTabsWrangled(totalTabsWrangled));
    },
  },

  initTabs(tabs: Array<chrome$Tab>) {
    for (let i = 0; i < tabs.length; i++) {
      TabManager.updateLastAccessed(tabs[i]);
    }
  },

  /* Re-export so these can be executed in the context of the Tab Manager. */
  exportData,
  importData,

  /**
   * Wrapper function to get all tab times regardless of time inactive
   * @return {Array}
   */
  getAll() {
    return TabManager.getOlderThen();
  },

  /**
   * Returns tab times (hash of tabId : lastAccess)
   * @param time
   *  If null, returns all.
   * @return {Array}
   */
  getOlderThen(time?: number) {
    const ret = [];
    for (const i in this.tabTimes) {
      if (this.tabTimes.hasOwnProperty(i)) {
        if (!time || this.tabTimes[i] < time) {
          ret.push(parseInt(i, 10));
        }
      }
    }
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
    const totalTabsRemoved = TW.store.getState().localStorage.totalTabsRemoved;
    TW.store.dispatch(setTotalTabsRemoved(totalTabsRemoved + 1));
    delete TabManager.tabTimes[tabId];
  },

  // `addListener` intersection results in incorrect function type
  // $FlowFixMe
  replaceTab(addedTabId: number, removedTabId: number) {
    TabManager.removeTab(removedTabId);
    TabManager.updateLastAccessed(addedTabId);
  },

  unlockTab(tabId: number) {
    const lockedIds = TW.settings.get('lockedIds');
    if (lockedIds.indexOf(tabId) > -1) {
      lockedIds.splice(lockedIds.indexOf(tabId), 1);
    }
    TW.settings.set('lockedIds', lockedIds);
  },

  updateClosedCount() {
    if (TW.settings.get('showBadgeCount') === false) return;
    const savedTabsLength = TW.store.getState().localStorage.savedTabs.length;
    chrome.browserAction.setBadgeText({
      text: savedTabsLength.length === 0 ? '' : savedTabsLength.toString(),
    });
  },

  // `addListener` intersection results in incorrect function type
  // $FlowFixMe
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

    TabManager.tabTimes[tabId] = new Date().getTime();
  },
};

export default TabManager;
