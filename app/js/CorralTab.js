/* @flow */

import {Sticky, StickyContainer} from 'react-sticky';
import ClosedTabRow from './ClosedTabRow';
import React from 'react';
import classnames from 'classnames';

const TW = chrome.extension.getBackgroundPage().TW;

// Unpack TW.
const {
  storageLocal,
  tabmanager,
} = TW;

type Sorter = {
  example: string,
  icon: string,
  label: string,
  sort: (a: any, b: any) => number,
};

const AlphaSorter: Sorter = {
  example: '(A -> Z)',
  icon: 'sort-by-alphabet',
  label: chrome.i18n.getMessage('corral_sortAlpha') || '',
  sort(tabA: chrome$Tab, tabB: chrome$Tab): number {
    if (tabA == null || tabB == null || tabA.title == null || tabB.title == null) {
      return 0;
    } else {
      return tabA.title.localeCompare(tabB.title);
    }
  },
};

const ReverseAlphaSorter: Sorter = {
  example: '(Z -> A)',
  icon: 'sort-by-alphabet-alt',
  label: chrome.i18n.getMessage('corral_sortReverseAlpha') || '',
  sort(tabA: chrome$Tab, tabB: chrome$Tab): number {
    if (tabA == null || tabB == null || tabA.title == null || tabB.title == null) {
      return 0;
    } else {
      return tabB.title.localeCompare(tabA.title);
    }
  },
};

const ChronoSorter: Sorter = {
  example: '(2000 -> 2020)',
  icon: 'sort-by-order-alt',
  label: chrome.i18n.getMessage('corral_sortChrono') || '',
  sort(tabA, tabB): number {
    if (tabA == null || tabB == null) {
      return 0;
    } else {
      return tabA.closedAt - tabB.closedAt;
    }
  },
};

const ReverseChronoSorter: Sorter = {
  example: '(2020 -> 2000)',
  icon: 'sort-by-order',
  label: chrome.i18n.getMessage('corral_sortReverseChrono') || '',
  sort(tabA, tabB): number {
    if (tabA == null || tabB == null) {
      return 0;
    } else {
      return tabB.closedAt - tabA.closedAt;
    }
  },
};

const Sorters: Array<Sorter> = [
  AlphaSorter,
  ReverseAlphaSorter,
  ChronoSorter,
  ReverseChronoSorter,
];

interface State {
  closedTabs: Array<chrome$Tab>;
  filter: string;
  isSortDropdownOpen: boolean;
  lastSelectedTab: ?chrome$Tab;
  shouldCheckLazyImages: boolean;
  selectedTabs: Set<chrome$Tab>;
  sorter: Sorter;
}

export default class CorralTab extends React.Component<{}, State> {
  _dropdownRef: ?HTMLElement;
  _searchRefFocusTimeout: TimeoutID;
  _searchRef: ?HTMLElement;
  _shouldCheckLazyImagesTimeout: TimeoutID;

  constructor(props: {}) {
    super(props);
    this.state = {
      closedTabs: [],
      filter: '',
      isSortDropdownOpen: false,
      lastSelectedTab: undefined,
      selectedTabs: new Set(),

      // Whether `LazyImage` instances should check to load their images immediately. This will be
      // true only after a period of time that allows the popup to show quickly.
      shouldCheckLazyImages: false,

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

    // Begin the loading process a full second after initial execution to allow the popup to open
    // before loading images. If images begin to load too soon after the popup opens, Chrome waits
    // for them to fully load before showing the popup.
    this._shouldCheckLazyImagesTimeout = setTimeout(() => {
      this.setState({shouldCheckLazyImages: true});
    }, 1000);

    window.addEventListener('click', this._handleWindowClick);
  }

  componentWillUnmount() {
    clearTimeout(this._searchRefFocusTimeout);
    clearTimeout(this._shouldCheckLazyImagesTimeout);
    window.removeEventListener('click', this._handleWindowClick);
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
    if (this.state.closedTabs.every(tab => this.state.selectedTabs.has(tab))) {
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
    let allTabsSelected;
    const tableRows = [];
    if (this.state.closedTabs.length === 0) {
      allTabsSelected = false;
      tableRows.push(
        <tr key="no-tabs">
          <td className="text-center" colSpan="3">{chrome.i18n.getMessage('corral_emptyList')}</td>
        </tr>
      );
    } else {
      allTabsSelected = true;
      this.state.closedTabs.forEach(tab => {
        const tabId = tab.id;
        if (tabId == null) return;

        const isSelected = this.state.selectedTabs.has(tab);
        allTabsSelected = allTabsSelected && isSelected;

        tableRows.push(
          <ClosedTabRow
            isSelected={isSelected}
            // $FlowFixMe: `closedAt` is an expando property added by Tab Wrangler to chrome$Tab
            key={`${tabId}-${tab.closedAt}`}
            onOpenTab={this.openTab}
            onToggleTab={this._handleToggleTab}
            shouldCheckLazyImages={this.state.shouldCheckLazyImages}
            tab={tab}
          />
        );
      });
    }

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
              <div style={Object.assign({}, style, {
                background: 'white',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                justifyContent: 'space-between',
                paddingBottom: '10px',
                paddingTop: '10px',
                zIndex: 100})}>
                <div>
                  <button
                    className="btn btn-default btn-sm btn-chunky"
                    onClick={this._toggleAllTabs}
                    title={allTabsSelected ?
                      chrome.i18n.getMessage('corral_toggleAllTabs_deselectAll') :
                      chrome.i18n.getMessage('corral_toggleAllTabs_selectAll')}>
                    <input
                      checked={allTabsSelected}
                      style={{ margin: 0 }}
                      type="checkbox"
                    />
                  </button>

                  {this.state.closedTabs.some(tab => this.state.selectedTabs.has(tab)) ? [
                    <button
                      className="btn btn-default btn-sm btn-chunky"
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
                      className="btn btn-default btn-sm btn-chunky"
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
                    className={classnames('dropdown', {open: this.state.isSortDropdownOpen})}
                    ref={(dropdown) => { this._dropdownRef = dropdown; }}>
                    <button
                      aria-haspopup="true"
                      className="btn btn-default btn-sm btn-chunky"
                      id="sort-dropdown"
                      onClick={this._toggleSortDropdown}
                      title={chrome.i18n.getMessage('corral_currentSort', this.state.sorter.label)}>
                      <span
                        aria-hidden="true"
                        className={`glyphicon glyphicon-${this.state.sorter.icon}`}
                      />{' '}
                      {chrome.i18n.getMessage('corral_sort')}
                    </button>
                    <ul
                      aria-labelledby="sort-dropdown"
                      className="dropdown-menu dropdown-menu-right">
                      {Sorters.map(sorter => {
                        const active = this.state.sorter === sorter;
                        return (
                          <li className={classnames({active})} key={sorter.label}>
                            <a href="#" onClick={this._clickSorter.bind(this, sorter)}>
                              {sorter.label}{' '}
                              <small className={classnames({'text-muted': !active})}>
                                {sorter.example}
                              </small>
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

          <table id="corralTable" className="table table-hover">
            <tbody>
              {tableRows}
            </tbody>
          </table>
        </StickyContainer>
      </div>
    );
  }
}
