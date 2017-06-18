/* @flow */

import classnames from 'classnames';
import ClosedTabRow from './ClosedTabRow';
import React from 'react';
import {StickyContainer, Sticky} from 'react-sticky';

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
  label: 'Alpha',
  sort(tabA, tabB) {
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
  label: 'Reverse Alpha',
  sort(tabA, tabB) {
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
  label: 'Chrono',
  sort(tabA, tabB) {
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
  label: 'Reverse Chrono',
  sort(tabA, tabB) {
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

export default class CorralTab extends React.Component {
  state: {
    closedTabs: Array<chrome$Tab>,
    filter: string,
    isSortDropdownOpen: boolean,
    lastSelectedTab: ?chrome$Tab,
    selectedTabs: Set<chrome$Tab>,
    sorter: Sorter,
  };

  _dropdownRef: ?HTMLElement;
  _searchRefFocusTimeout: ?number;
  _searchRef: ?HTMLElement;

  constructor(props: {}) {
    super(props);
    this.state = {
      closedTabs: [],
      filter: '',
      isSortDropdownOpen: false,
      lastSelectedTab: null,
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

  _clickSorter(sorter: Sorter, event: SyntheticMouseEvent) {
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

  setFilter = (event: SyntheticInputEvent) => {
    const filter = event.target.value;
    this.setState({filter});
    tabmanager.searchTabs(this.setClosedTabs, [tabmanager.filters.keyword(filter)]);
  };

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
    let selectedClosedTabsCount = 0;
    const tableRows = [];
    if (this.state.closedTabs.length === 0) {
      allTabsSelected = false;
      tableRows.push(
        <tr key="no-tabs">
          <td className="text-center" colSpan="3">
            No closed tabs yet. When Tab Wrangler closes tabs, they will appear here. Go leave your
            tabs open!
          </td>
        </tr>
      );
    } else {
      allTabsSelected = true;
      this.state.closedTabs.forEach(tab => {
        const tabId = tab.id;
        if (tabId == null) return;

        const isSelected = this.state.selectedTabs.has(tab);
        if (isSelected) selectedClosedTabsCount++;
        allTabsSelected = allTabsSelected && isSelected;

        tableRows.push(
          <ClosedTabRow
            isSelected={isSelected}
            // $FlowFixMe: `closedAt` is an expando property added by Tab Wrangler to chrome$Tab
            key={`${tabId}-${tab.closedAt}`}
            onOpenTab={this.openTab}
            onToggleTab={this._handleToggleTab}
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
                onChange={this.setFilter}
                placeholder="Search tabs..."
                ref={_searchRef => { this._searchRef = _searchRef; }}
                type="search"
                value={this.state.filter}
              />
            </div>
          </form>
          <div className="col-xs-6" style={{lineHeight: '30px', textAlign: 'right'}}>
            <small style={{color: '#999'}}>tabs wrangled</small>{' '}
            {storageLocal.get('totalTabsWrangled')} or{' '}
            <abbr title="tabs closed by Tab Wrangler / all tabs closed">{percentClosed}%</abbr>
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
                    title={allTabsSelected ? 'Deselect all tabs' : 'Select all tabs'}>
                    <input
                      checked={allTabsSelected}
                      style={{ margin: 0 }}
                      type="checkbox"
                    />
                  </button>

                  {this.state.closedTabs.some(tab => this.state.selectedTabs.has(tab)) ?
                    <div className="btn-group" style={{ marginLeft: '10px' }}>
                      <button
                        className="btn btn-default btn-sm btn-chunky"
                        onClick={this._handleRemoveSelectedTabs}
                        title="Remove selected tabs">
                        <span className="sr-only">Remove selected tabs</span>
                        <span className="glyphicon glyphicon-trash" aria-hidden="true"></span>
                      </button>
                      <button
                        className="btn btn-default btn-sm btn-chunky"
                        disabled={selectedClosedTabsCount > 15}
                        onClick={this._handleRestoreSelectedTabs}
                        title="Restore selected tabs">
                        <span className="sr-only">Restore selected tabs</span>
                        <span className="glyphicon glyphicon-new-window" aria-hidden="true"></span>
                      </button>
                    </div> :
                    null
                  }
                </div>
                <div
                  className={classnames('dropdown', {open: this.state.isSortDropdownOpen})}
                  ref={(dropdown) => { this._dropdownRef = dropdown; }}>
                  <button
                    aria-haspopup="true"
                    className="btn btn-default btn-sm btn-chunky"
                    id="sort-dropdown"
                    onClick={this._toggleSortDropdown}
                    title={`Currently sorted ${this.state.sorter.label}`}>
                    <span
                      aria-hidden="true"
                      className={`glyphicon glyphicon-${this.state.sorter.icon}`}
                    />{' '}
                    Sort
                  </button>
                  <ul aria-labelledby="sort-dropdown" className="dropdown-menu dropdown-menu-right">
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
