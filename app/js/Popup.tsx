import NavBar, { NavBarTabID } from "./NavBar";
import AboutTab from "./AboutTab";
import CorralTab from "./CorralTab";
import LockTab from "./LockTab";
import OptionsTab from "./OptionsTab";
import React from "react";
import { register } from "timeago.js";
import timeagoLocale from "./timeagoLocale";
import { useStorageSyncPersistQuery } from "./hooks";

export default function Popup() {
  const { data: settingsData } = useStorageSyncPersistQuery();

  React.useEffect(() => {
    // Configure Timeago to use the current UI language of the browser.
    const uiLanguage = chrome.i18n.getUILanguage();
    register(uiLanguage, timeagoLocale[uiLanguage]);
  }, []);

  // Enable overriding the color theme by applying a classname to the `body`. React does not own the
  // `<body>` tag, so instead toggle classes on it as needed.
  React.useEffect(() => {
    const body = document.body;
    if (body == null) return;
    body.classList.toggle("theme-dark", settingsData?.theme === "dark");
    body.classList.toggle("theme-light", settingsData?.theme === "light");
  }, [settingsData?.theme]);

  const [activeTabId, setActiveTabId] = React.useState<NavBarTabID>("corral");
  let activeTab;
  switch (activeTabId) {
    case "about":
      activeTab = <AboutTab />;
      break;
    case "corral":
      activeTab = <CorralTab />;
      break;
    case "lock":
      activeTab = <LockTab />;
      break;
    case "options":
      activeTab = <OptionsTab />;
      break;
  }

  return (
    <>
      <NavBar activeTabId={activeTabId} onClickTab={setActiveTabId} />
      <div className="tab-content container-fluid">{activeTab}</div>
    </>
  );
}
