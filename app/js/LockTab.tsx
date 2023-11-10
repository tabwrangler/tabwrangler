import * as React from "react";
import { lockTabId, unlockTabId } from "./storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStorageLocalPersistQuery, useStorageSyncQuery } from "./storage";
import OpenTabRow from "./OpenTabRow";
import cx from "classnames";
import { isTabLocked } from "./tabUtil";
import settings from "./settings";

type Sorter = {
  key: string;
  label: () => string;
  shortLabel: () => string;
  sort: (
    a: chrome.tabs.Tab | null,
    b: chrome.tabs.Tab | null,
    tabTimes: {
      [tabid: string]: number;
    }
  ) => number;
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
const Sorters = [TabOrderSorter, ReverseTabOrderSorter, ChronoSorter, ReverseChronoSorter];

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

export default function LockTab() {
  const dropdownRef = React.useRef<HTMLElement | null>(null);
  const lastSelectedTabRef = React.useRef<chrome.tabs.Tab | null>(null);
  const now = useNow();
  const [isSortDropdownOpen, setIsSortDropdownOpen] = React.useState<boolean>(false);
  const [sortOrder, setSortOrder] = React.useState<string | null>(
    settings.get<string>("lockTabSortOrder")
  );

  const [currSorter, setCurrSorter] = React.useState(() => {
    let sorter = sortOrder == null ? DEFAULT_SORTER : Sorters.find((s) => s.key === sortOrder);
    // If settings somehow stores a bad value, always fall back to default order.
    if (sorter == null) sorter = DEFAULT_SORTER;
    return sorter;
  });

  const queryClient = useQueryClient();
  const { data: tabs } = useQuery({
    queryFn: () => chrome.tabs.query({}),
    queryKey: ["tabsQuery"],
  });
  React.useEffect(() => {
    function handleChanged() {
      queryClient.invalidateQueries({ queryKey: ["tabsQuery"] });
    }
    chrome.tabs.onCreated.addListener(handleChanged);
    chrome.tabs.onRemoved.addListener(handleChanged);
    return () => {
      chrome.tabs.onCreated.removeListener(handleChanged);
      chrome.tabs.onRemoved.removeListener(handleChanged);
    };
  }, [queryClient]);

  const { data: persistLocalData } = useStorageLocalPersistQuery();
  const sortedTabs =
    tabs == null || persistLocalData?.tabTimes == null
      ? []
      : tabs.slice().sort((tabA, tabB) => currSorter.sort(tabA, tabB, persistLocalData.tabTimes));
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
              })
            )
            .map((tab) => tab.id)
        );

  React.useEffect(() => {
    function handleWindowClick(event: MouseEvent) {
      if (
        isSortDropdownOpen &&
        dropdownRef.current != null &&
        event.target instanceof Node &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsSortDropdownOpen(false);
      }
    }

    window.addEventListener("click", handleWindowClick);
    return () => {
      window.removeEventListener("click", handleWindowClick);
    };
  }, [isSortDropdownOpen]);

  async function handleToggleTab(tab: chrome.tabs.Tab, selected: boolean, multiselect: boolean) {
    let tabsToToggle = [tab];
    if (multiselect && lastSelectedTabRef.current != null) {
      const lastSelectedTabIndex = sortedTabs.indexOf(lastSelectedTabRef.current);
      if (lastSelectedTabIndex >= 0) {
        const tabIndex = sortedTabs.indexOf(tab);
        tabsToToggle = sortedTabs.slice(
          Math.min(tabIndex, lastSelectedTabIndex),
          Math.max(tabIndex, lastSelectedTabIndex) + 1
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
        })
    );

    lastSelectedTabRef.current = tab;
  }

  return (
    <div className="tab-pane active">
      <div className="d-flex align-items-center justify-content-between border-bottom pb-2">
        <div style={{ paddingLeft: "0.55rem", paddingRight: "0.55rem" }}>
          <abbr title={chrome.i18n.getMessage("tabLock_lockLabel")}>
            <i className="fas fa-lock" />
          </abbr>
        </div>
        <div
          className="dropdown"
          ref={(dropdown) => {
            dropdownRef.current = dropdown;
          }}
        >
          <button
            aria-haspopup="true"
            className="btn btn-outline-dark btn-sm"
            id="sort-dropdown"
            onClick={() => {
              setIsSortDropdownOpen(!isSortDropdownOpen);
            }}
            title={chrome.i18n.getMessage("corral_currentSort", currSorter.label())}
          >
            <span>{chrome.i18n.getMessage("corral_sortBy")}</span>
            <span> {currSorter.shortLabel()}</span> <i className="fas fa-caret-down" />
          </button>
          <div
            aria-labelledby="sort-dropdown"
            className={cx("dropdown-menu dropdown-menu-right shadow-sm", {
              show: isSortDropdownOpen,
            })}
          >
            {Sorters.map((sorter) => (
              <a
                className={cx("dropdown-item", { active: currSorter === sorter })}
                href="#"
                key={sorter.label()}
                onClick={(event: React.MouseEvent<HTMLElement>) => {
                  // The dropdown wraps items in bogus `<a href="#">` elements in order to match
                  // Bootstrap's style. Prevent default on the event in order to prevent scrolling
                  // to the top of the window (the default action for an empty anchor "#").
                  event.preventDefault();

                  if (sorter === currSorter) {
                    // If this is already the active sorter, close the dropdown and do no work since
                    // the state is already correct.
                    setIsSortDropdownOpen(false);
                  } else {
                    // When the saved sort order is not null then the user wants to preserve it.
                    // Update to the new sort order and persist it.
                    if (syncData != null) {
                      settings.set("lockTabSortOrder", sorter.key);
                    }

                    setIsSortDropdownOpen(false);
                    setCurrSorter(sorter);
                  }
                }}
              >
                {sorter.label()}
              </a>
            ))}
            <div className="dropdown-divider" />
            <form className="px-4 pb-1">
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
            </form>
          </div>
        </div>
      </div>
      <table className="table table-hover table-sm table-th-unbordered">
        <tbody>
          <UseNowContext.Provider value={now}>
            {sortedTabs.map((tab) => (
              <OpenTabRow
                isLocked={lockedTabIds.has(tab.id)}
                key={tab.id}
                onToggleTab={handleToggleTab}
                tab={tab}
              />
            ))}
          </UseNowContext.Provider>
        </tbody>
      </table>
    </div>
  );
}
