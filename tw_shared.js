function getLsOr(LsString) {
    var ls = localStorage[LsString];
    var r;
    if ( !ls ) {
	return new Array();
    } 
    return JSON.parse(ls);
}


