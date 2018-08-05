/* @flow */

import './CorralTab.css';
import { Sticky, StickyContainer } from 'react-sticky';
import { Table, WindowScroller } from 'react-virtualized';
import ClosedTabRow from './ClosedTabRow';
import type { Dispatch } from './Types';
import React from 'react';
import { connect } from 'react-redux';
import cx from 'classnames';
import extractHostname from './extractHostname';
import extractRootDomain from './extractRootDomain';
import { removeSavedTabs } from './actions/localStorageActions';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const { tabmanager } = TW;

function keywordFilter(keyword: string) {
  return function(tab: chrome$Tab) {
    const test = new RegExp(keyword, 'i');
    return (tab.title != null && test.exec(tab.title)) || (tab.url != null && test.exec(tab.url));
  };
}

type Sorter = {
  label: string,
  shortLabel: string,
  sort: (a: ?chrome$Tab, b: ?chrome$Tab) => number,
};

const AlphaSorter: Sorter = {
  label: chrome.i18n.getMessage('corral_sortPageTitle') || '',
  shortLabel: chrome.i18n.getMessage('corral_sortPageTitle_short') || '',
  sort(tabA, tabB) {
    if (tabA == null || tabB == null || tabA.title == null || tabB.title == null) {
      return 0;
    } else {
      return tabA.title.localeCompare(tabB.title);
    }
  },
};

const ReverseAlphaSorter: Sorter = {
  label: chrome.i18n.getMessage('corral_sortPageTitle_descending') || '',
  shortLabel: chrome.i18n.getMessage('corral_sortPageTitle_descending_short') || '',
  sort(tabA, tabB) {
    return -1 * AlphaSorter.sort(tabA, tabB);
  },
};

const ChronoSorter: Sorter = {
  label: chrome.i18n.getMessage('corral_sortTimeClosed') || '',
  shortLabel: chrome.i18n.getMessage('corral_sortTimeClosed_short') || '',
  sort(tabA, tabB) {
    if (tabA == null || tabB == null) {
      return 0;
    } else {
      // $FlowFixMe `closedAt` is an expando property on `chrome$Tab`
      return tabA.closedAt - tabB.closedAt;
    }
  },
};

const ReverseChronoSorter: Sorter = {
  label: chrome.i18n.getMessage('corral_sortTimeClosed_descending') || '',
  shortLabel: chrome.i18n.getMessage('corral_sortTimeClosed_descending_short') || '',
  sort(tabA, tabB) {
    return -1 * ChronoSorter.sort(tabA, tabB);
  },
};

const DomainSorter: Sorter = {
  label: chrome.i18n.getMessage('corral_sortDomain') || '',
  shortLabel: chrome.i18n.getMessage('corral_sortDomain_short') || '',
  sort(tabA, tabB) {
    if (tabA == null || tabB == null || tabA.url == null || tabB.url == null) {
      return 0;
    } else {
      const tabAUrl = tabA.url;
      const tabBUrl = tabB.url;
      const tabAHostname = extractHostname(tabAUrl);
      const tabBHostname = extractHostname(tabBUrl);
      const tabARootDomain = extractRootDomain(tabAUrl);
      const tabBRootDomain = extractRootDomain(tabBUrl);
      // Sort by root domain, then by hostname (like the subdomain), and then by closing time. This
      // gives a predictable sorting order at each level of sort.
      return (
        tabARootDomain.localeCompare(tabBRootDomain) ||
        tabAHostname.localeCompare(tabBHostname) ||
        ReverseChronoSorter.sort(tabA, tabB)
      );
    }
  },
};

const ReverseDomainSorter: Sorter = {
  label: chrome.i18n.getMessage('corral_sortDomain_descending') || '',
  shortLabel: chrome.i18n.getMessage('corral_sortDomain_descending_short') || '',
  sort(tabA, tabB) {
    return -1 * DomainSorter.sort(tabA, tabB);
  },
};

const Sorters: Array<Sorter> = [
  DomainSorter,
  ReverseDomainSorter,
  AlphaSorter,
  ReverseAlphaSorter,
  ChronoSorter,
  ReverseChronoSorter,
];

export function sessionFuzzyMatchesTab(session: chrome$Session, tab: chrome$Tab) {
  // Sessions' `lastModified` is only accurate to the second in Chrome whereas `closedAt` is
  // accurate to the millisecond. Convert to ms if needed.
  const lastModifiedMs =
    session.lastModified < 10000000000 ? session.lastModified * 1000 : session.lastModified;

  return (
    session.tab != null &&
    // Tabs with no favIcons have the value `undefined`, but once converted into a session the tab
    // has an empty string (`''`) as its favIcon value. Account for that case for "equality".
    (session.tab.favIconUrl === tab.favIconUrl ||
      (session.tab.favIconUrl === '' && tab.favIconUrl == null)) &&
    session.tab.title === tab.title &&
    session.tab.url === tab.url &&
    // Ensure the browser's last modified time is within 1s of Tab Wrangler's close to as a fuzzy,
    // but likely always correct, match.
    // $FlowFixMe
    Math.abs(lastModifiedMs - tab.closedAt) < 1000
  );
}

