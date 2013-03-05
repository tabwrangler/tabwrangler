/**
 * Handles updates between versions of the extension.
 */
TW.Updater = {
  updates: {},
  firstInstall: function() {
    var notification = window.webkitNotifications.createNotification(
      'img/icon48.png',                      // The image.
      'Tab Wrangler is installed',
      'Tab wrangler is now auto-closing tabs after ' + TW.settings.get('minutesInactive') + ' minutes. \n\
  To change this setting, click on the new icon on your URL bar.'
      );
    notification.show();
  },
  //@todo: refactor this into a couple functions
  run: function() {
    var self = this;
    chrome.storage.sync.get('version', function(items) {
      // Whatever is set in chrome.storage (if anything)
      var currentVersion;

      // The version from the manifest file
      var manifestVersion = parseFloat(chrome.app.getDetails().version);

      // If items[version] is undefined, the app has either not been installed, 
      // or it is an upgrade from when we were not storing the version.
      if (typeof items['version'] != 'undefined') {
        currentVersion = items['version'];
      }
      

      if (!currentVersion) {
        // Hardcoded here to make the code simpler.
        // This is the first update for users upgrading from when we didn't store
        // a version.
        if (localStorage['minutes_inactive']) {
          // This is the ancient 1.x version
          this.updates[2.1].fx();
        }
        if (localStorage['minutesInactive']) {
          // This is an update from the 2.1 version
          currentVersion = 2.1;
        }
      }
      self.runUpdates(currentVersion, manifestVersion);
    }); 
  },
  runUpdates: function(currentVersion, manifestVersion) {
    var self = this;
    if (!currentVersion) {
      chrome.storage.sync.set({
        'version': manifestVersion
      },function() {
        self.firstInstall();
      });
    } else if (currentVersion < manifestVersion) {
      for (var i in this.updates) {
        if (this.updates.hasOwnProperty(i)) {
          if (i > currentVersion) {
            this.updates[i].fx();
          }

          // This is the version we are updating to.
          if (i == manifestVersion) {
            // Post 2.0 updates.
            chrome.storage.sync.set({
              'version': manifestVersion
            },function() {
              if (typeof self.updates[i].finished == 'function') {
                self.updates[i].finished();
              }
            });
          }
        }
      }
    }
  }
}

