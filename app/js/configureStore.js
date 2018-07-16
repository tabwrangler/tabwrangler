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
        chrome.storage.local.get(null, items => {
          // THIS CANNOT BE INTERRUPTED! This is a bit scary, but the full contents of Tab
          // Wrangler's storage is held in memory between removing and resolving the outer Promise.
          // This is necessary to ensure Tab Wrangler doesn't go over its storage limit because
          // during this migration all items are moved to new locations, and without first removing
          // the old location Tab Wrangler would temporarily double its storage usage.
          chrome.storage.local.remove(Object.keys(items), () => {
            resolve(items);
          });
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
