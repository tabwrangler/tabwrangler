import { AVERAGE_TAB_BYTES_SIZE, TabLockStatus, getTabLockStatus } from "./tabUtil";
import {
  DEFAULT_STALE_AFTER_SECONDS,
  TAB_RULES_VERSION,
  type TabRulesConfig,
  buildTabRulesFromLegacySettings,
  getStaleAfterMs,
  withElseRule,
} from "./tabRules";
import Menus from "./menus";

export type LockTabSortOrderOption =
  | "alpha"
  | "chrono"
  | "reverseAlpha"
  | "reverseChrono"
  | "reverseTabOrder"
  | "tabOrder";
export type MinTabsStrategyOption = "allWindows" | "givenWindow";
export type SettingsSchemaWrangleOption = "exactURLMatch" | "hostnameAndTitleMatch" | "withDupes";

export interface SettingsSchema {
  corralTabSortOrder: string | null;
  createContextMenu: boolean;
  debounceOnActivated: boolean;
  filterAudio: boolean;
  filterGroupedTabs: boolean;
  lockedIds: number[];
  lockedWindowIds: number[];
  lockTabSortOrder: LockTabSortOrderOption | null;
  maxTabs: number;
  minTabs: number;
  minTabsStrategy: MinTabsStrategyOption;
  minutesInactive: number;
  pauseWhenIdle: boolean;
  purgeClosedTabs: boolean;
  secondsInactive: number;
  showBadgeCount: boolean;
  tabRules: TabRulesConfig;
  whitelist: string[];
  wrangleOption: SettingsSchemaWrangleOption;
}

const defaultLockedIds: Array<number> = [];
const defaultLockedWindowIds: Array<number> = [];

export const SETTINGS_DEFAULTS: SettingsSchema = {
  // Saved sort order for list of closed tabs. When null, default sort is used (resverse chrono.)
  corralTabSortOrder: null,

  // Create a context menu for accessing Tab Wrangler functionality on click
  createContextMenu: true,

  // wait 1 second before updating an active tab
  debounceOnActivated: true,

  // Superseded by `tabRules`; read only to migrate.
  filterAudio: true,

  // Superseded by `tabRules`; read only to migrate.
  filterGroupedTabs: false,

  // An array of tabids which have been explicitly locked by the user.
  lockedIds: defaultLockedIds,

  // An array of windowids that have been explicitly locked by the user.
  lockedWindowIds: defaultLockedWindowIds,

  // Saved sort order for list of open tabs. When null, default sort is used (tab order)
  lockTabSortOrder: null,

  // Max number of tabs stored before the list starts getting truncated.
  maxTabs: 1000,

  // Stop acting if there are only minTabs tabs open.
  minTabs: 20,

  // Strategy for counting minTabs
  // * "allWindows" - sum tabs across all open browser windows
  // * "givenWindow" (default) - count tabs within any given window
  minTabsStrategy: "givenWindow",

  // Superseded by `tabRules`; read only to migrate.
  minutesInactive: 60,

  // Stop tab timers from counting down while the browser is idle. Requires the "idle" permission.
  pauseWhenIdle: false,

  // Save closed tabs in between browser sessions.
  purgeClosedTabs: false,

  // Superseded by `tabRules`; read only to migrate.
  secondsInactive: 0,

  // When true, shows the number of closed tabs in the list as a badge on the browser icon.
  showBadgeCount: false,

  // Rules deciding which tabs are locked and when the rest become stale. Equivalent to the defaults
  // of the legacy settings they replace.
  tabRules: {
    version: TAB_RULES_VERSION,
    rules: [
      {
        id: "pinned",
        match: "every",
        when: [{ type: "pinned" }],
        then: { action: "lock" },
      },
      {
        id: "audible",
        match: "every",
        when: [{ type: "audible" }],
        then: { action: "lock" },
      },
      {
        id: "about",
        match: "every",
        when: [{ type: "url", op: "includes", value: "about:" }],
        then: { action: "lock" },
      },
      {
        id: "chrome",
        match: "every",
        when: [{ type: "url", op: "includes", value: "chrome://" }],
        then: { action: "lock" },
      },
      {
        id: "else",
        match: "every",
        when: [],
        then: { action: "stale", afterSeconds: DEFAULT_STALE_AFTER_SECONDS, save: "corral" },
      },
    ],
  },

  // Superseded by `tabRules`; read only to migrate.
  whitelist: ["about:", "chrome://"],

  // Allow duplicate entries in the closed/wrangled tabs list
  wrangleOption: "withDupes",
};

// Settings from before Tab Rules have no `tabRules`, so derive equivalent rules from the legacy
// settings until `migrateSync` persists them.
function loadLegacyTabRules(
  stored: TabRulesConfig | undefined,
  legacy: SettingsSchema,
): TabRulesConfig {
  return stored == null ? buildTabRulesFromLegacySettings(legacy) : withElseRule(stored);
}

