import TabManager from '../tabmanager';
import storageLocal from '../storageLocal';

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

describe('wrangleTabs', () => {
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

    TabManager.closedTabs.tabs = [
      {id: 1, url: 'https://www.github.com'},
      {id: 2, url: 'https://www.google.com'},
      {id: 3, url: 'https://www.nytimes.com'},
    ];

    window.chrome.storage.local.set = jest.fn();

    window.chrome.browserAction.setBadgeText = jest.fn();

    // reset all mocks
    jest.clearAllMocks();

    const testTabs = [{ id: 3, url: 'https://www.nytimes.com' }];

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

  test('should not wrangle if hostname and title match', () => {
    window.TW.settings.get = jest.fn().mockImplementationOnce(() => 3).
      mockImplementationOnce(() => 'HOST_AND_TITLE_MATCH');
    window.TW.storageLocal.get = jest.fn(() => 0);
    window.TW.storageLocal.set = jest.fn();
    window.chrome.tabs.remove = jest.fn();

    TabManager.closedTabs.tabs = [
      {id: 1, url: 'https://www.github.com', title: 'Github'},
      {id: 2, url: 'https://www.google.com', title: 'Google'},
      {id: 3, url: 'https://www.nytimes.com', title: 'New York Times'},
    ];

    window.chrome.storage.local.set = jest.fn();

    window.chrome.browserAction.setBadgeText = jest.fn();

    // reset all mocks
    jest.clearAllMocks();

    const testTabs = [{ id: 3, url: 'https://www.nytimes.com', title: 'New York Times' }];

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
});

describe('filter', () => {
  beforeEach(() => {
    TabManager.closedTabs.tabs = [
      {id: 1, url: 'https://www.github.com', title: 'GitHub'},
      {id: 2, url: 'https://www.google.com', title: 'Google'},
      {id: 3, url: 'https://www.nytimes.com', title: 'The New York Times - Breaking News, World News & Multimedia'},
    ];
  });

  test('should return index of tab if the url matches', () => {
    expect(TabManager.closedTabs.findPositionByURL('https://www.nytimes.com')).toBe(2);
  });

  test('should return -1 if the url does not match any tab', () => {
    expect(TabManager.closedTabs.findPositionByURL('https://www.mozilla.org')).toBe(-1);
  });

  test('should return -1 if the url is undefined', () => {
    expect(TabManager.closedTabs.findPositionByURL()).toBe(-1);
  });

  test('should return -1 if the url is null', () => {
    expect(TabManager.closedTabs.findPositionByURL(null)).toBe(-1);
  });

  test('should return index of tab if the url matches', () => {
    expect(TabManager.closedTabs.findPositionByHostnameAndTitle('https://www.nytimes.com', 'The New York Times - Breaking News, World News & Multimedia')).toBe(2);
  });

  test('should return -1 of tab if no title provided', () => {
    expect(TabManager.closedTabs.findPositionByHostnameAndTitle('https://www.nytimes.com')).toBe(-1);
  });
});

describe('getURLPositionFilterByWrangleOption', () => {
  test('should return function that always returns -1', () => {
    const filterFunction =
      TabManager.closedTabs.getURLPositionFilterByWrangleOption('withDuplicates');

    expect(filterFunction).not.toBeNull();
    expect(filterFunction({url: 'http://www.test.com'})).toBe(-1);
  });

  test('should return function that will return the tab position by exact URL match', () => {
    const filterFunction =
      TabManager.closedTabs.getURLPositionFilterByWrangleOption('exactURLMatch');

    expect(filterFunction).not.toBeNull();
    expect(filterFunction({url: 'http://www.test.com'})).toBe(-1);
  });

  test('should return function that will return the tab position by hostname and title', () => {
    const filterFunction =
      TabManager.closedTabs.getURLPositionFilterByWrangleOption('HOST_AND_TITLE_MATCH');

    expect(filterFunction).not.toBeNull();
    expect(filterFunction({url: 'http://www.test.com', title: 'test'})).toBe(-1);
  });
});
