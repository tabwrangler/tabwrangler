import NavBar, { NavBarTabID } from "./NavBar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AboutTab from "./AboutTab";
import CorralTab from "./CorralTab";
import LockTab from "./LockTab";
import OptionsTab from "./OptionsTab";
import React from "react";
import { register } from "timeago.js";
import timeagoLocale from "./timeagoLocale";

export default function Popup() {
  const { data: settingsData } = useQuery({
    queryFn: async () => {
      // `settings` was managed by redux-persit, which prefixed the data with "persist:"
      const data = await chrome.storage.sync.get({ "persist:settings": {} });
      return data["persist:settings"];
    },
    queryKey: ["settingsDataQuery"],
  });

  const queryClient = useQueryClient();
  React.useEffect(() => {
    function handleChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: chrome.storage.AreaName
    ) {
      if (areaName === "sync" && ["persist:settings"].some((key) => key in changes))
        queryClient.invalidateQueries({ queryKey: ["settingsDataQuery"] });
    }
    chrome.storage.onChanged.addListener(handleChanged);
    return () => chrome.storage.onChanged.removeListener(handleChanged);
  }, [queryClient]);

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
