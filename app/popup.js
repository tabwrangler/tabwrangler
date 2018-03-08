/* @flow */

import './lib/bootstrap/css/bootstrap.min.css';
import './css/popup.css';
import 'react-virtualized/styles.css';
import NavBar, {type NavBarTabID} from './js/NavBar';
import AboutTab from './js/AboutTab';
import CorralTab from './js/CorralTab';
import LockTab from './js/LockTab';
import OptionsTab from './js/OptionsTab';
import React from 'react';
import ReactDOM from 'react-dom';

type Props = {
  commands: Array<chrome$Command>,
  sessions: Array<chrome$Session>,
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

  _handleClickTab = (tabId) => {
    this.setState({activeTabId: tabId});
  };

  render() {
    let activeTab;
    switch (this.state.activeTabId) {
    case 'about':
      activeTab = <AboutTab />;
      break;
    case 'corral':
      activeTab = <CorralTab sessions={this.props.sessions} />;
      break;
    case 'lock':
      activeTab = <LockTab />;
      break;
    case 'options':
      activeTab = <OptionsTab commands={this.props.commands} />;
      break;
    }

    return (
      <div>
        <NavBar activeTabId={this.state.activeTabId} onClickTab={this._handleClickTab} />
        <div className="tab-content container">
          {activeTab}
        </div>
      </div>
    );
  }
}

function render(props) {
  const popupElement = document.getElementById('popup');
  if (popupElement == null) return;
  ReactDOM.render(<Popup {...props} />, popupElement);
}

let state = {
  commands: [],
  sessions: [],
};

render(state);

// TODO: Move into a Redux store rather than use one-off render calls.
// See https://github.com/tabwrangler/tabwrangler/issues/113
chrome.commands.getAll(commands => {
  state = Object.assign({}, state, {commands});
  render(state);
});

function updateSessionsRecentlyClosed() {
  chrome.sessions.getRecentlyClosed(sessions => {
    state = Object.assign({}, state, {sessions});
    render(state);
  });
}

chrome.sessions.onChanged.addListener(updateSessionsRecentlyClosed);
updateSessionsRecentlyClosed();
