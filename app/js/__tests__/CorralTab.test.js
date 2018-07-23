/* @flow */

let sessionFuzzyMatchesTab;

beforeAll(() => {
  window.chrome = {
    extension: {
      getBackgroundPage: () => {
        return {
          TW: { store: {} },
        };
      },
    },
    i18n: {
      getMessage() {
        return '';
      },
      getUILanguage() {
        return '';
      },
    },
  };

  // Dynamic import so globals can be defined beforehand. Importing 'CorralTab.js' calls
  // `chrome.i18n.getUILanguage` and `chrome.i18n.getMessage`.
  sessionFuzzyMatchesTab = require('../CorralTab.js').sessionFuzzyMatchesTab;
});

afterAll(() => {
  window.chrome = {};
});

describe('sessionFuzzyMatchesTab', () => {
  const tab = {
    active: false,
    closedAt: 1524301399048, // non-standard expando property added by Tab Wrangler
    favIconUrl: 'https://news.ycombinator.com/favicon.ico',
    hidden: false,
    highlighted: false,
    incognito: false,
    index: 5,
    lastAccessed: 1524301399048,
    pinned: false,
    selected: false,
    sessionId: '20',
    title: 'Hacker News',
    url: 'https://news.ycombinator.com/',
    windowId: 3,
  };

  test('matches a Chrome session with a standard tab', () => {
    const session = {
      lastModified: 1524301398548, // 500ms different than `closedAt`, within 1s "fuzzy" range
      tab,
    };
    expect(sessionFuzzyMatchesTab(session, tab)).toBe(true);
  });

  test('matches a Firefox session with a standard tab', () => {
    const session = {
      lastModified: 1524301399,
      tab,
    };
    expect(sessionFuzzyMatchesTab(session, tab)).toBe(true);
  });
});