function rowRenderer({ key, rowData, style }) {
  return (
    <ClosedTabRow
      isSelected={rowData.isSelected}
      key={key}
      onOpenTab={rowData.onOpenTab}
      onRemoveTab={rowData.onRemoveTab}
      onRestoreSession={rowData.onRestoreSession}
      onToggleTab={rowData.onToggleTab}
      session={rowData.session}
      style={style}
      tab={rowData.tab}
    />
  );
}

type Props = {
  dispatch: Dispatch,
  savedTabs: Array<chrome$Tab>,
  sessions: Array<chrome$Session>,
  totalTabsRemoved: number,
  totalTabsWrangled: number,
};

type State = {
  filter: string,
  isSortDropdownOpen: boolean,
  selectedTabs: Set<chrome$Tab>,
  sorter: Sorter,
};

class CorralTab extends React.Component<Props, State> {
  _dropdownRef: ?HTMLElement;
  _lastSelectedTab: ?chrome$Tab;
  _searchRefFocusTimeout: TimeoutID;
  _searchRef: ?HTMLElement;

  constructor(props: Props) {
    super(props);
    this.state = {
      filter: '',
      isSortDropdownOpen: false,
      selectedTabs: new Set(),
      sorter: ReverseChronoSorter,
    };
  }

  componentDidMount() {
    // Focus the search input so it's simple to type immediately. This must be done after the popup
    // is available, which is roughly 150ms after the popup is opened (determined empirically). Use
    // 250ms to ensure this always works.
    this._searchRefFocusTimeout = setTimeout(() => {
      if (this._searchRef != null) this._searchRef.focus();
    }, 350);

    window.addEventListener('click', this._handleWindowClick);
    window.addEventListener('keypress', this._handleKeypress);
  }

  componentWillUnmount() {
    clearTimeout(this._searchRefFocusTimeout);
    window.removeEventListener('click', this._handleWindowClick);
    window.removeEventListener('keypress', this._handleKeypress);
  }

  _areAllClosedTabsSelected() {
    const closedTabs = this._getClosedTabs();
    return closedTabs.length > 0 && closedTabs.every(tab => this.state.selectedTabs.has(tab));
  }

  _clearFilter = () => {
    this._setFilter('');
  };

  _clickSorter(sorter: Sorter, event: SyntheticMouseEvent<HTMLElement>) {
    // The dropdown wraps items in bogus `<a href="#">` elements in order to match Bootstrap's
    // style. Prevent default on the event in order to prevent scrolling to the top of the window
    // (the default action for an empty anchor "#").
    event.preventDefault();
    if (sorter === this.state.sorter) {
      // If this is already the active sorter, close the dropdown and do no work since the state is
      // already correct.
      this.setState({ isSortDropdownOpen: false });
    } else {
      this.setState({
        isSortDropdownOpen: false,
        sorter,
      });
    }
  }

  _getClosedTabs() {
    const filteredTabs = this._searchTabs();
    return filteredTabs.sort(this.state.sorter.sort);
  }

  _handleKeypress = (event: SyntheticKeyboardEvent<>) => {
    if (event.key !== '/') return;

    // Focus and prevent default only if the input is not already active. This way the intial act of
    // focusing does not print a '/' character, but if the input is already active then '/' can be
    // typed.
    if (this._searchRef != null && document.activeElement !== this._searchRef) {
      this._searchRef.focus();
      event.preventDefault();
    }
  };

  _handleRemoveSelectedTabs = () => {
    const closedTabs = this._getClosedTabs();
    const tabs = closedTabs.filter(tab => this.state.selectedTabs.has(tab));
    this.props.dispatch(removeSavedTabs(tabs));
    this.setState({ selectedTabs: new Set() });
  };

  _handleRemoveTab = (tab: chrome$Tab) => {
    this.props.dispatch(removeSavedTabs([tab]));
    this.state.selectedTabs.delete(tab);
    this.forceUpdate();
  };

