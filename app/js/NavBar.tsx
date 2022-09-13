import "./NavBar.css";
import * as React from "react";
import PauseButton from "./PauseButton";
import cx from "classnames";

export type NavBarTabID = "about" | "corral" | "lock" | "options";

type Props = {
  activeTabId: NavBarTabID;
  onClickTab: (tabId: NavBarTabID) => void;
};

export default function NavBar(props: Props) {
  function handleClickAboutTab(event: React.MouseEvent) {
    event.preventDefault();
    props.onClickTab("about");
  }

  function handleClickCorralTab(event: React.MouseEvent) {
    event.preventDefault();
    props.onClickTab("corral");
  }

  function handleClickLockTab(event: React.MouseEvent) {
    event.preventDefault();
    props.onClickTab("lock");
  }

  function handleClickOptionsTab(event: React.MouseEvent) {
    event.preventDefault();
    props.onClickTab("options");
  }

  return (
    <>
      <div className="nav-bar--buttons">
        <PauseButton />
      </div>
      <ul className="nav nav-tabs">
        <li className="nav-item">
          <a
            className={cx("nav-link", { active: props.activeTabId === "corral" })}
            href="#corral"
            onClick={handleClickCorralTab}
          >
            {chrome.i18n.getMessage("tabCorral_name")}
          </a>
        </li>
        <li className="nav-item">
          <a
            className={cx("nav-link", { active: props.activeTabId === "lock" })}
            href="#lock"
            onClick={handleClickLockTab}
          >
            {chrome.i18n.getMessage("tabLock_name")}
          </a>
        </li>
        <li className="nav-item">
          <a
            className={cx("nav-link", { active: props.activeTabId === "options" })}
            href="#options"
            onClick={handleClickOptionsTab}
          >
            {chrome.i18n.getMessage("options_name")}
          </a>
        </li>
        <li className="nav-item">
          <a
            className={cx("nav-link", { active: props.activeTabId === "about" })}
            href="#about"
            onClick={handleClickAboutTab}
          >
            {chrome.i18n.getMessage("about_name")}
          </a>
        </li>
      </ul>
    </>
  );
}
