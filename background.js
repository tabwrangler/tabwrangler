function initTabs(tabs) {
  for (i in tabs) {
    TW.TabManager.addTab(tabs[i]);
  }
}

/**
 * @todo: refactor into "get the ones to close" and "close 'em"
 * So it can be tested.
 */
function checkToClose(cutOff) {
  var cutOff = cutOff || new Date().getTime() - TW.settings.get('stayOpen');
  // Tabs which have been locked via the checkbox.
  var locked_ids = TW.settings.get("locked_ids");

  // Update the selected one to make sure it doesn't get closed.
  chrome.tabs.getSelected(null, TW.TabManager.addTab);

  /**
   * Idlechecker stuff, needs to be refactored
   *

  var sleepTime = TW.idleChecker.timeSinceLastRun(now) - TW.settings.checkInterval * 1.1;
  // sleepTime is the time elapsed between runs.  This is probably time when the computer was asleep.

  if (sleepTime < 0) {
    sleepTime = 0;
  }
  TW.idleChecker.logRun(now);

  */

  var toCut = TW.TabManager.getOlderThen(cutOff);
  if (toCut.length == 0) {
    return;
  }
  for (var i in toCut) {
    var tabToCut = toCut[i];
    // @todo: move to TW.TabManager.
    if (locked_ids.indexOf(tabToCut.id) != -1) {
      // Update its time so it gets checked less frequently.
      // Would also be smart to just never add it.
      // @todo: fix that.
      TW.TabManager.addTab(tabToCut);
      continue;
    }

    // Close it in Chrome.
    chrome.tabs.remove(tabToCut.id, function() {
      console.log('wtf willis');
    });
  }

  //@todo: add some error checking here.
  TW.TabManager.saveClosedTabs(toCut);
}

function startup() {
  // I don't even know wtf we need this for.
  // clear closed tabs DATA in options
  // CLEAR OLD DATA EVERY WHAT?..
  localStorage["closedTabs"] = "";
  // @todo: consider moving back to its own k/v since the other settings don't get reset on start.
  TW.settings.set('locked_ids', new Array());
  TW.settings.save();

  chrome.tabs.getAllInWindow(null, initTabs);
  chrome.tabs.onCreated.addListener(TW.TabManager.addTab);

  chrome.tabs.onUpdated.addListener(TW.TabManager.addTab);
  chrome.tabs.onRemoved.addListener(TW.TabManager.removeTab);
  chrome.tabs.onSelectionChanged.addListener(TW.TabManager.addTab);
  window.setInterval(checkToClose, TW.checkInterval);
}

window.onload = startup;