  _handleToggleTab = (tab: chrome$Tab, isSelected: boolean, multiselect: boolean) => {
    // If this is a multiselect (done by holding the Shift key and clicking), see if the last
    // selected tab is still visible and, if it is, toggle all tabs between it and this new clicked
    // tab.
    if (multiselect && this._lastSelectedTab != null) {
      const closedTabs = this._getClosedTabs();
      const lastSelectedTabIndex = closedTabs.indexOf(this._lastSelectedTab);
      if (lastSelectedTabIndex >= 0) {
        const tabIndex = closedTabs.indexOf(tab);
        for (
          let i = Math.min(lastSelectedTabIndex, tabIndex);
          i <= Math.max(lastSelectedTabIndex, tabIndex);
          i++
        ) {
          if (isSelected) {
            this.state.selectedTabs.add(closedTabs[i]);
          } else {
            this.state.selectedTabs.delete(closedTabs[i]);
          }
        }
      }
    } else {
      if (isSelected) {
        this.state.selectedTabs.add(tab);
      } else {
        this.state.selectedTabs.delete(tab);
      }
    }

    this._lastSelectedTab = tab;
    this.forceUpdate();
  };

  _handleRestoreSelectedTabs = () => {
    const closedTabs = this._getClosedTabs();
    const sessionTabs = closedTabs.filter(tab => this.state.selectedTabs.has(tab)).map(tab => ({
      session: this.props.sessions.find(session => sessionFuzzyMatchesTab(session, tab)),
      tab,
    }));

    tabmanager.closedTabs.unwrangleTabs(sessionTabs);
    this.setState({ selectedTabs: new Set() });
  };

