/* @flow */

import configureStore from 'redux-mock-store';
import { createInitialState as localStorageCreateInitialState } from '../reducers/localStorageReducer';
import { createInitialState as tempStorageCreateInitialState } from '../reducers/tempStorageReducer';

type MockInitialState = {
  localStorage?: Object,
  tempStorage?: Object,
};

export default function configureMockStore(initialState: MockInitialState = {}) {
  return configureStore()({
    localStorage: {
      ...localStorageCreateInitialState(),
      ...(initialState.localStorage == null ? {} : initialState.localStorage),
    },
    tempStorage: {
      ...tempStorageCreateInitialState(),
      ...(initialState.tempStorage == null ? {} : initialState.tempStorage),
    },
  });
}
