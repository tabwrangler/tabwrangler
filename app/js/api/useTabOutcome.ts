import { type TabOutcome, getTabOutcome } from "../tabUtil";
import { getStayOpenMs } from "../settings";
import useSetting from "../useSetting";

export default function useTabOutcome(tab: chrome.tabs.Tab): TabOutcome {
  const filterAudio = useSetting("filterAudio");
  const filterGroupedTabs = useSetting("filterGroupedTabs");
  const lockedIds = useSetting("lockedIds");
  const whitelist = useSetting("whitelist");
  const stayOpenMs = getStayOpenMs(useSetting("minutesInactive"), useSetting("secondsInactive"));
  const tabRules = useSetting("tabRules");
  return getTabOutcome(tab, {
    filterAudio,
    filterGroupedTabs,
    lockedIds,
    lockedWindowIds: [],
    stayOpenMs,
    tabRules,
    whitelist,
  });
}
