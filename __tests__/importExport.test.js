import {importData, exportData, exportFileName} from '../app/js/importExport';

beforeEach(() => {
  window.chrome = {
    'storage': {
      'local': {
      },
    },
  };
});

afterEach(() => {
  window.chrome = {};
})

test('should export the bookmark data', () => {
  // provide a mock function
  const mockFunction = jest.fn();
  window.chrome.storage.local.get = mockFunction;

  exportData();
  expect(mockFunction.mock.calls.length).toBe(4);
});

test('should import the bookmark data', (done) => {
  // provide a mock function
  const mockFunction = jest.fn();
  window.chrome.storage.local.set = mockFunction;

  const expectedImportData = {
    'savedTabs': [{
      'active': false,
      'audible': false,
      'autoDiscardable': true,
      'closedAt': 1493418190099,
      'discarded': false,
      'height': 175,
      'highlighted': false,
      'id': 36,
      'incognito': false,
      'index': 1,
      'mutedInfo': {
        'muted': false,
      },
      'pinned': false,
      'selected': false,
      'status': 'complete',
      'title': 'fish: Tutorial',
      'url': 'https://fishshell.com/docs/current/tutorial.html',
      'width': 400,
      'windowId': 33,
    }],
    'totalTabsRemoved': 256,
    'totalTabsUnwrangled': 16,
    'totalTabsWrangled': 32,
  };

  const blob = new Blob([JSON.stringify(expectedImportData)], {
    type: 'text/plain;charset=utf-8',
  });

  importData({target: {
    files: [blob],
  }}).then(() => {
    expect(mockFunction).toBeCalled();
    expect(mockFunction).toBeCalledWith(expectedImportData);

    done();
  });
});

test('should generate a unique file name based on a given date', () => {
  const date = new Date(2017, 3, 10);
  const uniqueFileName = exportFileName(date);

  expect(uniqueFileName).toBe('TabWranglerExport-4-10-2017.json');
});