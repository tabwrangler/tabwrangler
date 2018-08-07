/* @flow */

import { applyMiddleware, combineReducers, createStore } from 'redux';
import { persistReducer, persistStore } from 'redux-persist';
import { localStorage } from 'redux-persist-webextension-storage';
import localStorageReducer from './reducers/localStorageReducer';
import tempStorageReducer from './reducers/tempStorageReducer';
import thunk from 'redux-thunk';

const PRE_V6_STORAGE_KEYS = [
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
        chrome.storage.local.get(PRE_V6_STORAGE_KEYS, items => {
          if (PRE_V6_STORAGE_KEYS.some(key => key !== 'installDate' && items[key] == null)) {
            // If there's nothing left in the store, then there's something unexpected going on with
            // react-redux and/or the Chrome/Firefox store. If any of the keys are null, then do
            // nothing because we don't want to wipe out the current state if a timeout or some
            // other exception occurred that is causing this error.
            //
            // * 'installDate' is an exception because it was never properly written to storage. If
            //   it is void, let the migration still happen.
            resolve(state);
          } else {
            // Remove old data from the store once it's been migrated.
            chrome.storage.local.remove(Object.keys(items));
            resolve(items);
          }
        });
      });
    } else {
      return Promise.resolve(state);
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
