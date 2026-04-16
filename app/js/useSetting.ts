import Settings, { type SettingsSchema } from "./settings";
import { useSyncExternalStore } from "react";

/**
 * Returns a reactive version of setting `key`.
 */
export default function useSetting<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] {
  return useSyncExternalStore(
    (onStoreChange) => Settings.subscribe(key, onStoreChange),
    () => Settings.get(key),
  );
}
