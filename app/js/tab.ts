import { getTW } from "./util";

export function isLocked(tab: chrome.tabs.Tab): boolean {
  const { settings, tabmanager } = getTW();
  const lockedIds = settings.get<Array<number>>("lockedIds");
  const tabWhitelistMatch = tabmanager.getWhitelistMatch(tab.url);
  return (
    tab.pinned ||
    !!tabWhitelistMatch ||
    (tab.id != null && lockedIds.indexOf(tab.id) !== -1) ||
    !!(settings.get("filterGroupedTabs") && "groupId" in tab && tab.groupId > 0) ||
    !!(tab.audible && settings.get("filterAudio")) ||
    !!(
      settings.get("pauseIfFull") && tabmanager.closedTabs.length >= settings.get<number>("maxTabs")
    )
  );
}

export function isManuallyLockable(tab: chrome.tabs.Tab): boolean {
  const { settings, tabmanager } = getTW();
  const tabWhitelistMatch = tabmanager.getWhitelistMatch(tab.url);
  return (
    !tab.pinned &&
    !tabWhitelistMatch &&
    !(tab.audible && settings.get("filterAudio")) &&
    // $FlowFixMe missing groupId in chrome.tab
    !(settings.get("filterGroupedTabs") && "groupId" in tab && tab.groupId > 0) &&
    !(
      settings.get("pauseIfFull") && tabmanager.closedTabs.length >= settings.get<number>("maxTabs")
    )
  );
}
