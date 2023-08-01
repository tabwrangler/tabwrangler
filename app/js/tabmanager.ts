import { exportData, importData } from "./actions/importExportActions";
import {
  removeAllSavedTabs,
  removeSavedTabs,
  setSavedTabs,
  setTotalTabsRemoved,
  setTotalTabsUnwrangled,
  setTotalTabsWrangled,
} from "./actions/localStorageActions";

type WrangleOption = "exactURLMatch" | "hostnameAndTitleMatch" | "withDuplicates";

const TabManager = {
  closedTabs: {
    clear() {
      window.TW.store.dispatch(removeAllSavedTabs());
    },

    findPositionById(id: number): number | null {
      const { savedTabs } = window.TW.store.getState().localStorage;
      for (let i = 0; i < savedTabs.length; i++) {
        if (savedTabs[i].id === id) {
          return i;
        }
      }
      return null;
    },

    findPositionByURL(url: string | null = ""): number {
      return window.TW.store
        .getState()
        .localStorage.savedTabs.findIndex((item: chrome.tabs.Tab) => {
          return item.url === url && url != null;
        });
    },

    findPositionByHostnameAndTitle(url = "", title = ""): number {
      const hostB = new URL(url).hostname;
      return window.TW.store.getState().localStorage.savedTabs.findIndex((tab: chrome.tabs.Tab) => {
        const hostA = new URL(tab.url || "").hostname;
        return hostA === hostB && tab.title === title;
      });
    },

    unwrangleTabs(
      sessionTabs: Array<{
        session: chrome.sessions.Session | undefined;
        tab: chrome.tabs.Tab;
      }>
    ) {
      const { localStorage } = window.TW.store.getState();
      const installDate = localStorage.installDate;
      let countableTabsUnwrangled = 0;
      sessionTabs.forEach((sessionTab) => {
        if (sessionTab.session == null || sessionTab.session.tab == null) {
          chrome.tabs.create({ active: false, url: sessionTab.tab.url });
        } else {
          chrome.sessions.restore(sessionTab.session.tab.sessionId);
        }

        // Count only those tabs closed after install date because users who upgrade will not have
        // an accurate count of all tabs closed. The updaters' install dates will be the date of
        // the upgrade, after which point TW will keep an accurate count of closed tabs.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore:next-line
        if (sessionTab.tab.closedAt >= installDate) countableTabsUnwrangled++;
      });

      // Done opening them all, now get all of the restored tabs out of the store.
      window.TW.store.dispatch(removeSavedTabs(sessionTabs.map((sessionTab) => sessionTab.tab)));

      const totalTabsUnwrangled = localStorage.totalTabsUnwrangled;
      window.TW.store.dispatch(
        setTotalTabsUnwrangled(totalTabsUnwrangled + countableTabsUnwrangled)
      );
    },

    getURLPositionFilterByWrangleOption(option: WrangleOption): (tab: chrome.tabs.Tab) => number {
      if (option === "hostnameAndTitleMatch") {
        return (tab: chrome.tabs.Tab): number => {
          return TabManager.closedTabs.findPositionByHostnameAndTitle(tab.url, tab.title);
        };
      } else if (option === "exactURLMatch") {
        return (tab: chrome.tabs.Tab): number => {
          return TabManager.closedTabs.findPositionByURL(tab.url);
        };
      }

      // `'withDupes'` && default
      return () => {
        return -1;
      };
    },

    wrangleTabs(tabs: Array<chrome.tabs.Tab>) {
      const maxTabs = window.TW.settings.get<number>("maxTabs");
      let totalTabsWrangled = window.TW.store.getState().localStorage.totalTabsWrangled;
      const wrangleOption = window.TW.settings.get<WrangleOption>("wrangleOption");
      const findURLPositionByWrangleOption =
        this.getURLPositionFilterByWrangleOption(wrangleOption);

      let nextSavedTabs = window.TW.store.getState().localStorage.savedTabs.slice();
      for (let i = 0; i < tabs.length; i++) {
        if (tabs[i] === null) {
          console.log("Weird bug, backtrace this...");
        }

        const existingTabPosition = findURLPositionByWrangleOption(tabs[i]);
        const closingDate = Date.now();

        if (existingTabPosition > -1) {
          nextSavedTabs.splice(existingTabPosition, 1);
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore:next-line
        tabs[i].closedAt = closingDate;
        nextSavedTabs.unshift(tabs[i]);
        totalTabsWrangled += 1;

        // Close it in the browser.
        const tabId = tabs[i].id;
        if (tabId != null) chrome.tabs.remove(tabId);
      }

      if (nextSavedTabs.length - maxTabs > 0) {
        nextSavedTabs = nextSavedTabs.splice(0, maxTabs);
      }

      window.TW.store.dispatch(setSavedTabs(nextSavedTabs));
      window.TW.store.dispatch(setTotalTabsWrangled(totalTabsWrangled));
    },
  },

  initTabs(tabs: Array<chrome.tabs.Tab>) {
    for (let i = 0; i < tabs.length; i++) {
      TabManager.updateLastAccessed(tabs[i]);
    }
  },

  /* Re-export so these can be executed in the context of the Tab Manager. */
  exportData,
  importData,

  /**
   * Returns tab times (hash of tabId : lastAccess)
   * @param time
   *  If null, returns all.
   * @return {Array}
   */
  getOlderThen(time?: number): Array<number> {
    const ret = [];
    const { tabTimes } = window.TW.store.getState().localStorage;
    for (const i in tabTimes) {
      if (Object.prototype.hasOwnProperty.call(tabTimes, i)) {
        if (!time || tabTimes[i] < time) {
          ret.push(parseInt(i, 10));
        }
      }
    }
    return ret;
  },

  getWhitelistMatch(url: string | undefined): string | null {
    if (url == null) return null;
    const whitelist = window.TW.settings.get<string>("whitelist");
    for (let i = 0; i < whitelist.length; i++) {
      if (url.indexOf(whitelist[i]) !== -1) {
        return whitelist[i];
      }
    }
    return null;
  },

  isLocked(tabId: number): boolean {
    const lockedIds = window.TW.settings.get<Array<number>>("lockedIds");
    if (lockedIds.indexOf(tabId) !== -1) {
      return true;
    }
    return false;
  },

  isWhitelisted(url: string): boolean {
    return this.getWhitelistMatch(url) !== null;
  },

  lockTab(tabId: number) {
    const lockedIds = window.TW.settings.get<Array<number>>("lockedIds");
    if (tabId > 0 && lockedIds.indexOf(tabId) === -1) {
      lockedIds.push(tabId);
    }
    window.TW.settings.set("lockedIds", lockedIds);
  },

  removeTab(tabId: number) {
    const totalTabsRemoved = window.TW.store.getState().localStorage.totalTabsRemoved;
    window.TW.store.dispatch(setTotalTabsRemoved(totalTabsRemoved + 1));
    TabManager.unlockTab(tabId);
    window.TW.store.dispatch({ tabId: String(tabId), type: "REMOVE_TAB_TIME" });
  },

  replaceTab(addedTabId: number, removedTabId: number) {
    TabManager.removeTab(removedTabId);
    TabManager.updateLastAccessed(addedTabId);
  },

  resetTabTimes() {
    window.TW.store.dispatch({ type: "RESET_TAB_TIMES" });
  },

  toggleTabs(tabs: chrome.tabs.Tab[]) {
    tabs.forEach((tab) => {
      if (tab.id == null) return;
      else if (TabManager.isLocked(tab.id)) TabManager.unlockTab(tab.id);
      else TabManager.lockTab(tab.id);
    });
  },

  unlockTab(tabId: number) {
    const lockedIds = window.TW.settings.get<Array<number>>("lockedIds");
    if (lockedIds.indexOf(tabId) > -1) {
      lockedIds.splice(lockedIds.indexOf(tabId), 1);
    }
    window.TW.settings.set("lockedIds", lockedIds);
  },

  updateClosedCount() {
    let text;
    if (window.TW.settings.get("showBadgeCount")) {
      const savedTabsLength = window.TW.store.getState().localStorage.savedTabs.length;
      text = savedTabsLength.length === 0 ? "" : savedTabsLength.toString();
    } else {
      text = "";
    }
    chrome.browserAction.setBadgeText({ text });
  },

  updateLastAccessed(tabOrTabId: chrome.tabs.Tab | number | Array<chrome.tabs.Tab>) {
    let tabId;
    if (Array.isArray(tabOrTabId)) {
      tabOrTabId.map(TabManager.updateLastAccessed.bind(this));
      return;
    } else if (typeof tabOrTabId !== "number" && typeof tabOrTabId.id !== "number") {
      console.log("Error: `tabOrTabId.id` is not an number", tabOrTabId.id);
      return;
    } else if (typeof tabOrTabId === "number") {
      tabId = tabOrTabId;
      window.TW.store.dispatch({ tabId: String(tabId), tabTime: Date.now(), type: "SET_TAB_TIME" });
    } else {
      tabId = tabOrTabId.id;
      window.TW.store.dispatch({
        tabId: String(tabId),
        // `Tab.lastAccessed` not yet added to `chrome.tabs.Tab` type.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore:next-line
        tabTime: tabOrTabId?.lastAccessed ?? new Date().getTime(),
        type: "SET_TAB_TIME",
      });
    }
  },
};

export default TabManager;
