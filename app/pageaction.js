'use strict';

import $ from 'jquery';
import menus from './js/menus';

var TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
var tabmanager = TW.tabmanager;
var settings = TW.settings;

// Append all the buttons.
pageActions = menus.getPageActions();
pageActions.each(function(action) {
  $('pageActionButtons').append();
});
