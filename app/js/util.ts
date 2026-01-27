export function assertUnreachable(_never: never, message: string): never {
  throw new Error(message);
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
