/* @flow */

import type { Dispatch } from "../Types";

export function clearTempStorage() {
  return { type: "CLEAR_TEMP_STORAGE" };
}

export function setCommands(commands: Array<chrome$Command>) {
  return { commands, type: "SET_COMMANDS" };
}

export function fetchSessions() {
  return (dispatch: Dispatch) => {
    dispatch({ type: "FETCH_SESSIONS_REQUEST" });
    chrome.sessions.getRecentlyClosed((sessions) => {
      dispatch({ sessions, type: "FETCH_SESSIONS_SUCCESS" });
    });
  };
}
