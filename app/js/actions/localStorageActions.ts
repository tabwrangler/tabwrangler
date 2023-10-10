import {
  RemoveAllSavedTabsAction,
  SetSavedTabsAction,
  SetTotalTabsRemovedAction,
  SetTotalTabsUnwrangledAction,
  SetTotalTabsWrangledAction,
} from "../reducers/localStorageReducer";
import { serializeTab } from "../util";

type LocalStorage = {
  // Date of installation of Tab Wrangler
  installDate: number;
  // Tabs closed by Tab Wrangler
  savedTabs: Array<chrome.tabs.Tab>;
  // Map of tabId -> time remaining before tab is closed
  tabTimes: {
    [tabid: string]: number;
  };
  // Number of tabs closed by any means since install
  totalTabsRemoved: number;
  // Number of tabs unwrangled (re-opened from the corral) since install
  totalTabsUnwrangled: number;
  // Number of tabs wrangled since install
  totalTabsWrangled: number;
};

export function removeAllSavedTabs(): RemoveAllSavedTabsAction {
  return { type: "REMOVE_ALL_SAVED_TABS" };
}

export async function removeSavedTabs(tabs: Array<chrome.tabs.Tab>) {
  const data = await chrome.storage.local.get("persist:localStorage");
  const localStorage: LocalStorage = data["persist:localStorage"];
  if (localStorage == null) throw new Error("[unwrangleTabs] No data in `chrome.storage.local`");

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
}

export function setSavedTabs(savedTabs: Array<chrome.tabs.Tab>): SetSavedTabsAction {
  return { savedTabs, type: "SET_SAVED_TABS" };
}

export function setTotalTabsRemoved(totalTabsRemoved: number): SetTotalTabsRemovedAction {
  return { totalTabsRemoved, type: "SET_TOTAL_TABS_REMOVED" };
}

export function setTotalTabsUnwrangled(totalTabsUnwrangled: number): SetTotalTabsUnwrangledAction {
  return { totalTabsUnwrangled, type: "SET_TOTAL_TABS_UNWRANGLED" };
}

export function setTotalTabsWrangled(totalTabsWrangled: number): SetTotalTabsWrangledAction {
  return { totalTabsWrangled, type: "SET_TOTAL_TABS_WRANGLED" };
}

export async function unwrangleTabs(
  sessionTabs: Array<{
    session: chrome.sessions.Session | undefined;
    tab: chrome.tabs.Tab;
  }>
) {
  const data = await chrome.storage.local.get("persist:localStorage");
  const localStorage: LocalStorage = data["persist:localStorage"];
  if (localStorage == null) throw new Error("[unwrangleTabs] No data in `chrome.storage.local`");

  const installDate = localStorage.installDate;
  let countableTabsUnwrangled = 0;
  sessionTabs.forEach((sessionTab) => {
    // Count only those tabs closed after install date because users who upgrade will not have
    // an accurate count of all tabs closed. The updaters' install dates will be the date of
    // the upgrade, after which point TW will keep an accurate count of closed tabs.
    // @ts-expect-error `closedAt` is a TW expando property on tabs
    if (sessionTab.tab.closedAt >= installDate) countableTabsUnwrangled++;
  });

  // Get all of the restored tabs out of the store.
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
