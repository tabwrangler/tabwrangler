function openNewTab() {
  chrome.tabs.create({'url':'chrome://newtab/'});
}

function openExtTab() {
  chrome.tabs.create({'url':'chrome://extensions/'});
}

function showCloseUnlocked() {
//  return cleanLocked() && showCloseLink();
    showCloseLink();
}

// function updateAutoLock() {
//   chrome.tabs.getAllInWindow(null, function (tabs) {
//     checkAutoLock(tabs[i].id,tabs[i].url);
//   });
//   return true;
// }

function showCloseLink() {
    var locked_ids = getLsOr("locked_ids");
    var cids = new Array();
    chrome.tabs.getAllInWindow(null, function (tabs) {

      var tlen = tabs.length;
      for ( var i=0;i<tlen;i++ ) {
          cids.push(tabs[i].id);

      }

      var lock_size = locked_ids.length;
      for ( var x=0;x<lock_size;x++ ) {
          if ( cids.indexOf(locked_ids[x]) == -1 ) {
              alert("removing: " + locked_ids[x]);
              locked_ids.splice(locked_ids.indexOf(locked_ids[x]),1);
	  }
      }
    localStorage["locked_ids"] = JSON.stringify(locked_ids);
	    var tl = tabs.length;
	    var do_unlocking = true;
	    var cu = document.getElementById('close_unlocked');
	    var lil = locked_ids.length;

            alert("LOCKED:"+lil + "(" + locked_ids.join(",") + ") | TOTAL:"+ tl);
	    if ( lil < tl && lil > 0 ) {
		cu.style.display = 'inline';
	    } else {
		cu.style.display = 'none';
	    }
	} );

  return true;

}

function checkToClose(tabs) {
  var a = cleanLocked();
  var tl = tabs.length;
  var locked_ids = getLsOr("locked_ids");
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
}

function closeUnlocked() {
    chrome.tabs.getAllInWindow(null, checkToClose);
}


function loadOpenTabs() {
  var b = chrome.tabs.getAllInWindow(null, openTabs);
  return true;
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
  restore_options(); // from options.js
  updateWL();
}

function showCorral() {
  localStorage["popup_view"] = "corral";

  document.getElementById("corralHolder").style.display='block';
  document.getElementById("activeHolder").style.display='none';
  document.getElementById("optionsHolder").style.display='none';

  document.body.id = 'tab1';
  loadClosedTabs();
}

function showActive() {
  localStorage["popup_view"] = "active";

  document.getElementById("activeHolder").style.display='block';
  document.getElementById("corralHolder").style.display='none';
  document.getElementById("optionsHolder").style.display='none';

  document.body.id = 'tab2';
  loadOpenTabs() && showCloseUnlocked();
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
      showCorral();
  }
}

function deleteWL() {
  var wl_select = document.getElementById('whitelist');
  var wl_data = getLsOr("whitelist");
  var selected = wl_select.options.selectedIndex;
  if ( selected != -1 ) {
    //wl_select.options[selected] = null;
    wl_data.splice(selected,1);
  }
  localStorage["whitelist"] = JSON.stringify(wl_data);
  updateWL();
}

function addWL() {
  var url = document.getElementById('wl_add').value;
  var wl_data = getLsOr("whitelist");
  if ( url.length > 0 && wl_data.indexOf(url) == -1 ) {
    wl_data.push(url);
    document.getElementById('wl_add').value= '';
  } else {
    //alert("Already in list");
  }
  localStorage["whitelist"] = JSON.stringify(wl_data);
  updateWL();
}

function updateWL() {
  var wl_data = getLsOr("whitelist");
  var wl_len = wl_data.length;
  var wl_select = document.getElementById('whitelist');
  wl_select.options.length = 0;
  for ( var i=0;i<wl_len;i++ ) {
    var tmp_opt = document.createElement('option');
    tmp_opt.appendChild(document.createTextNode(wl_data[i]));
    wl_select.appendChild(tmp_opt);
  }
}

function tooLong(a) {
  if ( a.length > 73 ) {
    return a.substring(0,70) + "...";
  }
  return a;
}

window.onload = initTabWrangler;

