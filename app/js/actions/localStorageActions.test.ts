import settings from "../settings";
import { shiftTabTimes } from "./localStorageActions";

beforeEach(async () => {
  await chrome.storage.local.clear();
});

describe("shiftTabTimes", () => {
  const pausedAtMs = 1_000;
  const unpausedAtMs = 46_000; // paused for 45 seconds

  test("shifts a tabTime that predates the pause forward by the pause duration", async () => {
    settings.stayOpen = jest.fn(() => 3_600_000); // large stayOpen so clamping never kicks in
    jest.spyOn(Date, "now").mockReturnValue(unpausedAtMs);

    await chrome.storage.local.set({ tabTimes: { "1": 500 } }); // tabTime predates the pause

    await shiftTabTimes(pausedAtMs);

    const { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(500 + (unpausedAtMs - pausedAtMs));
  });

  test("leaves a tabTime that postdates the pause unchanged", async () => {
    settings.stayOpen = jest.fn(() => 3_600_000);
    jest.spyOn(Date, "now").mockReturnValue(unpausedAtMs);

    // Tab was activated while paused (`onActivated` updates tabTimes even when paused), so its
    // time is already accurate and must not be shifted.
    await chrome.storage.local.set({ tabTimes: { "1": 30_000 } });

    await shiftTabTimes(pausedAtMs);

    const { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(30_000);
  });

  test("clamps a shifted tabTime to `now - stayOpen` when stayOpen shrinks during the pause", async () => {
    settings.stayOpen = jest.fn(() => 0);
    jest.spyOn(Date, "now").mockReturnValue(unpausedAtMs);

    await chrome.storage.local.set({ tabTimes: { "1": 500 } }); // predates the pause

    await shiftTabTimes(pausedAtMs);

    const { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(unpausedAtMs);
  });

  test("clamps a postdating tabTime that is already older than `stayOpen`", async () => {
    settings.stayOpen = jest.fn(() => 0);
    jest.spyOn(Date, "now").mockReturnValue(unpausedAtMs);

    await chrome.storage.local.set({ tabTimes: { "1": 2_000 } }); // postdates the pause

    await shiftTabTimes(pausedAtMs);

    const { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(unpausedAtMs);
  });
});
