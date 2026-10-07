import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { type WrangleNowSettings, findTabsToWrangleNow } from "./tabUtil";
import Button from "react-bootstrap/Button";
import Toast from "react-bootstrap/Toast";
import { ToastPortal } from "./ToastPortal";
import useSetting from "./useSetting";
import { useState } from "react";
import useTabTimesQuery from "./api/useTabTimesQuery";
import useTabsQuery from "./api/useTabsQuery";
import { useUndo } from "./UndoContext";
import useWindowsGetLastFocused from "./api/useWindowsGetLastFocused";

export default function WrangleNowButton() {
  const { discardLastAction, isProcessing, lastAction, undo, wrangleNow } = useUndo();
  const tabsQuery = useTabsQuery();
  const tabTimesQuery = useTabTimesQuery();
  const [isWrangling, setIsWrangling] = useState(false);

  const wrangleNowSettings: WrangleNowSettings = {
    filterAudio: useSetting("filterAudio"),
    filterGroupedTabs: useSetting("filterGroupedTabs"),
    lockedIds: useSetting("lockedIds"),
    lockedWindowIds: useSetting("lockedWindowIds"),
    minTabs: useSetting("minTabs"),
    minTabsStrategy: useSetting("minTabsStrategy"),
    stayOpenMs: useSetting("minutesInactive") * 60_000 + useSetting("secondsInactive") * 1000,
    tabRules: useSetting("tabRules"),
    whitelist: useSetting("whitelist"),
  };

  const lastFocusedWindowId = useWindowsGetLastFocused().data?.id;
  const activeTabId = tabsQuery.data?.find(
    (tab) => tab.active && tab.windowId === lastFocusedWindowId,
  )?.id;
  const tabsToWrangle =
    tabsQuery.data == null || tabTimesQuery.data == null
      ? []
      : findTabsToWrangleNow(tabTimesQuery.data, tabsQuery.data, activeTabId, wrangleNowSettings);

  async function handleClick() {
    setIsWrangling(true);
    try {
      await wrangleNow();
    } finally {
      setIsWrangling(false);
    }
  }

  let tooltipMessage;
  if (tabsToWrangle.length === 0) {
    tooltipMessage = chrome.i18n.getMessage(
      wrangleNowSettings.minTabsStrategy === "allWindows"
        ? "extension_wrangleNow_title_none_allWindows"
        : "extension_wrangleNow_title_none_givenWindow",
      String(wrangleNowSettings.minTabs),
    );
  } else {
    tooltipMessage = chrome.i18n.getMessage("extension_wrangleNow_title", [
      String(tabsToWrangle.length),
    ]);
  }

  return (
    <>
      <OverlayTrigger
        overlay={<Tooltip className="lh-sm">{tooltipMessage}</Tooltip>}
        placement="bottom"
      >
        {/* Wrapper keeps the tooltip working while the button is disabled. */}
        <span className="d-inline-block">
          <Button
            disabled={isWrangling || tabsToWrangle.length === 0}
            onClick={handleClick}
            size="sm"
            style={tabsToWrangle.length === 0 ? { pointerEvents: "none" } : undefined}
            type="button"
            variant="secondary"
          >
            {chrome.i18n.getMessage("extension_wrangleNow")}
            {tabsToWrangle.length > 0 ? (
              <span className="badge text-bg-light ms-2">{tabsToWrangle.length}</span>
            ) : null}
          </Button>
        </span>
      </OverlayTrigger>
      <ToastPortal>
        <Toast
          autohide
          bg="primary"
          delay={8000}
          onClose={() => {
            discardLastAction("wrangle");
          }}
          show={lastAction?.type === "wrangle"}
        >
          <Toast.Body className="d-flex align-items-center justify-content-between text-light">
            {chrome.i18n.getMessage("extension_wrangleNow_done", String(lastAction?.tabCount))}
            <Button disabled={isProcessing} onClick={undo} type="button" variant="outline-light">
              <i className="fas fa-undo" /> {chrome.i18n.getMessage("corral_undo")}
            </Button>
          </Toast.Body>
        </Toast>
      </ToastPortal>
    </>
  );
}
