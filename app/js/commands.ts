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

// Returns the closed tabs and which of them were saved to the corral.
export async function wrangleNow(): Promise<{
  savedTabs: chrome.tabs.Tab[];
  tabs: chrome.tabs.Tab[];
}> {
  const [tabs, [activeTab], { tabTimes }] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
    chrome.storage.local.get<{ tabTimes: TabTimes }>({ tabTimes: {} }),
  ]);
  const tabRules = settings.get("tabRules");
  const tabsToWrangle = findTabsToWrangleNow(tabTimes, tabs, activeTab?.id, {
    lockedIds: settings.get("lockedIds"),
    lockedWindowIds: settings.get("lockedWindowIds"),
    minTabs: settings.get("minTabs"),
    minTabsStrategy: settings.get("minTabsStrategy"),
    tabRules,
  });
  const savedTabs = await wrangleTabsAndPersist(tabsToWrangle, tabRules);
  return { savedTabs, tabs: tabsToWrangle };
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
