'use strict';

define("util", function() {
  return {
    getDomain: function(url) {
      return url.match(/[^:]+:\/\/([^\/]+)\//)[1];
    },
  };
});

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};
