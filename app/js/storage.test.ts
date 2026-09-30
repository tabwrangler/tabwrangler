import { pauseExtension, setIdle } from "./storage";
import settings from "./settings";

beforeEach(async () => {
  await chrome.storage.local.clear();
  settings.stayOpen = jest.fn(() => 3_600_000); // large stayOpen so clamping never kicks in
});

describe("setIdle", () => {
  const idleAtMs = 1_000;
  const activeAtMs = 46_000; // idle for 45 seconds

  test("records when the browser became idle", async () => {
    jest.spyOn(Date, "now").mockReturnValue(idleAtMs);

    await setIdle(true);

    const { idleAt } = await chrome.storage.local.get("idleAt");
    expect(idleAt).toBe(idleAtMs);
  });

  test("keeps the original idle time while still idle", async () => {
    await chrome.storage.local.set({ idleAt: idleAtMs });
    jest.spyOn(Date, "now").mockReturnValue(activeAtMs);

    await setIdle(true);

    const { idleAt } = await chrome.storage.local.get("idleAt");
    expect(idleAt).toBe(idleAtMs);
  });

  test("shifts tab times by the idle duration once active", async () => {
    await chrome.storage.local.set({ idleAt: idleAtMs, tabTimes: { "1": 500 } });
    jest.spyOn(Date, "now").mockReturnValue(activeAtMs);

    await setIdle(false);

    const { idleAt, tabTimes } = await chrome.storage.local.get(["idleAt", "tabTimes"]);
    expect(idleAt).toBeUndefined();
    expect(tabTimes["1"]).toBe(500 + (activeAtMs - idleAtMs));
  });

  test("leaves tab times unchanged when active and was not idle", async () => {
    await chrome.storage.local.set({ tabTimes: { "1": 500 } });
    jest.spyOn(Date, "now").mockReturnValue(activeAtMs);

    await setIdle(false);

    const { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(500);
  });
});

describe("pauseExtension", () => {
  test("ends an in-progress idle period before pausing", async () => {
    await chrome.storage.local.set({ idleAt: 1_000, tabTimes: { "1": 500 } });
    jest.spyOn(Date, "now").mockReturnValue(46_000);

    await pauseExtension();

    const { idleAt, pausedAt, tabTimes } = await chrome.storage.local.get([
      "idleAt",
      "pausedAt",
      "tabTimes",
    ]);
    expect(idleAt).toBeUndefined();
    expect(pausedAt).toBe(46_000);
    expect(tabTimes["1"]).toBe(45_500);
  });
});
