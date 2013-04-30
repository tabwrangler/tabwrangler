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
    version: '3.0',
    fx: function() {},
    finished: function() {}
  }
]
