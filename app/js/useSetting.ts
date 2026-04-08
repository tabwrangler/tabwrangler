import Settings, { type SettingsSchema } from "./settings";
import { useSyncExternalStore } from "react";

/**
 * Returns a reactive version of setting `key`.
 */
export default function useSetting<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] {
  return useSyncExternalStore(
    (listener) => Settings.subscribe(key, listener),
    () => Settings.get(key),
  );
}
