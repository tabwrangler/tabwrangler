var TW = chrome.extension.getBackgroundPage().TW;

$(document).ready(function() {
  var urlParams = {};
  (function () {
      var match,
          pl     = /\+/g,  // Regex for replacing addition symbol with a space
          search = /([^&=]+)=?([^&]*)/g,
          decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
          query  = window.location.search.substring(1);

      while (match = search.exec(query))
        urlParams[decode(match[1])] = decode(match[2]);
  })();
  
  var content = 'Empty notification.  Something went wrong here!';
  var title = "Tab Wrangler";
  
  if (typeof urlParams['title'] != 'undefined') {
    title = urlParams['title'];
  }
  
  if (typeof urlParams['message'] != 'undefined') {
    content = urlParams['message'];
    
  } else if (typeof urlParams['file'] != 'undefined') {
    $.get('notifications/' + urlParams['file'], {}, function(data) {content = data});
  }
  
  $('#main').html(content);
  $('#title').text(title)
  
});