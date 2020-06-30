/* @flow */

import { applyMiddleware, combineReducers, createStore } from 'redux';
import { localStorage, syncStorage } from 'redux-persist-webextension-storage';
import { persistReducer, persistStore } from 'redux-persist';
import localStorageReducer from './reducers/localStorageReducer';
import settingsReducer from './reducers/settingsReducer';
import tempStorageReducer from './reducers/tempStorageReducer';
import thunk from 'redux-thunk';

const PRE_V6_STORAGE_KEYS: Array<string> = [
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

  // Disable redux-persist timeout functionality so it never erroneously wipes out the store. That's
  // never desired no matter how long the timeout lasts.
  //
  // See https://github.com/rt2zz/redux-persist/issues/809#issuecomment-437589932
  timeout: 0,
  version: 2,
};

const settingsPersistConfig = {
  key: 'settings',
  migrate(state) {
    if (state == null) return Promise.resolve(state);
    switch (state._persist.version) {
      // Migrating from v1 -> v2 moves `settings.paused` into the managed sync storage area.
      case 1:
        return new Promise(resolve => {
          chrome.storage.sync.get('paused', items => {
            if (Object.prototype.hasOwnProperty.call(items, 'paused')) {
              console.log('migrating! found paused', items.paused);
              resolve({
                ...state,
                paused: items.paused,
              });
            } else {
              resolve(state);
            }
          });
        });
      default:
        return Promise.resolve(state);
    }
  },
  serialize: false,
  storage: syncStorage,
  timeout: 0,
  version: 2,
};

const rootReducer = combineReducers({
  localStorage: persistReducer(localStoragePersistConfig, localStorageReducer),
  // $FlowFixMe redux-persist should allow parameterized PersistedState so app can declare shape.
  settings: persistReducer(settingsPersistConfig, settingsReducer),
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
