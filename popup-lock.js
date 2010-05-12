function openTabs(tabs) {
  var locked_ids = getLsOr("locked_ids");
  var tabNum = tabs.length;
  var table = document.getElementById('activeTable');

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

     var ptext = document.createTextNode(tooLong(tabs[i].title));
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

  return;
}
