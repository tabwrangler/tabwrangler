var TW = chrome.extension.getBackgroundPage().TW;
console.log(chrome.extension.getBackgroundPage());

TW.optionsTab = {};

/**
 * Initialization for options tab.
 * @param context
 *  Optionally used to limit jQueries
 */
TW.optionsTab.init = function(context) {
  $('#saveOptionsBtn', context).click(TW.optionsTab.saveOption);

  function onBlurTextField() {
    var key = this.id;
    TW.optionsTab.saveOption(key, $(this).val());
  }

  $('#minutesInactive').change(onBlurTextField);
  $('#minTabs').change(onBlurTextField);

  TW.optionsTab.loadOptions();
}


TW.optionsTab.saveOption = function (key, value) {

  var errors = new Array();

  try {
    TW.settings.set(key, value);
  } catch (err) {
    errors.push(err);
  }

  $('#status').removeClass();

  if (errors.length == 0) {
    $('#status').html('Saving...');

    $('#status').addClass('alert-success').addClass('alert');
  } else {
    var $errorList = $('<ul></ul>');
    for (var i in errors) {
      $errorList.append('<li>' + errors[i].message + '</li>');
    }
    $('#status').append($errorList).addClass('alert-error').addClass('alert');
  }
  $('#status').css('visibility', 'visible');
  $('#status').css('opacity', '100');
  $('#status').delay(1000).animate({opacity:0});
  return false;
}

TW.optionsTab.loadOptions = function () {
  $('#minutesInactive').val(TW.settings.get('minutesInactive'));
  $('#minTabs').val(TW.settings.get('minTabs'));

  $('#whitelist').addOption = function(key, val) {
    this.append(
      $('<option />')
      .value(val)
      .text(key)
    );
  }

  var whitelist = TW.settings.get('whitelist');
  TW.optionsTab.buildWLTable(whitelist);

  $('#addToWL').click(function() {
    whitelist.push($('#wl-add').val());
    TW.optionsTab.saveOption('whitelist', whitelist);
    TW.optionsTab.buildWLTable(whitelist);
    return false;
  });

}

TW.optionsTab.buildWLTable = function(whitelist) {
  var $wlTable = $('table#whitelist tbody');
  $wlTable.html('');
  for (var i=0; i < whitelist.length; i++) {
    $tr = $('<tr></tr>');
    $urlTd = $('<td></td>').text(whitelist[i]);
    $deleteLink = $('<a class="deleteLink" href="#">Remove</a>')
      .click(function() {
        whitelist.remove(whitelist.indexOf($(this).data('pattern')));
        TW.optionsTab.saveOption('whitelist', whitelist);
        TW.optionsTab.buildWLTable(whitelist);
      })
      .data('pattern', whitelist[i]);

    $tr.append($urlTd);
    $tr.append($('<td></td>').append($deleteLink));
    $wlTable.append($tr);
  }
}

// Active Tab
// @todo: rename this to lock tab, that's what it's for.;
TW.activeTab = {};

TW.activeTab.init = function(context) {
  this.context = context;
  chrome.tabs.getAllInWindow(null, function(tabs) { TW.activeTab.buildTabLockTable(tabs);});
}

TW.activeTab.saveLock = function(tabId) {
  TW.TabManager.lockTab(tabId);
}

TW.activeTab.removeLock = function(tabId) {
  TW.TabManager.unlockTab();
}


/**
 * @param tabs
 * @return {Boolean}
 */
TW.activeTab.buildTabLockTable = function (tabs) {
  var self = this;

  var tabNum = tabs.length;
  var $tbody = $('#activeTabs tbody');
  $tbody.html('');

  var lockedIds = TW.settings.get("lockedIds");
  for (var i = 0; i < tabNum; i++) {

    // Create a new row.
    var $tr = $('<tr></tr>');

    // Checkbox to lock it.
    //@todo: put the handler in its own function
    var $lock_box = $('<input />')
      .attr('type', 'checkbox')
      .attr('id', "cb" + tabs[i].id)
      .attr('value', tabs[i].id)
      .attr('checked', tabs[i].pinned || TW.TabManager.isWhitelisted(tabs[i].url) || lockedIds.indexOf(tabs[i].id) != -1)
      .click(function () {
        if (this.checked) {
          self.saveLock(parseInt(this.value));
        } else {
          self.removeLock(parseInt(this.value));
        }
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

    var lastModified = TW.TabManager.tabTimes[tabs[i].id];
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
  $('#clearCorralLink').click(function() {
    TW.TabManager.closedTabs.clear();
    TW.TabManager.updateClosedCount();
    TW.corralTab.loadClosedTabs();
  });
}
TW.corralTab.loadClosedTabs = function() {
  $('#autocloseMessage').hide();
  $('.clearCorralMessage').hide();

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

  // Get saved closed tabs.
  var closedTabs = TW.TabManager.closedTabs.tabs;

  // Clear out the table.
  var $tbody = $('#corralTable tbody');
  $tbody.html('');

  // If we have no saved closed tabs, show the help text and quit.
  if ( closedTabs.length == 0 ) {
    $('#autocloseMessage').show();
    return;
  }


  $('.clearCorralMessage').show();

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

    $link = $('<a target="_blank" data-tabid="' + tab.id + '" href="' + tab.url + '">' + tab.title.shorten(70) + '</a>');
    $link.click(function() {
      TW.TabManager.closedTabs.tabs.splice(TW.TabManager.closedTabs.findById($(this).data('tabid')), 1);
      $(this).parent().remove();
    });
    $tr.append($('<td></td/>').append($link));
    // Url - not sure if we want this.
    // $tr.append($('<td>' + tab.url.shorten(70) + '</td>'));
    // time ago.
    $tr.append('<td>' + $.timeago(tab.closedAt) + '</td>');
    $tbody.append($tr);
  }
}

$(document).ready(function() {
  $('a[href="#tabCorral"]').tab('show');
  // Seems we need to force this since corral is the default.
  TW.corralTab.init();

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

