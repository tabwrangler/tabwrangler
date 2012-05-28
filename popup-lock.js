function showCloseUnlocked() {
  //give it time to catch up
  window.setTimeout(showCloseLink,500);
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
        //              alert("removing: " + locked_ids[x]);
        locked_ids.splice(locked_ids.indexOf(locked_ids[x]),1);
      }
    }
    localStorage["locked_ids"] = JSON.stringify(locked_ids);
    var tl = tabs.length;
    var do_unlocking = true;
    var cu = document.getElementById('close_unlocked');
    var lil = locked_ids.length;

    //            alert("LOCKED:"+lil + "(" + locked_ids.join(",") + ") | TOTAL:"+ tl);
    if ( lil < tl && lil > 0 ) {
      cu.style.display = 'inline';
    } else {
      cu.style.display = 'none';
    }
  } );

  return true;

}

function closeUnlocked() {
  chrome.tabs.getAllInWindow(null, checkToClose);
}


function saveLock(tab_id) {
  var locked_ids = getLsOr("locked_ids");

  if ( tab_id > 0 && locked_ids.indexOf(tab_id) == -1 ) {
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




/**
 * OMFG this is painful.  Jquery please.
 * @param tabs
 * @return {Boolean}
 */
function openTabs(tabs) {

  var tabNum = tabs.length;
  var table = document.getElementById('activeTableBody');
  removeChildrenFromNode(table);
  for ( var i=0; i < tabNum; i++ ) {
    checkAutoLock(tabs[i].id,tabs[i].url);
  }
  var locked_ids = getLsOr("locked_ids");
  for ( var i=0; i < tabNum; i++ ) {
     var tr = document.createElement("tr");
     var td_icon = document.createElement("td");
     if ( tabs[i].favIconUrl != null && tabs[i].favIconUrl != undefined && tabs[i].favIconUrl.length > 0 ) {
       var img_icon = document.createElement("img");
       img_icon.src = tabs[i].favIconUrl;
       img_icon.style.height =  "16px";
       img_icon.style.width = "16px";
       img_icon.style.border = "0px";
       img_icon.style.display = "inline";
       img_icon.style.margin="0px";
       img_icon.style.padding="0px";
     } else {
       td_icon.style.textAlign = "center";
       var img_icon = document.createTextNode("-");
    }
    td_icon.appendChild(img_icon);

    var td_title = document.createElement("td");
    td_title.style.fontSize ='.9em';
    td_title.style.fontWeight = 'bold';

    var ptext = document.createTextNode(tooLong(tabs[i].title)); //DEBUG: +tabs[i].id
     td_title.appendChild(ptext);
     var spanurl = document.createElement("span");
     spanurl.className = "smallgrey";
     spanurl.appendChild(document.createTextNode(tooLong(tabs[i].url)));

     td_title.appendChild(document.createElement("br"));
     td_title.appendChild(spanurl);

     var td_lock = document.createElement("td");
     var lock_box = document.createElement("input");
     lock_box.type = "checkbox";
     if ( locked_ids.indexOf(tabs[i].id) != -1 ) {
     	 lock_box.checked = true;
     }

     lock_box.id = "cb" + tabs[i].id;
     lock_box.value = tabs[i].id;
     lock_box.onclick = function() {
	 if ( this.checked ) {
	     saveLock(parseInt(this.value));
	 } else {
	     removeLock(parseInt(this.value));
	 }
	 showCloseUnlocked();
     };
     td_lock.appendChild(lock_box);

     tr.appendChild(td_lock);
     tr.appendChild(td_icon);
     tr.appendChild(td_title);
     table.appendChild(tr);
  }

  return true;
}