  _handleSearchChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    const filter = event.target.value;
    this._setFilter(filter);
  };

  _handleWindowClick = (event: MouseEvent) => {
    if (
      this.state.isSortDropdownOpen &&
      this._dropdownRef != null &&
      event.target instanceof Node && // Type refinement for Flow
      !this._dropdownRef.contains(event.target)
    ) {
      this.setState({ isSortDropdownOpen: false });
    }
  };

  openTab = (tab: chrome$Tab, session: ?chrome$Session) => {
    tabmanager.closedTabs.unwrangleTabs([{ session, tab }]);
    this.state.selectedTabs.delete(tab);
    this.forceUpdate();
  };

  _renderNoRows = () => {
    return (
      <div aria-label="row" className="ReactVirtualized__Table__row" role="row">
        <div
          className="ReactVirtualized__Table__rowColumn text-center"
          style={{ flex: 1, padding: '8px' }}>
          {this.props.savedTabs.length === 0
            ? chrome.i18n.getMessage('corral_emptyList')
            : chrome.i18n.getMessage('corral_noTabsMatch')}
        </div>
      </div>
    );
  };

  _searchTabs(): Array<chrome$Tab> {
    return this.props.savedTabs.filter(keywordFilter(this.state.filter));
  }

  _setFilter(filter: string): void {
    this.setState({ filter });
  }

  _toggleAllTabs = () => {
    const closedTabs = this._getClosedTabs();
    let selectedTabs;
    if (this._areAllClosedTabsSelected()) {
      selectedTabs = this.state.selectedTabs;
      closedTabs.forEach(tab => this.state.selectedTabs.delete(tab));
    } else {
      selectedTabs = new Set(closedTabs);
    }

    this._lastSelectedTab = null;
    this.setState({
      selectedTabs,
    });
  };

  _toggleSortDropdown = () => {
    this.setState({ isSortDropdownOpen: !this.state.isSortDropdownOpen });
  };

  render() {
    const closedTabs = this._getClosedTabs();
    const areAllClosedTabsSelected = this._areAllClosedTabsSelected();
    const { totalTabsRemoved, totalTabsWrangled } = this.props;
    const percentClosed =
      totalTabsRemoved === 0 ? 0 : Math.trunc((totalTabsWrangled / totalTabsRemoved) * 100);

    return (
      <div className="tab-pane active">
        <div className="row">
          <form className="form-search col-xs-6">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <input
                className="form-control"
                name="search"
                onChange={this._handleSearchChange}
                placeholder={chrome.i18n.getMessage('corral_searchTabs')}
                ref={(_searchRef: ?HTMLElement) => {
                  this._searchRef = _searchRef;
                }}
                type="search"
                value={this.state.filter}
              />
            </div>
          </form>
          <div className="col-xs-6" style={{ lineHeight: '30px', textAlign: 'right' }}>
            <small style={{ color: '#999999' }}>
              {chrome.i18n.getMessage('corral_tabsWrangled')}
            </small>{' '}
            {totalTabsWrangled} {chrome.i18n.getMessage('corral_tabsWrangled_or')}{' '}
            <abbr title={chrome.i18n.getMessage('corral_tabsWrangled_formula')}>
              {percentClosed}%
            </abbr>
          </div>
        </div>

        <StickyContainer>
          <Sticky>
            {({ style }) => (
              <div
                style={Object.assign(
                  {
                    // Ensure this element is always positioned so its z-index stacks it on top of
                    // the virtual table below.
                    position: 'relative',
                  },
                  style,
                  {
                    background: 'white',
                    borderBottom: '1px solid #ddd',
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingBottom: '10px',
                    paddingTop: '10px',
                    zIndex: 100,
                  }
                )}>
                <div>
                  <button
                    className="btn btn-default btn-xs btn-chunky btn-chunky"
                    onClick={this._toggleAllTabs}
                    title={
                      areAllClosedTabsSelected
                        ? chrome.i18n.getMessage('corral_toggleAllTabs_deselectAll')
                        : chrome.i18n.getMessage('corral_toggleAllTabs_selectAll')
                    }>
                    <input
                      checked={areAllClosedTabsSelected}
                      readOnly
                      style={{ margin: 0 }}
                      type="checkbox"
                    />
                  </button>

                  {closedTabs.some(tab => this.state.selectedTabs.has(tab))
                    ? [
                        <button
                          className="btn btn-default btn-xs btn-chunky btn-chunky"
                          key="remove"
                          onClick={this._handleRemoveSelectedTabs}
                          style={{ marginLeft: '10px' }}
                          title={chrome.i18n.getMessage('corral_removeSelectedTabs')}>
                          <span className="sr-only">
                            {chrome.i18n.getMessage('corral_removeSelectedTabs')}
                          </span>
                          <span className="glyphicon glyphicon-trash" aria-hidden="true" />
                        </button>,
                        <button
                          className="btn btn-default btn-xs btn-chunky btn-chunky"
                          key="restore"
                          onClick={this._handleRestoreSelectedTabs}
                          style={{ marginLeft: '10px' }}
                          title={chrome.i18n.getMessage('corral_restoreSelectedTabs')}>
                          <span className="sr-only">
                            {chrome.i18n.getMessage('corral_removeSelectedTabs')}
                          </span>
                          <span className="glyphicon glyphicon-new-window" aria-hidden="true" />
                        </button>,
                      ]
                    : null}
                </div>
                <div style={{ alignItems: 'center', display: 'flex' }}>
                  {this.state.filter.length > 0 ? (
                    <span className="label label-info" style={{ marginRight: '5px' }}>
                      {chrome.i18n.getMessage('corral_searchResults_label', `${closedTabs.length}`)}
                      <span
                        className="close close-xs"
                        onClick={this._clearFilter}
                        style={{ marginLeft: '5px' }}
                        title={chrome.i18n.getMessage('corral_searchResults_clear')}>
                        x
                      </span>
                    </span>
                  ) : null}
                  <div
                    className={cx('dropdown', { open: this.state.isSortDropdownOpen })}
                    ref={dropdown => {
                      this._dropdownRef = dropdown;
                    }}>
                    <button
                      aria-haspopup="true"
                      className="btn btn-default btn-xs btn-chunky"
                      id="sort-dropdown"
                      onClick={this._toggleSortDropdown}
                      title={chrome.i18n.getMessage('corral_currentSort', this.state.sorter.label)}>
                      <span className="text-muted">{chrome.i18n.getMessage('corral_sortBy')}</span>
                      <span> {this.state.sorter.shortLabel}</span> <span className="caret" />
                    </button>
                    <ul
                      aria-labelledby="sort-dropdown"
                      className="dropdown-menu dropdown-menu-right">
                      {Sorters.map(sorter => {
                        const active = this.state.sorter === sorter;
                        return (
                          <li className={cx({ active })} key={sorter.label}>
                            <a href="#" onClick={this._clickSorter.bind(this, sorter)}>
                              {sorter.label}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </Sticky>

          <WindowScroller>
            {({ height, isScrolling, onChildScroll, scrollTop }) => (
              <Table
                autoHeight
                className="table table-hover"
                headerHeight={0}
                height={height}
                isScrolling={isScrolling}
                noRowsRenderer={this._renderNoRows}
                onScroll={onChildScroll}
                rowCount={closedTabs.length}
                rowGetter={({ index }) => {
                  const tab = closedTabs[index];
                  const session = this.props.sessions.find(session =>
                    sessionFuzzyMatchesTab(session, tab)
                  );
                  return {
                    isSelected: this.state.selectedTabs.has(tab),
                    onOpenTab: this.openTab,
                    onRemoveTab: this._handleRemoveTab,
                    onToggleTab: this._handleToggleTab,
                    session,
                    tab,
                  };
                }}
                rowHeight={38}
                rowRenderer={rowRenderer}
                scrollTop={scrollTop}
                tabIndex={null}
                width={670}
              />
            )}
          </WindowScroller>
        </StickyContainer>
      </div>
    );
  }
}

export default connect(state => ({
  savedTabs: state.localStorage.savedTabs,
  sessions: state.tempStorage.sessions,
  totalTabsRemoved: state.localStorage.totalTabsRemoved,
  totalTabsWrangled: state.localStorage.totalTabsWrangled,
}))(CorralTab);
