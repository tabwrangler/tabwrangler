function openExtTab() {
  chrome.tabs.create({'url':'chrome://extensions/'});
}

function openNewTab() {
  chrome.tabs.create({'url':'chrome://newtab/'});
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

  var table = document.getElementById('corralTableBody');
  removeChildrenFromNode(table);
  
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
    td_time.appendChild(document.createTextNode($.timeago(actions[i])));

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
}