// These are also run for users with no currentVersion set.
// This update is for the 1.x -> 2.x users
TW.Updater.updates[2.1] = {
  fx: function() {
    var map = {
      'minutes_inactive' : 'minutesInactive',
      'closed_tab_ids' : null,
      'closed_tab_titles': null,
      'closed_tab_urls' : null,
      'closed_tab_icons' : null,
      'closed_tab_actions': null,
      'locked_ids' : 'lockedIds',
      'popup_view' : null
    }

    var oldValue;

    for (var i in map) {
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
  }
}

TW.Updater.updates[2.2] = {
  fx: function() {
    // Move localStorage to chrome.storage.sync
    var items = {}
    var val;
    for(var i in localStorage) {
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

  finished: function() {

    var updateTxt = ''
    + '<strong>Big changes:</strong>'
    + '<ul>'
    + '<li> Resets timer when minTabs is reached <span class="label label-success">Feature</span></li>'
    + '<li> Syncs settings between computers <span class="label label-success">Feature</span></li>'
    + '<li> Right-click to lock tab <span class="label label-success">Feature</span></li>'
    + '<li> <a target="_blank" href="http://www.jacobsingh.name/tabwrangler/release-notes#2.2"> See all changes</a></li>'
    + '</ul>';

    var notification = window.webkitNotifications.createHTMLNotification(
      'notification.html?title=Version 2.2&message=' + updateTxt
    );
    notification.show();
  }
}

TW.Updater.updates[2.3] = {
  fx: function() {
    
  },

  finished: function() {

    var updateTxt = ''
    + '<strong>Minor release:</strong>'
    + '<ul>'
  + '<li> <a target="_blank" href="http://www.jacobsingh.name/tabwrangler/release-notes">See all changes</a></li>'
    + '<li> Fixes version requirement for (Chrome 20+ required) <span class="label label-error">Bug</span></li>'
    + '<li> Adds a search box to Tab Corral <span class="label label-success">Feature</span></li>'
    + '<li> Various consmetic improvements <span class="label label-success">Feature</span></li>'
    
    + '</ul>';

    var notification = window.webkitNotifications.createHTMLNotification(
      'notification.html?title=Version 2.3&message=' + updateTxt
    );
    notification.show();
  }
}

TW.Updater.updates[2.4] = {
  fx: function() {
    
  },

  finished: function() {

    var updateTxt = ''
    + '<strong>New features!:</strong>'
    + '<ul>'
  + '<li> <a target="_blank" href="http://www.jacobsingh.name/tabwrangler/release-notes">See all changes</a></li>'
    + '<li> Tabs now open in background <span class="label label-success">Feature</span></li>'
    + '<li> Tabs are grouped by time closed - restore multiple <span class="label label-success">Feature</span></li>'
    + '<li> Tab lock counter counts down <span class="label label-success">Feature</span></li>'
    + '<li> <a target="_blank" href="https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/reviews"> Review tab wrangler!</a> <span class="label label-info">Info</span></li>'
    + '</ul>';

    var notification = window.webkitNotifications.createHTMLNotification(
      'notification.html?title=Version 2.4&message=' + updateTxt
    );
    notification.show();
  }
}

TW.Updater.updates[2.5] = {
  fx: function() {
    
  },

  finished: function() {

    var updateTxt = ''
    + '<strong>Minor release:</strong>'
    + '<ul>'
    + '<li> <a target="_blank" href="http://www.jacobsingh.name/tabwrangler/release-notes">See all changes</a></li>'
    + '<li> Fixed error handling on options form <span class="label label-error">Bug</span></li>'
    + '<li> Clear link was broken<span class="label label-error">Bug</span></li>'
    + '<li> <a target="_blank" href="https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/reviews"> Review tab wrangler!</a></li>'
    + '</ul>';

    var notification = window.webkitNotifications.createHTMLNotification(
      'notification.html?title=Version 2.5&message=' + updateTxt
    );
    notification.show();
  }
}

TW.Updater.updates[2.6] = {
  fx: function() {
    
  },

  finished: function() {

    var updateTxt = ''
    + '<strong>Critical bug fix:</strong>'
    + '<ul>'
    + '<li> <a target="_blank" href="http://www.jacobsingh.name/tabwrangler/release-notes">See all changes</a></li>'
    + '<li> Syntax error in updater caused new installs to fail <span class="label label-error">Bug</span></li>'
    + '<li> <a target="_blank" href="https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/reviews"> Review tab wrangler!</a></li>'
    + '</ul>';

    var notification = window.webkitNotifications.createHTMLNotification(
      'notification.html?title=Version 2.6&message=' + updateTxt
    );
    notification.show();
  }

TW.Updater.updates[2.8] = {
  fx: function() {
    
  },

  finished: function() {

    var updateTxt = ''
    + '<strong>Updates</strong>'
    + '<ul>'
    + '<li> <a target="_blank" href="http://www.jacobsingh.name/tabwrangler/release-notes">See all changes</a></li>'
    + '<li> Right click on page to immediately close and save a tab. <span class="label label-success">Feature</span></li>'
    + '<li> Added a pause feature <span class="label label-success">Feature</span></li>'
    + '<li> Restoring tabs w/o using TabWrangler now removes them from Corral <span class="label label-error">Bug</span></li>'
    + '<li> <a target="_blank" href="https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/reviews"> Review tab wrangler!</a></li>'
    + '</ul>';

    var notification = window.webkitNotifications.createHTMLNotification(
      'notification.html?title=Version 2.8&message=' + updateTxt
    );
    notification.show();
  }
}