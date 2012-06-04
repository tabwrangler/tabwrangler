/**
 * @todo: refactor into "get the ones to close" and "close 'em"
 * So it can be tested.
 */
function checkToClose(cutOff) {
  var cutOff = cutOff || new Date().getTime() - TW.settings.get('stayOpen');
  var minTabs = TW.settings.get('minTabs');
  // Tabs which have been locked via the checkbox.
  var lockedIds = TW.settings.get("lockedIds");

  // Update the selected one to make sure it doesn't get closed.
  chrome.tabs.getSelected(null, TW.TabManager.updateLastAccessed);

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
  var tabsToSave = new Array();

  // If cutting will reduce us below 5 tabs, only remove the first N to get to 5.
  if ((TW.TabManager.getAll().length - minTabs) >= 0) {
    toCut = toCut.splice(0, TW.TabManager.getAll().length - minTabs);
  } else {
    // We have less than 5 tabs, abort.
    return;
  }

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

function startup() {
  TW.TabManager.clearClosedTabs();
  TW.settings.set('lockedIds', new Array());
  // @todo: consider moving back to its own k/v since the other settings don't get reset on start.

  chrome.tabs.query({windowType: 'normal'}, TW.TabManager.initTabs);
  chrome.tabs.onCreated.addListener(TW.TabManager.updateLastAccessed);
  chrome.tabs.onUpdated.addListener(TW.TabManager.updateLastAccessed);
  chrome.tabs.onRemoved.addListener(TW.TabManager.removeTab);
  chrome.tabs.onActivated.addListener(function(tabInfo) {TW.TabManager.updateLastAccessed(tabInfo['tabId'])});
  window.setInterval(checkToClose, TW.settings.get('checkInterval'));
  window.setInterval(TW.TabManager.updateClosedCount, TW.settings.get('badgeCounterInterval'));
}

window.onload = startup;
