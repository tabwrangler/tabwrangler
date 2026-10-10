import CorralTab from "./CorralTab/CorralTab";
import LockTab from "./LockTab/LockTab";
import { NavBarTabID } from "./NavBar";
import PageShell from "./PageShell";
import { useState } from "react";

export default function PopupPage() {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<number>>(new Set());
  const [activeTabId, setActiveTabId] = useState<NavBarTabID>("corral");

  let activeTab;
  switch (activeTabId) {
    case "corral":
      activeTab = <CorralTab />;
      break;
    case "lock":
    default:
      activeTab = (
        <LockTab
          collapsedGroupIds={collapsedGroupIds}
          setCollapsedGroupIds={setCollapsedGroupIds}
        />
      );
      break;
  }

  return (
    <PageShell activeTabId={activeTabId} isOptionsPage={false} onClickTab={setActiveTabId}>
      {activeTab}
    </PageShell>
  );
}
