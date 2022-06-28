/* @flow */

const TW = chrome.extension.getBackgroundPage().TW;
const { settings, tabmanager } = TW;

export function isLocked(tab: chrome$Tab): boolean {
  const lockedIds = settings.get("lockedIds");
  const tabWhitelistMatch = tabmanager.getWhitelistMatch(tab.url);
  return (
    tab.pinned ||
    tabWhitelistMatch ||
    lockedIds.indexOf(tab.id) !== -1 ||
    // $FlowFixMe missing groupId in chrome.tab
    !!(settings.get("filterGroupedTabs") && "groupId" in tab && tab.groupId > 0) ||
    !!(tab.audible && settings.get("filterAudio"))
  );
}

export function isManuallyLockable(tab: chrome$Tab): boolean {
  const tabWhitelistMatch = tabmanager.getWhitelistMatch(tab.url);
  return (
    !tab.pinned &&
    !tabWhitelistMatch &&
    !(tab.audible && settings.get("filterAudio")) &&
    // $FlowFixMe missing groupId in chrome.tab
    !(settings.get("filterGroupedTabs") && "groupId" in tab && tab.groupId > 0)
  );
}
