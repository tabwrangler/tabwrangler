/* @flow */

type RemoveAllSavedTabsAction = {
  type: 'REMOVE_ALL_SAVED_TABS',
};

type RemoveSavedTabIdAction = {
  tabId: number,
  type: 'REMOVE_SAVED_TAB_ID',
};

type SetSavedTabsAction = {
  savedTabs: Array<chrome$Tab>,
  type: 'SET_SAVED_TABS',
};

type SetTotalTabsRemovedAction = {
  totalTabsRemoved: number,
  type: 'SET_TOTAL_TABS_REMOVED_SUCCESS',
};

type SetTotalTabsUnwrangledAction = {
  totalTabsUnwrangled: number,
  type: 'SET_TOTAL_TABS_UNWRANGLED_SUCCESS',
};

type SetTotalTabsWrangledAction = {
  totalTabsWrangled: number,
  type: 'SET_TOTAL_TABS_WRANGLED_SUCCESS',
};

export type Action =
  | RemoveAllSavedTabsAction
  | RemoveSavedTabIdAction
  | SetSavedTabsAction
  | SetTotalTabsRemovedAction
  | SetTotalTabsUnwrangledAction
  | SetTotalTabsWrangledAction;

type State = {
  // Date of installation of Tab Wrangler
  installDate: number,

  // Tabs closed by Tab Wrangler
  savedTabs: Array<chrome$Tab>,

  // Number of tabs closed by any means since install
  totalTabsRemoved: number,

  // Number of tabs unwrangled (re-opened from the corral) since install
  totalTabsUnwrangled: number,

  // Number of tabs wrangled since install
  totalTabsWrangled: number,
};

export function createInitialState() {
  return {
    installDate: Date.now(),
    savedTabs: [],
    totalTabsRemoved: 0,
    totalTabsUnwrangled: 0,
    totalTabsWrangled: 0,
  };
}

const initialState = createInitialState();
export default function localStorage(state: State = initialState, action: Action) {
  switch (action.type) {
    case 'REMOVE_ALL_SAVED_TABS':
      return {
        ...state,
        savedTabs: [],
      };
    case 'REMOVE_SAVED_TAB_ID': {
      // Extract `tabId` to preserve type refinement inside `findIndex` callback.
      const actionTabId = action.tabId;
      const tabIndex = state.savedTabs.findIndex(tab => tab.id === actionTabId);
      if (tabIndex === -1) return state;

      // * Annotate `nextSavedTabs` to appease Flow. It's unclear why this annotation is required
      //   and can't be inferred.
      // * Copy the Array first (using `slice`) to achieve pseudo-immutability.
      const nextSavedTabs: Array<chrome$Tab> = state.savedTabs.slice();
      nextSavedTabs.splice(tabIndex, 1);
      return {
        ...state,
        savedTabs: nextSavedTabs,
      };
    }
    case 'SET_SAVED_TABS':
      return {
        ...state,
        savedTabs: action.savedTabs,
      };
    case 'SET_TOTAL_TABS_REMOVED_SUCCESS':
      return {
        ...state,
        totalTabsRemoved: action.totalTabsRemoved,
      };
    case 'SET_TOTAL_TABS_UNWRANGLED_SUCCESS':
      return {
        ...state,
        totalTabsUnwrangled: action.totalTabsUnwrangled,
      };
    case 'SET_TOTAL_TABS_WRANGLED_SUCCESS':
      return {
        ...state,
        totalTabsWrangled: action.totalTabsWrangled,
      };
    default:
      return state;
  }
}
