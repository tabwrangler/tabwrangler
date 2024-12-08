import { AVERAGE_TAB_BYTES_SIZE, getWhitelistMatch, isTabLocked } from "./tabUtil";
import Menus from "./menus";

const defaultCache: Record<string, unknown> = {};
const defaultLockedIds: Array<number> = [];

export const SETTINGS_DEFAULTS = {
  // Saved sort order for list of closed tabs. When null, default sort is used (resverse chrono.)
  corralTabSortOrder: null,

  // Create a context menu for accessing Tab Wrangler functionality on click
  createContextMenu: true,

  // wait 1 second before updating an active tab
  debounceOnActivated: true,

  // Don't close tabs that are playing audio.
  filterAudio: false,

  // Don't close tabs that are a member of a group.
  filterGroupedTabs: false,

  // An array of tabids which have been explicitly locked by the user.
  lockedIds: defaultLockedIds,

  // Saved sort order for list of open tabs. When null, default sort is used (tab order)
  lockTabSortOrder: null,

  // Max number of tabs stored before the list starts getting truncated.
  maxTabs: 10,

  // Stop acting if there are only minTabs tabs open.
  minTabs: 0,

  // Strategy for counting minTabs
  // * "allWindows" - sum tabs across all open browser windows
  // * "givenWindow" (default) - count tabs within any given window
  minTabsStrategy: "allWindows",

  // How many minutes (+ secondsInactive) before we consider a tab "stale" and ready to close.
  minutesInactive: 2,

  // Save closed tabs in between browser sessions.
  purgeClosedTabs: false,

  // How many seconds (+ minutesInactive) before a tab is "stale" and ready to close.
  secondsInactive: 0,

  // When true, shows the number of closed tabs in the list as a badge on the browser icon.
  showBadgeCount: false,

  // An array of patterns to check against. If a URL matches a pattern, it it will close when inactive.
  whitelist: ["default fallback url"],

  // An array of patterns to check against. If a title matches a pattern, it will close when inactive.
  targetTitles: ["default fallback title"],

  // Allow duplicate entries in the closed/wrangled tabs list
  wrangleOption: "withDupes",
} as Record<string, unknown>;

