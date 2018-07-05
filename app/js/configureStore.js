/* @flow */

import { persistReducer, persistStore } from 'redux-persist';
import { combineReducers } from 'redux';
import { createStore } from 'redux';
import localStorageReducer from './reducers/localStorageReducer';
import syncStorageReducer from './reducers/syncStorageReducer';
import tempStorageReducer from './reducers/tempStorageReducer';

function createChromeStorage(type: 'local' | 'sync') {
  return {
    getItem(key: string) {
      return new Promise((resolve, reject) => {
        chrome.storage[type].get(key, value => {
          if (chrome.runtime.lastError == null) {
            // Chrome Storage returns the value in an Object of with its original key. Unwrap the
            // value from the returned Object to match the `getItem` API.
            resolve(value[key]);
          } else {
            reject();
          }
        });
      });
    },
    removeItem(key: string) {
      return new Promise((resolve, reject) => {
        chrome.storage[type].remove(key, () => {
          if (chrome.runtime.lastError == null) {
            resolve();
          } else {
            reject();
          }
        });
      });
    },
    setItem(key: string, value: mixed) {
      return new Promise((resolve, reject) => {
        chrome.storage[type].set({ [key]: value }, () => {
          if (chrome.runtime.lastError == null) {
            resolve();
          } else {
            reject();
          }
        });
      });
    },
  };
}

const localStoragePersistConfig = {
  debug: true,
  key: 'localStorage',
  serialize: false,
  storage: createChromeStorage('local'),
};

const syncStoragePersistConfig = {
  debug: true,
  key: 'syncStorage',
  serialize: false,
  storage: createChromeStorage('sync'),
};

const rootReducer = combineReducers({
  localStorage: persistReducer(localStoragePersistConfig, localStorageReducer),
  syncStorage: persistReducer(syncStoragePersistConfig, syncStorageReducer),
  tempStorage: tempStorageReducer,
});

export default function() {
  const store = createStore(rootReducer);
  return {
    persistor: persistStore(store),
    store,
  };
}
