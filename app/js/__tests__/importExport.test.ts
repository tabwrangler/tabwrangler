import { exportData, exportFileName, importData } from "../actions/importExportActions";
import { MockStore } from "redux-mock-store";
import configureMockStore from "../__mocks__/configureMockStore";

describe("importExportActions", () => {
  let store: MockStore;

  beforeEach(() => {
    store = configureMockStore();
  });

  test("should export the bookmark data", () => {
    store = configureMockStore({
      tempStorage: {
        totalTabsRemoved: 256,
        totalTabsUnwrangled: 120,
        totalTabsWrangled: 100,
      },
    });

    const ogGet = chrome.storage.local.get;

    // @ts-expect-error Incomplete `get` implementation
    chrome.storage.local.get = (t, func) => {
      func({ test: 2 });
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    store.dispatch(exportData()).then((blob: Blob) => {
      expect(blob.type).toBe("application/json;charset=utf-8");
    });

    chrome.storage.local.get = ogGet;
  });

  test("should import the bookmark data", (done) => {
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
          status: "complete",
          title: "fish: Tutorial",
          url: "https://fishshell.com/docs/current/tutorial.html",
          width: 400,
          windowId: 33,
        },
      ],
      totalTabsRemoved: 256,
      totalTabsUnwrangled: 16,
      totalTabsWrangled: 32,
    };

    const blob = new Blob([JSON.stringify(expectedImportData)], {
      type: "text/plain;charset=utf-8",
    });

    store
      .dispatch(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore:next-line
        importData({
          target: {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore:next-line
            files: [blob],
          },
        })
      )
      .then(() => {
        expect(store.getActions()).toEqual([
          { totalTabsRemoved: 256, type: "SET_TOTAL_TABS_REMOVED" },
          { totalTabsUnwrangled: 16, type: "SET_TOTAL_TABS_UNWRANGLED" },
          { totalTabsWrangled: 32, type: "SET_TOTAL_TABS_WRANGLED" },
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
                status: "complete",
                title: "fish: Tutorial",
                url: "https://fishshell.com/docs/current/tutorial.html",
                width: 400,
                windowId: 33,
              },
            ],
            type: "SET_SAVED_TABS",
          },
        ]);
        done();
      })
      .catch((e: Error) => {
        console.error(e);
        done();
      });
  });

  test("should fail to import non existent backup", (done) => {
    store
      .dispatch(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore:next-line
        importData({
          target: {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore:next-line
            files: [],
          },
        })
      )
      .catch(() => {
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
        done();
      });
  });

  test("should fail import of incomplete backup data", (done) => {
    // this is missing the savedTabs object
    const expectedImportData = [
      { totalTabsRemoved: 256 },
      { totalTabsUnwrangled: 16 },
      { totalTabsWrangled: 32 },
    ];

    const blob = new Blob([JSON.stringify(expectedImportData)], {
      type: "text/plain;charset=utf-8",
    });

    store
      .dispatch(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore:next-line
        importData({
          target: {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore:next-line
            files: [blob],
          },
        })
      )
      .catch(() => {
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
        done();
      });
  });

  test("should fail import of corrupt backup data", (done) => {
    const blob = new Blob(["{345:}"], {
      type: "text/plain;charset=utf-8",
    });

    store
      .dispatch(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore:next-line
        importData({
          target: {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore:next-line
            files: [blob],
          },
        })
      )
      .catch(() => {
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
        done();
      });
  });

  test("should generate a unique file name based on a given date", () => {
    const date = new Date("2017-04-10 00:00:00 GMT");
    const uniqueFileName = exportFileName(date);
    expect(uniqueFileName).toBe("TabWranglerExport-2017-04-10.json");
  });
});
