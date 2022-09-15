import tabmanager from "./tabmanager";

const defaultCache: Record<string, unknown> = {};
const defaultLockedIds: Array<number> = [];
const defaultLockedWindowIds: Array<number> = [];

const Settings = {
  cache: defaultCache,

  defaults: {
    // How often we check for old tabs.
    checkInterval: 5000,

    // Saved sort order for list of closed tabs. When null, default sort is used (resverse chrono.)
    corralTabSortOrder: null,

    // wait 1 second before updating an active tab
    debounceOnActivated: false,

    // Don't close tabs that are playing audio.
    filterAudio: true,

    // Don't close tabs that are a member of a group.
    filterGroupedTabs: false,

    // An array of tabids which have been explicitly locked by the user.
    // TODO: rename to `lockedTabIds`?
    lockedIds: defaultLockedIds,
    
    // An array of window ids which have been explicitly locked by the user.
    lockedWindowIds: defaultLockedWindowIds,

    // Saved sort order for list of open tabs. When null, default sort is used (tab order)
    lockTabSortOrder: null,

    // Max number of tabs stored before the list starts getting truncated.
    maxTabs: 100,

    // Stop acting if there are only minTabs tabs open.
    minTabs: 5,

    // How many minutes (+ secondsInactive) before we consider a tab "stale" and ready to close.
    minutesInactive: 20,

    // Save closed tabs in between browser sessions.
    purgeClosedTabs: false,

    // How many seconds (+ minutesInactive) before a tab is "stale" and ready to close.
    secondsInactive: 0,

    // When true, shows the number of closed tabs in the list as a badge on the browser icon.
    showBadgeCount: false,

    // An array of patterns to check against. If a URL matches a pattern, it is never locked.
    whitelist: ["about:", "chrome://"],

    // We allow duplicate entries in the closed/wrangled tabs list
    wrangleOption: "withDupes",
  } as Record<string, unknown>,

  // Gets all settings from sync and stores them locally.
  init() {
    const keys: Array<string> = [];
    for (const i in this.defaults) {
      if (Object.prototype.hasOwnProperty.call(this.defaults, i)) {
        this.cache[i] = this.defaults[i];
        keys.push(i);
      }
    }
    chrome.storage.sync.get(keys, (items) => {
      for (const i in items) {
        if (Object.prototype.hasOwnProperty.call(items, i)) {
          this.cache[i] = items[i];

          // Because the badge count is external state, this side effect must be run once the value
          // is read from storage. This could more elequently be handled in a reducer, but place it
          // here to make minimal changes while correctly updating the badge count.
          if (i === "showBadgeCount") tabmanager.updateClosedCount();
        }
      }
    });
  },

  /**
   * Either calls a getter function or returns directly from storage.
   */
  get<T>(key: string): T {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    if (typeof this[key] == "function") {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore:next-line
      return this[key]();
    }
    return this.cache[key] as T;
  },

  /**
   * Sets a value in localStorage.  Can also call a setter.
   *
   * If the value is a struct (object or array) it is JSONified.
   */
  set<T>(key: string, value: T): void {
    // Magic setter functions are set{fieldname}
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    if (typeof this["set" + key] == "function") {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore:next-line
      this["set" + key](value);
    } else {
      Settings.setValue(key, value);
    }
  },

  /**
   * @see Settings.set
   */
  setmaxTabs(value: string) {
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue) || parsedValue < 1 || parsedValue > 1000) {
      throw Error(
        chrome.i18n.getMessage("settings_setmaxTabs_error") || "Error: settings.setmaxTabs"
      );
    }
    Settings.setValue("maxTabs", parsedValue);
  },

  /**
   * @see Settings.set
   */
  setminTabs(value: string) {
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue) || parsedValue < 0) {
      throw Error(
        chrome.i18n.getMessage("settings_setminTabs_error") || "Error: settings.setminTabs"
      );
    }
    Settings.setValue("minTabs", parsedValue);
  },

  /**
   * @see Settings.set
   */
  setminutesInactive(value: string): void {
    const minutes = parseInt(value, 10);
    if (isNaN(minutes) || minutes < 0) {
      throw Error(
        chrome.i18n.getMessage("settings_setminutesInactive_error") ||
          "Error: settings.setminutesInactive"
      );
    }

    // Reset the tabTimes since we changed the setting
    tabmanager.tabTimes = {};
    chrome.tabs.query({ windowType: "normal" }, tabmanager.initTabs);
    Settings.setValue("minutesInactive", value);
  },

  /**
   * @see Settings.set
   */
  setsecondsInactive(value: string): void {
    const seconds = parseInt(value, 10);
    if (isNaN(seconds) || seconds < 0 || seconds > 59) {
      throw Error(
        chrome.i18n.getMessage("settings_setsecondsInactive_error") || "Error: setsecondsInactive"
      );
    }

    // Reset the tabTimes since we changed the setting
    tabmanager.tabTimes = {};
    chrome.tabs.query({ windowType: "normal" }, tabmanager.initTabs);
    Settings.setValue("secondsInactive", value);
  },

  setshowBadgeCount(value: boolean) {
    Settings.setValue("showBadgeCount", value);
    tabmanager.updateClosedCount();
  },

  setValue<T>(key: string, value: T, fx?: () => void) {
    this.cache[key] = value;
    chrome.storage.sync.set({ [key]: value }, fx);
  },

  /**
   * Returns the number of milliseconds that tabs should stay open for without being used.
   */
  stayOpen(): number {
    return (
      parseInt(this.get("minutesInactive"), 10) * 60000 + // minutes
      parseInt(this.get("secondsInactive"), 10) * 1000 // seconds
    );
  },
};

export default Settings;
