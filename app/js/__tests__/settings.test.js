import Settings from '../settings';

let mockFunctionGet;
let mockFunctionSet;

beforeEach(() => {
  window.chrome = {
    'storage': {
      'local': {
      },
      'sync': {},
    },
  };

  mockFunctionGet = jest.fn();
  mockFunctionSet = jest.fn();

  window.chrome.storage.sync.get = mockFunctionGet;
  window.chrome.storage.sync.set = mockFunctionSet;
  
  Settings.init();
});

afterEach(() => {
  window.chrome = {};
});

test('should set maxTabs to 500', () => {
  Settings.setmaxTabs(500);
  expect(Settings.get('maxTabs')).toBe(500);
  expect(mockFunctionSet.mock.calls.length).toBe(1);
});

test('should set maxTabs to 1', () => {
  Settings.setmaxTabs(1);
  expect(Settings.get('maxTabs')).toBe(1);
  expect(mockFunctionSet.mock.calls.length).toBe(1);
});

test('should throw an exception when maxTabs is < 1', () => {
  expect(() => Settings.setmaxTabs(0)).toThrowError(
    'Max tabs must be a number between 1 and 500. ' +
    'Setting this too high can cause performance issues');
});

test('should throw an exception when maxTabs is > 500', () => {
  expect(() => Settings.setmaxTabs(600)).toThrowError(
    'Max tabs must be a number between 1 and 500. ' + 
    'Setting this too high can cause performance issues');
});