import settings from "./settings";
import { wrangleTabsAndPersist } from "./tabUtil";

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
