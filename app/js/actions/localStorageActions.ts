import { ASYNC_LOCK } from "../storage";
import { getStorageLocalPersist } from "../queries";
import { serializeTab } from "../util";

export function removeAllSavedTabs(): Promise<void> {
  return ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        savedTabs: [],
      },
    });
  });
}

export function removeSavedTabs(tabs: Array<chrome.tabs.Tab>) {
  return ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    const removedTabsSet = new Set(tabs.map(serializeTab));
    // * Remove any tabs that are not in the action's array of tabs.
    const nextSavedTabs = localStorage.savedTabs.filter(
      (tab) => !removedTabsSet.has(serializeTab(tab))
    );

    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        savedTabs: nextSavedTabs,
      },
    });
  });
}

export function setSavedTabs(savedTabs: Array<chrome.tabs.Tab>): Promise<void> {
  return ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        savedTabs,
      },
    });
  });
}

export function setTabTime(tabId: string, tabTime: number) {
  return ASYNC_LOCK.acquire("local.tabTimes", async () => {
    const { tabTimes } = await chrome.storage.local.get({ tabTimes: {} });
    await chrome.storage.local.set({
      tabTimes: {
        ...tabTimes,
        [tabId]: tabTime,
      },
    });
  });
}

export function setTabTimes(tabIds: string[], tabTime: number) {
  return ASYNC_LOCK.acquire("local.tabTimes", async () => {
    const { tabTimes } = await chrome.storage.local.get({ tabTimes: {} });
    tabIds.forEach((tabId) => {
      tabTimes[tabId] = tabTime;
    });
    await chrome.storage.local.set({
      tabTimes,
    });
  });
}

export function incrementTotalTabsRemoved() {
  return ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        totalTabsRemoved: localStorage.totalTabsRemoved + 1,
      },
    });
  });
}

export function removeTabTime(tabId: string) {
  return ASYNC_LOCK.acquire("local.tabTimes", async () => {
    const { tabTimes } = await chrome.storage.local.get({ tabTimes: {} });
    delete tabTimes[tabId];
    await chrome.storage.local.set({
      tabTimes,
    });
  });
}

export async function unwrangleTabs(
  sessionTabs: Array<{
    session: chrome.sessions.Session | undefined;
    tab: chrome.tabs.Tab;
  }>
): Promise<void> {
  await ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    const installDate = localStorage.installDate;
    let countableTabsUnwrangled = 0;
    sessionTabs.forEach((sessionTab) => {
      // Count only those tabs closed after install date because users who upgrade will not have
      // an accurate count of all tabs closed. The updaters' install dates will be the date of
      // the upgrade, after which point TW will keep an accurate count of closed tabs.
      // @ts-expect-error `closedAt` is a TW expando property on tabs
      if (sessionTab.tab.closedAt >= installDate) countableTabsUnwrangled++;
    });

    const removedTabsSet = new Set(sessionTabs.map((sessionTab) => serializeTab(sessionTab.tab)));
    // * Remove any tabs that are not in the action's array of tabs.
    const nextSavedTabs = localStorage.savedTabs.filter(
      (tab) => !removedTabsSet.has(serializeTab(tab))
    );

    const totalTabsUnwrangled = localStorage.totalTabsUnwrangled;
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        savedTabs: nextSavedTabs,
        totalTabsUnwrangled: totalTabsUnwrangled + countableTabsUnwrangled,
      },
    });
  });

  await Promise.all(
    sessionTabs.map((sessionTab) => {
      if (sessionTab.session == null || sessionTab.session.tab == null) {
        return chrome.tabs.create({ active: false, url: sessionTab.tab.url });
      } else {
        return chrome.sessions.restore(sessionTab.session.tab.sessionId);
      }
    })
  );
}
