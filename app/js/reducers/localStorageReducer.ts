import { serializeTab } from "../util";

export type RemoveAllSavedTabsAction = {
  type: "REMOVE_ALL_SAVED_TABS";
};

export type RemoveSavedTabsAction = {
  tabs: Array<chrome.tabs.Tab>;
  type: "REMOVE_SAVED_TABS";
};

type ResetTabTimes = {
  type: "RESET_TAB_TIMES";
};

export type SetSavedTabsAction = {
  savedTabs: Array<chrome.tabs.Tab>;
  type: "SET_SAVED_TABS";
};

type SetTabTimeAction = {
  tabId: string;
  tabTime: number;
  type: "SET_TAB_TIME";
};

type SetTabTimesAction = {
  tabIds: string[];
  tabTime: number;
  type: "SET_TAB_TIMES";
};

export type SetTotalTabsUnwrangledAction = {
  totalTabsUnwrangled: number;
  type: "SET_TOTAL_TABS_UNWRANGLED";
};

export type SetTotalTabsWrangledAction = {
  totalTabsWrangled: number;
  type: "SET_TOTAL_TABS_WRANGLED";
};

// This is an "alias" action that is dispatched in the popup, serialized, and sent to the background
// script to be handled.
//
// See https://github.com/tshaddix/webext-redux/tree/95ff156b4afe9bfa697e55bfdb32ec116706aba3#4-optional-implement-actions-whose-logic-only-happens-in-the-background-script-we-call-them-aliases
type UnwrangleTabsAliasAction = {
  sessionTabs: Array<{ session: chrome.sessions.Session | undefined; tab: chrome.tabs.Tab }>;
  type: "UNWRANGLE_TABS_ALIAS";
};

export type Action =
  | RemoveAllSavedTabsAction
  | RemoveSavedTabsAction
  | ResetTabTimes
  | SetSavedTabsAction
  | SetTabTimeAction
  | SetTabTimesAction
  | SetTotalTabsUnwrangledAction
  | SetTotalTabsWrangledAction
  | UnwrangleTabsAliasAction;

export type State = {
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

export function createInitialState(): State {
  return {
    installDate: Date.now(),
    savedTabs: [],
    tabTimes: {},
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
      const removedTabsSet = new Set(action.tabs.map(serializeTab));
      // * Remove any tabs that are not in the action's array of tabs.
      const nextSavedTabs = state.savedTabs.filter((tab) => !removedTabsSet.has(serializeTab(tab)));
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
    case "RESET_TAB_TIMES":
      return {
        ...state,
        tabTimes: {},
      };
    case "SET_TAB_TIME":
      return {
        ...state,
        tabTimes: {
          ...state.tabTimes,
          [action.tabId]: action.tabTime,
        },
      };
    case "SET_TAB_TIMES": {
      const nextTabTimes = { ...state.tabTimes };
      action.tabIds.forEach((tabId) => {
        nextTabTimes[tabId] = action.tabTime;
      });
      return {
        ...state,
        tabTimes: nextTabTimes,
      };
    }
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
