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

  if (!errors) {
    // Update status to let user know options were saved.
    TW.settings.save();
    var status = document.getElementById("status");
    status.innerHTML = "Saved.";
    setTimeout(function() { status.innerHTML = "";}, 4000);
  } else {
    for (key in errors) {
      // If we had jquery, I would highlight or something.
      // KISS
      alert(errors[key]);
      //document.getElementById(key);
    }
  }
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
