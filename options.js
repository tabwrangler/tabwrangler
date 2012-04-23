function save_options() {
  var m = parseInt(document.getElementById("minutes_inactive").value);
  var mt = parseInt(document.getElementById("max_tabs").value);

  if ( m > 0 && m < 720 ){
    localStorage["minutes_inactive"] = m;
  } else {
    window.alert("Must be greater than 0 and less than 720");
    return;
  }



  if (mt = parseInt(mt)) {
    localStorage["max_tabs"] = mt;
  } else {
    window.alert("Max tabs must be a number");
    return;
  }

  // Update status to let user know options were saved.
  var status = document.getElementById("status");
  status.innerHTML = "Saved.";
  setTimeout(function() { status.innerHTML = "";}, 4000);
}

function restore_options() {
  var m = localStorage["minutes_inactive"];
  var mt = localStorage["max_tabs"];
  m = m || 7;
  mt = mt || 50;
  document.getElementById("minutes_inactive").value = m;
  document.getElementById("max_tabs").value = mt;
}
