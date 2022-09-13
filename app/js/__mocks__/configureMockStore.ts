import configureStore from "redux-mock-store";
import { createInitialState as lsCreateInitialState } from "../reducers/localStorageReducer";
import thunk from "redux-thunk";
import { createInitialState as tsCreateInitialState } from "../reducers/tempStorageReducer";

type MockInitialState = {
  localStorage?: Record<string, unknown>;
  tempStorage?: Record<string, unknown>;
};

export default function configureMockStore(
  initialState: MockInitialState = { localStorage: undefined, tempStorage: undefined }
) {
  return configureStore([thunk])({
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
