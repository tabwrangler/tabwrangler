TW = TW || {};

TW.optionsTab = {}

TW.optionsTab.saveOptions = function () {
  for (var key in TW.settings.defaults) {
    var elem = document.getElementById(key);
    if (elem != undefined) {
      console.log(key);
      console.log(elem.value);
      TW.settings.set(key, elem.value);
      console.log(v);
    }
  }

  var errors = TW.settings.validate();

  $('#status').removeClass();

  if (!errors) {
    // Update status to let user know options were saved.
    TW.settings.save();
    $('#status').html('Options have been saved');

    $('#status').addClass('alert-success').addClass('alert');
    setTimeout(function() { status.innerHTML = "";}, 4000);
  } else {
    var $errorList = $('<ul></ul>');
    for (key in errors) {
      $errorList.append('<li>' + errors[key] + '</li>');
    }
    $('#status').append($errorList).addClass('alert-error').addClass('alert');

  }
  $('#status').show();
  $('#status').delay(5000).fadeOut(1000);
  return false;
}

TW.optionsTab.loadOptions = function () {
  for (var key in TW.settings.defaults) {
    var elem = document.getElementById(key);
    if (elem != undefined) {
      console.log(key);
      v = TW.settings.get(key);
      console.log(v);
      elem.value = v;
    }
  }
}

TW.optionsTab.deleteWL = function () {
  var wl_select = document.getElementById('whitelist');
  var wl_data = TW.settings.get("whitelist");
  var selected = wl_select.options.selectedIndex;
  if ( selected != -1 ) {
    //wl_select.options[selected] = null;
    wl_data.splice(selected,1);
  }
  localStorage["whitelist"] = JSON.stringify(wl_data);
  TW.optionsTab.updateWL();
}

TW.optionsTab.addWL = function () {
  var url = document.getElementById('wl_add').value;
  var wl_data = TW.settings.get("whitelist");
  if ( url.length > 0 && wl_data.indexOf(url) == -1 ) {
    wl_data.push(url);
    document.getElementById('wl_add').value= '';
  } else {
    //alert("Already in list");
  }
  localStorage["whitelist"] = JSON.stringify(wl_data);
  TW.optionsTab.updateWL();
}

TW.optionsTab.updateWL = function () {
  var wl_data = TW.settings.get("whitelist");
  var wl_len = wl_data.length;
  var wl_select = document.getElementById('whitelist');
  wl_select.options.length = 0;
  for ( var i=0;i<wl_len;i++ ) {
    var tmp_opt = document.createElement('option');
    tmp_opt.appendChild(document.createTextNode(wl_data[i]));
    wl_select.appendChild(tmp_opt);
  }
}

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

  $('#checkTimes').click(function() {

  });

  $('a[data-toggle="tab"]').on('show', function (e) {
    var tabId = event.target.hash;
    switch (tabId) {
      case '#tabOptions':
        $('#saveOptionsBtn').click(TW.optionsTab.saveOptions);
        TW.optionsTab.loadOptions();
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

