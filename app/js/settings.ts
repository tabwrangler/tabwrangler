import { getWhitelistMatch, isTabLocked } from "./tabUtil";

const defaultCache: Record<string, unknown> = {};
const defaultLockedIds: Array<number> = [];

export const SETTINGS_DEFAULTS = {
  // Saved sort order for list of closed tabs. When null, default sort is used (resverse chrono.)
  corralTabSortOrder: null,

  // wait 1 second before updating an active tab
  debounceOnActivated: true,

  // Don't close tabs that are playing audio.
  filterAudio: true,

  // Don't close tabs that are a member of a group.
  filterGroupedTabs: false,

  // An array of tabids which have been explicitly locked by the user.
  lockedIds: defaultLockedIds,

  // Saved sort order for list of open tabs. When null, default sort is used (tab order)
  lockTabSortOrder: null,

  // Max number of tabs stored before the list starts getting truncated.
  maxTabs: 1000,

  // Stop acting if there are only minTabs tabs open.
  minTabs: 20,

  // How many minutes (+ secondsInactive) before we consider a tab "stale" and ready to close.
  minutesInactive: 60,

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
} as Record<string, unknown>;

// This is a SINGLETON! It is imported both by backgrounnd.ts and by popup.tsx and used in both
// environments.
const Settings = {
  cache: defaultCache,

  // Gets all settings from sync and stores them locally.
  init(): Promise<void> {
    const keys: Array<string> = [];
    for (const i in SETTINGS_DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(SETTINGS_DEFAULTS, i)) {
        this.cache[i] = SETTINGS_DEFAULTS[i];
        keys.push(i);
      }
    }

    // Sync the cache with the browser's storage area. Changes in the background pages should sync
    // with those in the popup and vice versa.
    //
    // Note: this does NOT integrate with React, this is not a replacement for Redux. React
    // components will not be notified of the new values. For now this is okay because settings are
    // only updated via the popup and so React is already aware of the changes.
    chrome.storage.onChanged.addListener(
      (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName !== "sync") return;
        for (const [key, value] of Object.entries(changes)) this.cache[key] = value.newValue;
      }
    );

    return new Promise((resolve) => {
      chrome.storage.sync.get(keys, async (items) => {
        for (const i in items) {
          if (Object.prototype.hasOwnProperty.call(items, i)) {
            this.cache[i] = items[i];
          }
        }
        await this._initLockedIds();
        resolve();
      });
    });
  },

  async _initLockedIds(): Promise<void> {
    if (this.cache.lockedIds == null) return Promise.resolve();

    // Remove any tab IDs from the `lockedIds` list that no longer exist so the collection does not
    // grow unbounded. This also ensures tab IDs that are reused are not inadvertently locked.
    const tabs = await chrome.tabs.query({});
    const currTabIds = new Set(tabs.map((tab) => tab.id));
    const nextLockedIds = (this.cache.lockedIds as number[]).filter((lockedId) => {
      const lockedIdExists = currTabIds.has(lockedId);
      if (!lockedIdExists)
        console.debug(`Locked tab ID ${lockedId} no longer exixts; removing from 'lockedIds' list`);
      return lockedIdExists;
    });
    this.set("lockedIds", nextLockedIds);
    return void 0;
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

  getWhitelistMatch(url: string | undefined): string | null {
    return getWhitelistMatch(url, { whitelist: this.get<Array<string>>("whitelist") });
  },

  isTabLocked(tab: chrome.tabs.Tab): boolean {
    return isTabLocked(tab, {
      filterAudio: this.get("filterAudio"),
      filterGroupedTabs: this.get("filterGroupedTabs"),
      lockedIds: this.get<Array<number>>("lockedIds"),
      whitelist: this.get<Array<string>>("whitelist"),
    });
  },

  isTabManuallyLockable(tab: chrome.tabs.Tab): boolean {
    const tabWhitelistMatch = this.getWhitelistMatch(tab.url);
    return (
      !tab.pinned &&
      !tabWhitelistMatch &&
      !(tab.audible && this.get("filterAudio")) &&
      !(this.get("filterGroupedTabs") && "groupId" in tab && tab.groupId > 0)
    );
  },

  isWhitelisted(url: string): boolean {
    return this.getWhitelistMatch(url) !== null;
  },

  lockTab(tabId: number) {
    const lockedIds = this.get<Array<number>>("lockedIds");
    if (tabId > 0 && lockedIds.indexOf(tabId) === -1) {
      lockedIds.push(tabId);
    }
    this.set("lockedIds", lockedIds);
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

  setmaxTabs(maxTabs: string) {
    const parsedValue = parseInt(maxTabs, 10);
    if (isNaN(parsedValue) || parsedValue < 1 || parsedValue > 1000) {
      throw Error(
        chrome.i18n.getMessage("settings_setmaxTabs_error") || "Error: settings.setmaxTabs"
      );
    }
    Settings.setValue("maxTabs", parsedValue);
  },

  setminTabs(minTabs: string) {
    const parsedValue = parseInt(minTabs, 10);
    if (isNaN(parsedValue) || parsedValue < 0) {
      throw Error(
        chrome.i18n.getMessage("settings_setminTabs_error") || "Error: settings.setminTabs"
      );
    }
    Settings.setValue("minTabs", parsedValue);
  },

  setminutesInactive(minutesInactive: string): void {
    const minutes = parseInt(minutesInactive, 10);
    if (isNaN(minutes) || minutes < 0) {
      throw Error(
        chrome.i18n.getMessage("settings_setminutesInactive_error") ||
          "Error: settings.setminutesInactive"
      );
    }
    Settings.setValue("minutesInactive", minutesInactive);
  },

  setsecondsInactive(secondsInactive: string): void {
    const seconds = parseInt(secondsInactive, 10);
    if (isNaN(seconds) || seconds < 0 || seconds > 59) {
      throw Error(
        chrome.i18n.getMessage("settings_setsecondsInactive_error") || "Error: setsecondsInactive"
      );
    }
    Settings.setValue("secondsInactive", secondsInactive);
  },

  setValue<T>(key: string, value: T, fx?: () => void) {
    this.cache[key] = value;
    if (fx == null) chrome.storage.sync.set({ [key]: value });
    else chrome.storage.sync.set({ [key]: value }, fx);
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

  toggleTabs(tabs: chrome.tabs.Tab[]) {
    tabs.forEach((tab) => {
      if (tab.id == null) return;
      else if (this.isTabLocked(tab)) this.unlockTab(tab.id);
      else this.lockTab(tab.id);
    });
  },

  unlockTab(tabId: number) {
    const lockedIds = this.get<Array<number>>("lockedIds");
    if (lockedIds.indexOf(tabId) > -1) {
      lockedIds.splice(lockedIds.indexOf(tabId), 1);
    }
    this.set("lockedIds", lockedIds);
  },
};

export default Settings;
