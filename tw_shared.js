var TW = TW || {};

TW.settings = {
  loaded: false,
  cache: {},
  defaults: {
    checkInterval: 5000,
    minutesInactive: 7,
    maxTabs: 5
  }
}

TW.settings.get = function(key) {
  if (this.loaded == false) {
    this.load();
  }
  switch (typeof(this.cache[key])) {
    case 'function':
      return this.cache[key]();
      break;
    case 'undefined':
      if (this.defaults[key]) {
        return this.defaults[key];
      }
      throw Error('Undefined setting "' + key + '"');
      break;
    default:
      return this.cache[key];
  }
}

TW.settings.stayOpen = function() {
  return parseInt(this.get('minutesInactive')) * 60000;
}

TW.settings.resetToDefaults = function() {
  this.cache = {};
}

TW.settings.set = function(key, value) {
  this.cache[key] = value;
}

TW.settings.save = function() {
  localStorage['TWSettings'] = JSON.stringify(this.cache);
}

TW.settings.validate = function() {
  var errors = {}
  if (parseInt(this.cache['maxTabs']) != this.cache['maxTabs']) {
    errors['maxTabs'] = "Max tabs must be a number";
  }
  console.log(parseInt(this.cache['minutesInactive']));
  if ( parseInt(this.cache['minutesInactive']) < 0 || parseInt(this.cache['minutesInactive']) > 720 ){
    errors['minutesInactive'] = "Minutes Inactive must be greater than 0 and less than 720";
  }

  for(var i in errors) {
    if (errors.hasOwnProperty(i)) {
      return errors;
    }
  }
  return false;
}

TW.settings.load = function() {
  this.cache = JSON.parse(localStorage['TWSettings']);
  this.loaded = true;
}

TW.idleChecker = {
  lastRun: null,
  logRun: function(time) {
    this.lastRun = time;
  },
  timeSinceLastRun: function(time) {
    if (this.lastRun == null) {
      return 0;
    }
    return parseInt(time) - parseInt(this.lastRun);
  }
}

function removeChildrenFromNode(node) {

  var len = node.childNodes.length;
  node.innerHTML = '';
  // while (node.hasChildNodes()) {
  //   node.removeChild(node.firstChild);
  // }
}

function checkAutoLock(tab_id,url) {
  var wl_data = getLsOr("whitelist");
  var wl_len = wl_data.length;
  var locked_ids = getLsOr("locked_ids");

  for ( var i=0;i<wl_len;i++ ) {
    if ( url.indexOf(wl_data[i]) != -1 ) {
      if ( tab_id > 0 && locked_ids.indexOf(tab_id) == -1 ) {
	locked_ids.push(tab_id);
      }
    }
  }
  localStorage["locked_ids"] = JSON.stringify(locked_ids);
}




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


// in case needs to be called from multiple places...
function cleanLocked() {
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

 } );
  return true;
}



function addToCorral(new_id,new_title,new_url,new_icon,new_action) {
  var titles = getLsOr("closed_tab_titles");
  var urls = getLsOr("closed_tab_urls");
  var icons = getLsOr("closed_tab_icons");
  var actions = getLsOr("closed_tab_actions");
  var max_tabs = localStorage["max_tabs"];

  var extras = urls.length - max_tabs;
  if (extras < 0) {
    extras = 0;
  }
  
  titles.splice(0, extras, new_title);
  urls.splice(0, extras, new_url);
  icons.splice(0, extras, new_icon);
  actions.splice(0, extras, new_action);

  localStorage["closed_tab_titles"] = JSON.stringify(titles);
  localStorage["closed_tab_urls"] = JSON.stringify(urls);
  localStorage["closed_tab_icons"] = JSON.stringify(icons);
  localStorage["closed_tab_actions"] = JSON.stringify(actions);

}


