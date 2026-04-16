import { Button } from "react-bootstrap";
import MinimumTabsBadge from "./MinimumTabsBadge";
import OpenTabRow from "./OpenTabRow";
import cx from "classnames";
import settings from "../settings";

interface WindowCardProps {
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
}

export default function WindowCard({
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
}: WindowCardProps) {
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
                        {chrome.i18n.getMessage("tabLock_locked")} <i className="fas fa-lock" />
                      </>
                    ) : (
                      <>
                        {chrome.i18n.getMessage("tabLock_unlocked")} <i className="fas fa-unlock" />
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
