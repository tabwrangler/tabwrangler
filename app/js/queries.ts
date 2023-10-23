import { ThemeSettingValue } from "./Types";

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
