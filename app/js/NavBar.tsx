import "./NavBar.css";
import * as React from "react";
import PauseButton from "./PauseButton";
import cx from "classnames";

export type NavBarTabID = "about" | "corral" | "lock" | "options";

type Props = {
  activeTabId: NavBarTabID;
  isOptionsPage: boolean;
  onClickTab: (tabId: NavBarTabID) => void;
};

export default function NavBar({ activeTabId, isOptionsPage, onClickTab }: Props) {
  return (
    <>
      <div className="nav-bar--buttons">
        <PauseButton />
      </div>
      <ul className="nav nav-tabs">
        <li className="nav-item">
          <a
            className={cx("nav-link", { active: activeTabId === "corral" })}
            href="#corral"
            onClick={(event) => {
              event.preventDefault();
              onClickTab("corral");
            }}
          >
            {chrome.i18n.getMessage("tabCorral_name")}
          </a>
        </li>
        <li className="nav-item">
          <a
            className={cx("nav-link", { active: activeTabId === "lock" })}
            href="#lock"
            onClick={(event) => {
              event.preventDefault();
              onClickTab("lock");
            }}
          >
            {chrome.i18n.getMessage("tabLock_name")}
          </a>
        </li>
        {isOptionsPage ? (
          <>
            <li className="nav-item">
              <a
                className={cx("nav-link", { active: activeTabId === "options" })}
                href="#options"
                onClick={(event) => {
                  event.preventDefault();
                  onClickTab("options");
                }}
              >
                {chrome.i18n.getMessage("options_name")}
              </a>
            </li>
            <li className="nav-item">
              <a
                className={cx("nav-link", { active: activeTabId === "about" })}
                href="#about"
                onClick={(event) => {
                  event.preventDefault();
                  onClickTab("about");
                }}
              >
                {chrome.i18n.getMessage("about_name")}
              </a>
            </li>
          </>
        ) : (
          <li className="nav-item">
            <a
              className="nav-link"
              href="#options"
              onClick={(event) => {
                event.preventDefault();
                chrome.runtime.openOptionsPage();
                window.close();
              }}
              title={chrome.i18n.getMessage("options_name")}
            >
              <i className="fas fa-cogs" />
            </a>
          </li>
        )}
      </ul>
    </>
  );
}
