function showCloseUnlocked() {
  //give it time to catch up
  window.setTimeout(showCloseLink, 500);
}

// function updateAutoLock() {
//   chrome.tabs.getAllInWindow(null, function (tabs) {
//     checkAutoLock(tabs[i].id,tabs[i].url);
//   });
//   return true;
// }

function showCloseLink() {
  var locked_ids = TW.settings.get("locked_ids");
  var cids = new Array();
  chrome.tabs.getAllInWindow(null, function (tabs) {

    var tlen = tabs.length;
    for (var i = 0; i < tlen; i++) {
      cids.push(tabs[i].id);

    }

    var lock_size = locked_ids.length;
    for (var x = 0; x < lock_size; x++) {
      if (cids.indexOf(locked_ids[x]) == -1) {
        //              alert("removing: " + locked_ids[x]);
        locked_ids.splice(locked_ids.indexOf(locked_ids[x]), 1);
      }
    }
    TW.settings.set('locked_ids', locked_ids);
    var tl = tabs.length;
    var do_unlocking = true;
    var cu = document.getElementById('close_unlocked');
    var lil = locked_ids.length;

    //            alert("LOCKED:"+lil + "(" + locked_ids.join(",") + ") | TOTAL:"+ tl);
    if (lil < tl && lil > 0) {
      cu.style.display = 'inline';
    } else {
      cu.style.display = 'none';
    }
  });

  return true;

}

function closeUnlocked() {
  chrome.tabs.getAllInWindow(null, checkToClose);
}


function saveLock(tab_id) {
  var locked_ids = TW.settings.get("locked_ids");

  if (tab_id > 0 && locked_ids.indexOf(tab_id) == -1) {
    locked_ids.push(tab_id);
  }
  TW.settings.set('locked_ids', locked_ids);
  TW.settings.save();
}

function removeLock(tab_id) {
  var locked_ids = TW.settings.get("locked_ids");
  if (locked_ids.indexOf(tab_id) > -1) {
    locked_ids.splice(locked_ids.indexOf(tab_id), 1);
  }
  TW.settings.set('locked_ids', locked_ids);
  TW.settings.save();
}


/**
 * OMFG this is painful.  Jquery please.
 * @param tabs
 * @return {Boolean}
 */
function buildTabLockTable(tabs) {

  var tabNum = tabs.length;
  var $tbody = $('#activeTabs tbody');

  for (var i = 0; i < tabNum; i++) {
    checkAutoLock(tabs[i].id, tabs[i].url);
  }
  var locked_ids = TW.settings.get("locked_ids");
  for (var i = 0; i < tabNum; i++) {

    // Create a new row.
    var $tr = $('<tr></tr>');

    // Checkbox to lock it.
    //@todo: put the handler in its own function
    console.log(locked_ids.indexOf(tabs[i].id));
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
    $tr.append($('<td>' + tooLong(tabs[i].title) + '</td>'));
    // Url
    $tr.append($('<td>' + tooLong(tabs[i].url) + '</td>'));

    // Append the row.
    $tbody.append($tr);
  }

  return true;
}
