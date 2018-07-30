/* @flow */

import { applyMiddleware, combineReducers, createStore } from 'redux';
import { persistReducer, persistStore } from 'redux-persist';
import { localStorage } from 'redux-persist-webextension-storage';
import localStorageReducer from './reducers/localStorageReducer';
import tempStorageReducer from './reducers/tempStorageReducer';
import thunk from 'redux-thunk';

const PRE_V6_LOCAL_STORAGE_KEYS = [
  'installDate',
  'savedTabs',
  'totalTabsRemoved',
  'totalTabsUnwrangled',
  'totalTabsWrangled',
];
const localStoragePersistConfig = {
  key: 'localStorage',
  migrate(state) {
    // The first time this code is run there will be no redux-persist version of the state. In that
    // case, return the full contents of storage to be the initial state.
    if (state == null) {
      return new Promise(resolve => {
        chrome.storage.local.get(null, items => {
          // This is necessary to ensure Tab Wrangler doesn't go over its storage limit because
          // during this migration all items are moved to new locations, and without first removing
          // the old location Tab Wrangler would temporarily double its storage usage.
          chrome.storage.local.remove(Object.keys(items), () => {
            resolve(items);
          });
        });
      });
    } else {
      const inboundVersion =
        state._persist && state._persist.version !== undefined ? state._persist.version : -1;
      if (inboundVersion < 2) {
        return new Promise(resolve => {
          chrome.storage.local.get(PRE_V6_LOCAL_STORAGE_KEYS, data => {
            const nextState = { ...state };
            Object.keys(data).forEach(key => {
              const value = data[key];
              if (value != null) {
                switch (key) {
                  case 'installDate':
                    // $FlowFixMe
                    nextState.installDate = value;
                    break;
                  case 'savedTabs':
                    // $FlowFixMe
                    nextState.savedTabs =
                      // $FlowFixMe
                      nextState.savedTabs == null ? value : nextState.savedTabs.concat(value);
                    break;
                  case 'totalTabsRemoved':
                  case 'totalTabsUnwrangled':
                  case 'totalTabsWrangled':
                    // $FlowFixMe
                    nextState[key] = nextState[key] == null ? value : nextState[key] + value;
                    break;
                }
              }
            });
            chrome.storage.local.remove(PRE_V6_LOCAL_STORAGE_KEYS, () => {
              resolve(nextState);
            });
          });
        });
      } else {
        return Promise.resolve(state);
      }
    }
  },
  serialize: false,
  storage: localStorage,
  version: 2,
};

const rootReducer = combineReducers({
  localStorage: persistReducer(localStoragePersistConfig, localStorageReducer),
  tempStorage: tempStorageReducer,
});

export default function() {
  // $FlowFixMe
  const store = createStore(rootReducer, applyMiddleware(thunk));
  return {
    persistor: persistStore(store),
    store,
  };
}
