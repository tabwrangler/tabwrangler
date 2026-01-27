import "./CorralTabRow.css";
import * as React from "react";
import LazyImage from "../LazyImage";
import TimeAgo from "timeago-react";
import cx from "classnames";
import { extractHostname } from "../util";

interface ClosedTabRowProps {
  index: number;
  isSelected: boolean;
  session: chrome.sessions.Session | null;
  style: Record<string, unknown>;
  tab: chrome.tabs.Tab;
  onOpenTab: (tab: chrome.tabs.Tab, index: number, session: chrome.sessions.Session | null) => void;
  onRemoveTab: (tab: chrome.tabs.Tab, index: number) => void;
  onToggleTab: (
    tab: chrome.tabs.Tab,
    index: number,
    selected: boolean,
    multiselect: boolean,
  ) => void;
}

export default function ClosedTabRow({
  index,
  isSelected,
  session,
  style,
  tab,
  onOpenTab,
  onRemoveTab,
  onToggleTab,
}: ClosedTabRowProps) {
  return (
    <div
      aria-label="row"
      className={cx("ReactVirtualized__Table__row", { "table-warning": isSelected })}
      role="row"
      style={style}
    >
      <div className="ReactVirtualized__Table__rowColumn" style={{ verticalAlign: "middle" }}>
        <input
          checked={isSelected}
          className="checkbox--td"
          onClick={(event: React.MouseEvent) => {
            // Dynamic type check to ensure target is an input element.
            if (!(event.target instanceof HTMLInputElement)) return;
            onToggleTab(tab, index, event.target.checked, event.shiftKey);
          }}
          type="checkbox"
          readOnly
        />
      </div>
      <div
        className="faviconCol ReactVirtualized__Table__rowColumn"
        style={{ verticalAlign: "middle" }}
      >
        <LazyImage
          alt=""
          className="faviconCol--hover-hidden favicon"
          height={16}
          src={tab.favIconUrl ?? ""}
          width={16}
        />
        <span
          className="faviconCol--hover-shown"
          onClick={() => {
            onRemoveTab(tab, index);
          }}
          role="button"
          style={{ cursor: "pointer", height: 16, width: 16 }}
          tabIndex={0}
          title="Remove this tab"
        >
          <i className="fas fa-trash-alt" />
        </span>
      </div>
      <div className="ReactVirtualized__Table__rowColumn py-1" style={{ flex: 1 }}>
        <div style={{ display: "flex" }}>
          <div className="CorralTabRow-content">
            <a
              href={tab.url}
              onClick={(event: React.MouseEvent) => {
                event.preventDefault();
                onOpenTab(tab, index, session);
              }}
              rel="noopener noreferrer"
              style={{ flex: 1 }}
              target="_blank"
              title={tab.url}
            >
              {tab.title}
            </a>
            <br />
            <small className={cx({ "text-muted": !isSelected })}>
              ({tab.url == null ? "???" : extractHostname(tab.url)})
            </small>
          </div>
        </div>
      </div>
      <div
        className="ReactVirtualized__Table__rowColumn text-right"
        style={{ verticalAlign: "middle" }}
        title={
          // @ts-expect-error `closedAt` is a TW expando property on tabs
          new Date(tab.closedAt).toLocaleString()
        }
      >
        {/* @ts-expect-error `closedAt` is a TW expando property on tabs */}
        <TimeAgo datetime={tab.closedAt} locale={chrome.i18n.getUILanguage()} />
      </div>
      <div className="ReactVirtualized__Table__rowColumn" style={{ width: "11px" }}>
        {session == null ? null : (
          <abbr title={chrome.i18n.getMessage("corral_tabSessionFresh")}>
            <i className="fas fa-leaf text-success" />
          </abbr>
        )}
      </div>
    </div>
  );
}
