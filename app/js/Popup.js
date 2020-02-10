/* @flow */

import type { AppState, Dispatch } from './Types';
import NavBar, { type NavBarTabID } from './NavBar';
import { clearTempStorage, fetchSessions } from './actions/tempStorageActions';
import { useDispatch, useSelector } from 'react-redux';
import AboutTab from './AboutTab';
import CorralTab from './CorralTab';
import LockTab from './LockTab';
import OptionsTab from './OptionsTab';
import React from 'react';

export default function Popup() {
  const [activeTabId, setActiveTabId] = React.useState<NavBarTabID>('corral');
  const dispatch = useDispatch<Dispatch>();
  const theme = useSelector((state: AppState) => state.settings.theme);

  React.useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    document.body.classList.toggle('theme-light', theme === 'light');
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
    case 'about':
      activeTab = <AboutTab />;
      break;
    case 'corral':
      activeTab = <CorralTab />;
      break;
    case 'lock':
      activeTab = <LockTab />;
      break;
    case 'options':
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
