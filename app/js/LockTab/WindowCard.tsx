import { type FadeInHandle, type TabRowHandle, fadeIn } from "./rowAnimations";
import TabGroupIndicator, { getTabGroupColor, getTabGroupTitle } from "./TabGroupIndicator";
import { useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { Button } from "react-bootstrap";
import MinimumTabsBadge from "./MinimumTabsBadge";
import OpenTabRow from "./OpenTabRow";
import { TabTimes } from "../types";
import cx from "classnames";
import { prefersReducedMotion } from "../util";
import settings from "../settings";
import { useGetTabLockStatus } from "../useTabLockStatus";

interface WindowCardProps {
  // Present only when groups can be collapsed, which requires the tabs to be in tab order
  collapsedGroupIds?: Set<number>;
  isCurrent: boolean;
  isLocked: boolean;
  isLastFocused: boolean;
  windowId: number;
  tabGroupsById: Map<number, chrome.tabGroups.TabGroup>;
  tabs: chrome.tabs.Tab[];
  tabTimes: TabTimes | undefined;
  totalUnlockedTabCount: number;
  onToggle: (windowId: number) => void;
  onToggleGroupCollapsed: (groupId: number) => void;
  onToggleTab: (
    windowId: number,
    tab: chrome.tabs.Tab,
    selected: boolean,
    multiselect: boolean,
  ) => void;
}

export default function WindowCard({
  collapsedGroupIds,
  isCurrent,
  isLocked,
  isLastFocused,
  windowId,
  tabGroupsById,
  tabs,
  tabTimes,
  totalUnlockedTabCount,
  onToggle,
  onToggleGroupCollapsed,
  onToggleTab,
}: WindowCardProps) {
  const minTabs = settings.get("minTabs");
  const minTabsStrategy = settings.get("minTabsStrategy");
  const segments = useMemo(() => groupTabsIntoSegments(tabs), [tabs]);
  const getTabLockStatus = useGetTabLockStatus();
  const unlockedTabCount = tabs.filter((tab) => !getTabLockStatus(tab).locked).length ?? 0;
  const relevantUnlockedCount =
    minTabsStrategy === "allWindows" ? totalUnlockedTabCount : unlockedTabCount;
  const tabsWillAutoClose = relevantUnlockedCount > minTabs;
  const tabRowRefs = useRef(new Map<number, TabRowHandle>());
  const collapsedRowRefs = useRef(new Map<number, FadeInHandle>());
  const collapsingRef = useRef(new Set<number>());
  const toggledGroupIdRef = useRef<number | null>(null);

  // Grows a just-expanded group's rows open, or fades in a just-collapsed group's summary.
  useLayoutEffect(() => {
    const groupId = toggledGroupIdRef.current;
    if (groupId == null) return;
    toggledGroupIdRef.current = null;
    if (prefersReducedMotion()) return;
    if (collapsedGroupIds?.has(groupId)) {
      collapsedRowRefs.current.get(groupId)?.fadeIn();
      return;
    }
    const [firstRow, ...otherRows] = getGroupTabRows(segments, tabRowRefs.current, groupId);
    firstRow?.fadeIn();
    firstRow?.rotateChevron("expand");
    otherRows.forEach((row) => row.animateHeight("expand"));
  }, [collapsedGroupIds, segments]);

  async function toggleGroupCollapsed(groupId: number) {
    if (collapsingRef.current.has(groupId)) return;
    if (!collapsedGroupIds?.has(groupId) && !prefersReducedMotion()) {
      collapsingRef.current.add(groupId);
      const [firstRow, ...otherRows] = getGroupTabRows(segments, tabRowRefs.current, groupId);
      firstRow?.rotateChevron("collapse");
      await Promise.all(otherRows.map((row) => row.animateHeight("collapse")));
      collapsingRef.current.delete(groupId);
    }
    toggledGroupIdRef.current = groupId;
    onToggleGroupCollapsed(groupId);
  }

  const tbodies = segments.map((segment, segIndex) => {
    const groupId = segment.type === "group" ? segment.groupId : null;
    const tabGroup = groupId == null ? undefined : tabGroupsById.get(groupId);
    const collapsible = groupId != null && collapsedGroupIds != null;

    if (collapsible && collapsedGroupIds.has(groupId)) {
      return (
        <tbody key={segIndex}>
          <CollapsedTabGroupRow
            ref={(handle) => {
              if (handle == null) collapsedRowRefs.current.delete(groupId);
              else collapsedRowRefs.current.set(groupId, handle);
            }}
            tabCount={segment.tabs.length}
            tabGroup={tabGroup}
            onExpand={() => toggleGroupCollapsed(groupId)}
          />
        </tbody>
      );
    }

    return (
      <tbody key={segIndex}>
        {segment.tabs.map(({ tab, isFirstInGroup }) => (
          <OpenTabRow
            isFirstInGroup={groupId != null && isFirstInGroup}
            isInLastFocusedWindow={isLastFocused}
            key={tab.id}
            ref={(handle) => {
              if (tab.id == null) return;
              if (handle == null) tabRowRefs.current.delete(tab.id);
              else tabRowRefs.current.set(tab.id, handle);
            }}
            tab={tab}
            tabGroup={tabGroup}
            tabTime={tabTimes == null || tab.id == null ? undefined : tabTimes[tab.id]}
            tabsWillAutoClose={tabsWillAutoClose}
            windowId={windowId}
            windowLocked={isLocked}
            onCollapseGroup={collapsible ? () => toggleGroupCollapsed(groupId) : undefined}
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

function CollapsedTabGroupRow({
  ref,
  tabCount,
  tabGroup,
  onExpand,
}: {
  ref?: React.Ref<FadeInHandle>;
  tabCount: number;
  tabGroup: chrome.tabGroups.TabGroup | undefined;
  onExpand: () => void;
}) {
  const title = getTabGroupTitle(tabGroup);
  const summaryRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({ fadeIn: () => fadeIn([summaryRef.current]) }));
  return (
    <tr>
      <td
        className="ps-2 pe-2"
        colSpan={2}
        style={{ paddingBottom: "4px", paddingTop: "4px", position: "relative" }}
      >
        <div
          className="OpenTabRow-group-border"
          style={{ backgroundColor: getTabGroupColor(tabGroup) }}
        />
        <div className="d-flex align-items-center gap-2 ps-1">
          <TabGroupIndicator collapsed tabGroup={tabGroup} onToggleCollapsed={onExpand} />
          <div
            className="flex-fill d-grid"
            ref={summaryRef}
            style={{ lineHeight: "1.3", width: "1px" }}
          >
            {/* Reserves the height of a tab row's title and URL lines so both rows match */}
            <div aria-hidden className="invisible" style={{ gridArea: "1 / 1" }}>
              &nbsp;
              <br />
              <small>&nbsp;</small>
            </div>
            <div className="align-self-center text-truncate" style={{ gridArea: "1 / 1" }}>
              {tabCount === 1
                ? chrome.i18n.getMessage("tabLock_collapsedGroup_summary_one", title)
                : chrome.i18n.getMessage("tabLock_collapsedGroup_summary", [
                    title,
                    String(tabCount),
                  ])}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function getGroupTabRows(
  segments: TabSegment[],
  tabRows: Map<number, TabRowHandle>,
  groupId: number,
): TabRowHandle[] {
  const segment = segments.find((s) => s.type === "group" && s.groupId === groupId);
  return (segment?.tabs ?? []).flatMap(({ tab }) => {
    const row = tab.id == null ? undefined : tabRows.get(tab.id);
    return row == null ? [] : [row];
  });
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
