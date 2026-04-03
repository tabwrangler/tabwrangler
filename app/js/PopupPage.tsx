import CorralTab from "./CorralTab/CorralTab";
import LockTab from "./LockTab/LockTab";
import { NavBarTabID } from "./NavBar";
import PageShell from "./PageShell";
import React from "react";

export default function PopupPage() {
  const [activeTabId, setActiveTabId] = React.useState<NavBarTabID>("lock");

  let activeTab;
  switch (activeTabId) {
    case "lock":
      activeTab = <LockTab />;
      break;
    case "corral":
    default:
      activeTab = <CorralTab />;
  }

  return (
    <PageShell activeTabId={activeTabId} isOptionsPage={false} onClickTab={setActiveTabId}>
      {activeTab}
    </PageShell>
  );
}
