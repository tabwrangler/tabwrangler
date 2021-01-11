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
    !!(tab.groupId > 0 && settings.get("filterGroupedTabs")) ||
    !!(tab.audible && settings.get("filterAudio"))
  );
}

export function isManuallyLockable(tab: chrome$Tab): boolean {
  const tabWhitelistMatch = tabmanager.getWhitelistMatch(tab.url);
  return (
    !tab.pinned &&
    !tabWhitelistMatch &&
    !(tab.audible && settings.get("filterAudio")) &&
    !(tab.groupId > 0 && settings.get("filterGroupedTabs"))
  );
}
