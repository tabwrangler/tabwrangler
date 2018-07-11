/* @flow */

import './lib/bootstrap/css/bootstrap.min.css';
import './css/popup.css';
import 'react-virtualized/styles.css';
import NavBar, { type NavBarTabID } from './js/NavBar';
import AboutTab from './js/AboutTab';
import CorralTab from './js/CorralTab';
import LockTab from './js/LockTab';
import OptionsTab from './js/OptionsTab';
import { PersistGate } from 'redux-persist/integration/react';
import { Provider } from 'react-redux';
import React from 'react';
import ReactDOM from 'react-dom';

type State = {
  activeTabId: NavBarTabID,
};

class Popup extends React.PureComponent<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = {
      activeTabId: 'corral',
    };
  }

  _handleClickTab = tabId => {
    this.setState({ activeTabId: tabId });
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
      <div>
        <NavBar activeTabId={this.state.activeTabId} onClickTab={this._handleClickTab} />
        <div className="tab-content container">{activeTab}</div>
      </div>
    );
  }
}

const TW = chrome.extension.getBackgroundPage().TW;
const popupElement = document.getElementById('popup');
if (popupElement != null) {
  ReactDOM.render(
    <Provider store={TW.store}>
      <PersistGate loading={null} persistor={TW.persistor}>
        <Popup />
      </PersistGate>
    </Provider>,
    popupElement
  );

  // The popup fires `pagehide` when the popup is going away. Make sure to unmount the component so
  // it can unsubscribe from the Store events.
  window.addEventListener('pagehide', function() {
    ReactDOM.unmountComponentAtNode(popupElement);
  });
}
