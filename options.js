function saveOptions() {
  for (var key in TW.settings.defaults) {
    var elem = document.getElementById(key);
    if (elem != undefined) {
      console.log(key);
      console.log(elem.value);
      TW.settings.set(key, elem.value);
      console.log(v);
    }
  }

  var errors = TW.settings.validate();

  $('#status').removeClass();

  if (!errors) {
    // Update status to let user know options were saved.
    TW.settings.save();
    $('#status').html('Options have been saved');

    $('#status').addClass('alert-success').addClass('alert');
    setTimeout(function() { status.innerHTML = "";}, 4000);
  } else {
    var $errorList = $('<ul></ul>');
    for (key in errors) {
      $errorList.append('<li>' + errors[key] + '</li>');
    }
    $('#status').append($errorList).addClass('alert-error').addClass('alert');

  }
  $('#status').show();
  $('#status').delay(5000).fadeOut(1000);
}

function loadOptions() {
  for (var key in TW.settings.defaults) {
    var elem = document.getElementById(key);
    if (elem != undefined) {
      console.log(key);
      v = TW.settings.get(key);
      console.log(v);
      elem.value = v;
    }
  }
}


function deleteWL() {
  var wl_select = document.getElementById('whitelist');
  var wl_data = getLsOr("whitelist");
  var selected = wl_select.options.selectedIndex;
  if ( selected != -1 ) {
    //wl_select.options[selected] = null;
    wl_data.splice(selected,1);
  }
  localStorage["whitelist"] = JSON.stringify(wl_data);
  updateWL();
}

function addWL() {
  var url = document.getElementById('wl_add').value;
  var wl_data = getLsOr("whitelist");
  if ( url.length > 0 && wl_data.indexOf(url) == -1 ) {
    wl_data.push(url);
    document.getElementById('wl_add').value= '';
  } else {
    //alert("Already in list");
  }
  localStorage["whitelist"] = JSON.stringify(wl_data);
  updateWL();
}

function updateWL() {
  var wl_data = getLsOr("whitelist");
  var wl_len = wl_data.length;
  var wl_select = document.getElementById('whitelist');
  wl_select.options.length = 0;
  for ( var i=0;i<wl_len;i++ ) {
    var tmp_opt = document.createElement('option');
    tmp_opt.appendChild(document.createTextNode(wl_data[i]));
    wl_select.appendChild(tmp_opt);
  }
}
