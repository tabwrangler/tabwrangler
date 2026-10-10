import { OverlayTrigger, Tooltip } from "react-bootstrap";
import cx from "classnames";

export function getTabGroupColor(tabGroup: chrome.tabGroups.TabGroup | undefined): string {
  return tabGroup?.color != null
    ? `var(--tw-tab-group-color-${tabGroup.color})`
    : "var(--bs-primary)";
}

export function getTabGroupTitle(tabGroup: chrome.tabGroups.TabGroup | undefined): string {
  return tabGroup?.title || chrome.i18n.getMessage("tabLock_groupIndicator_unnamed");
}

interface TabGroupIndicatorProps {
  chevronRef?: React.Ref<HTMLElement>;
  collapsed?: boolean;
  tabGroup: chrome.tabGroups.TabGroup | undefined;
  onToggleCollapsed?: () => void;
}

export default function TabGroupIndicator({
  chevronRef,
  collapsed = false,
  tabGroup,
  onToggleCollapsed,
}: TabGroupIndicatorProps) {
  const title = getTabGroupTitle(tabGroup);
  const style = { backgroundColor: getTabGroupColor(tabGroup) };
  const indicator =
    onToggleCollapsed == null ? (
      <div className="OpenTabRow-group-indicator flex-shrink-0" style={style} />
    ) : (
      <button
        aria-expanded={!collapsed}
        aria-label={title}
        className={cx("OpenTabRow-group-indicator flex-shrink-0", {
          "OpenTabRow-group-indicator-collapsed": collapsed,
        })}
        style={style}
        type="button"
        onClick={onToggleCollapsed}
      >
        <i className="fas fa-chevron-down" ref={chevronRef} />
      </button>
    );

  // A collapsed group's title is already shown next to the indicator
  return collapsed ? (
    indicator
  ) : (
    <OverlayTrigger overlay={<Tooltip>{title}</Tooltip>}>{indicator}</OverlayTrigger>
  );
}
