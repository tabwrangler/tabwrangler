import { extractRootDomain, getRestorableGroupId } from "./util";

describe("util", () => {
  describe("extractRootDomain", () => {
    test("extracts from 2-character TLDs", () => {
      expect(extractRootDomain("https://ssorallen.github.io/react-todos/")).toEqual("github.io");
    });

    test("extracts country code TLDs", () => {
      expect(extractRootDomain("https://www.bbc.co.uk/")).toEqual("bbc.co.uk");
    });

    test("extracts one of those shenanigans TLDs", () => {
      expect(extractRootDomain("http://www.diy.guru/")).toEqual("diy.guru");
    });
  });

  describe("getRestorableGroupId", () => {
    const browserStartedAt = 1000;

    function createTab(groupId: number, closedAt: number | undefined): chrome.tabs.Tab {
      return { closedAt, groupId } as unknown as chrome.tabs.Tab;
    }

    test("returns the group of a tab closed since the browser started", () => {
      expect(getRestorableGroupId(createTab(7, 2000), browserStartedAt)).toBe(7);
    });

    test("ignores the group of a tab closed before the browser started", () => {
      expect(getRestorableGroupId(createTab(7, 500), browserStartedAt)).toBeNull();
    });

    test("ignores tabs that were not in a group", () => {
      expect(getRestorableGroupId(createTab(-1, 2000), browserStartedAt)).toBeNull();
    });

    test("ignores groups when the browser start time is unknown", () => {
      expect(getRestorableGroupId(createTab(7, 2000), undefined)).toBeNull();
    });

    test("ignores groups when the tab has no close time", () => {
      expect(getRestorableGroupId(createTab(7, undefined), browserStartedAt)).toBeNull();
    });
  });
});
