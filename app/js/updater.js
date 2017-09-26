/* @flow */
/* global TW */

/**
 * Handles updates between versions of the extension.
 */
const Updater = {
  updates: {},
  //@todo: refactor this into a couple functions
  run() {
    console.log('running updater');
    const self = this;
    chrome.storage.sync.get('version', function(items) {
      // Whatever is set in chrome.storage (if anything)
      let currentVersion;

      // The version from the manifest file
      const manifestVersion = parseFloat(chrome.runtime.getManifest().version);

      // If items[version] is undefined, the app has either not been installed,
      // or it is an upgrade from when we were not storing the version.
      if (typeof items['version'] != 'undefined') {
        currentVersion = items['version'];
      }

      if (currentVersion) {
        console.log('Updating from ' + currentVersion + ' to ' + manifestVersion);
      } else {
        // Hardcoded here to make the code simpler. This is the first update for users upgrading
        // from when we didn't store a version.
        if (localStorage['minutes_inactive']) {
          // This is the ancient 1.x version
          this.updates[2.1].fx();
        }
        if (localStorage['minutesInactive']) {
          // This is an update from the 2.1 version
          currentVersion = 2.1;
        }
        console.log('Updating to ' + manifestVersion);
      }
      self.runUpdates(currentVersion, manifestVersion);
    });
  },
  runUpdates(currentVersion: number, manifestVersion: number) {
    const self = this;
    if (!currentVersion) {
      chrome.storage.sync.set({
        'version': manifestVersion,
      });
    } else if (currentVersion < manifestVersion) {
      Object.keys(this.updates).forEach(i => {
        if (i > currentVersion) {
          this.updates[i].fx();
        }

        // This is the version we are updating to.
        if (i === manifestVersion) {
          // Post 2.0 updates.
          chrome.storage.sync.set({
            'version': manifestVersion,
          }, function() {
            if (typeof self.updates[i].finished == 'function') {
              self.updates[i].finished();
            }
          });
        }
      });
    }
  },
};

// These are also run for users with no currentVersion set.
// This update is for the 1.x -> 2.x users
Updater.updates[2.1] = {
  fx() {
    const map = {
      'minutes_inactive' : 'minutesInactive',
      'closed_tab_ids' : null,
      'closed_tab_titles': null,
      'closed_tab_urls' : null,
      'closed_tab_icons' : null,
      'closed_tab_actions': null,
      'locked_ids' : 'lockedIds',
      'popup_view' : null,
    };

    let oldValue;

    for (const i in map) {
      if (map.hasOwnProperty(i)) {
        oldValue = localStorage[i];
        if (oldValue) {
          if (map[i] != null) {
            localStorage[map[i]] = oldValue;
          }
          localStorage.removeItem(i);
        }
      }
    }
  },
};

Updater.updates[2.2] = {
  fx() {
    // Move localStorage to chrome.storage.sync
    const items = {};
    let val;
    for(const i in localStorage) {
      val = String(localStorage[i]);
      try {
        items[i] = JSON.parse(val);
      } catch(err) {
        items[i] = val;
      }
    }
    chrome.storage.sync.set(items, function() {
      localStorage.clear();
      TW.settings.init();
    });
  },
};

export default Updater;
