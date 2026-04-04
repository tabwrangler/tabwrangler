import AboutTab from "./AboutTab/AboutTab";
import CorralTab from "./CorralTab/CorralTab";
import LockTab from "./LockTab/LockTab";
import { NavBarTabID } from "./NavBar";
import OptionsTab from "./OptionsTab/OptionsTab";
import PageShell from "./PageShell";
import { useState } from "react";

export default function OptionsPage() {
  const [activeTabId, setActiveTabId] = useState<NavBarTabID>("options");

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
    <PageShell activeTabId={activeTabId} isOptionsPage={true} onClickTab={setActiveTabId}>
      {activeTab}
    </PageShell>
  );
}
