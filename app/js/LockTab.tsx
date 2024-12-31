import * as React from "react";
import { lockTabId, unlockTabId } from "./storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Dropdown from "react-bootstrap/Dropdown";
import OpenTabRow from "./OpenTabRow";
import { isTabLocked } from "./tabUtil";
import settings from "./settings";
import { useStorageSyncQuery } from "./storage";

type Sorter = {
  key: string;
  label: () => string;
  shortLabel: () => string;
  sort: (
    a: chrome.tabs.Tab | null,
    b: chrome.tabs.Tab | null,
    tabTimes: {
      [tabid: string]: number;
    },
  ) => number;
};

const AlphaSorter: Sorter = {
  key: "alpha",
  label: () => chrome.i18n.getMessage("corral_sortPageTitle") || "",
  shortLabel: () => chrome.i18n.getMessage("corral_sortPageTitle_short") || "",
  sort(tabA, tabB) {
    if (tabA == null || tabB == null || tabA.title == null || tabB.title == null) {
      return 0;
    } else {
      return tabA.title.localeCompare(tabB.title);
    }
  },
};

const ReverseAlphaSorter: Sorter = {
  key: "reverseAlpha",
  label: () => chrome.i18n.getMessage("corral_sortPageTitle_descending") || "",
  shortLabel: () => chrome.i18n.getMessage("corral_sortPageTitle_descending_short") || "",
  sort(tabA, tabB) {
    return -1 * AlphaSorter.sort(tabA, tabB, {});
  },
};

const ChronoSorter: Sorter = {
  key: "chrono",
  label: () => chrome.i18n.getMessage("tabLock_sort_timeUntilClose") || "",
  shortLabel: () => chrome.i18n.getMessage("tabLock_sort_timeUntilClose_short") || "",
  sort(tabA, tabB, tabTimes) {
    if (tabA == null || tabB == null) {
      return 0;
    } else if (settings.isTabLocked(tabA) && !settings.isTabLocked(tabB)) {
      return 1;
    } else if (!settings.isTabLocked(tabA) && settings.isTabLocked(tabB)) {
      return -1;
    } else {
      const lastModifiedA = tabA.id == null ? -1 : tabTimes[tabA.id];
      const lastModifiedB = tabB.id == null ? -1 : tabTimes[tabB.id];
      return lastModifiedA - lastModifiedB;
    }
  },
};

const ReverseChronoSorter: Sorter = {
  key: "reverseChrono",
  label: () => chrome.i18n.getMessage("tabLock_sort_timeUntilClose_desc") || "",
  shortLabel: () => chrome.i18n.getMessage("tabLock_sort_timeUntilClose_desc_short") || "",
  sort(tabA, tabB, tabTimes) {
    return -1 * ChronoSorter.sort(tabA, tabB, tabTimes);
  },
};

const TabOrderSorter: Sorter = {
  key: "tabOrder",
  label: () => chrome.i18n.getMessage("tabLock_sort_tabOrder") || "",
  shortLabel: () => chrome.i18n.getMessage("tabLock_sort_tabOrder_short") || "",
  sort(tabA, tabB) {
    if (tabA == null || tabB == null) {
      return 0;
    } else if (tabA.windowId === tabB.windowId) {
      return tabA.index - tabB.index;
    } else {
      return tabA.windowId - tabB.windowId;
    }
  },
};

const ReverseTabOrderSorter: Sorter = {
  key: "reverseTabOrder",
  label: () => chrome.i18n.getMessage("tabLock_sort_tabOrder_desc") || "",
  shortLabel: () => chrome.i18n.getMessage("tabLock_sort_tabOrder_desc_short") || "",
  sort(tabA, tabB, tabTimes) {
    return -1 * TabOrderSorter.sort(tabA, tabB, tabTimes);
  },
};

const DEFAULT_SORTER = TabOrderSorter;
const Sorters = [
  TabOrderSorter,
  ReverseTabOrderSorter,
  AlphaSorter,
  ReverseAlphaSorter,
  ChronoSorter,
  ReverseChronoSorter,
];

export const UseNowContext = React.createContext(new Date().getTime());
function useNow() {
  const [now, setNow] = React.useState(new Date().getTime());
  const intervalRef = React.useRef<number>();
  React.useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setNow(new Date().getTime());
    }, 1000);
    return () => {
      window.clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    };
  }, []);
  return now;
}

function useTabsQuery() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryFn: () => chrome.tabs.query({}),
    queryKey: ["tabsQuery"],
  });
  React.useEffect(() => {
    function invalidateTabsQuery() {
      queryClient.invalidateQueries({ queryKey: ["tabsQuery"] });
    }
    chrome.tabs.onCreated.addListener(invalidateTabsQuery);
    chrome.tabs.onRemoved.addListener(invalidateTabsQuery);
    return () => {
      chrome.tabs.onCreated.removeListener(invalidateTabsQuery);
      chrome.tabs.onRemoved.removeListener(invalidateTabsQuery);
    };
  }, [queryClient]);
  return query;
}

function useTabTimesQuery() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryFn: () => chrome.storage.local.get({ tabTimes: {} }),
    queryKey: ["tabTimesQuery"],
  });
  React.useEffect(() => {
    function invalidateTabTimesQuery(
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: chrome.storage.AreaName,
    ) {
      if (areaName === "local" && "tabTimes" in changes)
        queryClient.invalidateQueries({ queryKey: ["tabTimesQuery"] });
    }
    chrome.storage.onChanged.addListener(invalidateTabTimesQuery);
    return () => {
      chrome.storage.onChanged.removeListener(invalidateTabTimesQuery);
    };
  }, [queryClient]);
  return {
    ...query,
    data: query.data?.tabTimes, // unwrap `StorageArea.get` response since `tabTimes` is implied
  };
}

