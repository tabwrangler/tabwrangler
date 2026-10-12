import { act, renderHook } from "@testing-library/react";
import { type DayOfWeek } from "./activeHours";
import useActiveHoursState from "./useActiveHoursState";

process.env.TZ = "America/New_York";

const mockSettings: Record<string, unknown> = {};
jest.mock("./useSetting", () => (key: string) => mockSettings[key]);

const MINUTE_MS = 60 * 1000;

beforeEach(() => {
  jest.useFakeTimers();
  mockSettings.activeHours = ([1, 2, 3, 4, 5] as DayOfWeek[]).map((dayOfWeek) => ({
    dayOfWeek,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
  }));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useActiveHoursState", () => {
  test("changes when active hours end", () => {
    jest.setSystemTime(new Date("2026-10-07T16:00"));
    const { result } = renderHook(() => useActiveHoursState());
    expect(result.current.active).toBe(true);

    act(() => jest.advanceTimersByTime(60 * MINUTE_MS));
    expect(result.current.active).toBe(false);
  });

  test("still changes when its timer fires early because the clock was set back", () => {
    jest.setSystemTime(new Date("2026-10-07T16:00"));
    const { result } = renderHook(() => useActiveHoursState());
    act(() => jest.advanceTimersByTime(0));

    jest.setSystemTime(new Date("2026-10-07T15:59"));
    act(() => jest.advanceTimersByTime(60 * MINUTE_MS));
    expect(result.current.active).toBe(true);

    act(() => jest.advanceTimersByTime(MINUTE_MS));
    expect(result.current.active).toBe(false);
  });
});
