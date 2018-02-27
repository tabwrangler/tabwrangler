/* @flow */

import './CorralTab.css';
import {Sticky, StickyContainer} from 'react-sticky';
import {Table, WindowScroller} from 'react-virtualized';
import ClosedTabRow from './ClosedTabRow';
import React from 'react';
import cx from 'classnames';
import extractHostname from './extractHostname';
import extractRootDomain from './extractRootDomain';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const {
  storageLocal,
  tabmanager,
} = TW;

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
      return tabARootDomain.localeCompare(tabBRootDomain) ||
        tabAHostname.localeCompare(tabBHostname) ||
        ReverseChronoSorter.sort(tabA, tabB);
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

function rowRenderer({key, rowData, style}) {
  const {tab} = rowData;
  const tabId = tab.id;
  if (tabId == null) return null;

  return (
    <ClosedTabRow
      isSelected={rowData.isSelected}
      key={key}
      onOpenTab={rowData.onOpenTab}
      onRemoveTab={rowData.onRemoveTab}
      onToggleTab={rowData.onToggleTab}
      style={style}
      tab={tab}
    />
  );
}

type Props = {};

type State = {
  closedTabs: Array<chrome$Tab>,
  filter: string,
  isSortDropdownOpen: boolean,
  lastSelectedTab: ?chrome$Tab,
  selectedTabs: Set<chrome$Tab>,
  sorter: Sorter,
}

export default class CorralTab extends React.Component<Props, State> {
  _dropdownRef: ?HTMLElement;
  _searchRefFocusTimeout: TimeoutID;
  _searchRef: ?HTMLElement;

  constructor(props: Props) {
    super(props);
    this.state = {
      closedTabs: [],
      filter: '',
      isSortDropdownOpen: false,
      lastSelectedTab: undefined,
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

    // TODO: This is assumed to be synchronous. If it becomes async, this state needs to be
    // hoisted so this component does not need to track whether it's mounted.
    tabmanager.searchTabs(this.setClosedTabs);
    window.addEventListener('click', this._handleWindowClick);
  }

  componentWillUnmount() {
    clearTimeout(this._searchRefFocusTimeout);
    window.removeEventListener('click', this._handleWindowClick);
  }

  _areAllClosedTabsSelected() {
    return this.state.closedTabs.every(tab => this.state.selectedTabs.has(tab));
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
      this.setState({isSortDropdownOpen: false});
    } else {
      this.setState({
        closedTabs: this.state.closedTabs.sort(sorter.sort),
        isSortDropdownOpen: false,
        sorter,
      });
    }
  }