// This is a SINGLETON! It is imported both by backgrounnd.ts and by popup.tsx and used in both
// environments.
const Settings = {
  _initPromise: undefined as Promise<void> | undefined,
  cache: defaultCache,

  // Gets all settings from sync and stores them locally.
  init(): Promise<void> {
    if (this._initPromise != null) return this._initPromise;

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
      },
    );

    this._initPromise = new Promise((resolve) => {
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

    return this._initPromise;
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
        console.debug(`Locked tab ID ${lockedId} no longer exists; removing from 'lockedIds' list`);
      return lockedIdExists;
    });
    this.set("lockedIds", nextLockedIds);
    return void 0;
  },

  addTargetTitle(title: string) {
    const targetTitles = this.get<Array<string>>("targetTitles");
    if (title != null && targetTitles.indexOf(title) === -1) {
      targetTitles.push(title);
    }
    return Settings.setValue("targetTitles", targetTitles);
  },

  addTargetUrl(url: string) {
    const targetUrls = this.get<Array<string>>("whitelist");
    if (url != null && targetUrls.indexOf(url) === -1) {
      targetUrls.push(url);
    }
    return Settings.setValue("whitelist", targetUrls);
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

  getWhitelistMatch(url: string | undefined, title: string | undefined): string | null {
    return getWhitelistMatch(url, title, { whitelist: this.get<Array<string>>("whitelist") }, { targetTitles: this.get<Array<string>>("targetTitles") });
  },

  isTabLocked(tab: chrome.tabs.Tab): boolean {
    return isTabLocked(tab, {
      filterAudio: this.get("filterAudio"),
      filterGroupedTabs: this.get("filterGroupedTabs"),
      lockedIds: this.get<Array<number>>("lockedIds"),
      whitelist: this.get<Array<string>>("whitelist"),
      targetTitles: this.get<Array<string>>("targetTitles"),
    });
  },

  isTabManuallyLockable(tab: chrome.tabs.Tab): boolean {
    const tabWhitelistMatch = this.getWhitelistMatch(tab.url, tab.title);
    return (
      !tab.pinned &&
      !tabWhitelistMatch &&
      !(tab.audible && this.get("filterAudio")) &&
      !(this.get("filterGroupedTabs") && "groupId" in tab && tab.groupId > 0)
    );
  },

  isWhitelisted(url: string, title: string | undefined): boolean {
    return this.getWhitelistMatch(url, title) !== null;
  },

  lockTab(tabId: number): Promise<void> {
    const lockedIds = this.get<Array<number>>("lockedIds");
    if (tabId > 0 && lockedIds.indexOf(tabId) === -1) {
      lockedIds.push(tabId);
    }
    return this.set("lockedIds", lockedIds);
  },

  removeTargetTitle(title: string) {
    const newTitles = this.get<Array<string>>("targetTitles");
    if (title != null && newTitles.indexOf(title) !== -1) {
      const urlIndex = newTitles.indexOf(title);
      newTitles.splice(urlIndex, 1);
    }
    return Settings.setValue("targetTitles", newTitles);
  },

  removeTargetUrl(url: string) {
    const targetUrls = this.get<Array<string>>("whitelist");
    if (url != null && targetUrls.indexOf(url) !== -1) {
      const urlIndex = targetUrls.indexOf(url);
      targetUrls.splice(urlIndex, 1);
    }
    return Settings.setValue("whitelist", targetUrls);
  },

  /**
   * Sets a value in localStorage.  Can also call a setter.
   *
   * If the value is a struct (object or array) it is JSONified.
   */
  set<T>(key: string, value: T): Promise<void> {
    // Magic setter functions are set{fieldname}
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    if (typeof this["set" + key] == "function") {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore:next-line
      return this["set" + key](value);
    } else {
      return Settings.setValue(key, value);
    }
  },

  setcreateContextMenu(nextCreateContextMenu: boolean): Promise<void> {
    if (nextCreateContextMenu) Menus.create();
    else Menus.destroy();
    return Settings.setValue("createContextMenu", nextCreateContextMenu);
  },

  _getStorageQuota(): number {
    const quota: number | undefined = chrome.storage.local.QUOTA_BYTES;
    if (quota === undefined) {
      // Firefox doesn't implement QUOTA_BYTES
      // According to https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local
      // it'll use the "same storage limits as applied to IndexedDB databases"
      // According to https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria#how_much_data_can_be_stored
      // that should be "10% of the total disk size where the profile of the user is store"
      // But to be conservative, and since that's the documented limit for window.localStorage, we're going to limit it to 5MiB
      return 5 * 1024 * 1024;
    } else {
      return quota;
    }
  },

  setmaxTabs(maxTabs: string): Promise<void> {
    const storageQuota = this._getStorageQuota();
    const tabsUpperBound = Math.floor(storageQuota / AVERAGE_TAB_BYTES_SIZE);

    const parsedValue = parseInt(maxTabs, 10);
    if (isNaN(parsedValue) || parsedValue < 1) {
      throw Error(
        chrome.i18n.getMessage("settings_setmaxTabs_error_invalid") || "Error: settings.setmaxTabs",
      );
    } else if (parsedValue > tabsUpperBound) {
      throw Error(
        chrome.i18n.getMessage("settings_setmaxTabs_error_too_big", [
          tabsUpperBound.toString(),
          storageQuota.toString(),
        ]) || "Error: settings.setmaxTabs",
      );
    }
    return Settings.setValue("maxTabs", parsedValue);
  },

  setminTabs(minTabs: string): Promise<void> {
    const parsedValue = parseInt(minTabs, 10);
    if (isNaN(parsedValue) || parsedValue < 0) {
      throw Error(
        chrome.i18n.getMessage("settings_setminTabs_error") || "Error: settings.setminTabs",
      );
    }
    return Settings.setValue("minTabs", parsedValue);
  },

  setminutesInactive(minutesInactive: string): Promise<void> {
    const minutes = parseInt(minutesInactive, 10);
    if (isNaN(minutes) || minutes < 0) {
      throw Error(
        chrome.i18n.getMessage("settings_setminutesInactive_error") ||
        "Error: settings.setminutesInactive",
      );
    }
    return Settings.setValue("minutesInactive", minutesInactive);
  },

  setsecondsInactive(secondsInactive: string): Promise<void> {
    const seconds = parseInt(secondsInactive, 10);
    if (isNaN(seconds) || seconds < 0 || seconds > 59) {
      throw Error(
        chrome.i18n.getMessage("settings_setsecondsInactive_error") || "Error: setsecondsInactive",
      );
    }
    return Settings.setValue("secondsInactive", secondsInactive);
  },

  setValue<T>(key: string, value: T): Promise<void> {
    this.cache[key] = value;
    return chrome.storage.sync.set({ [key]: value });
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
    return Promise.all(
      tabs.map((tab) => {
        if (tab.id == null) return Promise.resolve();
        else if (this.isTabLocked(tab)) return this.unlockTab(tab.id);
        else return this.lockTab(tab.id);
      }),
    );
  },

  unlockTab(tabId: number): Promise<void> {
    const lockedIds = this.get<Array<number>>("lockedIds");
    if (lockedIds.indexOf(tabId) > -1) {
      lockedIds.splice(lockedIds.indexOf(tabId), 1);
    }
    return this.set("lockedIds", lockedIds);
  },
};

export default Settings;
