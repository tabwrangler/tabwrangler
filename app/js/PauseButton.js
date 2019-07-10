/* @flow */

import React from 'react';

// Unpack TW.
const { settings } = chrome.extension.getBackgroundPage().TW;

export default function PauseButton() {
  // $FlowFixMe Upgrade Flow to get latest React types
  const [paused, setPaused] = React.useState(settings.get('paused'));

  function pause() {
    chrome.browserAction.setIcon({ path: 'img/icon-paused.png' });
    settings.set('paused', true);
    setPaused(true);
  }

  function play() {
    chrome.browserAction.setIcon({ path: 'img/icon.png' });
    settings.set('paused', false);
    setPaused(false);
  }

  return (
    <button className="btn btn-outline-dark btn-sm" onClick={paused ? play : pause} type="button">
      {paused ? (
        <>
          <i className="fas fa-play" /> {chrome.i18n.getMessage('extension_resume')}
        </>
      ) : (
        <>
          <i className="fas fa-pause" /> {chrome.i18n.getMessage('extension_pause')}
        </>
      )}
    </button>
  );
}
