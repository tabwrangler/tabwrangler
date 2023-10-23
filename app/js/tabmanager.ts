import {
  incrementTotalTabsRemoved,
  removeTabTime,
  setSavedTabs,
  setTotalTabsWrangled,
} from "./actions/localStorageActions";
import configureStore from "./configureStore";
import settings from "./settings";

type WrangleOption = "exactURLMatch" | "hostnameAndTitleMatch" | "withDuplicates";

function findPositionByURL(savedTabs: chrome.tabs.Tab[], url: string | null = ""): number {
  return savedTabs.findIndex((item: chrome.tabs.Tab) => item.url === url && url != null);
}

function findPositionByHostnameAndTitle(
  savedTabs: chrome.tabs.Tab[],
  url = "",
  title = ""
): number {
  const hostB = new URL(url).hostname;
  return savedTabs.findIndex((tab: chrome.tabs.Tab) => {
    const hostA = new URL(tab.url || "").hostname;
    return hostA === hostB && tab.title === title;
  });
}

function getURLPositionFilterByWrangleOption(
  savedTabs: chrome.tabs.Tab[],
  option: WrangleOption
): (tab: chrome.tabs.Tab) => number {
  if (option === "hostnameAndTitleMatch") {
    return (tab: chrome.tabs.Tab): number =>
      findPositionByHostnameAndTitle(savedTabs, tab.url, tab.title);
  } else if (option === "exactURLMatch") {
    return (tab: chrome.tabs.Tab): number => findPositionByURL(savedTabs, tab.url);
  }

  // `'withDupes'` && default
  return () => -1;
}

export default class TabManager {
  store: ReturnType<typeof configureStore>["store"] | undefined;

  resetTabTimes() {
    if (this.store == null) return;
    this.store.dispatch({ type: "RESET_TAB_TIMES" });
    chrome.tabs.query({ windowType: "normal" }, (tabs) => {
      this.initTabs(tabs);
    });
  }

  wrangleTabs(tabs: Array<chrome.tabs.Tab>) {
    // Store not yet initialized, nothing to do
    if (this.store == null) return;
    // No tabs, nothing to do
    else if (tabs.length === 0) return;

    const maxTabs = settings.get<number>("maxTabs");
    let totalTabsWrangled = this.store.getState().localStorage.totalTabsWrangled;
    const wrangleOption = settings.get<WrangleOption>("wrangleOption");
    const findURLPositionByWrangleOption = getURLPositionFilterByWrangleOption(
      this.store.getState().localStorage.savedTabs,
      wrangleOption
    );

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
    const ret: Array<number> = [];
    if (this.store == null) return ret;

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

  async removeTab(tabId: number) {
    if (this.store == null) return;
    await incrementTotalTabsRemoved();
    settings.unlockTab(tabId);
    await removeTabTime(String(tabId));
  }

  async replaceTab(addedTabId: number, removedTabId: number) {
    await this.removeTab(removedTabId);
    this.updateLastAccessed(addedTabId);
  }

  setStore(store: ReturnType<typeof configureStore>["store"]) {
    this.store = store;
  }

  updateClosedCount(showBadgeCount: boolean = settings.get("showBadgeCount")) {
    if (this.store == null) return;
    let text;
    if (showBadgeCount) {
      const savedTabsLength = this.store.getState().localStorage.savedTabs.length;
      text = savedTabsLength === 0 ? "" : savedTabsLength.toString();
    } else {
      text = "";
    }
    chrome.action.setBadgeText({ text });
  }

  updateLastAccessed(tabOrTabId: chrome.tabs.Tab | number) {
    if (this.store == null) return;
    let tabId;
    if (typeof tabOrTabId !== "number" && typeof tabOrTabId.id !== "number") {
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
