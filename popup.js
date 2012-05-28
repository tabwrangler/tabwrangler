/**
 * WTF... this has the same name as a different function in background.js
 * @param tabs
 */
function checkToClose(tabs) {
  var a = cleanLocked();
  var tl = tabs.length;
  var locked_ids = TW.settings.get("locked_ids");
  var do_unlocking = true;

  if ( !do_unlocking ) {
    return; //close out
  }
  for (var i = 0; i !== tl; i++) {
    var tmp_id = tabs[i].id;
    var lock_check = locked_ids.indexOf(tmp_id);
    if ( lock_check == -1 ) {
      try {
	chrome.tabs.remove(tmp_id);
	addToCorral(tabs[i].id,tabs[i].title,
		  tabs[i].url,tabs[i].favIconUrl,
		  new Date().getTime());

      } catch(e) {

      }

    }
  }
  window.close(); //close popup
}

function loadOpenTabs() {
  var b = chrome.tabs.getAllInWindow(null, buildTabLockTable);
  return true;
}

function loadLastView() {
  var pv = localStorage["popup_view"];

  if ( pv == "active" ) {
      showActive();
  } else if ( pv == "corral" ) {
      showCorral();
  } else if ( pv == "options" ) {
    showOptions();
  } else {
      showCorral();
  }
}

function tooLong(a) {
  if ( a.length > 73 ) {
    return a.substring(0,70) + "...";
  }
  return a;
}

//window.onload = initTabWrangler;

$(document).ready(function() {

  $('a[data-toggle="tab"]').on('show', function (e) {
    var tabId = event.target.hash;
    console.log(tabId);
    console.log(event.target);
    switch (tabId) {
      case '#tabOptions':
        // In options.js, @todo: refactor this too.
        console.log('ae');
        loadOptions();
        break;
      case '#tabActive':
        loadOpenTabs() && showCloseUnlocked();
        break;

      case '#tabCorral':
        loadClosedTabs();
        break;
    }
  });
});

