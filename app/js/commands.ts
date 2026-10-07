import { findTabsToWrangleNow, wrangleTabsAndPersist } from "./tabUtil";
import { TabTimes } from "./types";
import settings from "./settings";

export async function lockUnlockActiveTab(): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  settings.toggleTabs(tabs);
}

export async function lockUnlockCurrentWindow(): Promise<void> {
  const currentWindow = await chrome.windows.getCurrent();
  if (currentWindow.id == null) return;

  settings.toggleWindow(currentWindow.id);
}

export async function wrangleActiveTab(): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  await wrangleTabsAndPersist(tabs);
}

export async function wrangleNow(): Promise<chrome.tabs.Tab[]> {
  const [tabs, [activeTab], { tabTimes }] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
    chrome.storage.local.get<{ tabTimes: TabTimes }>({ tabTimes: {} }),
  ]);
  const tabsToWrangle = findTabsToWrangleNow(tabTimes, tabs, activeTab?.id, {
    filterAudio: settings.get("filterAudio"),
    filterGroupedTabs: settings.get("filterGroupedTabs"),
    lockedIds: settings.get("lockedIds"),
    lockedWindowIds: settings.get("lockedWindowIds"),
    minTabs: settings.get("minTabs"),
    minTabsStrategy: settings.get("minTabsStrategy"),
    stayOpenMs: settings.stayOpen(),
    tabRules: settings.get("tabRules"),
    whitelist: settings.get("whitelist"),
  });
  await wrangleTabsAndPersist(tabsToWrangle);
  return tabsToWrangle;
}

export async function wrangleOtherTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find((tab) => tab.active);
  if (activeTab?.id == null) return;

  const tabsToWrangle = tabs.filter((t) => t.id !== activeTab.id);
  await wrangleTabsAndPersist(tabsToWrangle);
}

export async function wrangleTabsToRight(): Promise<void> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find((tab) => tab.active);
  if (activeTab?.id == null) return;

  const tabsToWrangle = tabs.filter((t) => t.index > activeTab.index);
  await wrangleTabsAndPersist(tabsToWrangle);
}
