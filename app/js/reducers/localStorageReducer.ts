export type RemoveAllSavedTabsAction = {
  type: "REMOVE_ALL_SAVED_TABS";
};

export type RemoveSavedTabsAction = {
  tabs: Array<chrome.tabs.Tab>;
  type: "REMOVE_SAVED_TABS";
};

type RemoveTabTimeAction = {
  tabId: number;
  type: "REMOVE_TAB_TIME";
};

type ResetTabTimesAction = {
  type: "RESET_TAB_TIMES";
};

export type SetSavedTabsAction = {
  savedTabs: Array<chrome.tabs.Tab>;
  type: "SET_SAVED_TABS";
};

export type SetTotalTabsRemovedAction = {
  totalTabsRemoved: number;
  type: "SET_TOTAL_TABS_REMOVED";
};

export type SetTotalTabsUnwrangledAction = {
  totalTabsUnwrangled: number;
  type: "SET_TOTAL_TABS_UNWRANGLED";
};

export type SetTotalTabsWrangledAction = {
  totalTabsWrangled: number;
  type: "SET_TOTAL_TABS_WRANGLED";
};

type UpdateTabTimeAction = {
  tabOrTabId: chrome.tabs.Tab | number | Array<chrome.tabs.Tab>;
  type: "UPDATE_TAB_TIME";
};

export type Action =
  | RemoveAllSavedTabsAction
  | RemoveSavedTabsAction
  | RemoveTabTimeAction
  | ResetTabTimesAction
  | SetSavedTabsAction
  | SetTotalTabsRemovedAction
  | SetTotalTabsUnwrangledAction
  | SetTotalTabsWrangledAction
  | UpdateTabTimeAction;

export type State = {
  // Date of installation of Tab Wrangler
  installDate: number;
  // Tabs closed by Tab Wrangler
  savedTabs: Array<chrome.tabs.Tab>;
  // Map of tabId -> secondsRemainingUntilClose to determine when to close tabs
  tabTimes: Record<string, number>;
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
  function updateTabTime(
    tabTimes: Record<string, number>,
    tabOrTabId: chrome.tabs.Tab | number
  ): Record<string, number> {
    let tabId;
    if (typeof tabOrTabId === "number") {
      tabId = tabOrTabId;
      tabTimes[String(tabId)] = Date.now();
    } else {
      tabId = tabOrTabId.id;
      // @ts-expect-error `lastAccessed` is not correctly typed in @types/webextension-polyfill
      tabTimes[String(tabId)] = tabOrTabId?.lastAccessed ?? new Date().getTime();
    }
    return tabTimes;
  }

  switch (action.type) {
    case "REMOVE_ALL_SAVED_TABS":
      return {
        ...state,
        savedTabs: [],
      };
    case "REMOVE_SAVED_TABS": {
      const removedTabsSet = new Set(action.tabs);
      // * Remove any tabs that are not in the action's array of tabs.
      const nextSavedTabs = state.savedTabs.filter((tab) => !removedTabsSet.has(tab));
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
    case "RESET_TAB_TIMES":
      return {
        ...state,
        tabTimes: {},
      };
    case "REMOVE_TAB_TIME": {
      const nextTabTimes = { ...state.tabTimes };
      delete nextTabTimes[action.tabId];
      return {
        ...state,
        tabTimes: nextTabTimes,
      };
    }
    case "UPDATE_TAB_TIME": {
      const { tabOrTabId } = action;
      const nextTabTimes = { ...state.tabTimes };
      if (Array.isArray(tabOrTabId)) {
        tabOrTabId.forEach((tabOrTabId) => {
          updateTabTime(nextTabTimes, tabOrTabId);
        });
      } else if (typeof tabOrTabId !== "number" && typeof tabOrTabId.id !== "number") {
        console.log("Error: `tabOrTabId.id` is not an number", tabOrTabId.id);
      } else {
        updateTabTime(nextTabTimes, tabOrTabId);
      }
      return {
        ...state,
        tabTimes: nextTabTimes,
      };
    }
    default:
      return state;
  }
}
