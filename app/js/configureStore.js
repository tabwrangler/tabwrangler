/* @flow */

import { applyMiddleware, combineReducers, createStore } from 'redux';
import { localStorage, syncStorage } from 'redux-persist-webextension-storage';
import { persistReducer, persistStore } from 'redux-persist';
import localStorageReducer from './reducers/localStorageReducer';
import logger from 'redux-logger';
import syncStorageReducer from './reducers/syncStorageReducer';
import tempStorageReducer from './reducers/tempStorageReducer';
import thunk from 'redux-thunk';

const localStoragePersistConfig = {
  key: 'localStorage',
  migrate(state) {
    // The first time this code is run there will be no redux-persist version of the state. In that
    // case, return the full contents of storage to be the initial state.
    if (state == null) {
      return new Promise(resolve => {
        // $FlowFixMe `chrome.storage.local.get` accepts `null`, but the types are incorrect.
        chrome.storage.local.get(null, items => {
          resolve(items);
        });
      });
    } else {
      return Promise.resolve(state);
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
  const store = createStore(rootReducer, applyMiddleware(thunk, logger));
  return {
    persistor: persistStore(store),
    store,
  };
}
