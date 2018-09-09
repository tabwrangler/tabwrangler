/* @flow */

import React from 'react';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const { settings } = TW;

type State = {
  paused: boolean,
};

export default class PauseButton extends React.PureComponent<{}, State> {
  constructor() {
    super();
    this.state = {
      paused: settings.get('paused'),
    };
  }

  pause = () => {
    chrome.browserAction.setIcon({ path: 'img/icon-paused.png' });
    settings.set('paused', true);
    this.setState({ paused: true });
  };

  play = () => {
    chrome.browserAction.setIcon({ path: 'img/icon.png' });
    settings.set('paused', false);
    this.setState({ paused: false });
  };

  render() {
    const content = this.state.paused ? (
      <span>
        <i className="fas fa-play" /> {chrome.i18n.getMessage('extension_resume')}
      </span>
    ) : (
      <span>
        <i className="fas fa-pause" /> {chrome.i18n.getMessage('extension_pause')}
      </span>
    );

    return (
      <button
        className="btn btn-outline-secondary btn-sm"
        onClick={this.state.paused ? this.play : this.pause}>
        {content}
      </button>
    );
  }
}
