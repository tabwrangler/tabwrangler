'use strict';

require([
  'bootstrap',
  'bootstrap-tab',
  'jquery',
  'jquery-timeago',
  'react',
  'react-dom',
  'underscore',
  'util'
], function(Bootstrap, BootstrapTabs, $, timeago, React, ReactDOM, _, util) {

  var TW = chrome.extension.getBackgroundPage().TW;

  // Unpack TW.
  var tabmanager = TW.tabmanager;
  var settings = TW.settings;

  var Popup = {};
  Popup.Util = {};
  Popup.Util.buildFaviconCol = function(url) {

     // Image cell.
    var $faviconCol = $('<td class="faviconCol"></td>');
    var $faviconColContent = $('<span class="faviconContent"></span>');
    $faviconCol.append($faviconColContent);
    if (url !== null && url !== undefined) {
      // We have an image to show.
      var $favicon = $('<img />')
        .addClass('favicon')
        .attr('height', 16)
        .attr('src', url)
        .attr('width', 16);
      $faviconColContent.append($favicon);
    } else {
      $faviconColContent.text('-');
    }

    return $faviconCol;
  };

  Popup.Util.secondsToMinutes =  function (seconds) {
    var s = seconds % 60;
    s = s > 10 ? String(s) : "0" + String(s);
    return String(Math.floor(seconds / 60)) + ":" + s;
  };


  Popup.optionsTab = {};
  /**
   * Initialization for options tab.
   * @param context
   *  Optionally used to limit jQueries
   */
  Popup.optionsTab.init = function(context) {
    $('#saveOptionsBtn', context).click(Popup.optionsTab.saveOption);

    function onBlurInput() {
      var key = this.id;
      Popup.optionsTab.saveOption(key, $(this).val());
    }

    function onChangeCheckBox() {
      var key = this.id;
      if ($(this).attr('checked')) {
        Popup.optionsTab.saveOption(key, $(this).val());
      } else {
        Popup.optionsTab.saveOption(key, false);
      }
    }

    $('#minutesInactive').keyup(_.debounce(onBlurInput, 200));
    $('#minTabs').keyup(_.debounce(onBlurInput, 200));
    $('#maxTabs').keyup(_.debounce(onBlurInput, 200));
    $('#purgeClosedTabs').change(onChangeCheckBox);
    $('#showBadgeCount').change(onChangeCheckBox);

    Popup.optionsTab.loadOptions();
  };


  Popup.optionsTab.saveOption = function (key, value) {

    var errors = [];
    $('#status').html();

    try {
      settings.set(key, value);
    } catch (err) {
      errors.push(err);
    }


    $('#status').removeClass();
    $('#status').css('visibility', 'visible');
    $('#status').css('opacity', '100');

    if (errors.length === 0) {
      $('#status').html('Saving...');
      $('#status').addClass('alert-success').addClass('alert');
      $('#status').delay(50).animate({opacity:0});
    } else {
      var $errorList = $('<ul></ul>');
      for (var i=0; i< errors.length; i++) {
        $errorList.append('<li>' + errors[i].message + '</li>');
      }
      $('#status').append($errorList).addClass('alert-error').addClass('alert');
    }
    return false;
  };

  Popup.optionsTab.loadOptions = function () {
    $('#minutesInactive').val(settings.get('minutesInactive'));
    $('#minTabs').val(settings.get('minTabs'));
    $('#maxTabs').val(settings.get('maxTabs'));
    if (settings.get('purgeClosedTabs') !== false) {
      $('#purgeClosedTabs').attr('checked', true);
    }
    if (settings.get('showBadgeCount') !== false) {
      $('#showBadgeCount').attr('checked', true);
    }


    $('#whitelist').addOption = function(key, val) {
        this.append(
        $('<option />')
        .value(val)
        .text(key)
      );
    };

    var whitelist = settings.get('whitelist');
    Popup.optionsTab.buildWLTable(whitelist);

    var $wlInput = $('#wl-add');
    var $wlAdd = $('#addToWL');
    var isValid = function(pattern) {
      // some other choices such as '/' also do not make sense
      // not sure if they should be blocked as well
      return /\S/.test(pattern);
    };

    $wlInput.on('input', function() {
      if (isValid($wlInput.val())) {
        $wlAdd.removeAttr('disabled');
      }
      else {
        $wlAdd.attr('disabled', 'disabled');
      }
    });

    $wlAdd.click(function() {
      var value = $wlInput.val();
      // just in case
      if (!isValid(value)) {
        return;
      }
      whitelist.push(value);
      $wlInput.val('').trigger('input').focus();
      Popup.optionsTab.saveOption('whitelist', whitelist);
      Popup.optionsTab.buildWLTable(whitelist);
      return false;
    });
  };

  Popup.optionsTab.buildWLTable = function(whitelist) {
    var $wlTable = $('table#whitelist tbody');
    $wlTable.html('');
    for (var i=0; i < whitelist.length; i++) {
      var $tr = $('<tr></tr>');
      var $urlTd = $('<td></td>').text(whitelist[i]);
      var $deleteLink = $('<a class="deleteLink" href="#">Remove</a>')
        .click(function() {
          whitelist.remove(whitelist.indexOf($(this).data('pattern')));
          Popup.optionsTab.saveOption('whitelist', whitelist);
          Popup.optionsTab.buildWLTable(whitelist);
        })
        .data('pattern', whitelist[i]);

      $tr.append($urlTd);
      $tr.append($('<td></td>').append($deleteLink));
      $wlTable.append($tr);
    }
  };

  // Active Tab
  // @todo: rename this to lock tab, that's what it's for.;
  Popup.activeTab = {};

  Popup.activeTab.init = function(context) {
    this.context = context;
    chrome.tabs.getAllInWindow(null, function(tabs) { Popup.activeTab.buildTabLockTable(tabs);});
  };

  Popup.activeTab.saveLock = function(tabId) {
    tabmanager.lockTab(tabId);
  };

  Popup.activeTab.removeLock = function(tabId) {
    tabmanager.unlockTab();
  };


  /**
   * @param tabs
   * @return {Boolean}
   */
  Popup.activeTab.buildTabLockTable = function (tabs) {
    var self = this;

    var tabNum = tabs.length;
    var $tbody = $('#activeTabs tbody');
    $tbody.html('');

    var lockedIds = settings.get("lockedIds");

    for (var i = 0; i < tabNum; i++) {
      var tabIsPinned = tabs[i].pinned;
      var tabWhitelistMatch = tabmanager.getWhitelistMatch(tabs[i].url);
      var tabIsLocked = tabIsPinned || tabWhitelistMatch || lockedIds.indexOf(tabs[i].id) != -1;

      // Create a new row.
      var $tr = $('<tr></tr>');
      $tr.attr('data-tabid', tabs[i].id);

      // Checkbox to lock it.
      //@todo: put the handler in its own function
      var $lock_box = $('<input />')
      .attr('type', 'checkbox')
      .attr('id', "cb" + tabs[i].id)
      .attr('value', tabs[i].id)
      .attr('checked', tabIsLocked)
      .attr('disabled', tabIsPinned || tabWhitelistMatch)
      .click(function () {
        if (this.checked) {
          self.saveLock(parseInt(this.value));
        } else {
          self.removeLock(parseInt(this.value));
        }
      });
      $tr.append($('<td></td>').append($lock_box));

      var $faviconCol = Popup.Util.buildFaviconCol(tabs[i].favIconUrl);
      $tr.append($faviconCol);

      // Page title.
      $tr.append($('<td><span class="tabTitle">' + tabs[i].title.shorten(70) + '</span><br/><span class="tabUrl">' + tabs[i].url.shorten(70) + '</td>'));

      if (!tabIsLocked) {
        var $timer = $('<td class="time-left"></td>');
        $tr.append($timer);
      } else {
        var reason = 'Locked';
        if (tabIsPinned) {
            reason = 'Pinned';
        } else if (tabWhitelistMatch) {
            reason = $('<a href="#" title="' + tabWhitelistMatch + '">Auto-Lock</a>').click(function() {
              $('a[href="#tabOptions"]').tab('show');
            });
        }

        $tr.append($('<td class="lock-reason"></td>').append(reason));
      }
      // Append the row.
      $tbody.append($tr);
    }

    Popup.activeTab.updateCountdown();
    setInterval(Popup.activeTab.updateCountdown, 1000);

    return true;
  };

  Popup.activeTab.updateCountdown = function() {
    var self = this;
    $('.time-left').each(function() {
      var t = null;
      var myElem = $(this);
      var tabId = myElem.parent().data('tabid');
      if (settings.get('paused')) {
        myElem.html('paused');
      } else {
        var lastModified = tabmanager.tabTimes[tabId];
        var cutOff = new Date().getTime() - settings.get('stayOpen');
        var timeLeft = -1 * (Math.round((cutOff - lastModified) / 1000)).toString();
        myElem.html(Popup.Util.secondsToMinutes(timeLeft));
      }
    });
  };

  class ClosedTabGroupHeader extends React.PureComponent {
    constructor(props) {
      super(props);
      this.handleClickRestoreAll = this.handleClickRestoreAll.bind(this);
    }

    handleClickRestoreAll() {
      this.props.onRestoreAll(this.props.title);
    }

    render() {
      return (
        <tr className="info">
          <td colSpan="3" className="timeGroupRow">
            <button
              className="btn btn-mini btn-primary pull-right"
              onClick={this.handleClickRestoreAll}>
              restore all
            </button>
            closed {this.props.title}
          </td>
        </tr>
      );
    }
  }

  class ClosedTabRow extends React.PureComponent {
    constructor() {
      super();

      this.state = {
        active: false,
      };

      this.handleMouseEnter = this.handleMouseEnter.bind(this);
      this.handleMouseLeave = this.handleMouseLeave.bind(this);
      this.openTab = this.openTab.bind(this);
      this.removeTabFromList = this.removeTabFromList.bind(this);
    }

    handleMouseEnter() {
      this.setState({active: true});
    }

    handleMouseLeave() {
      this.setState({active: false});
    }

    openTab(event) {
      const {tab} = this.props;
      event.preventDefault();
      this.props.onOpenTab(tab.id, tab.url);
    }

    removeTabFromList(event) {
      this.props.onRemoveTabFromList(this.props.tab.id);
    }

    render() {
      const {tab} = this.props;

      let favicon;
      if (this.state.active) {
        favicon = (
          <i
            className="btn-remove icon-remove"
            onClick={this.removeTabFromList}
            title="Remove tab from list"
          />
        );
      } else {
        favicon = (tab.favIconUrl == null)
          ? '-'
          : <img className="favicon" height="16" src={tab.favIconUrl} width="16" />;
      }

      return (
        <tr onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td className="faviconCol">
            {favicon}
          </td>
          <td>
            <a target="_blank" href={tab.url} onClick={this.openTab}>
              {tab.title.shorten(70)}
            </a>
          </td>
          <td>
            {$.timeago(tab.closedAt)}
          </td>
        </tr>
      );
    }
  }

  class CorralTab extends React.Component {
    constructor() {
      super();

      this.state = {
        closedTabGroups: [],
        filter: '',
      };

      this.clearList = this.clearList.bind(this);
      this.handleRemoveTabFromList = this.handleRemoveTabFromList.bind(this);
      this.handleRestoreAllFromGroup = this.handleRestoreAllFromGroup.bind(this);
      this.openTab = this.openTab.bind(this);
      this.setClosedTabs = this.setClosedTabs.bind(this);
      this.setFilter = this.setFilter.bind(this);
    }

    componentDidMount() {
      // TODO: This is assumed to be synchronous. If it becomes async, this state needs to be
      // hoisted so this component does not need to track whether it's mounted.
      tabmanager.searchTabs(this.setClosedTabs);
    }

    clearList() {
      tabmanager.closedTabs.clear();
      tabmanager.updateClosedCount();
      this.setState({
        closedTabGroups: [],
      });
    }

    handleRemoveTabFromList(tabId) {
      tabmanager.closedTabs.removeTab(tabId);
      tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(this.state.filter)]);
      this.forceUpdate();
    }

    handleRestoreAllFromGroup(groupTitle) {
      const group = _.findWhere(this.state.closedTabGroups, {title: groupTitle});
      group.tabs.forEach(tab => {
        chrome.tabs.create({active: false, url: tab.url});
        tabmanager.closedTabs.removeTab(tab.id);
      });
      tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(this.state.filter)]);
      this.forceUpdate();
    }

    openTab(tabId, url) {
      chrome.tabs.create({active: false, url});
      tabmanager.closedTabs.removeTab(tabId);
      tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(this.state.filter)]);
      this.forceUpdate();
    }

    setClosedTabs(closedTabs) {
      const now = new Date().getTime();
      const separations = []
      separations.push([now - (1000 * 60 * 30), 'in the last 1/2 hour']);
      separations.push([now - (1000 * 60 * 60), 'in the last hour']);
      separations.push([now - (1000 * 60 * 60 * 2),'in the last 2 hours']);
      separations.push([now - (1000 * 60 * 60 * 24),'in the last day']);
      separations.push([0, 'more than a day ago']);

      function getGroup(time) {
        let limit, text;
        for (let i = 0; i < separations.length; i++) {
          limit = separations[i][0];
          text = separations[i][1];
          if (limit < time) {
            return text;
          }
        }
      }

      const closedTabGroups = [];
      let currentGroup;
      for (let i = 0; i < closedTabs.length; i++) {
        var tab = closedTabs[i];
        var timeGroup = getGroup(tab.closedAt);

        if (timeGroup !== currentGroup) {
          currentGroup = _.findWhere(closedTabGroups, {title: timeGroup});

          if (currentGroup == null) {
            currentGroup = {
              tabs: [],
              title: timeGroup,
            };
            closedTabGroups.push(currentGroup);
          }
        }

        currentGroup.tabs.push(tab)
      }

      this.setState({closedTabGroups});
    }

    setFilter(event) {
      const filter = event.target.value;
      this.setState({filter});
      tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(filter)]);
    }

    render() {
      const tableRows = [];
      this.state.closedTabGroups.forEach(closedTabGroup => {
        tableRows.push(
          <ClosedTabGroupHeader
            key={`ctgh-${closedTabGroup.title}`}
            onRestoreAll={this.handleRestoreAllFromGroup}
            title={closedTabGroup.title}
          />
        );

        closedTabGroup.tabs.forEach(tab => {
          tableRows.push(
            <ClosedTabRow
              key={`ctr-${tab.id}`}
              onOpenTab={this.openTab}
              onRemoveTabFromList={this.handleRemoveTabFromList}
              tab={tab}
            />
          );
        });
      });

      const messageElement = this.state.closedTabGroups.length === 0
        ? <div id="autocloseMessage" className="alert alert-info">If tabs are closed automatically, they will be stored here</div>
        : (
          <div className="clearCorralMessage alert alert-info">
            <a className="clearCorralLink" href="#" onClick={this.clearList}>Clear list</a>
          </div>
        );

      return (
        <div className="tab-pane active" id="tabCorral">
          <form className="form-search">
            <input
              className="span8 corral-search search-query"
              name="search"
              onChange={this.setFilter}
              placeholder="search"
              ref={(_corralSearch) => { this._corralSearch = _corralSearch; }}
              type="search"
              value={this.state.filter}
            />
          </form>

          <table id="corralTable" className="table-condensed table-striped table table-bordered">
            <thead>
              <tr>
                <th className="faviconCol"><i className="icon-remove"></i></th>
                <th>Title</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {tableRows}
            </tbody>
          </table>

          {messageElement}
        </div>
      );
    }
  }

  class PauseButton extends React.PureComponent {
    constructor() {
      super();

      this.state = {
        paused: settings.get('paused'),
      };

      this.pause = this.pause.bind(this);
      this.play = this.play.bind(this);
    }

    pause() {
      chrome.browserAction.setIcon({'path': 'img/icon-paused.png'});
      settings.set('paused', true);
      this.setState({paused: true});
    }

    play() {
      chrome.browserAction.setIcon({'path': 'img/icon.png'});
      settings.set('paused', false);
      this.setState({paused: false});
    }

    render() {
      const action = this.state.paused
        ? this.play
        : this.pause;

      const content = this.state.paused
        ? <span><i className="icon-play"></i> Play</span>
        : <span><i className="icon-pause"></i> Pause</span>;

      return (
        <button className="btn btn-mini" onClick={action}>
          {content}
        </button>
      );
    }
  }

  class Header extends React.PureComponent {
    render() {
      return (
        <div>
          <div className="pull-right nav-buttons">
            <PauseButton />{' '}
            <a
              className="btn btn-mini"
              href="https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/reviews"
              target="_blank">
              <i className="icon-star"></i> Review Tab Wrangler
            </a>
          </div>
          <ul className="nav nav-tabs">
            <li><a href="#tabCorral" target="#tabCorral" data-toggle="tab">Tab Corral</a></li>
            <li><a href="#tabActive" target="#tabActive" data-toggle="tab">Tab Lock</a></li>
            <li><a href="#tabOptions" target="#tabOptions" data-toggle="tab">Options</a></li>
          </ul>
        </div>
      );
    }
  }

  class PopupContent extends React.PureComponent {
    render() {
      return (
        <div>
          <Header />
          <div className="tab-content container-fluid">
            <div className="tab-pane" id="tabOptions">
              <form>
                <fieldset>
                  <legend>Settings</legend>
                  <p>
                    <label for="minutesInactive">Close inactive tabs after:</label>
                    <input type="text" id="minutesInactive" className="span1" name="minutesInactive" /> minutes.
                  </p>
                  <p>
                    <label for="minTabs">Don't auto-close if I only have</label>
                    <input type="text" id="minTabs" className="span1" name="minTabs" /> tabs open (does not include pinned or locked tabs).
                  </p>
                  <p>
                    <label for="showBadgeCount">Remember up to</label>
                    <input type="text" id="maxTabs" className="span1" name="maxTabs" /> closed tabs.
                  </p>
                  <p>
                    <label for="purgeClosedTabs" className="checkbox">Clear closed tabs list on quit
                      <input type="checkbox" id="purgeClosedTabs" className="span1" name="purgeClosedTabs" />
                    </label>
                  </p>
                  <p>
                    <label for="showBadgeCount" className="checkbox">Show # of closed tabs in url bar
                      <input type="checkbox" id="showBadgeCount" className="span1" name="showBadgeCount" />
                    </label>
                  </p>
                </fieldset>

                <div id="status" className="alert alert-success" style={{visibility: 'hidden'}}></div>

                <fieldset>
                  <legend>Auto-Lock</legend>
                  <label for="wl-add">tabs with urls "like":</label>
                  <input type="text" id="wl-add" />
                  <button className="btn-mini add-on" id="addToWL" disabled>Add</button>

                  <table className="table table-bordered table-striped" id="whitelist">
                    <thead>
                      <th>Url pattern</th>
                      <th></th>
                    </thead>
                    <tbody>
                    </tbody>
                  </table>
                  <span className="help-block">
                    Example: <i>cnn</i> would match every page on cnn.com and any URL with cnn anywhere in url.
                  </span>
                </fieldset>
              </form>
            </div>

            <CorralTab />

            <div className="tab-pane" id="tabActive">
              <div className="alert alert-info">Click the checkbox to lock the tab (prevent it from auto-closing).</div>
              <table id="activeTabs" className="table-striped table table-bordered">
                <thead>
                  <tr>
                    <th className="narrowColumn"><img src="img/lock.png"/></th>
                    <th className="narrowColumn"></th>
                    <th>Tab</th>
                    <th className="countdownColumn">Closing in</th>
                  </tr>
                </thead>
                <tbody>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
  }

  ReactDOM.render(
    <PopupContent />,
    document.getElementById('popup'),
    () => {
      $('a[href="#tabCorral"]').tab('show');

      $('a[data-toggle="tab"]').on('show', function (e) {
        var tabId = e.target.hash;
        switch (tabId) {
          case '#tabOptions':
            Popup.optionsTab.init($('div#tabOptions'));
            break;
          case '#tabActive':
            Popup.activeTab.init($('div#tabActive'));
            break;
        }
      });
    }
  );
});
