// Days follow `Intl.Locale.prototype.getWeekInfo`: 1 is Monday and 7 is Sunday.
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * The hours of one day during which Tab Wrangler runs. A day without a window is not active at all.
 * Windows never cross midnight, so they never overlap.
 */
export interface ActiveWindow {
  dayOfWeek: DayOfWeek;
  startMinute: number;
  endMinute: number;
}

export type ActiveHours = ActiveWindow[];

export const ACTIVE_HOURS_STEP_MINUTES = 15;
export const DAYS_OF_WEEK: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];
export const MINUTES_PER_DAY = 24 * 60;

export const ALWAYS_ACTIVE_HOURS: ActiveHours = DAYS_OF_WEEK.map((dayOfWeek) => ({
  dayOfWeek,
  startMinute: 0,
  endMinute: MINUTES_PER_DAY,
}));

// Long enough that any schedule that is not always active has a change in it.
const STATE_LOOKAHEAD_DAYS = 8;

export function getDayOfWeek(date: Date): DayOfWeek {
  return (date.getDay() || 7) as DayOfWeek;
}

export function isAllDay(window: ActiveWindow): boolean {
  return window.startMinute === 0 && window.endMinute === MINUTES_PER_DAY;
}

export function isAlwaysActive(activeHours: ActiveHours): boolean {
  return DAYS_OF_WEEK.every((dayOfWeek) =>
    activeHours.some((window) => window.dayOfWeek === dayOfWeek && isAllDay(window)),
  );
}

/**
 * Returns the active periods overlapping `[fromMs, toMs)` as `[start, end)` timestamps in local
 * time, joining periods that touch at midnight.
 */
function getActivePeriods(
  fromMs: number,
  toMs: number,
  activeHours: ActiveHours,
): Array<[number, number]> {
  const periods: Array<[number, number]> = [];
  const from = new Date(fromMs);
  for (
    let day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    day.getTime() < toMs;
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  ) {
    const window = activeHours.find((w) => w.dayOfWeek === getDayOfWeek(day));
    if (window == null) continue;

    // Built from local wall-clock time so DST changes shift the window like a clock on the wall.
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, window.startMinute);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, window.endMinute);
    if (end.getTime() <= fromMs) continue;

    const last = periods[periods.length - 1];
    if (last != null && last[1] === start.getTime()) last[1] = end.getTime();
    else periods.push([start.getTime(), end.getTime()]);
  }
  return periods;
}

/** Milliseconds of `[fromMs, toMs)` that fall outside active hours. */
export function inactiveMs(fromMs: number, toMs: number, activeHours: ActiveHours): number {
  if (toMs <= fromMs || isAlwaysActive(activeHours)) return 0;
  const activeMs = getActivePeriods(fromMs, toMs, activeHours).reduce(
    (sum, [start, end]) => sum + Math.max(0, Math.min(end, toMs) - Math.max(start, fromMs)),
    0,
  );
  return toMs - fromMs - activeMs;
}

export interface ActiveHoursState {
  active: boolean;
  // When `active` next flips, or null when it never does.
  nextChangeAt: number | null;
}

export function getActiveHoursState(nowMs: number, activeHours: ActiveHours): ActiveHoursState {
  if (isAlwaysActive(activeHours)) return { active: true, nextChangeAt: null };

  const lookaheadEnd = new Date(nowMs);
  lookaheadEnd.setDate(lookaheadEnd.getDate() + STATE_LOOKAHEAD_DAYS);
  const periods = getActivePeriods(nowMs, lookaheadEnd.getTime(), activeHours);
  const current = periods.find(([start, end]) => start <= nowMs && nowMs < end);
  if (current != null) return { active: true, nextChangeAt: current[1] };

  const next = periods.find(([start]) => start > nowMs);
  return { active: false, nextChangeAt: next?.[0] ?? null };
}

export function isWithinActiveHours(nowMs: number, activeHours: ActiveHours): boolean {
  return getActiveHoursState(nowMs, activeHours).active;
}

/** Sorted by day so the stored value does not depend on the order days were selected. */
export function setActiveWindow(
  activeHours: ActiveHours,
  dayOfWeek: DayOfWeek,
  window: Omit<ActiveWindow, "dayOfWeek"> | null,
): ActiveHours {
  const next = activeHours.filter((w) => w.dayOfWeek !== dayOfWeek);
  if (window != null) next.push({ dayOfWeek, ...window });
  return next.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

export function getFirstDayOfWeek(): DayOfWeek {
  // `Intl.Locale` requires a tag, so take the one formatters resolve for the configured locale.
  const locale = new Intl.Locale(new Intl.DateTimeFormat().resolvedOptions().locale);
  // Sunday first like en-US where neither the method (Chrome 130+, Firefox 153+) nor the older
  // getter (Chrome 99-129) exists.
  return ((locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay ?? 7) as DayOfWeek;
}

export function getDaysOfWeekInLocaleOrder(): DayOfWeek[] {
  const firstDay = getFirstDayOfWeek();
  return DAYS_OF_WEEK.map((_, i) => (((firstDay - 1 + i) % 7) + 1) as DayOfWeek);
}

export function formatDayOfWeek(dayOfWeek: DayOfWeek, weekday: "long" | "narrow"): string {
  // January 1, 2024 was a Monday, so day N of that month is ISO weekday N.
  return new Intl.DateTimeFormat(undefined, { weekday }).format(new Date(2024, 0, dayOfWeek));
}

export function formatMinuteOfDay(minute: number): string {
  return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(
    new Date(2024, 0, 1, 0, minute),
  );
}

/** Formats when active hours next change, leaving out the day when it is today. */
export function formatActiveHoursChange(changeAtMs: number, nowMs: number): string {
  const changeAt = new Date(changeAtMs);
  const isToday = changeAt.toDateString() === new Date(nowMs).toDateString();
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    weekday: isToday ? undefined : "short",
  }).format(changeAt);
}
