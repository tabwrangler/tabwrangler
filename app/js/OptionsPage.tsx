import { useEffect, useState } from "react";
import AboutTab from "./AboutTab/AboutTab";
import CorralTab from "./CorralTab/CorralTab";
import LockTab from "./LockTab/LockTab";
import { NavBarTabID } from "./NavBar";
import OptionsTab from "./OptionsTab/OptionsTab";
import PageShell from "./PageShell";

const TAB_IDS = new Set(["about", "corral", "lock", "options"]);

function isNavBarTabID(value: string): value is NavBarTabID {
  return TAB_IDS.has(value);
}

function getTabIdFromHash(): NavBarTabID {
  const hash = window.location.hash.slice(1);
  return isNavBarTabID(hash) ? hash : "options";
}

export default function OptionsPage() {
  const [activeTabId, setActiveTabId] = useState<NavBarTabID>(getTabIdFromHash);

  // The background opens this page to a specific tab by setting the hash, including when the page
  // is already open.
  useEffect(() => {
    function handleHashChange() {
      setActiveTabId(getTabIdFromHash());
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  function handleClickTab(tabId: NavBarTabID) {
    // Keep the hash in sync so a later navigation to a tab's hash is a change that fires
    // "hashchange".
    history.replaceState(null, "", `#${tabId}`);
    setActiveTabId(tabId);
  }

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
    default:
      activeTabId satisfies never;
  }

  return (
    <PageShell activeTabId={activeTabId} isOptionsPage={true} onClickTab={handleClickTab}>
      {activeTab}
    </PageShell>
  );
}
