function getLsOr(LsString) {
    var ls = localStorage[LsString];
    var r;
    if ( !ls ) {
	return new Array();
    }
    return JSON.parse(ls);
}

function tooLong(a) {
  if ( a.length > 83 ) {
    return a.substring(0,80) + "...";
  }
  return a;
}


// function getLsOrObject(LsString) {
//     var ls = localStorage[LsString];
//     var r;
//     if ( !ls ) {
// 	return new Object();
//     }
//     return JSON.parse(ls);
// }

function addToCorral(new_id,new_title,new_url,new_icon,new_action) {
  var titles = getLsOr("closed_tab_titles");
  var urls = getLsOr("closed_tab_urls");
  var icons = getLsOr("closed_tab_icons");
  var actions = getLsOr("closed_tab_actions");

  titles.push(new_title);
  urls.push(new_url);
  icons.push(new_icon);
  actions.push(new_action);

  localStorage["closed_tab_titles"] = JSON.stringify(titles);
  localStorage["closed_tab_urls"] = JSON.stringify(urls);
  localStorage["closed_tab_icons"] = JSON.stringify(icons);
  localStorage["closed_tab_actions"] = JSON.stringify(actions);

}


