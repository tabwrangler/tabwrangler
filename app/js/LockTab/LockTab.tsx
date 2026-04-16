import "./LockTab.css";
import { Button, Dropdown, OverlayTrigger, Tooltip } from "react-bootstrap";
import { createContext, useEffect, useMemo, useRef, useState } from "react";
import { lockTabId, lockWindowId, unlockTabId, unlockWindowId } from "../storage";
import settings, { type LockTabSortOrderOption } from "../settings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStorageSyncPersistQuery, useStorageSyncQuery } from "../storage";
import OpenTabRow from "./OpenTabRow";
import cx from "classnames";
import useTabGroupsQuery from "../api/useTabGroupsQuery";
import useTabsQuery from "../api/useTabsQuery";
import useWindowsGetLastFocused from "../api/useWindowsGetLastFocused";

interface Sorter {
  key: LockTabSortOrderOption;
  label: () => string;
  shortLabel: () => string;
  sort: (
    a: chrome.tabs.Tab | null,
    b: chrome.tabs.Tab | null,
    tabTimes: {
      [tabid: string]: number;
    },
  ) => number;
}

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

interface TabSegmentTab {
  isFirstInGroup: boolean;
  tab: chrome.tabs.Tab;
}

type TabSegment =
  | { type: "ungrouped"; tabs: TabSegmentTab[] }
  | { type: "group"; groupId: number; tabs: TabSegmentTab[] };

function groupTabsIntoSegments(tabs: chrome.tabs.Tab[]): TabSegment[] {
  const segments: TabSegment[] = [];
  const seenGroupIds = new Set<number>();
  for (const tab of tabs) {
    const groupId = tab.groupId != null && tab.groupId > 0 ? tab.groupId : null;
    const last = segments[segments.length - 1];
    if (groupId != null && last?.type === "group" && last.groupId === groupId) {
      last.tabs.push({ isFirstInGroup: false, tab });
    } else if (groupId == null && last?.type === "ungrouped") {
      last.tabs.push({ isFirstInGroup: false, tab });
    } else {
      segments.push(
        groupId == null
          ? { type: "ungrouped", tabs: [{ isFirstInGroup: !seenGroupIds.has(tab.groupId), tab }] }
          : {
              type: "group",
              groupId,
              tabs: [{ isFirstInGroup: !seenGroupIds.has(tab.groupId), tab }],
            },
      );
    }
    if (groupId != null) seenGroupIds.add(groupId);
  }
  return segments;
}

const DEFAULT_SORTER = TabOrderSorter;
const Sorters = [
  TabOrderSorter,
  ReverseTabOrderSorter,
  AlphaSorter,
  ReverseAlphaSorter,
  ChronoSorter,
  ReverseChronoSorter,
];

export const UseNowContext = createContext(new Date().getTime());
function useNow() {
  const [now, setNow] = useState(new Date().getTime());
  const intervalRef = useRef<number>(null);
  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setNow(new Date().getTime());
    }, 1000);
    return () => {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);
  return now;
}

