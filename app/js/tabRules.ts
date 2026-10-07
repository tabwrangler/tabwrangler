/**
 * A user-defined timer for tabs whose URL contains `when.url`. Rules are checked in order and the
 * first match wins. Tabs matching no rule use the "All other tabs" timeout (`minutesInactive` +
 * `secondsInactive`).
 */
export interface TabRule {
  action: "close";
  id: string;
  timeoutMs: number;
  when: { url: string };
}

export function createTabRule(url: string, timeoutMs: number): TabRule {
  return { action: "close", id: crypto.randomUUID(), timeoutMs, when: { url } };
}

export function findTabRule(tab: chrome.tabs.Tab, tabRules: TabRule[]): TabRule | undefined {
  const url = tab.url;
  if (url == null) return undefined;
  return tabRules.find((rule) => url.includes(rule.when.url));
}
