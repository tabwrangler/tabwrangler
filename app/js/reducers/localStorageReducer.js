/* @flow */

export type RemoveAllSavedTabsAction = {
  type: "REMOVE_ALL_SAVED_TABS",
};

export type RemoveSavedTabsAction = {
  tabs: Array<chrome$Tab>,
  type: "REMOVE_SAVED_TABS",
};

export type SetSavedTabsAction = {
  savedTabs: Array<chrome$Tab>,
  type: "SET_SAVED_TABS",
};

export type SetTotalTabsRemovedAction = {
  totalTabsRemoved: number,
  type: "SET_TOTAL_TABS_REMOVED",
};

export type SetTotalTabsUnwrangledAction = {
  totalTabsUnwrangled: number,
  type: "SET_TOTAL_TABS_UNWRANGLED",
};

export type SetTotalTabsWrangledAction = {
  totalTabsWrangled: number,
  type: "SET_TOTAL_TABS_WRANGLED",
};

export type Action =
  | RemoveAllSavedTabsAction
  | RemoveSavedTabsAction
  | SetSavedTabsAction
  | SetTotalTabsRemovedAction
  | SetTotalTabsUnwrangledAction
  | SetTotalTabsWrangledAction;

export type State = {
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

export function createInitialState(): State {
  return {
    installDate: Date.now(),
    savedTabs: [],
    totalTabsRemoved: 0,
    totalTabsUnwrangled: 0,
    totalTabsWrangled: 0,
  };
}

const initialState = createInitialState();
export default function localStorage(state: State = initialState, action: Action): State {
  switch (action.type) {
    case "REMOVE_ALL_SAVED_TABS":
      return {
        ...state,
        savedTabs: [],
      };
    case "REMOVE_SAVED_TABS": {
      const removedTabsSet = new Set(action.tabs);
      // * Annotate `nextSavedTabs` to appease Flow. It's unclear why this annotation is required
      //   and can't be inferred.
      // * Remove any tabs that are not in the action's array of tabs.
      const nextSavedTabs: Array<chrome$Tab> = state.savedTabs.filter(
        (tab) => !removedTabsSet.has(tab)
      );
      return {
        ...state,
        savedTabs: nextSavedTabs,
      };
    }
    case "SET_SAVED_TABS":
      return {
        ...state,
        savedTabs: action.savedTabs,
      };
    case "SET_TOTAL_TABS_REMOVED":
      return {
        ...state,
        totalTabsRemoved: action.totalTabsRemoved,
      };
    case "SET_TOTAL_TABS_UNWRANGLED":
      return {
        ...state,
        totalTabsUnwrangled: action.totalTabsUnwrangled,
      };
    case "SET_TOTAL_TABS_WRANGLED":
      return {
        ...state,
        totalTabsWrangled: action.totalTabsWrangled,
      };
    default:
      return state;
  }
}