  _handleRemoveSelectedTabs = () => {
    const tabs = this.state.closedTabs.filter(tab => this.state.selectedTabs.has(tab));
    tabs.forEach(tab => { tabmanager.closedTabs.removeTab(tab.id); });
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword('')]);
    this.setState({
      filter: '',
      selectedTabs: new Set(),
    });
  };

  _handleRemoveTab = (tab: chrome$Tab) => {
    tabmanager.closedTabs.removeTab(tab.id);
    this.state.selectedTabs.delete(tab);
    this.forceUpdate();
  };

  _handleToggleTab = (tab: chrome$Tab, isSelected: boolean, multiselect: boolean) => {
    // If this is a multiselect (done by holding the Shift key and clicking), see if the last
    // selected tab is still visible and, if it is, toggle all tabs between it and this new clicked
    // tab.
    if (multiselect && this.state.lastSelectedTab != null) {
      const lastSelectedTabIndex = this.state.closedTabs.indexOf(this.state.lastSelectedTab);
      if (lastSelectedTabIndex >= 0) {
        const tabIndex = this.state.closedTabs.indexOf(tab);
        for (
          let i = Math.min(lastSelectedTabIndex, tabIndex);
          i <= Math.max(lastSelectedTabIndex, tabIndex);
          i++
        ) {
          if (isSelected) {
            this.state.selectedTabs.add(this.state.closedTabs[i]);
          } else {
            this.state.selectedTabs.delete(this.state.closedTabs[i]);
          }
        }
        this.setState({lastSelectedTab: tab});
        return;
      }
    }

    if (isSelected) {
      this.state.selectedTabs.add(tab);
    } else {
      this.state.selectedTabs.delete(tab);
    }
    this.setState({lastSelectedTab: tab});
  };

  _handleRestoreSelectedTabs = () => {
    const tabs = this.state.closedTabs.filter(tab => this.state.selectedTabs.has(tab));
    tabmanager.closedTabs.unwrangleTabs(tabs);
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword('')]);
    this.setState({
      filter: '',
      selectedTabs: new Set(),
    });
  };

  _handleSearchChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    const filter = event.target.value;
    this._setFilter(filter);
  }

  _handleWindowClick = (event: MouseEvent) => {
    if (
      this.state.isSortDropdownOpen &&
      this._dropdownRef != null &&
      event.target instanceof Node && // Type refinement for Flow
      !this._dropdownRef.contains(event.target)
    ) {
      this.setState({isSortDropdownOpen: false});
    }
  };

  openTab = (tab: chrome$Tab) => {
    tabmanager.closedTabs.unwrangleTabs([tab]);
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(this.state.filter)]);
    this.state.selectedTabs.delete(tab);
    this.forceUpdate();
  };

  setClosedTabs = (closedTabs: Array<chrome$Tab>) => {
    closedTabs.sort(this.state.sorter.sort);
    this.setState({closedTabs});
  };

  _setFilter(filter: string): void {
    this.setState({filter});
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(filter)]);
  }

  _toggleAllTabs = () => {
    let selectedTabs;
    if (this._areAllClosedTabsSelected()) {
      selectedTabs = this.state.selectedTabs;
      this.state.closedTabs.forEach(tab => this.state.selectedTabs.delete(tab));
    } else {
      selectedTabs = new Set(this.state.closedTabs);
    }

    this.setState({
      lastSelectedTab: null,
      selectedTabs,
    });
  };

  _toggleSortDropdown = () => {
    this.setState({isSortDropdownOpen: !this.state.isSortDropdownOpen});
  };

  render() {
    const areAllClosedTabsSelected = this._areAllClosedTabsSelected();
    const totalTabsRemoved = storageLocal.get('totalTabsRemoved');
    const percentClosed = totalTabsRemoved === 0
      ? 0
      : Math.trunc(
        storageLocal.get('totalTabsWrangled') / storageLocal.get('totalTabsRemoved') * 100
      );

    return (
      <div className="tab-pane active">
        <div className="row">
          <form className="form-search col-xs-6">
            <div className="form-group" style={{marginBottom: 0}}>
              <input
                className="form-control"
                name="search"
                onChange={this._handleSearchChange}
                placeholder={chrome.i18n.getMessage('corral_searchTabs')}
                ref={(_searchRef: ?HTMLElement) => { this._searchRef = _searchRef; }}
                type="search"
                value={this.state.filter}
              />
            </div>
          </form>
          <div className="col-xs-6" style={{lineHeight: '30px', textAlign: 'right'}}>
            <small style={{color: '#999'}}>{chrome.i18n.getMessage('corral_tabsWrangled')}</small>
            {' '}{storageLocal.get('totalTabsWrangled')}
            {' '}{chrome.i18n.getMessage('corral_tabsWrangled_or')}{' '}
            <abbr title={chrome.i18n.getMessage('corral_tabsWrangled_formula')}>
              {percentClosed}%
            </abbr>
          </div>
        </div>

        <StickyContainer>
          <Sticky>
            {({style}) => (
              <div style={Object.assign(
                {
                  // Ensure this element is always positioned so its z-index stacks it on top of the
                  // virtual table below.
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
                })}>
                <div>
                  <button
                    className="btn btn-default btn-xs btn-chunky btn-chunky"
                    onClick={this._toggleAllTabs}
                    title={areAllClosedTabsSelected ?
                      chrome.i18n.getMessage('corral_toggleAllTabs_deselectAll') :
                      chrome.i18n.getMessage('corral_toggleAllTabs_selectAll')}>
                    <input
                      checked={areAllClosedTabsSelected}
                      readOnly
                      style={{ margin: 0 }}
                      type="checkbox"
                    />
                  </button>

                  {this.state.closedTabs.some(tab => this.state.selectedTabs.has(tab)) ? [
                    <button
                      className="btn btn-default btn-xs btn-chunky btn-chunky"
                      key="remove"
                      onClick={this._handleRemoveSelectedTabs}
                      style={{marginLeft: '10px'}}
                      title={chrome.i18n.getMessage('corral_removeSelectedTabs')}>
                      <span className="sr-only">
                        {chrome.i18n.getMessage('corral_removeSelectedTabs')}
                      </span>
                      <span className="glyphicon glyphicon-trash" aria-hidden="true"></span>
                    </button>,
                    <button
                      className="btn btn-default btn-xs btn-chunky btn-chunky"
                      key="restore"
                      onClick={this._handleRestoreSelectedTabs}
                      style={{marginLeft: '10px'}}
                      title={chrome.i18n.getMessage('corral_restoreSelectedTabs')}>
                      <span className="sr-only">
                        {chrome.i18n.getMessage('corral_removeSelectedTabs')}
                      </span>
                      <span className="glyphicon glyphicon-new-window" aria-hidden="true"></span>
                    </button>,
                  ] : null}
                </div>
                <div style={{ alignItems: 'center', display: 'flex' }}>
                  {this.state.filter.length > 0 ?
                    <span className="label label-info" style={{ marginRight: '5px' }}>
                      {chrome.i18n.getMessage(
                        'corral_searchResults_label',
                        `${this.state.closedTabs.length}`
                      )}
                      <span
                        className="close close-xs"
                        onClick={this._clearFilter}
                        style={{ marginLeft: '5px' }}
                        title={chrome.i18n.getMessage('corral_searchResults_clear')}>
                        x
                      </span>
                    </span> :
                    null}
                  <div
                    className={cx('dropdown', {open: this.state.isSortDropdownOpen})}
                    ref={(dropdown) => { this._dropdownRef = dropdown; }}>
                    <button
                      aria-haspopup="true"
                      className="btn btn-default btn-xs btn-chunky"
                      id="sort-dropdown"
                      onClick={this._toggleSortDropdown}
                      title={chrome.i18n.getMessage('corral_currentSort', this.state.sorter.label)}>
                      <span className="text-muted">{chrome.i18n.getMessage('corral_sortBy')}</span>
                      {' '}{this.state.sorter.shortLabel}{' '}
                      <span className="caret" />
                    </button>
                    <ul
                      aria-labelledby="sort-dropdown"
                      className="dropdown-menu dropdown-menu-right">
                      {Sorters.map(sorter => {
                        const active = this.state.sorter === sorter;
                        return (
                          <li className={cx({active})} key={sorter.label}>
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
            {({height, isScrolling, onChildScroll, scrollTop}) => (
              <Table
                autoHeight
                className="table table-hover"
                headerHeight={0}
                height={height}
                isScrolling={isScrolling}
                onScroll={onChildScroll}
                rowCount={this.state.closedTabs.length}
                rowGetter={({index}) => {
                  const tab = this.state.closedTabs[index];
                  return {
                    isSelected: this.state.selectedTabs.has(tab),
                    onOpenTab: this.openTab,
                    onRemoveTab: this._handleRemoveTab,
                    onToggleTab: this._handleToggleTab,
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
