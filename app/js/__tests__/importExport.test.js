import { exportData, exportFileName, importData } from '../importExport';
import FileSaver from 'file-saver';
import storageLocal from '../storageLocal';

beforeEach(() => {
  window.chrome = {
    'storage': {
      'local': {
      },
    },
    'extension': {
      getBackgroundPage: () => {
        return {
          'TW': storageLocal,
        };
      },
    },
  };
});

afterEach(() => {
  window.chrome = {};
});

test('should export the bookmark data', () => {
  const mockValues = {
    'totalTabsRemoved': 256,
    'totalTabsUnwrangled': 120,
    'totalTabsWrangled': 100,
  };

  // provide some mock functions
  const localStorageGet = jest.fn((key) => mockValues[key]);
  const fileSaveMock = jest.fn();

  window.chrome.storage.local.get = (t, func) => {
    func({test: 2});
  };

  const storageLocal = {
    get: localStorageGet,
  };

  FileSaver.saveAs = fileSaveMock;

  exportData(storageLocal);
  expect(localStorageGet.mock.calls.length).toBe(3);
  expect(fileSaveMock.mock.calls.length).toBe(1);
  const result = fileSaveMock.mock.calls[0][0];
  expect(result.type).toBe('application/json;charset=utf-8');
});

test('should import the bookmark data', (done) => {
  // provide a mock function
  const localStorageSetMock = jest.fn();
  window.chrome.storage.local.set = localStorageSetMock;
  const tabManagerInit = jest.fn();

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

  importData(storageLocal, {closedTabs: {init: tabManagerInit}}, {target: {
    files: [blob],
  }}).then(() => {
    expect(localStorageSetMock.mock.calls.length).toBe(4);
    expect(localStorageSetMock.mock.calls[3][0]).toEqual({savedTabs: expectedImportData.savedTabs});
    expect(localStorageSetMock.mock.calls[0][0]).toEqual(
      {totalTabsRemoved: expectedImportData.totalTabsRemoved}
    );
    expect(localStorageSetMock.mock.calls[1][0]).toEqual(
      {totalTabsUnwrangled: expectedImportData.totalTabsUnwrangled}
    );
    expect(localStorageSetMock.mock.calls[2][0]).toEqual(
      {totalTabsWrangled: expectedImportData.totalTabsWrangled}
    );

    done();
  }).catch((e) => console.error(e));
});

test('should fail to import non existent backup', done => {
  // provide a mock function
  const mockFunction = jest.fn();
  window.chrome.storage.local.set = mockFunction;

  importData(
    storageLocal,
    {},
    {
      target: {
        files: [],
      },
    }
  ).catch(() => {
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

  importData(storageLocal, {}, {
    target: {
      files: [blob],
    },
  }).catch(() => {
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

  importData(
    storageLocal,
    {},
    {
      target: {
        files: [blob],
      },
    }
  ).catch(() => {
    expect(mockFunction.mock.calls.length).toBe(0);

    done();
  });
});

test('should generate a unique file name based on a given date', () => {
  const date = new Date(2017, 3, 10);
  const uniqueFileName = exportFileName(date);

  expect(uniqueFileName).toBe('TabWranglerExport-4-10-2017.json');
});
