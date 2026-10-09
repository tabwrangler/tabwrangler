import { type TabLockStatus, getTabLockStatus } from "./tabUtil";
import useSetting from "./useSetting";

export function useGetTabLockStatus(): (tab: chrome.tabs.Tab) => TabLockStatus {
  const lockedIds = useSetting("lockedIds");
  const tabRules = useSetting("tabRules");
  return (tab) => getTabLockStatus(tab, { lockedIds, lockedWindowIds: [], tabRules });
}

export default function useTabLockStatus(tab: chrome.tabs.Tab): TabLockStatus {
  return useGetTabLockStatus()(tab);
}
