import { sessionFuzzyMatchesTab } from "../CorralTab";

describe("sessionFuzzyMatchesTab", () => {
  const tab = {
    active: false,
    autoDiscardable: true,
    closedAt: 1524301399048, // non-standard expando property added by Tab Wrangler
    discarded: false,
    favIconUrl: "https://news.ycombinator.com/favicon.ico",
    groupId: 1,
    highlighted: false,
    incognito: false,
    index: 5,
    pinned: false,
    selected: false,
    sessionId: "20",
    title: "Hacker News",
    url: "https://news.ycombinator.com/",
    windowId: 3,
  };

  test("matches a Chrome session with a standard tab", () => {
    const session = {
      lastModified: 1524301398548, // 500ms different than `closedAt`, within 1s "fuzzy" range
      tab,
    };
    expect(sessionFuzzyMatchesTab(session, tab)).toBe(true);
  });

  test("matches a Firefox session with a standard tab", () => {
    const session = {
      lastModified: 1524301399,
      tab,
    };
    expect(sessionFuzzyMatchesTab(session, tab)).toBe(true);
  });
});
