import CorralTab from "./CorralTab/CorralTab";
import LockTab from "./LockTab/LockTab";
import { NavBarTabID } from "./NavBar";
import PageShell from "./PageShell";
import React from "react";

export default function PopupPage() {
  const [activeTabId, setActiveTabId] = React.useState<NavBarTabID>("corral");

  let activeTab;
  switch (activeTabId) {
    case "corral":
      activeTab = <CorralTab />;
      break;
    case "lock":
    default:
      activeTab = <LockTab />;
      break;
  }

  return (
    <PageShell activeTabId={activeTabId} isOptionsPage={false} onClickTab={setActiveTabId}>
      {activeTab}
    </PageShell>
  );
}
