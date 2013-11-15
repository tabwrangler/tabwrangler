
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

Stack = (function(){
    /**
     * Subclassed JavaScript 1.5 Array for every browser.
     * @author      Andrea Giammarchi
     * @site        devpro.it
     * @blog        webreflection.blogspot.com
     * @date        2009/05/07
     * @requires    IE 5.5+ , FF 1+ , Opera 8+ , Safari 2+
     * @license     Mit Style
     */
    function Stack(){
        this.push.apply(this, Array.apply(null, arguments));
    };
    Stack.prototype = new Array;
    Stack.prototype.length = 0;
    if(!new Stack(1).length){
        Stack.prototype = {length:0};
        for(var
            split = "join.pop.push.reverse.shift.slice.sort.splice.unshift".split("."),
            length = split.length;
            length;
        )
            Stack.prototype[split[--length]] = Array.prototype[split[length]];
    };
    var toString= Object.prototype.toString,
        slice   = Array.prototype.slice,
        concat  = Array.prototype.concat
    ;
    Stack.prototype.concat = function(){
        for(var Array = this.slice(0), i = 0, length = arguments.length; i < length; ++i){
            if(toString.call(arguments[i]) != "[object Array]")
                arguments[i] = typeof arguments[i] == "object" ? slice.call(arguments[i]) : [arguments[i]];
        };
        Array.push.apply(Array, concat.apply([], arguments));
        return  Array;
    };
    Stack.prototype.toString = Stack.prototype.join;
    Stack.prototype.constructor = Stack;
    return  Stack;
})();