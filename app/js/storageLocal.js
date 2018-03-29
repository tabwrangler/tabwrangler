/* @flow */

const storageLocal = {
  cache: {},

  defaults: {
    installDate: Date.now(), // Date of installation of Tab Wrangler
    tabTimes: {}, // {[tabId: number]: number}
    totalTabsRemoved: 0, // Number of tabs closed by any means since install
    totalTabsUnwrangled: 0, // Number of tabs unwrangled (re-opened from the corral) since install
    totalTabsWrangled: 0, // Number of tabs wrangled since install
  },

  // Gets all settings from sync and stores them locally.
  init(): void {
    const keys = [];
    Object.keys(this.defaults).forEach(setting => {
      this.cache[setting] = this.defaults[setting];
      keys.push(setting);
    });

    chrome.storage.local.get(keys, items => {
      Object.keys(items).forEach(setting => {
        this.cache[setting] = items[setting];
      });
    });
  },

  /**
   * Either calls a getter function or returns directly from storage.
   *
   * Returns callback function after value is received.
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
