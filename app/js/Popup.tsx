import NavBar, { NavBarTabID } from "./NavBar";
import AboutTab from "./AboutTab";
import CorralTab from "./CorralTab";
import LockTab from "./LockTab";
import OptionsTab from "./OptionsTab";
import React from "react";
import { register } from "timeago.js";
import timeagoLocale from "./timeagoLocale";
import { useStorageSyncPersistQuery } from "./storage";

export default function Popup() {
  const { data: storageSyncPersistData } = useStorageSyncPersistQuery();

  React.useEffect(() => {
    // Configure Timeago to use the current UI language of the browser.
    const uiLanguage = chrome.i18n.getUILanguage();
    register(uiLanguage, timeagoLocale[uiLanguage]);
  }, []);

  // Apply a color theme to <html> using [Bootstrap's Color Mode][0]. The applied data attribute
  // must be named `data-bs-theme` and match either "light" or "dark".
  //
  // [0]: https://getbootstrap.com/docs/5.3/customize/color-modes/
  React.useEffect(() => {
    function setTheme(prefersDark: boolean) {
      const storedTheme = storageSyncPersistData?.theme;

      let theme;
      if (storedTheme != null && storedTheme !== "system") {
        theme = storedTheme;
      } else {
        theme = prefersDark ? "dark" : "light";
      }

      if (theme === "light" || theme === "dark")
        document.documentElement.setAttribute("data-bs-theme", theme);
      else document.documentElement.removeAttribute("data-bs-theme");
    }

    function handlePrefersDarkChange(event: MediaQueryListEvent) {
      setTheme(event.matches);
    }

    // Check current color scheme preference and listen for changes.
    const prefersDarkQL = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(prefersDarkQL.matches);
    prefersDarkQL.addEventListener("change", handlePrefersDarkChange);
    return () => {
      prefersDarkQL.removeEventListener("change", handlePrefersDarkChange);
    };
  }, [storageSyncPersistData?.theme]);

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
