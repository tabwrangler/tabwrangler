import storageLocal from '../storageLocal';

beforeEach(() => {
  window.chrome = {
    storage: {
      local: {},
      onChanged: {
        addListener() {
        },
      },
    },
  };
});

afterEach(() => {
  window.chrome = {};
});

test('should refresh cache after localstorage changed', () => {
  const mockFunctionGet = jest.fn();
  const mockFunctionSet = jest.fn();
  window.chrome.storage.local.set = mockFunctionSet;
  window.chrome.storage.local.get = mockFunctionGet;

  // initialize cache and localStarage change listener
  storageLocal.init();

  // update local storage with default entries
  expect(Object.keys(storageLocal.cache).length).toBe(4);

  // replace the savedTabs
  storageLocal.setValue('savedTabs', [{test: 'new Value'}]);

  // cache must be updated
  expect(Object.keys(storageLocal.cache).length).toBe(5);
  expect(storageLocal.cache['savedTabs']).toEqual([{ test: 'new Value' }]);
});
