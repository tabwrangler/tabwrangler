/* @flow */

import './css/popup.scss';
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import './css/fontawesome-free-solid-woff-only.css';
import 'react-virtualized/styles.css';
import NavBar, { type NavBarTabID } from './js/NavBar';
import { clearTempStorage, fetchSessions } from './js/actions/tempStorageActions';
import AboutTab from './js/AboutTab';
import CorralTab from './js/CorralTab';
import type { Dispatch } from './js/Types';
import LockTab from './js/LockTab';
import OptionsTab from './js/OptionsTab';
import { PersistGate } from 'redux-persist/integration/react';
import { Provider } from 'react-redux';
import React from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';

type Props = {
  dispatch: Dispatch,
};

type State = {
  activeTabId: NavBarTabID,
};

class Popup extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      activeTabId: 'corral',
    };
  }

  componentDidMount() {
    chrome.sessions.onChanged.addListener(this._updateSessionsRecentlyClosed);
    this._updateSessionsRecentlyClosed();
  }

  componentWillUnmount() {
    // Ensure the temp storage is cleared when the popup is closed to prevent holding references to
    // objects that may be cleaned up. In Firefox, this can lead to ["DeadObject" errors][1], which
    // throw exceptions and prevent the popup from displaying.
    this.props.dispatch(clearTempStorage());
    chrome.sessions.onChanged.removeListener(this._updateSessionsRecentlyClosed);
  }

  _handleClickTab = tabId => {
    this.setState({ activeTabId: tabId });
  };

  _updateSessionsRecentlyClosed = () => {
    this.props.dispatch(fetchSessions());
  };

  render() {
    let activeTab;
    switch (this.state.activeTabId) {
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
        <NavBar activeTabId={this.state.activeTabId} onClickTab={this._handleClickTab} />
        <div className="tab-content container-fluid">{activeTab}</div>
      </>
    );
  }
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
