/* @flow */

// eslint-disable-next-line no-unused-vars
import type { Action, AppState } from "../Types";
import configureStore from "redux-mock-store";
import { createInitialState as lsCreateInitialState } from "../reducers/localStorageReducer";
import thunk from "redux-thunk";
import { createInitialState as tsCreateInitialState } from "../reducers/tempStorageReducer";

type MockInitialState = {
  localStorage?: Object,
  tempStorage?: Object,
};

export default function configureMockStore(
  initialState: MockInitialState = { localStorage: null, tempStorage: null }
) {
  return configureStore([thunk])<AppState, Action>({
    localStorage: {
      ...lsCreateInitialState(),
      ...(initialState.localStorage == null ? {} : initialState.localStorage),
    },
    settings: {
      paused: false,
      theme: "system",
    },
    tempStorage: {
      ...tsCreateInitialState(),
      ...(initialState.tempStorage == null ? {} : initialState.tempStorage),
    },
  });
}
