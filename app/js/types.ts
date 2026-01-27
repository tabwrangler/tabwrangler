export interface SessionTab {
  session: chrome.sessions.Session | undefined;
  tab: chrome.tabs.Tab;
}

export interface TabWithIndex {
  tab: chrome.tabs.Tab;
  index: number;
}
