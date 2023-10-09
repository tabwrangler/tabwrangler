export function getWhitelistMatch(
  url: string | undefined,
  { whitelist }: { whitelist: string[] }
): string | null {
  if (url == null) return null;
  for (let i = 0; i < whitelist.length; i++) {
    if (url.indexOf(whitelist[i]) !== -1) {
      return whitelist[i];
    }
  }
  return null;
}

export function isTabLocked(
  tab: chrome.tabs.Tab,
  {
    filterAudio,
    filterGroupedTabs,
    lockedIds,
    whitelist,
  }: { filterAudio: boolean; filterGroupedTabs: boolean; lockedIds: number[]; whitelist: string[] }
): boolean {
  const tabWhitelistMatch = getWhitelistMatch(tab.url, { whitelist });
  return (
    tab.pinned ||
    !!tabWhitelistMatch ||
    (tab.id != null && lockedIds.indexOf(tab.id) !== -1) ||
    !!(filterGroupedTabs && "groupId" in tab && tab.groupId > 0) ||
    !!(tab.audible && filterAudio)
  );
}
