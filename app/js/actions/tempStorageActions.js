/* @flow */

import type { ClearTempStorageAction, SetCommandsAction } from "../reducers/tempStorageReducer";
import type { Dispatch } from "../Types";

export function clearTempStorage(): ClearTempStorageAction {
  return { type: "CLEAR_TEMP_STORAGE" };
}

export function setCommands(commands: Array<chrome$Command>): SetCommandsAction {
  return { commands, type: "SET_COMMANDS" };
}

export function fetchSessions(): (dispatch: Dispatch) => void {
  return (dispatch: Dispatch) => {
    dispatch({ type: "FETCH_SESSIONS_REQUEST" });
    chrome.sessions.getRecentlyClosed((sessions) => {
      dispatch({ sessions, type: "FETCH_SESSIONS_SUCCESS" });
    });
  };
}
