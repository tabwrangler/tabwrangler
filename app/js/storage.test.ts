import { ALWAYS_ACTIVE_HOURS, type DayOfWeek } from "./activeHours";
import {
  excludeTimeOutsideActiveHours,
  migrateSync,
  onActiveHoursChanged,
  pauseExtension,
  setIdle,
  unpauseExtension,
} from "./storage";
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

describe("excludeTimeOutsideActiveHours", () => {
  const HOUR_MS = 60 * 60 * 1000;
  const fridayCheckAt = new Date("2026-10-09T16:55").getTime();
  const fridayEndAt = new Date("2026-10-09T17:00").getTime();
  const saturdayAt = new Date("2026-10-10T10:00").getTime();
  const mondayAt = new Date("2026-10-12T09:05").getTime();
  const tabTime = fridayCheckAt - HOUR_MS;

  beforeEach(() => {
    process.env.TZ = "America/New_York";
    settings.stayOpen = jest.fn(() => 7 * 24 * HOUR_MS);
    settings.cache.activeHours = ([1, 2, 3, 4, 5] as DayOfWeek[]).map((dayOfWeek) => ({
      dayOfWeek,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
    }));
  });

  afterEach(() => {
    settings.cache.activeHours = ALWAYS_ACTIVE_HOURS;
  });

  test("starts the clock without shifting tab times", async () => {
    await chrome.storage.local.set({ tabTimes: { "1": tabTime } });
    jest.spyOn(Date, "now").mockReturnValue(saturdayAt);

    await excludeTimeOutsideActiveHours();

    const { clockCheckedAt, tabTimes } = await chrome.storage.local.get([
      "clockCheckedAt",
      "tabTimes",
    ]);
    expect(clockCheckedAt).toBe(saturdayAt);
    expect(tabTimes["1"]).toBe(tabTime);
  });

  test("leaves tab times alone outside active hours", async () => {
    await chrome.storage.local.set({ clockCheckedAt: fridayCheckAt, tabTimes: { "1": tabTime } });
    jest.spyOn(Date, "now").mockReturnValue(saturdayAt);

    await excludeTimeOutsideActiveHours();

    const { clockCheckedAt, tabTimes } = await chrome.storage.local.get([
      "clockCheckedAt",
      "tabTimes",
    ]);
    expect(clockCheckedAt).toBe(fridayCheckAt);
    expect(tabTimes["1"]).toBe(tabTime);
  });

  test("excludes a weekend spent asleep once active hours begin", async () => {
    const tabActivatedOnSaturdayAt = saturdayAt + HOUR_MS;
    await chrome.storage.local.set({
      clockCheckedAt: fridayCheckAt,
      tabTimes: { "1": tabTime, "2": tabActivatedOnSaturdayAt },
    });
    jest.spyOn(Date, "now").mockReturnValue(mondayAt);

    await excludeTimeOutsideActiveHours();

    const { clockCheckedAt, tabTimes } = await chrome.storage.local.get([
      "clockCheckedAt",
      "tabTimes",
    ]);
    expect(clockCheckedAt).toBe(mondayAt);
    expect(tabTimes["1"]).toBe(tabTime + 64 * HOUR_MS);
    // Activated outside active hours, so only time since they began counts.
    expect(tabTimes["2"]).toBe(new Date("2026-10-12T09:00").getTime());
  });

  test("excludes the time before an idle period, which excludes the rest", async () => {
    await chrome.storage.local.set({
      clockCheckedAt: fridayCheckAt,
      idleAt: saturdayAt,
      tabTimes: { "1": tabTime },
    });
    jest.spyOn(Date, "now").mockReturnValue(saturdayAt + 5_000);

    await excludeTimeOutsideActiveHours();
    let { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(tabTime + (saturdayAt - fridayEndAt));

    jest.spyOn(Date, "now").mockReturnValue(mondayAt);
    await excludeTimeOutsideActiveHours();
    await setIdle(false);
    ({ tabTimes } = await chrome.storage.local.get("tabTimes"));
    expect(tabTimes["1"]).toBe(tabTime + (mondayAt - fridayEndAt));
  });

  test("excludes time that was outside active hours before they changed", async () => {
    const mondayCheckAt = new Date("2026-10-12T09:35:00").getTime();
    const mondayOffAt = mondayCheckAt + 4_000;
    const mondayOnAt = mondayOffAt + 60_000;
    const withoutMonday = ALWAYS_ACTIVE_HOURS.filter((w) => w.dayOfWeek !== 1);
    settings.cache.activeHours = ALWAYS_ACTIVE_HOURS;
    await chrome.storage.local.set({ clockCheckedAt: mondayCheckAt, tabTimes: { "1": tabTime } });

    jest.spyOn(Date, "now").mockReturnValue(mondayOffAt);
    settings.cache.activeHours = withoutMonday;
    await onActiveHoursChanged(ALWAYS_ACTIVE_HOURS);

    jest.spyOn(Date, "now").mockReturnValue(mondayOffAt + 5_000);
    await excludeTimeOutsideActiveHours();

    jest.spyOn(Date, "now").mockReturnValue(mondayOnAt);
    settings.cache.activeHours = ALWAYS_ACTIVE_HOURS;
    await onActiveHoursChanged(withoutMonday);

    jest.spyOn(Date, "now").mockReturnValue(mondayOnAt + 5_000);
    await excludeTimeOutsideActiveHours();

    const { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(tabTime + 60_000);
  });

  test("excludes the time before a pause, which excludes the rest", async () => {
    await chrome.storage.local.set({ clockCheckedAt: fridayCheckAt, tabTimes: { "1": tabTime } });
    jest.spyOn(Date, "now").mockReturnValue(saturdayAt);
    await pauseExtension();

    jest.spyOn(Date, "now").mockReturnValue(saturdayAt + 5_000);
    await excludeTimeOutsideActiveHours();

    jest.spyOn(Date, "now").mockReturnValue(mondayAt);
    await excludeTimeOutsideActiveHours();
    await unpauseExtension();

    const { tabTimes } = await chrome.storage.local.get("tabTimes");
    expect(tabTimes["1"]).toBe(tabTime + (mondayAt - fridayEndAt));
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
      { then: { action: "lock" }, when: [{ type: "url", op: "includes", value: "github.com" }] },
      { then: { action: "lock" }, when: [{ type: "audible" }] },
      { then: { action: "lock" }, when: [{ type: "groupId", op: "some" }] },
      { then: { action: "stale", afterSeconds: 330, save: "corral" }, when: [] },
    ]);
    expect(whitelist).toEqual(["github.com"]);
  });

  test("uses legacy defaults for legacy settings that were never changed", async () => {
    await chrome.storage.sync.set({ whitelist: ["github.com"] });
    await migrateSync();
    const { tabRules } = await chrome.storage.sync.get("tabRules");
    expect(tabRules.rules.map(({ when }: { when: unknown[] }) => when)).toEqual([
      [{ type: "pinned" }],
      [{ type: "url", op: "includes", value: "github.com" }],
      [{ type: "audible" }],
      [],
    ]);
    expect(tabRules.rules[3].then).toEqual({ action: "stale", afterSeconds: 3600, save: "corral" });
  });

  test("stores nothing when no legacy settings were changed", async () => {
    await migrateSync();
    expect(await chrome.storage.sync.get(null)).toEqual({});
  });

  test("leaves tabRules that were already migrated, even by another device", async () => {
    const stored = {
      version: 1,
      rules: [
        {
          id: "a",
          match: "every",
          when: [],
          then: { action: "stale", afterSeconds: 10, save: "corral" },
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
