function add_s(num,word) {
	num = Math.floor(num);
	if ( num == 1 ) {
		return num + ' ' + word + ' ago';
	} else {
		return num + ' ' + word + 's ago';
	}
}

function to_secs(a) {
    return Math.round(a/1000.0)
}

function time_since(ts) {

    seconds = to_secs(new Date().getTime()) - to_secs(ts);
	minutes = 0;
	hours = 0;
	days = 0;
	weeks = 0;
	months = 0;
	years = 0;
	if ( seconds == 0 ) seconds = 1;
	if ( seconds> 60 ) {
		minutes =  seconds/60;
	} else {
		return add_s(seconds,'second');
	}

	if ( minutes >= 60 ) {
		hours = minutes/60;
	} else {
		return add_s(minutes,'minute');
	}

	if ( hours >= 24) {
		days = hours/24;
	} else {
		return add_s(hours,'hour');
	}

	if ( days >= 7 ) {
		weeks = days/7;
	} else {
		return add_s(days,'day');
	}

	if ( weeks >= 4 ) {
		months = weeks/4;
	} else {
		return add_s(weeks,'week');
	}

	if ( months>= 12 ) {
		years = months/12;
		return add_s(years,'year');
	} else {
		return add_s(months,'month');
	}
}
