TW = TW || {};

TW.optionsTab = {};

/**
 * Initialization for options tab.
 * @param context
 *  Optionally used to limit jQueries
 */
TW.optionsTab.init = function(context) {
  $('#saveOptionsBtn', context).click(TW.optionsTab.saveOptions);
  TW.optionsTab.loadOptions();
}

TW.optionsTab.saveOptions = function () {
  for (var key in TW.settings.defaults) {
    var elem = document.getElementById(key);
    if (elem != undefined) {
      TW.settings.set(key, elem.value);
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
      v = TW.settings.get(key);
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

// Active Tab
// @todo: rename this to lock tab, that's what it's for.;
TW.activeTab = {};

TW.activeTab.init = function(context) {
  this.context = context;
  chrome.tabs.getAllInWindow(null, TW.activeTab.buildTabLockTable);
}

TW.activeTab.saveLock = function(tab_id) {
  var locked_ids = TW.settings.get("locked_ids");

  if (tab_id > 0 && locked_ids.indexOf(tab_id) == -1) {
    locked_ids.push(tab_id);
  }
  TW.settings.set('locked_ids', locked_ids);
  TW.settings.save();
}

TW.activeTab.removeLock = function(tab_id) {
  var locked_ids = TW.settings.get("locked_ids");
  if (locked_ids.indexOf(tab_id) > -1) {
    locked_ids.splice(locked_ids.indexOf(tab_id), 1);
  }
  TW.settings.set('locked_ids', locked_ids);
  TW.settings.save();
}


/**
 * @param tabs
 * @return {Boolean}
 */
TW.activeTab.buildTabLockTable = function (tabs) {

  var tabNum = tabs.length;
  var $tbody = $('#activeTabs tbody');
  $tbody.html('');

  for (var i = 0; i < tabNum; i++) {
    checkAutoLock(tabs[i].id, tabs[i].url);
  }
  var locked_ids = TW.settings.get("locked_ids");
  for (var i = 0; i < tabNum; i++) {

    // Create a new row.
    var $tr = $('<tr></tr>');

    // Checkbox to lock it.
    //@todo: put the handler in its own function
    var $lock_box = $('<input />')
      .attr('type', 'checkbox')
      .attr('id', "cb" + tabs[i].id)
      .attr('value', tabs[i].id)
      .attr('checked', locked_ids.indexOf(tabs[i].id) != -1)
      .click(function () {
        if (this.checked) {
          saveLock(parseInt(this.value));
        } else {
          removeLock(parseInt(this.value));
        }
        showCloseUnlocked();
      });
    $tr.append($('<td></td>').append($lock_box));

    // Image cell.
    var $img_td = $('<td></td>');
    if (tabs[i].favIconUrl != null && tabs[i].favIconUrl != undefined && tabs[i].favIconUrl.length > 0) {
      // We have an image to show.
      var $img_icon = $('<img />')
        .attr('class', 'favicon')
        .attr('src', tabs[i].favIconUrl)
      $img_td.append($img_icon);
    } else {
      $img_td.text('-');
    }

    $tr.append($img_td);

    // Page title.
    $tr.append($('<td>' + tabs[i].title.shorten(70) + '</td>'));
    // Url
    $tr.append($('<td>' + tabs[i].url.shorten(70) + '</td>'));

    var cutOff = new Date().getTime() - TW.settings.get('stayOpen');

    var lastModified = chrome.extension.getBackgroundPage().TW.TabManager.tabTimes[tabs[i].id];
    var timeLeft = -1 * (Math.round((cutOff - lastModified) / 1000)).toString();
    $tr.append($('<td class="time-left">' + timeLeft + 's</td>'));


    // Append the row.
    $tbody.append($tr);
  }

  return true;
}

TW.corralTab = {};

TW.corralTab.init = function(context) {
  // @todo: use context to select table.
  TW.corralTab.loadClosedTabs();
}
TW.corralTab.loadClosedTabs = function() {
  $('#autocloseMessage').hide();
  $('#reopenTabMessage').hide();

  /**
   * @todo: add this back in
   *
   * function openExtTab() {
   chrome.tabs.create({'url':'chrome://extensions/'});
   }

   function openNewTab() {
   chrome.tabs.create({'url':'chrome://newtab/'});
   }
   */

  var closedTabs = TW.TabManager.loadClosedTabs();
  var $tbody = $('#corralTable tbody');
  $tbody.html('');

  if ( closedTabs.length == 0 ) {
    $('#autocloseMessage').show();
    return;
  }

  $('#reopenTabMessage').show();

  for ( var i = 0; i < closedTabs.length; i++) {
    var tab = closedTabs[i];
    // Create a new row.
    var $tr = $('<tr></tr>');

    // Image cell.
    var $img_td = $('<td></td>');
    if (tab.favIconUrl != null && tab.favIconUrl != undefined && tab.favIconUrl.length > 0) {
      // We have an image to show.
      var $img_icon = $('<img />')
        .attr('class', 'favicon')
        .attr('src', tab.favIconUrl)
      $img_td.append($img_icon);
    } else {
      $img_td.text('-');
    }

    $tr.append($img_td);

    // Page title.

    // @todo: Add this logic back in:
//    if ( urls[i] == "chrome://newtab/") {
//      a_title.href = "javascript:openNewTab();";
//    } else  if ( urls[i] == "chrome://extensions/") {
//      a_title.href = "javascript:openExtTab();";
//    } else {
//      a_title.href = urls[i];
//    }
    $tr.append($('<td><a target="_blank" href="' + tab.url + '">' + tab.title.shorten(70) + '</a></td>'));
    // Url - not sure if we want this.
    // $tr.append($('<td>' + tab.url.shorten(70) + '</td>'));
    // time ago.
    $tr.append('<td>' + $.timeago(tab.closedAt) + '</td>');
    $tbody.append($tr);
  }
}


// Utility stuff:
String.prototype.shorten = function(length) {
  if ( this.length > (length + 3) ) {
    return this.substring(0, length) + "...";
  }
  return this;
}

$(document).ready(function() {
  $('a[href="#tabCorral"]').tab('show');
  // Seems we need to force this since corral is the default.
  TW.corralTab.loadClosedTabs();

  $('#checkTimes').click(function() {
    //@todo: make that button work on lock tab.
  });

  $('a[data-toggle="tab"]').on('show', function (e) {
    var tabId = event.target.hash;
    switch (tabId) {
      case '#tabOptions':
        TW.optionsTab.init($('div#tabOptions'));
        break;
      case '#tabActive':
        TW.activeTab.init($('div#tabActive'));
        break;

      case '#tabCorral':
        TW.corralTab.init($('div#tabCorral'));
        break;
    }
  });
});

