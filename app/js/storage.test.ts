import { migrateSync, pauseExtension, setIdle } from "./storage";
import { TextEncoder } from "util";
import settings from "./settings";

Object.assign(global, { TextEncoder });

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

describe("migrateSync", () => {
  beforeEach(async () => {
    await chrome.storage.sync.clear();
  });

  test("migrates legacy settings to tabRules and keeps the legacy settings", async () => {
    await chrome.storage.sync.set({
      filterAudio: true,
      filterGroupedTabs: true,
      minutesInactive: 5,
      secondsInactive: 30,
      whitelist: ["github.com"],
    });
    await migrateSync();
    const { tabRules, whitelist } = await chrome.storage.sync.get(["tabRules", "whitelist"]);
    expect(
      tabRules.rules.map(({ then, when }: { then: unknown; when: unknown[] }) => ({ then, when })),
    ).toEqual([
      { then: { action: "lock" }, when: [{ type: "pinned" }] },
      { then: { action: "lock" }, when: [{ type: "url", op: "contains", value: "github.com" }] },
      { then: { action: "lock" }, when: [{ type: "audible" }] },
      { then: { action: "lock" }, when: [{ type: "groupId", op: "some" }] },
      { then: { action: "stale", afterSeconds: 330 }, when: [] },
    ]);
    expect(whitelist).toEqual(["github.com"]);
  });

  test("migrates the legacy defaults when no settings were changed", async () => {
    await migrateSync();
    const { tabRules } = await chrome.storage.sync.get("tabRules");
    expect(tabRules.rules).toHaveLength(5);
    expect(tabRules.rules[0].when).toEqual([{ type: "pinned" }]);
    expect(tabRules.rules[4].then).toEqual({ action: "stale", afterSeconds: 3600 });
  });

  test("leaves tabRules that were already migrated, even by another device", async () => {
    const stored = {
      version: 1,
      rules: [
        {
          id: "a",
          enabled: true,
          match: "all",
          when: [],
          then: { action: "stale", afterSeconds: 10 },
        },
      ],
    };
    await chrome.storage.sync.set({ tabRules: stored, whitelist: ["github.com"] });
    await migrateSync();
    expect((await chrome.storage.sync.get("tabRules")).tabRules).toEqual(stored);
  });

  test("does not write tabRules that exceed the sync quota for one item", async () => {
    await chrome.storage.sync.set({
      whitelist: Array.from({ length: 100 }, (_, i) => `example${i}.com/path`),
    });
    await migrateSync();
    expect((await chrome.storage.sync.get("tabRules")).tabRules).toBeUndefined();
  });
});
