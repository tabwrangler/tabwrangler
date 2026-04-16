import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { useStorageSyncPersistQuery } from "../storage";

type MinTabsStrategyState =
  | {
      minTabsStrategy: "allWindows";
    }
  | { minTabsStrategy: "givenWindow"; isWindowLocked: boolean };

interface MinimumTabsBadgeProps {
  minTabs: number;
  minTabsStrategyState: MinTabsStrategyState;
  unlockedTabCount: number;
}

export default function MinimumTabsBadge({
  minTabs,
  minTabsStrategyState,
  unlockedTabCount,
}: MinimumTabsBadgeProps) {
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

  let badgeIconClassName;
  if (paused) {
    badgeIconClassName = "fa-hourglass";
  } else if (
    minTabsStrategyState.minTabsStrategy === "givenWindow" &&
    minTabsStrategyState.isWindowLocked
  ) {
    badgeIconClassName = "fa-hourglass";
  } else if (tabsWillAutoClose) {
    badgeIconClassName = "fa-check";
  } else {
    badgeIconClassName = "fa-hourglass text-warning";
  }

  return (
    <OverlayTrigger overlay={<Tooltip>{tooltipMessage}</Tooltip>}>
      <span className="badge rounded-pill text-bg-secondary">
        <span className={`fas ${badgeIconClassName}`} />{" "}
        {chrome.i18n.getMessage("tabLock_minTabsStatus", [
          unlockedTabCount.toLocaleString(),
          minTabs.toLocaleString(),
        ])}
      </span>
    </OverlayTrigger>
  );
}
