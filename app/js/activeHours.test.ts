import {
  ALWAYS_ACTIVE_HOURS,
  type ActiveHours,
  type DayOfWeek,
  getActiveHoursState,
  getDaysOfWeekInLocaleOrder,
  getFirstDayOfWeek,
  inactiveMs,
  isAlwaysActive,
  setActiveWindow,
} from "./activeHours";

// US Eastern time has DST changes on March 8 and November 1, 2026.
process.env.TZ = "America/New_York";

const HOUR_MS = 60 * 60 * 1000;

function at(isoLocal: string): number {
  return new Date(isoLocal).getTime();
}

function weekdays(startMinute: number, endMinute: number): ActiveHours {
  return ([1, 2, 3, 4, 5] as DayOfWeek[]).map((dayOfWeek) => ({
    dayOfWeek,
    startMinute,
    endMinute,
  }));
}

const WEEKDAYS_ALL_DAY = weekdays(0, 24 * 60);
const WEEKDAYS_9_TO_5 = weekdays(9 * 60, 17 * 60);

describe("inactiveMs", () => {
  test("is 0 when always active", () => {
    expect(inactiveMs(at("2026-10-09T17:00"), at("2026-10-12T09:00"), ALWAYS_ACTIVE_HOURS)).toBe(0);
  });

  test("is the whole interval when no day is active", () => {
    expect(inactiveMs(at("2026-10-09T17:00"), at("2026-10-12T09:00"), [])).toBe(64 * HOUR_MS);
  });

  test("excludes a weekend spent asleep", () => {
    // Laptop closed Friday 4:55 PM and opened Monday 9:00 AM
    expect(inactiveMs(at("2026-10-09T16:55"), at("2026-10-12T09:00"), WEEKDAYS_ALL_DAY)).toBe(
      48 * HOUR_MS,
    );
    expect(inactiveMs(at("2026-10-09T16:55"), at("2026-10-12T09:00"), WEEKDAYS_9_TO_5)).toBe(
      64 * HOUR_MS,
    );
  });

  test("is 0 within active hours and the whole interval outside them", () => {
    expect(inactiveMs(at("2026-10-07T10:00"), at("2026-10-07T12:00"), WEEKDAYS_9_TO_5)).toBe(0);
    expect(inactiveMs(at("2026-10-07T18:00"), at("2026-10-07T20:00"), WEEKDAYS_9_TO_5)).toBe(
      2 * HOUR_MS,
    );
  });

  test("counts only the part of a day outside its window", () => {
    expect(inactiveMs(at("2026-10-07T08:00"), at("2026-10-07T18:00"), WEEKDAYS_9_TO_5)).toBe(
      2 * HOUR_MS,
    );
  });

  test("follows wall-clock time across DST changes", () => {
    // The weekend loses an hour in spring and gains one in fall
    expect(inactiveMs(at("2026-03-06T17:00"), at("2026-03-09T09:00"), WEEKDAYS_9_TO_5)).toBe(
      63 * HOUR_MS,
    );
    expect(inactiveMs(at("2026-10-30T17:00"), at("2026-11-02T09:00"), WEEKDAYS_9_TO_5)).toBe(
      65 * HOUR_MS,
    );
  });
});

describe("getActiveHoursState", () => {
  test("is always active with no change by default", () => {
    expect(getActiveHoursState(at("2026-10-10T12:00"), ALWAYS_ACTIVE_HOURS)).toEqual({
      active: true,
      nextChangeAt: null,
    });
  });

  test("changes at the end of today's window", () => {
    expect(getActiveHoursState(at("2026-10-07T12:00"), WEEKDAYS_9_TO_5)).toEqual({
      active: true,
      nextChangeAt: at("2026-10-07T17:00"),
    });
  });

  test("changes when the next window begins", () => {
    expect(getActiveHoursState(at("2026-10-10T12:00"), WEEKDAYS_9_TO_5)).toEqual({
      active: false,
      nextChangeAt: at("2026-10-12T09:00"),
    });
  });

  test("joins all-day windows that touch at midnight", () => {
    expect(getActiveHoursState(at("2026-10-07T12:00"), WEEKDAYS_ALL_DAY)).toEqual({
      active: true,
      nextChangeAt: at("2026-10-10T00:00"),
    });
  });

  test("never changes when no day is active", () => {
    expect(getActiveHoursState(at("2026-10-07T12:00"), [])).toEqual({
      active: false,
      nextChangeAt: null,
    });
  });
});

describe("setActiveWindow", () => {
  test("replaces a day's window and keeps days in order", () => {
    const activeHours = setActiveWindow(WEEKDAYS_ALL_DAY, 3, { startMinute: 60, endMinute: 120 });
    expect(activeHours.map((w) => w.dayOfWeek)).toEqual([1, 2, 3, 4, 5]);
    expect(activeHours[2]).toEqual({ dayOfWeek: 3, startMinute: 60, endMinute: 120 });
  });

  test("removes a day", () => {
    expect(isAlwaysActive(setActiveWindow(ALWAYS_ACTIVE_HOURS, 7, null))).toBe(false);
  });
});

describe("getFirstDayOfWeek", () => {
  const prototype = Intl.Locale.prototype as Intl.Locale;
  const descriptors = Object.getOwnPropertyDescriptors(prototype);

  afterEach(() => {
    delete prototype.getWeekInfo;
    delete prototype.weekInfo;
    Object.defineProperties(prototype, descriptors);
  });

  function setWeekInfo({ method, getter }: { method?: number; getter?: number }) {
    delete prototype.getWeekInfo;
    delete prototype.weekInfo;
    if (method != null) prototype.getWeekInfo = () => ({ firstDay: method, weekend: [6, 7] });
    if (getter != null)
      Object.defineProperty(prototype, "weekInfo", {
        configurable: true,
        get: () => ({ firstDay: getter, weekend: [6, 7] }),
      });
  }

  test("uses getWeekInfo", () => {
    setWeekInfo({ getter: 6, method: 1 });
    expect(getFirstDayOfWeek()).toBe(1);
    expect(getDaysOfWeekInLocaleOrder()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("falls back to the weekInfo getter", () => {
    setWeekInfo({ getter: 6 });
    expect(getFirstDayOfWeek()).toBe(6);
    expect(getDaysOfWeekInLocaleOrder()).toEqual([6, 7, 1, 2, 3, 4, 5]);
  });

  test("falls back to Sunday", () => {
    setWeekInfo({});
    expect(getFirstDayOfWeek()).toBe(7);
    expect(getDaysOfWeekInLocaleOrder()).toEqual([7, 1, 2, 3, 4, 5, 6]);
  });
});
