import * as React from "react";
import { isLocked, isManuallyLockable } from "./tab";
import { AppState } from "./Types";
import LazyImage from "./LazyImage";
import cx from "classnames";
import { getTW } from "./util";
import { useSelector } from "react-redux";

function secondsToMinutes(seconds: number) {
  const minutes = seconds % 60;
  const minutesString = minutes >= 10 ? String(minutes) : `0${String(minutes)}`;
  return `${String(Math.floor(seconds / 60))}:${minutesString}`;
}

type Props = {
  onToggleTab: (tab: chrome.tabs.Tab, selected: boolean, multiselect: boolean) => void;
  tab: chrome.tabs.Tab;
};

export default function OpenTabRow(props: Props) {
  const paused = useSelector((state: AppState) => state.settings.paused);

  function handleLockedOnClick(event: React.MouseEvent) {
    // Dynamic type check to ensure target is an input element.
    if (!(event.target instanceof HTMLInputElement)) return;
    props.onToggleTab(props.tab, event.target.checked, event.shiftKey);
  }

  const { tab } = props;
  const tabWhitelistMatch = getTW().tabmanager.getWhitelistMatch(tab.url);
  const tabIsLocked = isLocked(tab);

  let lockStatusElement;
  if (tabIsLocked) {
    let reason;
    if (tab.pinned) {
      reason = chrome.i18n.getMessage("tabLock_lockedReason_pinned");
    } else if (getTW().settings.get("filterAudio") && tab.audible) {
      reason = <abbr title={chrome.i18n.getMessage("tabLock_lockedReason_audible")}>Locked</abbr>;
    } else if (getTW().settings.get("filterGroupedTabs") && "groupId" in tab && tab.groupId > 0) {
      reason = chrome.i18n.getMessage("tabLock_lockedReason_group");
    } else if (tabWhitelistMatch) {
      if (!getTW().settings.get("invertWhitelist"))
        reason = (
          <abbr title={chrome.i18n.getMessage("tabLock_lockedReason_matches", tabWhitelistMatch)}>
            Auto-Locked
          </abbr>
        );
      else
        reason = (
          <abbr title={chrome.i18n.getMessage("tabLock_lockedReason_noMatches")}>Auto-Locked</abbr>
        );
    } else {
      reason = chrome.i18n.getMessage("tabLock_lockedReason_locked");
    }

    lockStatusElement = (
      <td className="text-center muted" style={{ verticalAlign: "middle" }}>
        {reason}
      </td>
    );
  } else {
    let timeLeftContent;
    if (paused) {
      timeLeftContent = chrome.i18n.getMessage("tabLock_lockedReason_paused");
    } else {
      const lastModified = tab.id == null ? Date.now() : getTW().tabmanager.tabTimes[tab.id];
      const cutOff = new Date().getTime() - getTW().settings.get<number>("stayOpen");
      const timeLeft = -1 * Math.round((cutOff - lastModified) / 1000);
      // If `timeLeft` is less than 0, the countdown likely continued and is waiting for the
      // interval to clean up this tab. It's also possible the number of tabs is not below
      // `minTabs`, which has stopped the countdown and locked this at a negative `timeLeft` until
      // another tab is opened to jump start the countdown again.
      timeLeftContent = timeLeft < 0 ? "..." : secondsToMinutes(timeLeft);
    }

    lockStatusElement = (
      <td className="text-center" style={{ verticalAlign: "middle" }}>
        {timeLeftContent}
      </td>
    );
  }

  return (
    <tr className={cx({ "table-warning": tabIsLocked })}>
      <td className="text-center" style={{ verticalAlign: "middle", width: "1px" }}>
        <input
          checked={tabIsLocked}
          className="mx-1"
          disabled={!isManuallyLockable(tab)}
          onClick={handleLockedOnClick}
          type="checkbox"
          readOnly
        />
      </td>
      <td className="text-center" style={{ verticalAlign: "middle", width: "32px" }}>
        <LazyImage
          alt=""
          height={16}
          src={tab.favIconUrl ?? ""}
          style={{ height: "16px", maxWidth: "none" }}
          width={16}
        />
      </td>
      <td style={{ paddingBottom: "4px", paddingTop: "4px", width: "75%" }}>
        <div className="d-flex" style={{ lineHeight: "1.3" }}>
          <div className="flex-fill text-truncate" style={{ width: "1px" }}>
            {tab.title}
            <br />
            <small className={cx({ "text-muted": !tabIsLocked })}>({tab.url})</small>
          </div>
        </div>
      </td>
      {lockStatusElement}
    </tr>
  );
}
