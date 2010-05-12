function openNewTab() {
  chrome.tabs.create({'url':'chrome://newtab/'});
}

function openExtTab() {
  chrome.tabs.create({'url':'chrome://extensions/'});
}

function showCloseUnlocked() {
    chrome.tabs.getAllInWindow(null, function (tabs){
	    var tl = tabs.length;
	    var locked_ids = getLsOr("locked_ids");
	    var do_unlocking = true;
	    var cu = document.getElementById('close_unlocked');
	    var lil = locked_ids.length;
	    if ( lil < tl && lil > 0 ) {
		cu.style.display = 'inline';
	    } else {
		cu.style.display = 'none';
	    }
	} );
}

function checkToClose(tabs) {
  var tl = tabs.length;
  var locked_ids = getLsOr("locked_ids");
  var do_unlocking = true;
  if ( locked_ids.length == 0 ) {
    if ( !window.confirm("No tabs are locked...close ALL tabs?") ) {
      do_unlocking = false;
    }
  }
  if ( !do_unlocking ) {
    return; //close out
  }
  for (var i = 0; i !== tl; i++) {
    var tmp_id = tabs[i].id;
    var lock_check = locked_ids.indexOf(tmp_id);
    if ( lock_check == -1 ) {
      chrome.tabs.remove(tmp_id);
    }
  }
}

function closeUnlocked() {
    chrome.tabs.getAllInWindow(null, checkToClose);
}


function loadOpenTabs() {
  chrome.tabs.getAllInWindow(null, openTabs);
  return;
}

function saveLock(tab_id) {
    var locked_ids = getLsOr("locked_ids");

    if ( locked_ids.indexOf(tab_id) == -1 ) {
	locked_ids.push(tab_id);
    }
    localStorage["locked_ids"] = JSON.stringify(locked_ids);
}

function removeLock(tab_id) {
    var locked_ids = getLsOr("locked_ids");
    if ( locked_ids.indexOf(tab_id) > -1 ) {
	locked_ids.splice(locked_ids.indexOf(tab_id),1);
    }
    localStorage["locked_ids"] = JSON.stringify(locked_ids);
}

function initTabWrangler() {
    loadLastView();
    loadOpenTabs();
    loadClosedTabs();
    restore_options(); // from options.js
}

function showCorral() {
    localStorage["popup_view"] = "corral";
    document.getElementById("corralHolder").style.display='block';
    document.getElementById("activeHolder").style.display='none';
    document.getElementById("optionsHolder").style.display='none';
    document.body.id = 'tab1';
}

function showActive() {
    localStorage["popup_view"] = "active";
    document.getElementById("activeHolder").style.display='block';
    document.getElementById("corralHolder").style.display='none';
    document.getElementById("optionsHolder").style.display='none';
    document.body.id = 'tab2';
    showCloseUnlocked();
}

function showOptions() {
    localStorage["popup_view"] = "options";
    document.getElementById("activeHolder").style.display='none';
    document.getElementById("corralHolder").style.display='none';
    document.getElementById("optionsHolder").style.display='block';
    document.body.id = 'tab3';
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
      showCorral();n
  }
}

function tooLong(a) {
  if ( a.length > 83 ) {
    return a.substring(0,80) + "...";
  }
  return a;
}

window.onload = initTabWrangler;

