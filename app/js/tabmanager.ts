import {
  removeAllSavedTabs,
  setSavedTabs,
  setTotalTabsRemoved,
  setTotalTabsWrangled,
} from "./actions/localStorageActions";
import configureStore from "./configureStore";

type WrangleOption = "exactURLMatch" | "hostnameAndTitleMatch" | "withDuplicates";

export default class TabManager {
  store: ReturnType<typeof configureStore>["store"];

  constructor(store: ReturnType<typeof configureStore>["store"]) {
    this.store = store;
  }

  clear() {
    this.store.dispatch(removeAllSavedTabs());
  }

  findPositionById(id: number): number | null {
    const { savedTabs } = this.store.getState().localStorage;
    for (let i = 0; i < savedTabs.length; i++) {
      if (savedTabs[i].id === id) {
        return i;
      }
    }
    return null;
  }

  findPositionByURL(url: string | null = ""): number {
    return this.store
      .getState()
      .localStorage.savedTabs.findIndex((item: chrome.tabs.Tab) => item.url === url && url != null);
  }

  findPositionByHostnameAndTitle(url = "", title = ""): number {
    const hostB = new URL(url).hostname;
    return this.store.getState().localStorage.savedTabs.findIndex((tab: chrome.tabs.Tab) => {
      const hostA = new URL(tab.url || "").hostname;
      return hostA === hostB && tab.title === title;
    });
  }

  getURLPositionFilterByWrangleOption(option: WrangleOption): (tab: chrome.tabs.Tab) => number {
    if (option === "hostnameAndTitleMatch") {
      return (tab: chrome.tabs.Tab): number =>
        this.findPositionByHostnameAndTitle(tab.url, tab.title);
    } else if (option === "exactURLMatch") {
      return (tab: chrome.tabs.Tab): number => this.findPositionByURL(tab.url);
    }

    // `'withDupes'` && default
    return () => -1;
  }

  wrangleTabs(tabs: Array<chrome.tabs.Tab>) {
    const maxTabs = window.TW.settings.get<number>("maxTabs");
    let totalTabsWrangled = this.store.getState().localStorage.totalTabsWrangled;
    const wrangleOption = window.TW.settings.get<WrangleOption>("wrangleOption");
    const findURLPositionByWrangleOption = this.getURLPositionFilterByWrangleOption(wrangleOption);

    let nextSavedTabs = this.store.getState().localStorage.savedTabs.slice();
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

    this.store.dispatch(setSavedTabs(nextSavedTabs));
    this.store.dispatch(setTotalTabsWrangled(totalTabsWrangled));
  }

  initTabs(tabs: Array<chrome.tabs.Tab>) {
    for (let i = 0; i < tabs.length; i++) {
      this.updateLastAccessed(tabs[i]);
    }
  }

  /**
   * Returns tab times (hash of tabId : lastAccess)
   * @param time
   *  If null, returns all.
   * @return {Array}
   */
  getOlderThen(time?: number): Array<number> {
    const ret = [];
    const { tabTimes } = this.store.getState().localStorage;
    for (const i in tabTimes) {
      if (Object.prototype.hasOwnProperty.call(tabTimes, i)) {
        if (!time || tabTimes[i] < time) {
          ret.push(parseInt(i, 10));
        }
      }
    }
    return ret;
  }

  removeTab(tabId: number) {
    const totalTabsRemoved = this.store.getState().localStorage.totalTabsRemoved;
    this.store.dispatch(setTotalTabsRemoved(totalTabsRemoved + 1));
    window.TW.settings.unlockTab(tabId);
    this.store.dispatch({ tabId: String(tabId), type: "REMOVE_TAB_TIME" });
  }

  replaceTab(addedTabId: number, removedTabId: number) {
    this.removeTab(removedTabId);
    this.updateLastAccessed(addedTabId);
  }

  resetTabTimes() {
    this.store.dispatch({ type: "RESET_TAB_TIMES" });
  }

  updateClosedCount(showBadgeCount: boolean = window.TW.settings.get("showBadgeCount")) {
    let text;
    if (showBadgeCount) {
      const savedTabsLength = this.store.getState().localStorage.savedTabs.length;
      text = savedTabsLength === 0 ? "" : savedTabsLength.toString();
    } else {
      text = "";
    }
    chrome.browserAction.setBadgeText({ text });
  }

  updateLastAccessed(tabOrTabId: chrome.tabs.Tab | number | Array<chrome.tabs.Tab>) {
    let tabId;
    if (Array.isArray(tabOrTabId)) {
      tabOrTabId.map(this.updateLastAccessed.bind(this));
      return;
    } else if (typeof tabOrTabId !== "number" && typeof tabOrTabId.id !== "number") {
      console.log("Error: `tabOrTabId.id` is not an number", tabOrTabId.id);
      return;
    } else if (typeof tabOrTabId === "number") {
      tabId = tabOrTabId;
      this.store.dispatch({ tabId: String(tabId), tabTime: Date.now(), type: "SET_TAB_TIME" });
    } else {
      tabId = tabOrTabId.id;
      this.store.dispatch({
        tabId: String(tabId),
        // `Tab.lastAccessed` not yet added to `chrome.tabs.Tab` type.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore:next-line
        tabTime: tabOrTabId?.lastAccessed ?? new Date().getTime(),
        type: "SET_TAB_TIME",
      });
    }
  }
}
