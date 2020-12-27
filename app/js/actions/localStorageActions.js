/* @flow */

import type {
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

export function removeSavedTabs(tabs: Array<chrome$Tab>): RemoveSavedTabsAction {
  return { tabs, type: "REMOVE_SAVED_TABS" };
}

export function setSavedTabs(savedTabs: Array<chrome$Tab>): SetSavedTabsAction {
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
