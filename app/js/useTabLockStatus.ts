import { type TabLockStatus, getTabLockStatus } from "./tabUtil";
import frontWindow from "./frontWindow";
import tabGroupTitles from "./tabGroupTitles";
import useSetting from "./useSetting";
import { useSyncExternalStore } from "react";

export function useGetTabLockStatus(): (tab: chrome.tabs.Tab) => TabLockStatus {
  const lockedIds = useSetting("lockedIds");
  const tabRules = useSetting("tabRules");
  // Re-renders when a group is renamed, since rules can match group titles.
  useSyncExternalStore(
    (onStoreChange) => tabGroupTitles.subscribe(onStoreChange),
    () => tabGroupTitles.getVersion(),
  );
  // Re-renders when another window comes to the front, since rules can match the tab in view.
  useSyncExternalStore(
    (onStoreChange) => frontWindow.subscribe(onStoreChange),
    () => frontWindow.getVersion(),
  );
  return (tab) => getTabLockStatus(tab, { lockedIds, lockedWindowIds: [], tabRules });
}

export default function useTabLockStatus(tab: chrome.tabs.Tab): TabLockStatus {
  return useGetTabLockStatus()(tab);
}
