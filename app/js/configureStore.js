/* @flow */

import { applyMiddleware, combineReducers } from 'redux';
import { localStorage, syncStorage } from 'redux-persist-webextension-storage';
import { persistReducer, persistStore } from 'redux-persist';
import { createStore } from 'redux';
import localStorageReducer from './reducers/localStorageReducer';
import logger from 'redux-logger';
import syncStorageReducer from './reducers/syncStorageReducer';
import tempStorageReducer from './reducers/tempStorageReducer';

const localStoragePersistConfig = {
  key: 'localStorage',
  migrate(state, currentVersion) {
    if (!state) {
      return Promise.resolve(undefined);
    } else if (state._persist.version >= currentVersion) {
      return Promise.resolve(state);
    } else {
      return new Promise(resolve => {
        // $FlowFixMe `chrome.storage.local.get` accepts `null`, but the types are incorrect.
        chrome.storage.local.get(null, items => {
          resolve({
            ...state,
            ...items,
          });
        });
      });
    }
  },
  serialize: false,
  storage: localStorage,
  version: 1,
};

const syncStoragePersistConfig = {
  key: 'syncStorage',
  serialize: false,
  storage: syncStorage,
};

const rootReducer = combineReducers({
  localStorage: persistReducer(localStoragePersistConfig, localStorageReducer),
  syncStorage: persistReducer(syncStoragePersistConfig, syncStorageReducer),
  tempStorage: tempStorageReducer,
});

export default function() {
  // $FlowFixMe
  const store = createStore(rootReducer, applyMiddleware(logger));
  return {
    persistor: persistStore(store),
    store,
  };
}
