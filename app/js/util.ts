export function assertUnreachable(_never: never, message: string): never {
  throw new Error(message);
}

export function isValidPattern(pattern: string): boolean {
  return pattern != null && pattern.length > 0 && /\S/.test(pattern);
}

export function extractHostname(url: string): string {
  let hostname;

  // find & remove protocol (http, ftp, etc.) and get hostname
  if (url.indexOf("://") > -1) {
    hostname = url.split("/")[2];
  } else {
    hostname = url.split("/")[0];
  }

  // find & remove port number
  hostname = hostname.split(":")[0];
  // find & remove "?"
  hostname = hostname.split("?")[0];

  return hostname;
}

// Original code from https://stackoverflow.com/a/23945027/368697.
export function extractRootDomain(url: string): string {
  let domain = extractHostname(url);
  const splitArr = domain.split(".");
  const arrLen = splitArr.length;

  // extracting the root domain here if there is a subdomain
  if (arrLen > 2) {
    domain = splitArr[arrLen - 2] + "." + splitArr[arrLen - 1];
    // check to see if it's using a Country Code Top Level Domain (ccTLD) (i.e. ".me.uk")
    if (splitArr[arrLen - 1].length === 2 && splitArr[arrLen - 2].length === 2) {
      // this is using a ccTLD
      domain = splitArr[arrLen - 3] + "." + domain;
    }
  }
  return domain;
}

/**
 * Serializes closed tabs for comparison. Because the "REMOVED_SAVED_TABS" action comes from the
 * popup, the tabs to remove are serialized as strings to pass from popup -> serviceWorker and so
 * object comparison is not possible.
 */
export function serializeTab(tab: chrome.tabs.Tab): string {
  // @ts-expect-error `closedAt` is a TW expando property
  return `${tab.id}:${tab.windowId}:${tab.closedAt}`;
}

// Tab group IDs are only unique within a browser session, so a saved tab's `groupId` refers to a
// group that may still exist only if the tab was closed after the browser last started.
export function getRestorableGroupId(
  tab: chrome.tabs.Tab,
  browserStartedAt: number | null | undefined,
): number | null {
  if (browserStartedAt == null || tab.groupId == null || tab.groupId < 0) return null;
  // @ts-expect-error `closedAt` is a TW expando property on tabs
  const closedAt: number | undefined = tab.closedAt;
  return closedAt != null && closedAt >= browserStartedAt ? tab.groupId : null;
}
