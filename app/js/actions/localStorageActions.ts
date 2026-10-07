import { SessionTab, TabTimes, TabWithIndex } from "../types";
import { getRestorableGroupId, serializeTab } from "../util";
import { ASYNC_LOCK } from "../storage";
import { getStorageLocalPersist } from "../queries";
import settings from "../settings";

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
      (tab) => !removedTabsSet.has(serializeTab(tab)),
    );

    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        savedTabs: nextSavedTabs,
      },
    });
  });
}

export function insertSavedTabsAt(tabsWithIndices: TabWithIndex[]): Promise<void> {
  return ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    const savedTabs = [...localStorage.savedTabs];

    // Sort by index ascending so insertions don't affect subsequent indices
    const sorted = [...tabsWithIndices].sort((a, b) => a.index - b.index);

    // Insert each tab at its original index
    sorted.forEach(({ tab, index }) => {
      // Clamp index to valid range in case array has changed
      const insertAt = Math.min(index, savedTabs.length);
      savedTabs.splice(insertAt, 0, tab);
    });

    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        savedTabs,
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

export function addSavedTabs(tabs: Array<chrome.tabs.Tab>): Promise<void> {
  return ASYNC_LOCK.acquire("persist:localStorage", async () => {
    const localStorage = await getStorageLocalPersist();
    const existingTabsSet = new Set(localStorage.savedTabs.map(serializeTab));

    // Only add tabs that don't already exist
    const tabsToAdd = tabs.filter((tab) => !existingTabsSet.has(serializeTab(tab)));

    await chrome.storage.local.set({
      "persist:localStorage": {
        ...localStorage,
        savedTabs: [...localStorage.savedTabs, ...tabsToAdd],
      },
    });
  });
}

export function openTabs(tabs: Array<chrome.tabs.Tab>): Promise<chrome.tabs.Tab[]> {
  return Promise.all(tabs.map((tab) => chrome.tabs.create({ active: false, url: tab.url })));
}

export function setTabTime(tabId: string, tabTime: number) {
  return ASYNC_LOCK.acquire("local.tabTimes", async () => {
    const { tabTimes } = await chrome.storage.local.get<{ tabTimes: TabTimes }>({ tabTimes: {} });
    await chrome.storage.local.set({
      tabTimes: {
        ...tabTimes,
        [tabId]: tabTime,
      },
    });
  });
}

export function shiftTabTimes(pausedAtMs: number) {
  return ASYNC_LOCK.acquire("local.tabTimes", async () => {
    const { tabTimes } = await chrome.storage.local.get<{ tabTimes: TabTimes }>({
      tabTimes: {},
    });

    const now = Date.now();
    const deltaMs = now - pausedAtMs;
    const shifted: TabTimes = {};
    const minShiftedTimeMs = now - settings.longestTimeout();
    for (const [tabId, tabTimeMs] of Object.entries(tabTimes)) {
      // Timers do not count down while paused: a tab resumes with the time it had remaining when
      // paused, and a tab activated during the pause resumes with a full timer.
      const shiftedTimeMs = Math.min(tabTimeMs, pausedAtMs) + deltaMs;

      // Clamp new tabTimes to the longest timeout in case timeouts changed while paused
      shifted[tabId] = Math.max(shiftedTimeMs, minShiftedTimeMs);
    }
    console.debug(`[shiftTabTimes] Shifted tabTimes by ${deltaMs}ms pause`);
    await chrome.storage.local.set({ tabTimes: shifted });
  });
}

export function setTabTimes(tabIds: string[], tabTime: number) {
  return ASYNC_LOCK.acquire("local.tabTimes", async () => {
    const { tabTimes } = await chrome.storage.local.get<{ tabTimes: TabTimes }>({
      tabTimes: {},
    });
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
    const { tabTimes } = await chrome.storage.local.get<{ tabTimes: TabTimes }>({ tabTimes: {} });
    delete tabTimes[tabId];
    await chrome.storage.local.set({
      tabTimes,
    });
  });
}

export async function unwrangleTabs(sessionTabs: Array<SessionTab>): Promise<void> {
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
      (tab) => !removedTabsSet.has(serializeTab(tab)),
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

  const { browserStartedAt } = await chrome.storage.local.get<{ browserStartedAt?: number }>(
    "browserStartedAt",
  );
  await Promise.all(
    sessionTabs.map(async (sessionTab) => {
      const restoredTab = await restoreSessionTab(sessionTab);
      if (restoredTab != null)
        await regroupRestoredTab(
          restoredTab,
          getRestorableGroupId(sessionTab.tab, browserStartedAt),
        );
    }),
  );
}

async function restoreSessionTab(sessionTab: SessionTab): Promise<chrome.tabs.Tab | undefined> {
  const sessionId = sessionTab.session?.tab?.sessionId;
  if (sessionId != null) {
    try {
      const restoredSession = await chrome.sessions.restore(sessionId);
      return restoredSession.tab;
    } catch (error) {
      // The session list the popup matched against can be stale, e.g. the browser already
      // restored that session, so the ID is no longer valid
      console.log(`[restoreSessionTab] Failed to restore session ${sessionId}, opening URL`, error);
    }
  }
  return chrome.tabs.create({
    active: false,
    pinned: sessionTab.tab.pinned,
    url: sessionTab.tab.url,
  });
}

async function regroupRestoredTab(
  restoredTab: chrome.tabs.Tab,
  groupId: number | null,
): Promise<void> {
  if (
    chrome.tabGroups == null ||
    restoredTab.id == null ||
    groupId == null ||
    // The browser's own session restore may have already put the tab back in a group
    (restoredTab.groupId != null && restoredTab.groupId >= 0)
  )
    return;

  try {
    await chrome.tabGroups.get(groupId);
  } catch {
    // The group no longer exists, e.g. it was closed or emptied when its last tab was wrangled
    return;
  }

  try {
    await chrome.tabs.group({ groupId, tabIds: restoredTab.id });
    console.info(`[regroupRestoredTab] Added tab ${restoredTab.id} to group ${groupId}`);
  } catch (error) {
    console.log(`[regroupRestoredTab] Failed to add tab to group ${groupId}`, error);
  }
}
