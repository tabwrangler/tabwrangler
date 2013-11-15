define(function(require) {

/**
 * Handles updates between versions of the extension.
 */
Updater = {
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
    console.log('running updater');
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
      console.log("Updating from " + currentVersion + " to " + manifestVersion);
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
};

Updater.getNotification = function(title, items) {
  title = title || "Tab Wrangler Updates";
  items = items || [];
  return {
      type: "list",
      title: title,
      message: "Tab wrangler updates",
      iconUrl: "img/icon128.png",
      items: [],
      buttons: [],
    };
};

Updater.addCommonButtons = function(notification) {
  notification.buttons.push({iconUrl: 'img/star.png', title: "Review Tab Wrangler"});
  notification.buttons.push({iconUrl: 'img/notes.png', title: "See all release notes / be a tester"});
};

Updater.notificationIdPrefix = "updater-";

Updater.commonButtonHandler = function(id, buttonIdx) {
  // If an updater is creating a notification it should
  // do so by prefixing the Id with updater--.
  // This is a little hacky, so there is a helper function
  // which launches the notification with this.
  if(id.indexOf(Updater.notificationIdPrefix) === 0) {
    if (buttonIdx === 0) {
      // Reviewing TabWrangler
      // Launch the Chrome store page
      chrome.tabs.create({url: 'https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/reviews', active: true});
    }

    if (buttonIdx === 1) {
      chrome.tabs.create({url: 'http://www.jacobsingh.name/tabwrangler/release-notes', active: true});
    }
  }
};

Updater.launchNotification = function(id, notification, addButtons) {
  var cb = function(){};
  addButtons = typeof(addButtons) == 'undefined' ? false : true;
  if (addButtons) {
    this.addCommonButtons(notification);
    chrome.notifications.onButtonClicked.addListener(this.commonButtonHandler);
  }
  chrome.notifications.create(this.notificationIdPrefix + id, notification, cb);
};

// These are also run for users with no currentVersion set.
// This update is for the 1.x -> 2.x users
Updater.updates[2.1] = {
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
    };

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
};

Updater.updates[2.2] = {
  fx: function() {
    // Move localStorage to chrome.storage.sync
    var items = {};
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
};

Updater.updates[2.3] = {
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

Updater.updates[2.4] = {
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

Updater.updates[2.5] = {
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

Updater.updates[2.6] = {
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
};

Updater.updates[2.8] = {
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
};

Updater.updates[2.9] = {
  fx: function() {
    
  },

  finished: function() {



    var updateTxt = ''
    + '<strong>Updates</strong>'
    + '<ul>'
    + '<li> <a target="_blank" href="http://www.jacobsingh.name/tabwrangler/release-notes">See all changes</a></li>'
    + '<li> Tabs were getting cleared at quit, even when setting was on. <span class="label label-error">Bug</span></li>'
    + '<li> <a target="_blank" href="https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/reviews"> Review tab wrangler!</a></li>'
    + '</ul>';

    var notification = window.webkitNotifications.createHTMLNotification(
      'notification.html?title=Version 2.9&message=' + updateTxt
    );
    notification.show();
    
  }  
}

Updater.updates[3.1] = {
  fx: function() {
    
  },

  finished: function() {

    var notification = Updater.getNotification("Tab Wrangler 3.1 updates");
    notification.items.push({title: "New", message: "Remove tabs from Corral"});
    notification.items.push({title: "New", message: "Pinned tabs not counted"});
    notification.items.push({title: "New", message: "Auto-lock page UX"});
    notification.items.push({title: "Fix", message: "No auto-close when > minTabs."});
    notification.items.push({title: "Fix", message: "Fixed display issue with timer after pause"});
    Updater.launchNotification("3.1", notification, true);
  }  
}

return Updater;

});
