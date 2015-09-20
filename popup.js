require([
], function() {

var TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
var tabmanager = TW.tabmanager;
var settings = TW.settings;

Popup = {};
Popup.Util = {};
Popup.Util.buildFaviconCol = function(url) {
  
   // Image cell.
  var $faviconCol = $('<td class="faviconCol"></td>');
  var $faviconColContent = $('<span class="faviconContent"></span>');
  $faviconCol.append($faviconColContent);
  if (url !== null && url !== undefined) {
    // We have an image to show.
    var $favicon = $('<img />')
    .addClass('lazy')
    .addClass('favicon')
    .attr('src', 'img/1px.png')
    .attr('data-src', url);
    $faviconColContent.append($favicon);
  } else {
    $faviconColContent.text('-');
  }

  return $faviconCol;
};

Popup.Util.secondsToMinutes =  function (seconds) {
  var s = seconds % 60;
  s = s >= 10 ? String(s) : "0" + String(s);
  return String(Math.floor(seconds / 60)) + ":" + s;
};


Popup.optionsTab = {};
/**
 * Initialization for options tab.
 * @param context
 *  Optionally used to limit jQueries
 */
Popup.optionsTab.init = function(context) {
  $('#saveOptionsBtn', context).click(Popup.optionsTab.saveOption);

  function onBlurInput() {
    var key = this.id;
    Popup.optionsTab.saveOption(key, $(this).val());
  }
  
  function onChangeCheckBox() {
    var key = this.id;
    if ($(this).attr('checked')) {
      Popup.optionsTab.saveOption(key, $(this).val());
    } else {
      Popup.optionsTab.saveOption(key, false);
    }
  }
  
  $('#minutesInactive').keyup(_.debounce(onBlurInput, 200));
  $('#minTabs').keyup(_.debounce(onBlurInput, 200));
  $('#maxTabs').keyup(_.debounce(onBlurInput, 200));
  $('#purgeClosedTabs').change(onChangeCheckBox);
  $('#showBadgeCount').change(onChangeCheckBox);

  Popup.optionsTab.loadOptions();
};


Popup.optionsTab.saveOption = function (key, value) {

  var errors = [];
  $('#status').html();

  try {
    settings.set(key, value);
  } catch (err) {
    errors.push(err);
  }
  
  
  $('#status').removeClass();
  $('#status').css('visibility', 'visible');
  $('#status').css('opacity', '100');

  if (errors.length === 0) {
    $('#status').html('Saving...');
    $('#status').addClass('alert-success').addClass('alert');
    $('#status').delay(50).animate({opacity:0});
  } else {
    var $errorList = $('<ul></ul>');
    for (var i=0; i< errors.length; i++) {
      $errorList.append('<li>' + errors[i].message + '</li>');
    }
    $('#status').append($errorList).addClass('alert-error').addClass('alert');
  }
  return false;
};

Popup.optionsTab.loadOptions = function () {
  $('#minutesInactive').val(settings.get('minutesInactive'));
  $('#minTabs').val(settings.get('minTabs'));
  $('#maxTabs').val(settings.get('maxTabs'));
  if (settings.get('purgeClosedTabs') !== false) {
    $('#purgeClosedTabs').attr('checked', true);
  }
  if (settings.get('showBadgeCount') !== false) {
    $('#showBadgeCount').attr('checked', true);
  }
  

  $('#whitelist').addOption = function(key, val) {
      this.append(
      $('<option />')
      .value(val)
      .text(key)
    );
  };

  var whitelist = settings.get('whitelist');
  Popup.optionsTab.buildWLTable(whitelist);

  var $wlInput = $('#wl-add');
  var $wlAdd = $('#addToWL');
  var isValid = function(pattern) {
    // some other choices such as '/' also do not make sense
    // not sure if they should be blocked as well
    return /\S/.test(pattern);
  };

  $wlInput.on('input', function() {
    if (isValid($wlInput.val())) {
      $wlAdd.removeAttr('disabled');
    }
    else {
      $wlAdd.attr('disabled', 'disabled');
    }
  });

  $wlAdd.click(function() {
    var value = $wlInput.val();
    // just in case
    if (!isValid(value)) {
      return;
    }
    whitelist.push(value);
    $wlInput.val('').trigger('input').focus();
    Popup.optionsTab.saveOption('whitelist', whitelist);
    Popup.optionsTab.buildWLTable(whitelist);
    return false;
  });
};

Popup.optionsTab.buildWLTable = function(whitelist) {
  var $wlTable = $('table#whitelist tbody');
  $wlTable.html('');
  for (var i=0; i < whitelist.length; i++) {
    $tr = $('<tr></tr>');
    $urlTd = $('<td></td>').text(whitelist[i]);
    $deleteLink = $('<a class="deleteLink" href="#">Remove</a>')
    .click(function() {
      whitelist.remove(whitelist.indexOf($(this).data('pattern')));
      Popup.optionsTab.saveOption('whitelist', whitelist);
      Popup.optionsTab.buildWLTable(whitelist);
    })
    .data('pattern', whitelist[i]);

    $tr.append($urlTd);
    $tr.append($('<td></td>').append($deleteLink));
    $wlTable.append($tr);
  }
};

// Active Tab
// @todo: rename this to lock tab, that's what it's for.;
Popup.activeTab = {};

Popup.activeTab.init = function(context) {
  this.context = context;
  chrome.tabs.getAllInWindow(null, function(tabs) { Popup.activeTab.buildTabLockTable(tabs);});
};

Popup.activeTab.saveLock = function(tabId) {
  tabmanager.lockTab(tabId);
};

Popup.activeTab.removeLock = function(tabId) {
  tabmanager.unlockTab();
};


/**
 * @param tabs
 * @return {Boolean}
 */
Popup.activeTab.buildTabLockTable = function (tabs) {
  var self = this;

  var tabNum = tabs.length;
  var $tbody = $('#activeTabs tbody');
  $tbody.html('');

  var lockedIds = settings.get("lockedIds");
      
  for (var i = 0; i < tabNum; i++) {
    console.log('wtf');
    var tabIsPinned = tabs[i].pinned;
    var tabWhitelistMatch = tabmanager.getWhitelistMatch(tabs[i].url);
    var tabIsLocked = tabIsPinned || tabWhitelistMatch || lockedIds.indexOf(tabs[i].id) != -1;

    // Create a new row.
    var $tr = $('<tr></tr>');
    $tr.attr('data-tabid', tabs[i].id);
    

    // Checkbox to lock it.
    //@todo: put the handler in its own function
    var $lock_box = $('<input />')
    .attr('type', 'checkbox')
    .attr('id', "cb" + tabs[i].id)
    .attr('value', tabs[i].id)
    .attr('checked', tabIsLocked)
    .attr('disabled', tabIsPinned || tabWhitelistMatch)
    .click(function () {
      if (this.checked) {
        self.saveLock(parseInt(this.value));
      } else {
        self.removeLock(parseInt(this.value));
      }
    });
    $tr.append($('<td></td>').append($lock_box));

    var $faviconCol = Popup.Util.buildFaviconCol(tabs[i].favIconUrl);
    $tr.append($faviconCol);

    // Page title.
    $tr.append($('<td><span class="tabTitle">' + tabs[i].title.shorten(70) + '</span><br/><span class="tabUrl">' + tabs[i].url.shorten(70) + '</td>'));

    if (!tabIsLocked) {
      $timer = $('<td class="time-left"></td>');
      $tr.append($timer);
    } else {
      var reason = 'Locked';
      if (tabIsPinned) {
          reason = 'Pinned';
      } else if (tabWhitelistMatch) {
          reason = $('<a href="#" title="' + tabWhitelistMatch + '">Auto-Lock</a>').click(function() {
            $('a[href="#tabOptions"]').tab('show');
          });
      }

      $tr.append($('<td class="lock-reason"></td>').append(reason));
    }
    // Append the row.
    $tbody.append($tr);
  }

  Popup.activeTab.updateCountdown();
  setInterval(Popup.activeTab.updateCountdown, 1000);

  return true;
};

Popup.activeTab.updateCountdown = function() {
  var self = this;
  $('.time-left').each(function() {
    var t = null;
    var myElem = $(this);
    var tabId = myElem.parent().data('tabid');
    if (settings.get('paused')) {
      myElem.html('paused');
    } else {
      var lastModified = tabmanager.tabTimes[tabId];
      var cutOff = new Date().getTime() - settings.get('stayOpen');
      var timeLeft = -1 * (Math.round((cutOff - lastModified) / 1000)).toString();
      myElem.html(Popup.Util.secondsToMinutes(timeLeft));
    }
  });
};

Popup.corralTab = {};

Popup.corralTab.init = function(context) {
  var self = this;
  
  // Setup interface elements
  $('#autocloseMessage').hide();
  $('.clearCorralMessage').hide();
  // @todo: use context to select table.
  tabmanager.searchTabs(function(closedTabs) {
    if ( closedTabs.length == 0 ) {
      // If we have no saved closed tabs, show the help text
      $('#autocloseMessage').show();
    } else {
      $('.clearCorralMessage').show();
    }
    return self.buildTable(closedTabs);
  });
  $('.clearCorralLink').click(function() {
    tabmanager.closedTabs.clear();
    tabmanager.updateClosedCount();
    Popup.corralTab.init();
    return;
  });
  
  if(location.search !== "?foo") {
    location.search = "?foo";
    throw new Error;  // load everything on the next page;
    // stop execution on this page
  }
  
  $('.corral-search').keyup(_.debounce(
  function() {
    var keyword = $(this).val();
    tabmanager.searchTabs(self.buildTable, [tabmanager.filters.keyword(keyword)]);
  }, 200));
  
  $('.corral-search').delay(1000).focus();
};

Popup.corralTab.buildTable = function(closedTabs) {
   
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
  
  // Clear out the table.
  var $tbody = $('#corralTable tbody');
  $tbody.html('');
  
  var now = new Date().getTime();
  separations = []
  separations.push([now - (1000 * 60 * 30), 'in the last 1/2 hour']);
  separations.push([now - (1000 * 60 * 60), 'in the last hour']);
  separations.push([now - (1000 * 60 * 60 * 2),'in the last 2 hours']);
  separations.push([now - (1000 * 60 * 60 * 24),'in the last day']);
  separations.push([0, 'more than a day ago']);
  
  function getGroup(time) {
    var limit, text, i;
    for (i=0; i < separations.length; i++) {
      limit = separations[i][0];
      text = separations[i][1];
      if (limit < time) {
        return text;
      }
    }
  }
  
  function createGroupRow(timeGroup, $tbody) {
    var $tr = $('<tr class="info"></tr>');
    $button = $('<button class="btn btn-mini btn-primary" style="float:right;">restore all</button>').click(function() {
      $('tr[data-group="' + timeGroup + '"]').each(function() {
        $('a', this).click();
      });
    });
    $td = $('<td colspan=3 class="timeGroupRow"> closed ' + timeGroup + '</td>').append($button);
    $tr.append($td);
    $tbody.append($tr);
  }
  
  function createTabRow(tab, group, $tbody) {
    // Create a new row.
    var $tr = $('<tr></tr>')
      .attr('data-group', group)
      .attr('data-tabid', tab.id);
   
    var $faviconCol = Popup.Util.buildFaviconCol(tab.favIconUrl);
    $faviconCol.append($('<i class="icon-remove" style="display:none"></i>'));

    $faviconCol.on('mouseover', function() {
      $('.faviconContent', $(this)).hide();
      $('.icon-remove', $(this)).show();
    });

    $faviconCol.on('mouseout', function() {
      $('.faviconContent', $(this)).show();
      $('.icon-remove', $(this)).hide();
    });

    $faviconCol.click(function() {
      tabmanager.closedTabs.removeTab($(this).parent().data('tabid'));
      $(this).parent().remove();
    });

    $tr.append($faviconCol);

    // Page title.

    // @todo: Add this logic back in:
    //    if ( urls[i] == "chrome://newtab/") {
    //      a_title.href = "javascript:openNewTab();";
    //    } else  if ( urls[i] == "chrome://extensions/") {
    //      a_title.href = "javascript:openExtTab();";
    //    } else {
    //      a_title.href = urls[i];
    //    }

    $link = $('<a target="_blank" href="' + tab.url + '">' + tab.title.shorten(70) + '</a>');

    // Create a new tab when clicked in the background
    // Remove from the closedTabs list.
    $link.click(function() {
      chrome.tabs.create({active:false, url: $(this).attr('href')});
      tabmanager.closedTabs.removeTab($(this).parent().parent().data('tabid'));
      $(this).parent().parent().remove();
      return false;
    });

    $tr.append($('<td></td/>').append($link));
    // Url - not sure if we want this.
    // $tr.append($('<td>' + tab.url.shorten(70) + '</td>'));
    // time ago.
    $tr.append('<td>' + $.timeago(tab.closedAt) + '</td>');
    $tbody.append($tr);
  }
  
  /** 
    * Testing code to make fake tags
    
    closedTabs = [];
    for (var i=0; i<20; i++) {
      now = new Date().getTime();
      x = Math.pow(2, i);
      closedTabs.push({closedAt: now-1000*1*x, title: 'foo'});
    }
  
  */
 
  var currentGroup = '';
  for ( var i = 0; i < closedTabs.length; i++) {
    var tab = closedTabs[i];
    
    timeGroup = getGroup(tab.closedAt);
    if (timeGroup != currentGroup) {
      createGroupRow(timeGroup, $tbody);
      currentGroup = timeGroup;
    }
    
    createTabRow(tab, currentGroup, $tbody);
    
  }
};

Popup.corralTab.filterByKeyword = function() {
  var keyword = $(this).val();
};


PauseButton = {};

PauseButton.init = function() {
  var self = this;
  if (settings.get('paused') === true) {
    this.pause();
  } else {
    this.play();
  }
  this.elem = $('a#pauseButton');

  this.elem.click(function() {
    if (settings.get('paused') === true) {
      self.play();
      settings.set('paused', false);
    } else {
      self.pause();
      settings.set('paused', true);
    }
  });
};

PauseButton.pause = function() {
  chrome.browserAction.setIcon({'path': 'img/icon-paused.png'});
  $('.unpaused-state', this.elem).hide();
  $('.paused-state', this.elem).show();
};

PauseButton.play = function() {
  chrome.browserAction.setIcon({'path': 'img/icon.png'});
  $('.paused-state',this.elem).hide();
  $('.unpaused-state', this.elem).show();
};

$(document).ready(function() {
  PauseButton.init();

  $('a[href="#tabCorral"]').tab('show');
  // Seems we need to force this since corral is the default.
  Popup.corralTab.init();

  $('#checkTimes').click(function() {
    //@todo: make that button work on lock tab.
  });

  $('a[data-toggle="tab"]').on('show', function (e) {
    var tabId = e.target.hash;
    switch (tabId) {
      case '#tabOptions':
        Popup.optionsTab.init($('div#tabOptions'));
        break;
      case '#tabActive':
        Popup.activeTab.init($('div#tabActive'));
        break;

      case '#tabCorral':
        Popup.corralTab.init($('div#tabCorral'));
        break;
    }
  });

  $('.lazy').jail();
});
});
