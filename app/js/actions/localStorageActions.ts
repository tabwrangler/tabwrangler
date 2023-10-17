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

// This is an ["aliased" action creator][0] that is called by message passing from popup ->
// background script. The function receives the full de-serialized action as an argument and returns
// a Thunk to dispatch more actions.
//
// This is done in the background script to ensure `chrome` API calls execute even if the popup
// closes during execution.
//
// [0]: https://github.com/tshaddix/webext-redux/tree/95ff156b4afe9bfa697e55bfdb32ec116706aba3#4-optional-implement-actions-whose-logic-only-happens-in-the-background-script-we-call-them-aliases
export function unwrangleTabs({
  sessionTabs,
}: {
  sessionTabs: Array<{
    session: chrome.sessions.Session | undefined;
    tab: chrome.tabs.Tab;
  }>;
}) {
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
      // @ts-expect-error `closedAt` is a TW expando property on tabs
      if (sessionTab.tab.closedAt >= installDate) countableTabsUnwrangled++;
    });

    // Done opening them all, now get all of the restored tabs out of the store.
    dispatch(removeSavedTabs(sessionTabs.map((sessionTab) => sessionTab.tab)));

    const totalTabsUnwrangled = localStorage.totalTabsUnwrangled;
    dispatch(setTotalTabsUnwrangled(totalTabsUnwrangled + countableTabsUnwrangled));
  };
}
