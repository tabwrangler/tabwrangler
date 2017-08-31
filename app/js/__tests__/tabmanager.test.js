import storageLocal from '../storageLocal';
import TabManager from '../tabmanager';

beforeEach(() => {
  window.chrome = {
    'storage': {
      'local': {
      },
    },
    'tabs': {
    },
    'browserAction': {},
    'extension': {
      getBackgroundPage: () => {
        return {
          'TW': storageLocal,
        };
      },
    },
  };

  window.TW = {
    settings: {},
    storageLocal: {},
  };
});

afterEach(() => {
  window.chrome = {};
});

test('should wrangle new tabs', () => {
  window.TW.settings.get = jest.fn(() => 5); //maxTabs
  window.TW.storageLocal.get = jest.fn(() => 10); // totalTabsWrangled
  window.TW.storageLocal.set = jest.fn();
  window.chrome.tabs.remove = jest.fn();

  const testTabs = [{ id: 2 }, { id: 3 }, { id: 4 }];
  window.chrome.storage.local.set = jest.fn();

  window.chrome.browserAction.setBadgeText = jest.fn();

  TabManager.closedTabs.wrangleTabs(testTabs);

  expect(window.chrome.tabs.remove.mock.calls.length).toBe(3);
  expect(window.chrome.tabs.remove.mock.calls).toEqual([[2], [3], [4]]);
  expect(window.TW.storageLocal.set.mock.calls).toEqual([['totalTabsWrangled', 13]]);
  expect(window.chrome.storage.local.set.mock.calls).toMatchObject([
    [{
      'savedTabs':
      [{ 'id': 4 },
      { 'id': 3 },
      { 'id': 2 }],
    }]]);

  expect(window.chrome.browserAction.setBadgeText.mock.calls[0]).toEqual([{ 'text': '3' }]);
});

test('should wrangle max tabs', () => {
  window.TW.settings.get = jest.fn(() => 3);
  window.TW.storageLocal.get = jest.fn(() => 0);
  window.TW.storageLocal.set = jest.fn();
  window.chrome.tabs.remove = jest.fn();

  const testTabs = [{ id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
  window.chrome.storage.local.set = jest.fn();

  window.chrome.browserAction.setBadgeText = jest.fn();

  TabManager.closedTabs.wrangleTabs(testTabs);

  expect(window.chrome.tabs.remove.mock.calls.length).toBe(4);
  expect(window.chrome.tabs.remove.mock.calls).toEqual([[2], [3], [4], [5]]);
  expect(window.TW.storageLocal.set.mock.calls).toEqual([['totalTabsWrangled', 4]]);
  expect(window.chrome.storage.local.set.mock.calls).toMatchObject([
    [{
      'savedTabs':
      [{ 'id': 5 },
      { 'id': 4 },
      { 'id': 3 }],
    }]]);

  expect(window.chrome.browserAction.setBadgeText.mock.calls[0]).toEqual([{ 'text': '3' }]);
});

test('should not wrangle duplicate tabs', () => {
  window.TW.settings.get = jest.fn(() => 3);
  window.TW.storageLocal.get = jest.fn(() => 0);
  window.TW.storageLocal.set = jest.fn();
  window.chrome.tabs.remove = jest.fn();

  let testTabs = [
    {id: 1, url: 'https://www.github.com'},
    {id: 2, url: 'https://www.google.com'},
    {id: 3, url: 'https://www.nytimes.com'},
  ];

  window.chrome.storage.local.set = jest.fn();

  window.chrome.browserAction.setBadgeText = jest.fn();

  TabManager.closedTabs.wrangleTabs(testTabs);

  // reset all mocks
  jest.clearAllMocks();

  testTabs = [{ id: 3, url: 'https://www.nytimes.com' }];
  
  TabManager.closedTabs.wrangleTabs(testTabs);

  expect(window.chrome.tabs.remove.mock.calls.length).toBe(1);
  expect(window.chrome.tabs.remove.mock.calls).toEqual([[3]]);
  expect(window.TW.storageLocal.set.mock.calls).toEqual([['totalTabsWrangled', 1]]);
  expect(window.chrome.storage.local.set.mock.calls).toMatchObject([
    [{
      'savedTabs':
      [{ 'id': 3 },
      { 'id': 1 },
      { 'id': 2 }],
    }]]);

  expect(window.chrome.browserAction.setBadgeText.mock.calls[0]).toEqual([{ 'text': '3' }]);
});

// sample tab data
// [
//   {
//     "active": true,
//     "audible": false,
//     "autoDiscardable": true,
//     "discarded": false,
//     "favIconUrl": "https://facebook.github.io/jest/img/favicon/favicon.ico",
//     "height": 1496,
//     "highlighted": true,
//     "id": 2267,
//     "incognito": false,
//     "index": 4,
//     "mutedInfo": {
//       "muted": false
//     },
//     "pinned": false,
//     "selected": true,
//     "status": "complete",
//     "title": "Expect · Jest",
//     "url": "https://facebook.github.io/jest/docs/en/expect.html#expectanything",
//     "width": 2823,
//     "windowId": 769
//   }
// ]