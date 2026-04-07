import Settings, { type SettingsSchema } from "./settings";
import { useSyncExternalStore } from "react";

export default function useSetting<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] {
  return useSyncExternalStore(
    (listener) => Settings.subscribe(key, listener),
    () => Settings.get(key),
  );
}