export default function LockTab() {
  const lastSelectedTabRef = React.useRef<chrome.tabs.Tab | null>(null);
  const now = useNow();
  const [sortOrder, setSortOrder] = React.useState<string | null>(
    settings.get<string>("lockTabSortOrder"),
  );

  const [currSorter, setCurrSorter] = React.useState(() => {
    let sorter = sortOrder == null ? DEFAULT_SORTER : Sorters.find((s) => s.key === sortOrder);
    // If settings somehow stores a bad value, always fall back to default order.
    if (sorter == null) sorter = DEFAULT_SORTER;
    return sorter;
  });

  const tabsQuery = useTabsQuery();
  const tabTimesQuery = useTabTimesQuery();
  const sortedTabs =
    tabsQuery.data == null || tabTimesQuery.data == null
      ? []
      : tabsQuery.data
          .slice()
          .sort((tabA, tabB) => currSorter.sort(tabA, tabB, tabTimesQuery.data));
  const { data: syncData } = useStorageSyncQuery();
  const lockedTabIds =
    syncData == null
      ? new Set()
      : new Set(
          sortedTabs
            .filter((tab) =>
              isTabLocked(tab, {
                filterAudio: syncData["filterAudio"],
                filterGroupedTabs: syncData["filterGroupedTabs"],
                lockedIds: syncData["lockedIds"],
                whitelist: syncData["whitelist"],
              }),
            )
            .map((tab) => tab.id),
        );

  async function toggleTab(tab: chrome.tabs.Tab, selected: boolean, multiselect: boolean) {
    let tabsToToggle = [tab];
    if (multiselect && lastSelectedTabRef.current != null) {
      const lastSelectedTabIndex = sortedTabs.indexOf(lastSelectedTabRef.current);
      if (lastSelectedTabIndex >= 0) {
        const tabIndex = sortedTabs.indexOf(tab);
        tabsToToggle = sortedTabs.slice(
          Math.min(tabIndex, lastSelectedTabIndex),
          Math.max(tabIndex, lastSelectedTabIndex) + 1,
        );
      }
    }

    // Toggle only the tabs that are manually lockable.
    await Promise.all(
      tabsToToggle
        .filter((tab) => settings.isTabManuallyLockable(tab))
        .map((tab) => {
          if (tab.id == null) return Promise.resolve();
          else if (selected) return lockTabId(tab.id);
          else return unlockTabId(tab.id);
        }),
    );

    lastSelectedTabRef.current = tab;
  }

  return (
    <div className="tab-pane active">
      <div className="d-flex align-items-center justify-content-between border-bottom pb-2">
        <div className="px-2">
          <abbr title={chrome.i18n.getMessage("tabLock_lockLabel")}>
            <i className="fas fa-lock" />
          </abbr>
        </div>
        <Dropdown>
          <Dropdown.Toggle
            size="sm"
            title={chrome.i18n.getMessage("corral_currentSort", currSorter.label())}
            variant="secondary"
          >
            {chrome.i18n.getMessage("corral_sortBy")} {currSorter.shortLabel()}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {Sorters.map((sorter) => (
              <Dropdown.Item
                active={currSorter === sorter}
                as="button"
                key={sorter.label()}
                onClick={() => {
                  if (sorter !== currSorter) {
                    // When the saved sort order is not null then the user wants to preserve it.
                    // Update to the new sort order and persist it.
                    if (syncData != null) {
                      settings.set("lockTabSortOrder", sorter.key);
                    }
                    setCurrSorter(sorter);
                  }
                }}
              >
                {sorter.label()}
              </Dropdown.Item>
            ))}
            <Dropdown.Divider />
            <Dropdown.ItemText>
              <div className="form-group mb-0">
                <div className="form-check">
                  <input
                    checked={sortOrder != null}
                    className="form-check-input"
                    id="lock-tab--save-sort-order"
                    onChange={(event) => {
                      if (event.target.checked) {
                        settings.set("lockTabSortOrder", currSorter.key);
                        setSortOrder(currSorter.key);
                      } else {
                        settings.set("lockTabSortOrder", null);
                        setSortOrder(null);
                      }
                    }}
                    type="checkbox"
                  />
                  <label className="form-check-label" htmlFor="lock-tab--save-sort-order">
                    {chrome.i18n.getMessage("options_option_saveSortOrder")}
                  </label>
                </div>
              </div>
            </Dropdown.ItemText>
          </Dropdown.Menu>
        </Dropdown>
      </div>
      <table className="table table-hover table-sm table-th-unbordered">
        <tbody>
          <UseNowContext.Provider value={now}>
            {sortedTabs.map((tab) => (
              <OpenTabRow
                isLocked={lockedTabIds.has(tab.id)}
                key={tab.id}
                onToggleTab={toggleTab}
                tab={tab}
                tabTime={
                  tabTimesQuery.data == null || tab.id == null
                    ? undefined
                    : tabTimesQuery.data[tab.id]
                }
              />
            ))}
          </UseNowContext.Provider>
        </tbody>
      </table>
    </div>
  );
}
