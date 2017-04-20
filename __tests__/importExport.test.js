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
  const mockFunction = jest.fn()
  window.chrome.storage.local.get = mockFunction;

  exportData();
  expect(mockFunction.mock.calls.length).toBe(1);
});

// TODO(irichter): implement import
test('should import the bookmark data', () => {
  importData();
  expect(true).toBe(true);
});

test('should generate a unique file name based on a given date', () => {
  const date = new Date(2017, 3, 10);
  const uniqueFileName = exportFileName(date);

  expect(uniqueFileName).toBe('TabWranglerExport-4-10-2017.json');
});