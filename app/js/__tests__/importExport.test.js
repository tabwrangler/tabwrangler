import { exportData, exportFileName, importData } from '../actions/importExportActions';
import configureMockStore from '../__mocks__/configureMockStore';

beforeEach(() => {
  const TW = (window.TW = {
    store: configureMockStore(),
  });

  window.chrome = {
    storage: {
      local: {},
    },
    extension: {
      getBackgroundPage: () => {
        return {
          TW,
        };
      },
    },
  };
});

afterEach(() => {
  window.chrome = {};
});

test('should export the bookmark data', () => {
  window.TW.store = configureMockStore({
    tempStorage: {
      totalTabsRemoved: 256,
      totalTabsUnwrangled: 120,
      totalTabsWrangled: 100,
    },
  });

  window.chrome.storage.local.get = (t, func) => {
    func({ test: 2 });
  };

  window.TW.store.dispatch(exportData()).then(blob => {
    expect(blob.type).toBe('application/json;charset=utf-8');
  });
});

test('should import the bookmark data', done => {
  const expectedImportData = {
    savedTabs: [
      {
        active: false,
        audible: false,
        autoDiscardable: true,
        closedAt: 1493418190099,
        discarded: false,
        height: 175,
        highlighted: false,
        id: 36,
        incognito: false,
        index: 1,
        mutedInfo: {
          muted: false,
        },
        pinned: false,
        selected: false,
        status: 'complete',
        title: 'fish: Tutorial',
        url: 'https://fishshell.com/docs/current/tutorial.html',
        width: 400,
        windowId: 33,
      },
    ],
    totalTabsRemoved: 256,
    totalTabsUnwrangled: 16,
    totalTabsWrangled: 32,
  };

  const blob = new Blob([JSON.stringify(expectedImportData)], {
    type: 'text/plain;charset=utf-8',
  });

  window.TW.store
    .dispatch(
      importData({
        target: {
          files: [blob],
        },
      })
    )
    .then(() => {
      expect(window.TW.store.getActions()).toEqual([
        { totalTabsRemoved: 256, type: 'SET_TOTAL_TABS_REMOVED' },
        { totalTabsUnwrangled: 16, type: 'SET_TOTAL_TABS_UNWRANGLED' },
        { totalTabsWrangled: 32, type: 'SET_TOTAL_TABS_WRANGLED' },
        {
          savedTabs: [
            {
              active: false,
              audible: false,
              autoDiscardable: true,
              closedAt: 1493418190099,
              discarded: false,
              height: 175,
              highlighted: false,
              id: 36,
              incognito: false,
              index: 1,
              mutedInfo: { muted: false },
              pinned: false,
              selected: false,
              status: 'complete',
              title: 'fish: Tutorial',
              url: 'https://fishshell.com/docs/current/tutorial.html',
              width: 400,
              windowId: 33,
            },
          ],
          type: 'SET_SAVED_TABS',
        },
      ]);
      done();
    })
    .catch(e => {
      console.error(e);
      done();
    });
});

test('should fail to import non existent backup', done => {
  // provide a mock function
  const mockFunction = jest.fn();
  window.chrome.storage.local.set = mockFunction;

  window.TW.store
    .dispatch(
      importData({
        target: {
          files: [],
        },
      })
    )
    .catch(() => {
      expect(mockFunction.mock.calls.length).toBe(0);

      done();
    });
});

test('should fail import of incomplete backup data', done => {
  // provide a mock function
  const mockFunction = jest.fn();
  window.chrome.storage.local.set = mockFunction;

  // this is missing the savedTabs object
  const expectedImportData = [
    { totalTabsRemoved: 256 },
    { totalTabsUnwrangled: 16 },
    { totalTabsWrangled: 32 },
  ];

  const blob = new Blob([JSON.stringify(expectedImportData)], {
    type: 'text/plain;charset=utf-8',
  });

  window.TW.store
    .dispatch(
      importData({
        target: {
          files: [blob],
        },
      })
    )
    .catch(() => {
      expect(mockFunction.mock.calls.length).toBe(0);
      done();
    });
});

test('should fail import of corrupt backup data', done => {
  // provide a mock function
  const mockFunction = jest.fn();
  window.chrome.storage.local.set = mockFunction;

  const blob = new Blob(['{345:}'], {
    type: 'text/plain;charset=utf-8',
  });

  window.TW.store
    .dispatch(
      importData({
        target: {
          files: [blob],
        },
      })
    )
    .catch(() => {
      expect(mockFunction.mock.calls.length).toBe(0);
      done();
    });
});

test('should generate a unique file name based on a given date', () => {
  const date = new Date(2017, 3, 10);
  const uniqueFileName = exportFileName(date);

  expect(uniqueFileName).toBe('TabWranglerExport-4-10-2017.json');
});
