type ThemeSettingValue = "dark" | "light" | "system";

type StorageSyncPersistState = {
  // If TabWrangler is paused (won't count down)
  paused: boolean;
  // Which color theme to use for Tab Wrangler. Can be 'dark', 'light', or 'system'
  theme: ThemeSettingValue;
};

const STORAGE_SYNC_PERSIST_DEFAULTS: StorageSyncPersistState = {
  paused: false,
  theme: "system" as const,
};

export async function getStorageSyncPersist(): Promise<StorageSyncPersistState> {
  const data = await chrome.storage.sync.get("persist:settings");
  return Object.assign({}, STORAGE_SYNC_PERSIST_DEFAULTS, data["persist:settings"]);
}

// StorageLocalPersistState grows linearly with the size of tabTimes and savedTabs
// We defined an estimate of the size of an individual tab at tabUtil.AVERAGE_TAB_BYTES_SIZE

export type StorageLocalPersistState = {
  // Date of installation of Tab Wrangler
  installDate: number;
  // Tabs closed by Tab Wrangler
  savedTabs: Array<chrome.tabs.Tab>;
  // Map of tabId -> time remaining before tab is closed
  tabTimes: {
    [tabid: string]: number;
  };
  // Number of tabs closed by any means since install
  totalTabsRemoved: number;
  // Number of tabs unwrangled (re-opened from the corral) since install
  totalTabsUnwrangled: number;
  // Number of tabs wrangled since install
  totalTabsWrangled: number;
};

const STORAGE_LOCAL_PERSIST_DEFAULTS: StorageLocalPersistState = {
  installDate: Date.now(),
  savedTabs: [],
  tabTimes: {},
  totalTabsRemoved: 0,
  totalTabsUnwrangled: 0,
  totalTabsWrangled: 0,
};

export async function getStorageLocalPersist(): Promise<StorageLocalPersistState> {
  const data = await chrome.storage.local.get("persist:localStorage");
  return Object.assign({}, STORAGE_LOCAL_PERSIST_DEFAULTS, data["persist:localStorage"]);
}
