declare namespace Intl {
  interface WeekInfo {
    // 1 is Monday and 7 is Sunday.
    firstDay: number;
    weekend: number[];
  }

  interface Locale {
    // Chrome 130+, Firefox 153+. Remove once the TypeScript lib includes `esnext.intl`.
    getWeekInfo?(): WeekInfo;
    // Chrome 99-129 implement it as a getter instead.
    weekInfo?: WeekInfo;
  }
}
