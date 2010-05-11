function openNewTab() {
  chrome.tabs.create({'url':'chrome://newtab/'});
}

function openExtTab() {
  chrome.tabs.create({'url':'chrome://extensions/'});
}


function loadClosedTabs() {
  try {
    var titles = JSON.parse(localStorage["closed_tab_titles"]).reverse();
    var urls = JSON.parse(localStorage["closed_tab_urls"]).reverse();
    var icons = JSON.parse(localStorage["closed_tab_icons"]).reverse();
    var actions = JSON.parse(localStorage["closed_tab_actions"]).reverse();
    var closed_count = titles.length;
  } catch(e) {
    closed_count = 0;
  }

  //var table = document.createElement("table");
  var table = document.getElementById('corralTable');
  //table.className = "pretty";

  for ( var i = 0; i < closed_count; i++) {
     var tr = document.createElement("tr");
     var td_icon = document.createElement("td");
     if ( icons[i] != null && icons[i] != undefined && icons[i].length > 0 ) {
       var img_icon = document.createElement("img");

       img_icon.src = icons[i];
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
     tr.appendChild(td_icon);

     var td_title = document.createElement("td");

     var a_title = document.createElement("a");
     a_title.target = "_blank";
    if ( urls[i] == "chrome://newtab/") {
            a_title.href = "javascript:openNewTab();";
    } else  if ( urls[i] == "chrome://extensions/") {
            a_title.href = "javascript:openExtTab();";
    } else {
       a_title.href = urls[i];
    }
     var ptext = document.createTextNode(tooLong(titles[i]));
     a_title.appendChild(ptext);
    var spanurl = document.createElement("span");
    spanurl.className = "smallgrey";
    spanurl.appendChild(document.createTextNode(tooLong(urls[i])));

    td_title.appendChild(a_title);
    td_title.appendChild(document.createElement("br"));
    td_title.appendChild(spanurl);

    var td_time = document.createElement('td');
    td_time.className = "smallgrey";
    td_time.appendChild(document.createTextNode(time_since(actions[i])));


    tr.appendChild(td_title);
    tr.appendChild(td_time);
    table.appendChild(tr);
  }

  if ( closed_count == 0 ) {
    var tr_no = document.createElement('tr');
    var td_no = document.createElement('td');
    td_no.colSpan = '3';
    td_no.className = "smallgrey";
    td_no.style.textAlign = 'center';
    td_no.appendChild(document.createTextNode("No tabs have been wrangled...yet"));
    tr_no.appendChild(td_no);
    table.appendChild(tr_no);
  }

  //document.getElementById('corralDyn').appendChild(table);
}

function loadOpenTabs() {

  chrome.tabs.getAllInWindow(null, openTabs);
  //  alert('hello');
  return;
}

function openTabs(tabs) {
  var locked_ids = getLsOr("locked_ids");
  var tabNum = tabs.length;
  var table = document.getElementById('activeTable');
  //var table = document.createElement("table");
  //table.className = "pretty";

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

     var ptext = document.createTextNode(tooLong(tabs[i].title));
     td_title.appendChild(ptext);
     var spanurl = document.createElement("span");
     spanurl.className = "smallgrey";
     spanurl.appendChild(document.createTextNode(tooLong(tabs[i].url)));

     //td_title.appendChild(a_title);
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
     };
     td_lock.appendChild(lock_box);

     tr.appendChild(td_lock);
     tr.appendChild(td_icon);
     tr.appendChild(td_title);

     table.appendChild(tr);
  }
  //document.getElementById('activeDyn').appendChild(table);
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

  //  document.getElementById(pv+"Holder").style.display='block';
}

function tooLong(a) {
  if ( a.length > 83 ) {
    return a.substring(0,80) + "...";
  }
  return a;
}

window.onload = initTabWrangler;

