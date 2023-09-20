import {
  setSavedTabs,
  setTotalTabsRemoved,
  setTotalTabsWrangled,
} from "./actions/localStorageActions";
import configureStore from "./configureStore";
import settings from "./settings";

type WrangleOption = "exactURLMatch" | "hostnameAndTitleMatch" | "withDuplicates";

export default class TabManager {
  store: ReturnType<typeof configureStore>["store"];

  constructor(store: ReturnType<typeof configureStore>["store"]) {
    this.store = store;
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
    const maxTabs = settings.get<number>("maxTabs");
    let totalTabsWrangled = this.store.getState().localStorage.totalTabsWrangled;
    const wrangleOption = settings.get<WrangleOption>("wrangleOption");
    const findURLPositionByWrangleOption = this.getURLPositionFilterByWrangleOption(wrangleOption);

    let nextSavedTabs = this.store.getState().localStorage.savedTabs.slice();
    const tabIdsToRemove: Array<number> = [];
    for (let i = 0; i < tabs.length; i++) {
      const existingTabPosition = findURLPositionByWrangleOption(tabs[i]);
      const closingDate = Date.now();

      if (existingTabPosition > -1) {
        nextSavedTabs.splice(existingTabPosition, 1);
      }

      // @ts-expect-error `closedAt` is a TW expando property on tabs
      tabs[i].closedAt = closingDate;
      nextSavedTabs.unshift(tabs[i]);
      totalTabsWrangled += 1;

      const tabId = tabs[i].id;
      if (tabId != null) {
        tabIdsToRemove.push(tabId);
      }
    }

    // Note: intentionally not awaiting tab removal! If removal does need to be awaited then this
    // function must be rewritten to get store values before/after async operations.
    if (tabIdsToRemove.length > 0) chrome.tabs.remove(tabIdsToRemove);

    // Trim saved tabs to the max allocated by the setting. Browser extension storage is limited and
    // thus cannot allow saved tabs to grow indefinitely.
    if (nextSavedTabs.length - maxTabs > 0) nextSavedTabs = nextSavedTabs.splice(0, maxTabs);

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

  onNewTab(tab: chrome.tabs.Tab) {
    // Track new tab's time to close.
    if (tab.id != null) this.updateLastAccessed(tab.id);
  }

  removeTab(tabId: number) {
    const totalTabsRemoved = this.store.getState().localStorage.totalTabsRemoved;
    this.store.dispatch(setTotalTabsRemoved(totalTabsRemoved + 1));
    settings.unlockTab(tabId);
    this.store.dispatch({ tabId: String(tabId), type: "REMOVE_TAB_TIME" });
  }

  replaceTab(addedTabId: number, removedTabId: number) {
    this.removeTab(removedTabId);
    this.updateLastAccessed(addedTabId);
  }

  updateClosedCount(showBadgeCount: boolean = settings.get("showBadgeCount")) {
    let text;
    if (showBadgeCount) {
      const savedTabsLength = this.store.getState().localStorage.savedTabs.length;
      text = savedTabsLength === 0 ? "" : savedTabsLength.toString();
    } else {
      text = "";
    }
    chrome.action.setBadgeText({ text });
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
