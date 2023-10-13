import Settings from "../settings";

let mockFunctionGet: jest.Mock;
let mockFunctionSet: jest.Mock;

beforeEach(() => {
  window.chrome = {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    i18n: {
      getMessage() {
        return "";
      },
    },
    storage: {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore:next-line
      local: {},
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore:next-line
      sync: {},
    },
  };

  mockFunctionGet = jest.fn();
  mockFunctionSet = jest.fn();

  window.chrome.storage.sync.get = mockFunctionGet;
  window.chrome.storage.sync.set = mockFunctionSet;

  Settings.init();
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore:next-line
  window.chrome = {};
});

test("should set maxTabs to 1000", () => {
  Settings.setmaxTabs("1000");
  expect(Settings.get("maxTabs")).toBe(1000);
  expect(mockFunctionSet.mock.calls.length).toBe(1);
});

test("should set maxTabs to 1", () => {
  Settings.setmaxTabs("1");
  expect(Settings.get("maxTabs")).toBe(1);
  expect(mockFunctionSet.mock.calls.length).toBe(1);
});

test("should throw an exception when maxTabs is < 1", () => {
  expect(() => Settings.setmaxTabs("0")).toThrowError();
});

test("should throw an exception when maxTabs is > 1000", () => {
  expect(() => Settings.setmaxTabs("1100")).toThrowError();
});
