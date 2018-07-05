/* @flow */

export function removeAllSavedTabs() {
  return { type: 'REMOVE_ALL_SAVED_TABS' };
}

export function removeSavedTabId(tabId: number) {
  return { tabId, type: 'REMOVE_SAVED_TAB_ID' };
}

export function setSavedTabs(savedTabs: Array<chrome$Tab>) {
  return { savedTabs, type: 'SET_SAVED_TABS' };
}

export function setTotalTabsRemoved(totalTabsRemoved: number) {
  return { totalTabsRemoved, type: 'SET_TOTAL_TABS_REMOVED' };
}

export function setTotalTabsUnwrangled(totalTabsUnwrangled: number) {
  return { totalTabsUnwrangled, type: 'SET_TOTAL_TABS_UNWRANGLED' };
}

export function setTotalTabsWrangled(totalTabsWrangled: number) {
  return { totalTabsWrangled, type: 'SET_TOTAL_TABS_WRANGLED' };
}
