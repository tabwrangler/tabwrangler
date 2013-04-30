/**
 * Handles updates between versions of the extension.
 */
TW.Updater = {}

/* Shows a notification when the app is first installed. */
TW.Updater.firstInstall = function() {
  var notification = window.webkitNotifications.createNotification(
    'img/icon48.png',                      // The image.
    'Tab Wrangler is installed',
    'Tab wrangler is now auto-closing tabs after ' + TW.settings.get('minutesInactive') + ' minutes. \n\
To change this setting, click on the new icon on your URL bar.'
  );
  notification.show();
}

TW.Updater.runUpdates = function(previous, current) {

  // Get the list of all updates to run
  var updatesToRun = _.filter(TW.Updater.updates, function(update) {
    // This will work for now, but will begin to fall apart at some point.
    return update.version > previous && update.version <= current;
  });

  // Sort the updates by version so they are run in order
  var sortedUpdates = _.sortBy(updatesToRun, function(update) {
    return update.version;
  });

  // Run all updates
  _.map(sortedUpdates, function(update) { update.fx(); });

  var currentUpdate = _.findWhere(TW.Updater.updates, { version: current })
  if (currentUpdate) { currentUpdate.finished(); }
}

TW.Updater.updates = [
  {
    version: '2.8.5',
    fx: function() {},
    finished: function() { alert("this is a test.") },
  },

  {
    version: '3.0',
    fx: function() {},
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
]