function useTabTimesQuery() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryFn: () => chrome.storage.local.get({ tabTimes: {} }),
    queryKey: ["tabTimesQuery"],
  });
  useEffect(() => {
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
  const now = useNow();
  const lastSelectedTabRef = useRef<chrome.tabs.Tab | null>(null);
  const [sortOrder, setSortOrder] = useState<string | null>(settings.get("lockTabSortOrder"));
  const lastFocusedWindowQuery = useWindowsGetLastFocused();

  const [currWindow, setCurrWindow] = useState<chrome.windows.Window>();
  useEffect(() => {
    async function getCurrentWindow() {
      const win = await chrome.windows.getCurrent({});
      setCurrWindow(win);
    }
    getCurrentWindow();
  }, []);

  const [currSorter, setCurrSorter] = useState(() => {
    let sorter = sortOrder == null ? DEFAULT_SORTER : Sorters.find((s) => s.key === sortOrder);
    // If settings somehow stores a bad value, always fall back to default order.
    if (sorter == null) sorter = DEFAULT_SORTER;
    return sorter;
  });

  const tabsQuery = useTabsQuery();
  const tabTimesQuery = useTabTimesQuery();
  const tabGroupsQuery = useTabGroupsQuery();
  const tabGroupsById = new Map((tabGroupsQuery.data ?? []).map((group) => [group.id, group]));

  const tabsByWindowId: Array<[number, chrome.tabs.Tab[]]> = useMemo(() => {
    const tabs =
      tabsQuery.data == null || tabTimesQuery.data == null
        ? []
        : tabsQuery.data
            .slice()
            .sort((tabA, tabB) => currSorter.sort(tabA, tabB, tabTimesQuery.data));
    const map = new Map<number, chrome.tabs.Tab[]>();
    tabs.forEach((tab) => {
      if (!map.has(tab.windowId)) map.set(tab.windowId, []);
      map.get(tab.windowId)?.push(tab);
    });

    const entries = Array.from(map.entries());
    return entries.sort(([a], [b]) => {
      if (a === currWindow?.id) return -1;
      if (b === currWindow?.id) return 1;
      return 0;
    });
  }, [currSorter, currWindow?.id, tabTimesQuery.data, tabsQuery.data]);

  const unlockedTabCount = tabsQuery.data?.filter((tab) => !settings.isTabLocked(tab)).length ?? 0;
  const { data: syncData } = useStorageSyncQuery();
  const lockedWindowIds: Set<number> = new Set(syncData?.lockedWindowIds ?? []);

  async function toggleWindow(windowId: number) {
    if (lockedWindowIds.has(windowId)) {
      await unlockWindowId(windowId);
    } else {
      await lockWindowId(windowId);
    }
  }

  async function toggleTab(
    windowId: number,
    tab: chrome.tabs.Tab,
    selected: boolean,
    multiselect: boolean,
  ) {
    let tabsToToggle = [tab];
    if (multiselect && lastSelectedTabRef.current != null) {
      const lastSelectedWindowIndex = tabsByWindowId.findIndex(([winId]) => winId === windowId);
      const tabs = tabsByWindowId[lastSelectedWindowIndex]?.[1];
      if (tabs != null) {
        const fromIndex = tabs.indexOf(lastSelectedTabRef.current);
        const toIndex = tabs.indexOf(tab);
        if (fromIndex !== -1 && toIndex !== -1) {
          tabsToToggle = tabs.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1);
        }
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

  const minTabs = settings.get("minTabs");
  const minTabsStrategy = settings.get("minTabsStrategy");
  const showMinTabsBadge = minTabsStrategy === "allWindows";

  return (
    <div className="tab-pane active">
      <div
        className={cx("d-flex align-items-center pb-2", {
          "justify-content-between": showMinTabsBadge,
          "justify-content-end": !showMinTabsBadge,
        })}
      >
        {showMinTabsBadge && (
          <MinimumTabsBadge
            minTabs={minTabs}
            minTabsStrategyState={{ minTabsStrategy }}
            unlockedTabCount={unlockedTabCount}
          />
        )}
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
      <div className="d-flex flex-column gap-4">
        <UseNowContext.Provider value={now}>
          {tabsByWindowId.map(([windowId, tabs]) => (
            <WindowCard
              isCurrent={currWindow?.id === windowId}
              isLocked={lockedWindowIds.has(windowId)}
              isLastFocused={lastFocusedWindowQuery.data?.id === windowId}
              key={windowId}
              windowId={windowId}
              tabGroupsById={tabGroupsById}
              tabs={tabs}
              tabTimes={tabTimesQuery.data}
              totalUnlockedTabCount={unlockedTabCount}
              onToggle={toggleWindow}
              onToggleTab={toggleTab}
            />
          ))}
        </UseNowContext.Provider>
      </div>
    </div>
  );
}

function WindowCard({
  isCurrent,
  isLocked,
  isLastFocused,
  windowId,
  tabGroupsById,
  tabs,
  tabTimes,
  totalUnlockedTabCount,
  onToggle,
  onToggleTab,
}: {
  isCurrent: boolean;
  isLocked: boolean;
  isLastFocused: boolean;
  windowId: number;
  tabGroupsById: Map<number, chrome.tabGroups.TabGroup>;
  tabs: chrome.tabs.Tab[];
  tabTimes: Record<number, number> | undefined;
  totalUnlockedTabCount: number;
  onToggle: (windowId: number) => void;
  onToggleTab: (
    windowId: number,
    tab: chrome.tabs.Tab,
    selected: boolean,
    multiselect: boolean,
  ) => void;
}) {
  const minTabs = settings.get("minTabs");
  const minTabsStrategy = settings.get("minTabsStrategy");
  const segments = groupTabsIntoSegments(tabs);
  const unlockedTabCount = tabs.filter((tab) => !settings.isTabLocked(tab)).length ?? 0;
  const relevantUnlockedCount =
    minTabsStrategy === "allWindows" ? totalUnlockedTabCount : unlockedTabCount;
  const tabsWillAutoClose = relevantUnlockedCount > minTabs;
  const tbodies = segments.map((segment, segIndex) => {
    return (
      <tbody key={segIndex}>
        {segment.tabs.map(({ tab, isFirstInGroup }) => (
          <OpenTabRow
            isFirstInGroup={segment.type === "group" && isFirstInGroup}
            isInLastFocusedWindow={isLastFocused}
            key={tab.id}
            tab={tab}
            tabGroup={segment.type === "group" ? tabGroupsById.get(segment.groupId) : undefined}
            tabTime={tabTimes == null || tab.id == null ? undefined : tabTimes[tab.id]}
            tabsWillAutoClose={tabsWillAutoClose}
            windowId={windowId}
            windowLocked={isLocked}
            onToggleTab={onToggleTab}
          />
        ))}
      </tbody>
    );
  });

  let thBgColor: string;
  if (isCurrent) {
    thBgColor = "bg-body-secondary";
  } else {
    thBgColor = "bg-body-tertiary";
  }

  return (
    <div className="border overflow-hidden rounded" key={windowId}>
      <table className="table table-hover table-sm mb-0">
        <thead>
          <tr>
            <th className={cx("p-2 align-middle", thBgColor)} colSpan={2}>
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <abbr title={`ID: ${windowId}`}>Window</abbr>
                </div>
                <div className="d-flex align-items-center gap-2">
                  {minTabsStrategy === "givenWindow" && (
                    <MinimumTabsBadge
                      minTabs={minTabs}
                      minTabsStrategyState={{ minTabsStrategy, isWindowLocked: isLocked }}
                      unlockedTabCount={unlockedTabCount}
                    />
                  )}
                  <Button
                    active={isLocked}
                    className="d-flex align-items-center gap-1"
                    // @ts-expect-error Need to expand size type to include "xs"
                    size="xs"
                    type="button"
                    variant="outline-secondary"
                    onClick={() => onToggle(windowId)}
                  >
                    {isLocked ? (
                      <>
                        Locked <i className="fas fa-lock" />
                      </>
                    ) : (
                      <>
                        Unlocked <i className="fas fa-unlock" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </th>
          </tr>
        </thead>
        {tbodies}
      </table>
    </div>
  );
}

type MinTabsStrategyState =
  | {
      minTabsStrategy: "allWindows";
    }
  | { minTabsStrategy: "givenWindow"; isWindowLocked: boolean };

function MinimumTabsBadge({
  minTabs,
  minTabsStrategyState,
  unlockedTabCount,
}: {
  minTabs: number;
  minTabsStrategyState: MinTabsStrategyState;
  unlockedTabCount: number;
}) {
  const { data: syncPersistData } = useStorageSyncPersistQuery();
  const paused = syncPersistData?.paused ?? false;
  const tabsWillAutoClose = unlockedTabCount > minTabs;

  let tooltipMessage;
  if (paused) {
    tooltipMessage = chrome.i18n.getMessage("tabLock_minTabsBadge_paused");
  } else {
    switch (minTabsStrategyState.minTabsStrategy) {
      case "allWindows":
        tooltipMessage = chrome.i18n.getMessage(
          tabsWillAutoClose
            ? "tabLock_minTabsBadge_allWindows_aboveMin"
            : "tabLock_minTabsBadge_allWindows_belowMin",
        );
        break;
      case "givenWindow":
        if (minTabsStrategyState.isWindowLocked) {
          tooltipMessage = chrome.i18n.getMessage("tabLock_minTabsBadge_givenWindow_locked");
        } else {
          tooltipMessage = chrome.i18n.getMessage(
            tabsWillAutoClose
              ? "tabLock_minTabsBadge_givenWindow_aboveMin"
              : "tabLock_minTabsBadge_givenWindow_belowMin",
          );
        }
        break;
      default:
        minTabsStrategyState satisfies never;
    }
  }

  let badgeClassName;
  let badgeIconClassName;
  if (paused) {
    badgeClassName = "text-bg-secondary";
    badgeIconClassName = "fa-hourglass";
  } else if (
    minTabsStrategyState.minTabsStrategy === "givenWindow" &&
    minTabsStrategyState.isWindowLocked
  ) {
    badgeClassName = "text-bg-secondary";
    badgeIconClassName = "fa-hourglass";
  } else if (tabsWillAutoClose) {
    badgeClassName = "text-bg-secondary";
    badgeIconClassName = "fa-check";
  } else {
    badgeClassName = "text-bg-warning";
    badgeIconClassName = "fa-hourglass";
  }

  return (
    <OverlayTrigger overlay={<Tooltip>{tooltipMessage}</Tooltip>}>
      <span className={cx("badge rounded-pill", badgeClassName)}>
        <span className={`fas ${badgeIconClassName}`} />{" "}
        {chrome.i18n.getMessage("tabLock_minTabsStatus", [
          unlockedTabCount.toLocaleString(),
          minTabs.toLocaleString(),
        ])}
      </span>
    </OverlayTrigger>
  );
}