// This is a SINGLETON! It is imported both by backgrounnd.ts and by popup.tsx and used in both
// environments.
const Settings = {
  // Keys changed while loading, which the load must not overwrite with its older snapshot. Only set
  // while loading.
  _initChangedKeys: null as Set<string> | null,
  _initPromise: undefined as Promise<void> | undefined,
  _listeners: {} as { [K in keyof SettingsSchema]?: Set<() => void> },
  cache: { ...SETTINGS_DEFAULTS } as SettingsSchema,

  // Loads all settings from sync storage into the cache. Later changes, including those made in
  // another extension page, arrive through `_onStorageChanged`.
  init(): Promise<void> {
    if (this._initPromise != null) return this._initPromise;

    const initChangedKeys = new Set<string>();
    this._initChangedKeys = initChangedKeys;
    this._initPromise = (async () => {
      const items = await chrome.storage.sync.get<Partial<SettingsSchema>>(
        Object.keys(SETTINGS_DEFAULTS) as (keyof SettingsSchema)[],
      );

      for (const [key, value] of Object.entries(items)) {
        if (key !== "tabRules" && !initChangedKeys.has(key))
          Object.assign(this.cache, { [key]: value });
      }

      if (!initChangedKeys.has("tabRules"))
        this.cache.tabRules = loadLegacyTabRules(items.tabRules, this.cache);

      this._initChangedKeys = null;
    })();

    return this._initPromise;
  },

  _onStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) {
    if (areaName !== "sync") return;
    const keys = Object.keys(changes).filter(
      (key): key is keyof SettingsSchema => key in SETTINGS_DEFAULTS,
    );

    // `newValue` is undefined when the key was removed from storage. Removed `tabRules` are derived
    // from the legacy settings, so those are applied first.
    for (const key of keys) {
      this._initChangedKeys?.add(key);
      if (key !== "tabRules")
        Object.assign(this.cache, { [key]: changes[key].newValue ?? SETTINGS_DEFAULTS[key] });
    }

    if (keys.includes("tabRules"))
      this.cache.tabRules = loadLegacyTabRules(changes.tabRules.newValue, this.cache);

    keys.forEach((key) => this._listeners[key]?.forEach((l) => l()));
  },

  async cleanupLockedIds(tabs: chrome.tabs.Tab[]): Promise<void> {
    if (this.cache.lockedIds == null) return;

    // Remove any tab IDs from the `lockedIds` list that no longer exist so the collection does not
    // grow unbounded. This also ensures tab IDs that are reused are not inadvertently locked.
    const currTabIds = new Set(tabs.map((tab) => tab.id));
    const nextLockedIds = this.cache.lockedIds.filter((lockedId) => {
      const lockedIdExists = currTabIds.has(lockedId);
      if (!lockedIdExists)
        console.debug(`Locked tab ID ${lockedId} no longer exists; removing from 'lockedIds' list`);
      return lockedIdExists;
    });

    await this.set("lockedIds", nextLockedIds);
  },

  get<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] {
    return this.cache[key];
  },

  getTabLockStatus(tab: chrome.tabs.Tab): TabLockStatus {
    // Intentionally excludes `lockedWindowIds` so the UI checkbox reflects individual tab lock
    // state only. Window lock state is passed separately as a prop in the UI.
    return getTabLockStatus(tab, {
      lockedIds: this.get("lockedIds"),
      lockedWindowIds: [],
      tabRules: this.get("tabRules"),
    });
  },

  isTabLocked(tab: chrome.tabs.Tab): boolean {
    return this.getTabLockStatus(tab).locked;
  },

  isTabManuallyLockable(tab: chrome.tabs.Tab): boolean {
    const status = this.getTabLockStatus(tab);
    return !status.locked || status.reason === "manual";
  },

  lockTab(tab: chrome.tabs.Tab): Promise<void> {
    if (tab.id == null || tab.id <= 0) return Promise.resolve();
    const lockedIds = this.get("lockedIds");
    if (lockedIds.indexOf(tab.id) !== -1) return Promise.resolve();
    return this.set("lockedIds", [...lockedIds, tab.id]);
  },

  lockTabs(tabs: chrome.tabs.Tab[]): Promise<void> {
    const lockedIds = this.get("lockedIds");
    const nextLockedIds = [...lockedIds];
    for (const tab of tabs)
      if (tab.id != null && tab.id > 0 && nextLockedIds.indexOf(tab.id) === -1)
        nextLockedIds.push(tab.id);
    return this.set("lockedIds", nextLockedIds);
  },

  lockWindows(windowIds: number[]): Promise<void> {
    const lockedWindowIds = this.get("lockedWindowIds");
    const nextLockedWindowIds = [...lockedWindowIds];
    for (const id of windowIds)
      if (id > 0 && nextLockedWindowIds.indexOf(id) === -1) nextLockedWindowIds.push(id);
    return this.set("lockedWindowIds", nextLockedWindowIds);
  },

  lockWindow(windowId: number): Promise<void> {
    const lockedWindowIds = this.get("lockedWindowIds");
    const nextLockedWindowIds = [...lockedWindowIds];
    if (windowId > 0 && nextLockedWindowIds.indexOf(windowId) === -1) {
      nextLockedWindowIds.push(windowId);
    }
    return this.set("lockedWindowIds", nextLockedWindowIds);
  },

  toggleWindow(windowId: number): Promise<void> {
    const lockedWindowIds = this.get("lockedWindowIds");
    const index = lockedWindowIds.indexOf(windowId);
    return index === -1 ? this.lockWindow(windowId) : this.unlockWindow(windowId);
  },

  unlockWindow(windowId: number): Promise<void> {
    const lockedWindowIds = this.get("lockedWindowIds");
    const index = lockedWindowIds.indexOf(windowId);
    if (index === -1) return Promise.resolve();
    const nextLockedWindowIds = [...lockedWindowIds];
    nextLockedWindowIds.splice(index, 1);
    console.info(`[unlockWindow] Removed window ID ${windowId}`);
    return this.set("lockedWindowIds", nextLockedWindowIds);
  },

  // Magic setter functions keyed by setting name. When `set` is called for one of these keys,
  // the setter is invoked instead of writing directly to storage.
  _setters: {
    createContextMenu(nextCreateContextMenu: boolean): Promise<void> {
      if (nextCreateContextMenu) Menus.create();
      else Menus.destroy();
      return Settings.setValue("createContextMenu", nextCreateContextMenu);
    },

    maxTabs(maxTabs: number): Promise<void> {
      const storageQuota = Settings._getStorageQuota();
      const tabsUpperBound = Math.floor(storageQuota / AVERAGE_TAB_BYTES_SIZE);

      if (isNaN(maxTabs) || maxTabs < 1) {
        throw Error(
          chrome.i18n.getMessage("settings_setmaxTabs_error_invalid") ||
            "Error: settings.setmaxTabs",
        );
      } else if (maxTabs > tabsUpperBound) {
        throw Error(
          chrome.i18n.getMessage("settings_setmaxTabs_error_too_big", [
            tabsUpperBound.toString(),
            storageQuota.toString(),
          ]) || "Error: settings.setmaxTabs",
        );
      }
      return Settings.setValue("maxTabs", maxTabs);
    },

    minTabs(minTabs: number): Promise<void> {
      if (isNaN(minTabs) || minTabs < 0) {
        throw Error(
          chrome.i18n.getMessage("settings_setminTabs_error") || "Error: settings.setminTabs",
        );
      }
      return Settings.setValue("minTabs", minTabs);
    },
  } as Partial<{ [K in keyof SettingsSchema]: (value: SettingsSchema[K]) => Promise<void> }>,

  set<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]): Promise<void> {
    const setter = this._setters[key];
    if (setter != null) {
      return setter(value);
    } else {
      return Settings.setValue(key, value);
    }
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

  subscribe<K extends keyof SettingsSchema>(key: K, listener: () => void): () => void {
    let set = this._listeners[key];
    if (set == null) {
      set = new Set();
      this._listeners[key] = set;
    }
    set.add(listener);
    return () => this._listeners[key]?.delete(listener);
  },

  setValue<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]): Promise<void> {
    this._initChangedKeys?.add(key);
    this.cache[key] =
      key === "tabRules" ? (withElseRule(value as TabRulesConfig) as typeof value) : value;
    this._listeners[key]?.forEach((l) => l());
    return chrome.storage.sync.set({ [key]: value });
  },

  /**
   * Returns the number of milliseconds a tab may stay inactive before it is stale. Without a tab,
   * returns the longest such duration of any rule.
   */
  stayOpen(tab?: chrome.tabs.Tab): number {
    return getStaleAfterMs(this.get("tabRules"), tab);
  },

  toggleTabs(tabs: chrome.tabs.Tab[]) {
    return Promise.all(
      tabs.map((tab) => {
        if (tab.id == null) return Promise.resolve();
        else if (this.isTabLocked(tab)) return this.unlockTab(tab.id);
        else return this.lockTab(tab);
      }),
    );
  },

  unlockTab(tabId: number): Promise<void> {
    const lockedIds = this.get("lockedIds");
    const index = lockedIds.indexOf(tabId);
    if (index === -1) return Promise.resolve();

    const nextLockedIds = [...lockedIds];
    nextLockedIds.splice(index, 1);
    return this.set("lockedIds", nextLockedIds);
  },
};

// Register when the module loads so a service worker adds it synchronously as required by
// Chrome's [service worker documentation][0].
// [0]: https://developer.chrome.com/docs/extensions/get-started/tutorial/service-worker-events
chrome.storage.onChanged.addListener((changes, areaName) => {
  Settings._onStorageChanged(changes, areaName);
});

export default Settings;
