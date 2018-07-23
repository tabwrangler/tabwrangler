/* @flow */

import configureStore from 'redux-mock-store';
import { createInitialState as lsCreateInitialState } from '../reducers/localStorageReducer';
import thunk from 'redux-thunk';
import { createInitialState as tsCreateInitialState } from '../reducers/tempStorageReducer';

type MockInitialState = {
  localStorage?: Object,
  tempStorage?: Object,
};

export default function configureMockStore(initialState: MockInitialState = {}) {
  return configureStore([thunk])({
    localStorage: {
      ...lsCreateInitialState(),
      ...(initialState.localStorage == null ? {} : initialState.localStorage),
    },
    tempStorage: {
      ...tsCreateInitialState(),
      ...(initialState.tempStorage == null ? {} : initialState.tempStorage),
    },
  });
}
