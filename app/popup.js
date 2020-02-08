/* @flow */

import './css/popup.scss';
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import './css/fontawesome-free-solid-woff-only.css';
import 'react-virtualized/styles.css';
import { clearTempStorage, fetchSessions } from './js/actions/tempStorageActions';
import { connect, useDispatch } from 'react-redux';
import AboutTab from './js/AboutTab';
import CorralTab from './js/CorralTab';
import type { Dispatch } from './js/Types';
import LockTab from './js/LockTab';
import NavBar from './js/NavBar';
import OptionsTab from './js/OptionsTab';
import { PersistGate } from 'redux-persist/integration/react';
import { Provider } from 'react-redux';
import React from 'react';
import ReactDOM from 'react-dom';

function Popup() {
  const [activeTabId, setActiveTabId] = React.useState('corral');
  const dispatch = useDispatch<Dispatch>();

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

const ConnectedPopup = connect()(Popup);
const TW = chrome.extension.getBackgroundPage().TW;
const popupElement = document.getElementById('popup');
if (popupElement != null) {
  ReactDOM.render(
    <Provider store={TW.store}>
      <PersistGate loading={null} persistor={TW.persistor}>
        <ConnectedPopup />
      </PersistGate>
    </Provider>,
    popupElement
  );

  // The popup fires `pagehide` when the popup is going away. Make sure to unmount the component so
  // it can unsubscribe from the Store events.
  const unmountPopup = function unmountPopup() {
    ReactDOM.unmountComponentAtNode(popupElement);
    window.removeEventListener('pagehide', unmountPopup);
  };

  window.addEventListener('pagehide', unmountPopup);
}

// [1]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Dead_object
