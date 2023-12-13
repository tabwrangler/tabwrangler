import { exportData, exportFileName, importData } from "../actions/importExportActions";

describe("importExportActions", () => {
  test("exports the bookmark data", async () => {
    await chrome.storage.local.set({
      "persist:localStorage": {
        totalTabsRemoved: 256,
        totalTabsUnwrangled: 120,
        totalTabsWrangled: 100,
      },
    });

    const blob = await exportData();
    expect(blob.type).toBe("application/json;charset=utf-8");
  });

  test("imports the bookmark data", async () => {
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

    await importData({
      target: {
        // @ts-expect-error Using only necessary key from `EventTarget`, no need to create real one
        files: [blob],
      },
    });

    const { "persist:localStorage": data } = await chrome.storage.local.get("persist:localStorage");
    expect(data).toEqual(expectedImportData);
  });

  test("fails to import non existent backup", async () => {
    try {
      await importData({
        target: {
          // @ts-expect-error Using only necessary key from `EventTarget`, no need to create real one
          files: [],
        },
      });
      fail("Expected `importData` failure: no files");
    } catch (error) {
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    }
  });

  test("should fail import of incomplete backup data", async () => {
    // this is missing the savedTabs object
    const expectedImportData = [
      { totalTabsRemoved: 256 },
      { totalTabsUnwrangled: 16 },
      { totalTabsWrangled: 32 },
    ];

    const blob = new Blob([JSON.stringify(expectedImportData)], {
      type: "text/plain;charset=utf-8",
    });

    try {
      await importData({
        target: {
          // @ts-expect-error Using only necessary key from `EventTarget`, no need to create real one
          files: [blob],
        },
      });
      fail("Expected `importData` failure: missing `savedTabs` key");
    } catch (error) {
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    }
  });

  test("fails import of corrupt backup data", async () => {
    const blob = new Blob(["{345:}"], {
      type: "text/plain;charset=utf-8",
    });

    try {
      await importData({
        target: {
          // @ts-expect-error Using only necessary key from `EventTarget`, no need to create real one
          files: [blob],
        },
      });
      fail("Expected `importData` failure: corrupted `Blob` backup data");
    } catch (error) {
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    }
  });

  test("generates a unique file name based on a given date", () => {
    const date = new Date("2017-04-10 00:00:00 GMT");
    const uniqueFileName = exportFileName(date);
    expect(uniqueFileName).toBe("TabWranglerExport-2017-04-10.json");
  });
});
