'use strict';

define("util", function() {
  return {
    getDomain: function(url) {
      return url.match(/[^:]+:\/\/([^\/]+)\//)[1];
    },
  };
});

String.prototype.shorten = function(length) {
  if ( this.length > (length + 3) ) {
    return this.substring(0, length) + "...";
  }
  return this;
};

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};
