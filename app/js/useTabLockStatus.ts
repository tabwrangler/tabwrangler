import { type TabLockStatus, getTabLockStatus } from "./tabUtil";
import useSetting from "./useSetting";

export function useGetTabLockStatus(): (tab: chrome.tabs.Tab) => TabLockStatus {
  const filterAudio = useSetting("filterAudio");
  const filterGroupedTabs = useSetting("filterGroupedTabs");
  const lockedIds = useSetting("lockedIds");
  const whitelist = useSetting("whitelist");
  return (tab) =>
    getTabLockStatus(tab, {
      filterAudio,
      filterGroupedTabs,
      lockedIds,
      lockedWindowIds: [],
      whitelist,
    });
}

export default function useTabLockStatus(tab: chrome.tabs.Tab): TabLockStatus {
  return useGetTabLockStatus()(tab);
}
