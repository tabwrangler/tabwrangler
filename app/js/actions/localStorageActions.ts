import { Dispatch, GetState } from "../Types";
import {
  RemoveAllSavedTabsAction,
  RemoveSavedTabsAction,
  SetSavedTabsAction,
  SetTotalTabsRemovedAction,
  SetTotalTabsUnwrangledAction,
  SetTotalTabsWrangledAction,
} from "../reducers/localStorageReducer";

export function removeAllSavedTabs(): RemoveAllSavedTabsAction {
  return { type: "REMOVE_ALL_SAVED_TABS" };
}

export function removeSavedTabs(tabs: Array<chrome.tabs.Tab>): RemoveSavedTabsAction {
  return { tabs, type: "REMOVE_SAVED_TABS" };
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

export function unwrangleTabs(
  sessionTabs: Array<{
    session: chrome.sessions.Session | undefined;
    tab: chrome.tabs.Tab;
  }>
) {
  return (dispatch: Dispatch, getState: GetState) => {
    const { localStorage } = getState();
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
    dispatch(removeSavedTabs(sessionTabs.map((sessionTab) => sessionTab.tab)));

    const totalTabsUnwrangled = localStorage.totalTabsUnwrangled;
    dispatch(setTotalTabsUnwrangled(totalTabsUnwrangled + countableTabsUnwrangled));
  };
}
