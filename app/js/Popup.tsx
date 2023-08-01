import * as React from "react";
import { AppState, Dispatch } from "./Types";
import NavBar, { NavBarTabID } from "./NavBar";
import { clearTempStorage, fetchSessions } from "./actions/tempStorageActions";
import { useDispatch, useSelector } from "react-redux";
import AboutTab from "./AboutTab";
import CorralTab from "./CorralTab";
import LockTab from "./LockTab";
import OptionsTab from "./OptionsTab";
import { register } from "timeago.js";
import timeagoLocale from "./timeagoLocale";

export default function Popup() {
  const [activeTabId, setActiveTabId] = React.useState<NavBarTabID>("corral");
  const dispatch = useDispatch<Dispatch>();
  const theme = useSelector((state: AppState) => state.settings.theme);

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
    body.classList.toggle("theme-dark", theme === "dark");
    body.classList.toggle("theme-light", theme === "light");
  }, [theme]);

  React.useEffect(() => {
    function updateSessionsRecentlyClosed() {
      dispatch(fetchSessions());
    }

    chrome.sessions.onChanged.addListener(updateSessionsRecentlyClosed);
    updateSessionsRecentlyClosed();

    return () => {
      chrome.sessions.onChanged.removeListener(updateSessionsRecentlyClosed);
    };
  }, [dispatch]);

  React.useEffect(() => {
    return () => {
      // Ensure the temp storage is cleared when the popup is closed to prevent holding references
      // to objects that may be cleaned up. In Firefox, this can lead to ["DeadObject" errors][1],
      // which throw exceptions and prevent the popup from displaying.
      dispatch(clearTempStorage());
    };
  }, [dispatch]);

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

// [1]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Dead_object
