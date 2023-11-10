import { ASYNC_LOCK } from "../storage";
import { getStorageLocalPersist } from "../queries";
import { serializeTab } from "../util";

export async function removeAllSavedTabs(): Promise<void> {
  ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        savedTabs: [],
      },
    });
  });
}

export async function removeSavedTabs(tabs: Array<chrome.tabs.Tab>) {
  ASYNC_LOCK.acquire("persist:localStorage", async () => {
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

export async function resetTabTimes() {
  ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        tabTimes: [],
      },
    });
  });
}

export async function setSavedTabs(savedTabs: Array<chrome.tabs.Tab>): Promise<void> {
  ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        savedTabs,
      },
    });
  });
}

export async function setTabTime(tabId: string, tabTime: number) {
  ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        tabTimes: {
          ...localStorage.tabTimes,
          [tabId]: tabTime,
        },
      },
    });
  });
}

export async function setTabTimes(tabIds: string[], tabTime: number) {
  ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    const nextTabTimes = { ...localStorage.tabTimes };
    tabIds.forEach((tabId) => {
      nextTabTimes[tabId] = tabTime;
    });
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        tabTimes: nextTabTimes,
      },
    });
  });
}

export async function incrementTotalTabsRemoved() {
  ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        totalTabsRemoved: localStorage.totalTabsRemoved + 1,
      },
    });
  });
}

export async function removeTabTime(tabId: string) {
  ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    const nextTabTimes = { ...localStorage.tabTimes };
    delete nextTabTimes[tabId];
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        tabTimes: nextTabTimes,
      },
    });
  });
}

export async function setTotalTabsWrangled(totalTabsWrangled: number) {
  ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        totalTabsWrangled,
      },
    });
  });
}

export async function unwrangleTabs(
  sessionTabs: Array<{
    session: chrome.sessions.Session | undefined;
    tab: chrome.tabs.Tab;
  }>
) {
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
