import {
  incrementTotalTabsRemoved,
  removeTabTime,
  setSavedTabs,
  setTabTime,
  setTabTimes,
  setTotalTabsWrangled,
} from "./actions/localStorageActions";
import { getStorageLocalPersist } from "./queries";
import settings from "./settings";

type WrangleOption = "exactURLMatch" | "hostnameAndTitleMatch" | "withDuplicates";

export function findPositionByURL(savedTabs: chrome.tabs.Tab[], url: string | null = ""): number {
  return savedTabs.findIndex((item: chrome.tabs.Tab) => item.url === url && url != null);
}

export function findPositionByHostnameAndTitle(
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

export function getURLPositionFilterByWrangleOption(
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
  async wrangleTabs(tabs: Array<chrome.tabs.Tab>) {
    // No tabs, nothing to do
    if (tabs.length === 0) return;

    console.debug("[wrangleTabs] WRANGLING TABS", tabs);

    const localStorage = await getStorageLocalPersist();
    const maxTabs = settings.get<number>("maxTabs");
    let totalTabsWrangled = localStorage.totalTabsWrangled;
    const wrangleOption = settings.get<WrangleOption>("wrangleOption");
    const findURLPositionByWrangleOption = getURLPositionFilterByWrangleOption(
      localStorage.savedTabs,
      wrangleOption
    );

    let nextSavedTabs = localStorage.savedTabs.slice();
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

    await setSavedTabs(nextSavedTabs);
    await setTotalTabsWrangled(totalTabsWrangled);
  }

  async initTabs() {
    const tabs = await chrome.tabs.query({ windowType: "normal" });
    await setTabTimes(
      tabs.map((tab) => String(tab.id)),
      Date.now()
    );
  }

  /**
   * Returns tab times (hash of tabId : lastAccess)
   * @param time
   *  If null, returns all.
   * @return {Array}
   */
  async getOlderThen(time?: number): Promise<Array<number>> {
    const ret: Array<number> = [];
    const { tabTimes } = await getStorageLocalPersist();
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
    console.debug("[onNewTab] updating new tab", tab);
    // Track new tab's time to close.
    if (tab.id != null) this.updateLastAccessed(tab.id);
  }

  async removeTab(tabId: number) {
    await incrementTotalTabsRemoved();
    settings.unlockTab(tabId);
    await removeTabTime(String(tabId));
  }

  async replaceTab(addedTabId: number, removedTabId: number) {
    await this.removeTab(removedTabId);
    this.updateLastAccessed(addedTabId);
  }

  async updateClosedCount(showBadgeCount: boolean = settings.get("showBadgeCount")): Promise<void> {
    let text;
    if (showBadgeCount) {
      const localStorage = await getStorageLocalPersist();
      const savedTabsLength = localStorage.savedTabs.length;
      text = savedTabsLength === 0 ? "" : savedTabsLength.toString();
    } else {
      text = "";
    }
    chrome.action.setBadgeText({ text });
  }

  async updateLastAccessed(tabOrTabId: chrome.tabs.Tab | number): Promise<void> {
    let tabId;
    if (typeof tabOrTabId !== "number" && typeof tabOrTabId.id !== "number") {
      console.log("Error: `tabOrTabId.id` is not an number", tabOrTabId.id);
      return;
    } else if (typeof tabOrTabId === "number") {
      tabId = tabOrTabId;
      await setTabTime(String(tabId), Date.now());
    } else {
      tabId = tabOrTabId.id;
      // @ts-expect-error `Tab.lastAccessed` not yet added to `chrome.tabs.Tab` type.
      await setTabTime(String(tabId), tabOrTabId?.lastAccessed ?? new Date().getTime());
    }
  }
}
