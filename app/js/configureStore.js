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
  debug: true,
  key: 'localStorage',
  serialize: false,
  storage: localStorage,
};

const syncStoragePersistConfig = {
  debug: true,
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
  const store = createStore(rootReducer, applyMiddleware(logger));
  return {
    persistor: persistStore(store),
    store,
  };
}
