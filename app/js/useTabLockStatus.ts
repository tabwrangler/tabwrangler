import { type TabLockStatus, getTabLockStatus } from "./tabUtil";
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
  return (tab) => getTabLockStatus(tab, { lockedIds, lockedWindowIds: [], tabRules });
}

export default function useTabLockStatus(tab: chrome.tabs.Tab): TabLockStatus {
  return useGetTabLockStatus()(tab);
}
