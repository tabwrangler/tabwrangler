/* @flow */

const storageLocal = {
  cache: {},

  defaults: {
    installDate: Date.now(), // Date of installation of Tab Wrangler
    totalTabsRemoved: 0, // Number of tabs closed by any means since install
    totalTabsUnwrangled: 0, // Number of tabs unwrangled (re-opened from the corral) since install
    totalTabsWrangled: 0, // Number of tabs wrangled since install
  },

  // Gets all settings from sync and stores them locally.
  init() {
    const keys = [];
    for (const i in this.defaults) {
      if (this.defaults.hasOwnProperty(i)) {
        this.cache[i] = this.defaults[i];
        keys.push(i);
      }
    }

    chrome.storage.local.get(keys, items => {
      for (const i in items) {
        if (items.hasOwnProperty(i)) {
          this.cache[i] = items[i];
        }
      }
    });
  },

  /**
   * Either calls a getter function or returns directly from storage.
   * @param key
   * @param fx
   *  Callback function after value is received.
   * @return {*}
   */
  get(key: string): mixed {
    if (typeof this[key] == 'function') {
      return this[key]();
    }
    return this.cache[key];
  },

  /**
   * Sets a value in localStorage.  Can also call a setter.
   *
   * If the value is a struct (object or array) it is JSONified.
   *
   * @param key
   *  Settings keyword string.
   * @param value
   * @return {*}
   */
  set(key: string, value: mixed) {
    // Magic setter functions are set{fieldname}
    if (typeof this['set' + key] == 'function') {
      this['set' + key](value);
    } else {
      this.setValue(key, value);
    }
  },

  setValue(key: string, value: mixed, fx?: () => void) {
    this.cache[key] = value;
    chrome.storage.local.set({[key]: value}, fx);
  },
};

export default storageLocal;
