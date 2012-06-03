/**
 * @todo: refactor into "get the ones to close" and "close 'em"
 * So it can be tested.
 */
function checkToClose(cutOff) {
  var cutOff = cutOff || new Date().getTime() - TW.settings.get('stayOpen');
  // Tabs which have been locked via the checkbox.
  var lockedIds = TW.settings.get("lockedIds");

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
  console.log("Tabs to close", toCut);
  var tabsToSave = new Array();

  if (toCut.length == 0) {
    return;
  }

  for (var i=0; i < toCut.length; i++) {
    var tabIdToCut = toCut[i];
    // @todo: move to TW.TabManager.
    if (lockedIds.indexOf(tabIdToCut) != -1) {
      // Update its time so it gets checked less frequently.
      // Would also be smart to just never add it.
      // @todo: fix that.
      TW.TabManager.updateLastAccessed(tabIdToCut);
      continue;
    }

    chrome.tabs.get(tabIdToCut, function(tab) {
      if (TW.TabManager.isWhitelisted(tab.url) == false) {
        TW.TabManager.saveClosedTabs([tab]);
        // Close it in Chrome.
        chrome.tabs.remove(tab.id);
      }
    });
  }
}

function updateClosedCount() {
  var storedTabs = TW.TabManager.loadClosedTabs().length;
  if (storedTabs > 0) {
    chrome.browserAction.setBadgeText({text: storedTabs.toString()});
  }
}

function startup() {
  TW.TabManager.clearClosedTabs();
  TW.settings.set('lockedIds', new Array());
  // @todo: consider moving back to its own k/v since the other settings don't get reset on start.

  chrome.tabs.query({windowType: 'normal'}, TW.TabManager.initTabs);
  chrome.tabs.onCreated.addListener(TW.TabManager.addTab);

  chrome.tabs.onUpdated.addListener(TW.TabManager.addTab);
  chrome.tabs.onRemoved.addListener(TW.TabManager.removeTab);
  chrome.tabs.onSelectionChanged.addListener(TW.TabManager.addTab);
  window.setInterval(checkToClose, TW.settings.get('checkInterval'));
  window.setInterval(updateClosedCount, TW.settings.get('badgeCounterInterval'));
}

window.onload = startup;
