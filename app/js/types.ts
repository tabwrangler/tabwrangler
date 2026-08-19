export interface SessionTab {
  session: chrome.sessions.Session | undefined;
  tab: chrome.tabs.Tab;
}

export type TabTimes = Record<string, number>;

export interface TabWithIndex {
  tab: chrome.tabs.Tab;
  index: number;
}
