/* @flow */

import { isLocked, isManuallyLockable } from './tab';
import OpenTabRow from './OpenTabRow';
import React from 'react';
import cx from 'classnames';
import memoize from 'memoize-one';

// Unpack TW.
const { tabmanager } = chrome.extension.getBackgroundPage().TW;

type Sorter = {
  label: string,
  shortLabel: string,
  sort: (a: ?chrome$Tab, b: ?chrome$Tab) => number,
};

const ChronoSorter: Sorter = {
  label: chrome.i18n.getMessage('tabLock_sort_timeUntilClose') || '',
  shortLabel: chrome.i18n.getMessage('tabLock_sort_timeUntilClose_short') || '',
  sort(tabA, tabB) {
    if (tabA == null || tabB == null) {
      return 0;
    } else if (isLocked(tabA) && !isLocked(tabB)) {
      return 1;
    } else if (!isLocked(tabA) && isLocked(tabB)) {
      return -1;
    } else {
      const lastModifiedA = tabmanager.tabTimes[tabA.id];
      const lastModifiedB = tabmanager.tabTimes[tabB.id];
      return lastModifiedA - lastModifiedB;
    }
  },
};

const ReverseChronoSorter: Sorter = {
  label: chrome.i18n.getMessage('tabLock_sort_timeUntilClose_desc') || '',
  shortLabel: chrome.i18n.getMessage('tabLock_sort_timeUntilClose_desc_short') || '',
  sort(tabA, tabB) {
    return -1 * ChronoSorter.sort(tabA, tabB);
  },
};

const TabOrderSorter: Sorter = {
  label: chrome.i18n.getMessage('tabLock_sort_tabOrder') || '',
  shortLabel: chrome.i18n.getMessage('tabLock_sort_tabOrder_short') || '',
  sort() {
    return 1;
  },
};

const ReverseTabOrderSorter: Sorter = {
  label: chrome.i18n.getMessage('tabLock_sort_tabOrder_desc') || '',
  shortLabel: chrome.i18n.getMessage('tabLock_sort_tabOrder_desc_short') || '',
  sort() {
    return -1;
  },
};

const Sorters = [TabOrderSorter, ReverseTabOrderSorter, ChronoSorter, ReverseChronoSorter];

type State = {
  isSortDropdownOpen: boolean,
  sorter: Sorter,
  tabs: Array<chrome$Tab>,
};

export default class LockTab extends React.PureComponent<{}, State> {
  _dropdownRef: ?HTMLElement;
  _lastSelectedTab: ?chrome$Tab;
  _timeLeftInterval: ?number;

  constructor() {
    super();
    this.state = {
      isSortDropdownOpen: false,
      sorter: TabOrderSorter,
      tabs: [],
    };
  }

  componentDidMount() {
    this._timeLeftInterval = window.setInterval(this.forceUpdate.bind(this), 1000);

    // TODO: THIS WILL BREAK. This is some async stuff inside a synchronous call. Fix this, move
    // the state into a higher component.
    chrome.tabs.query({}, tabs => {
      this.setState({ tabs });
    });

    window.addEventListener('click', this._handleWindowClick);
  }

  componentWillUnmount() {
    window.removeEventListener('click', this._handleWindowClick);
    window.clearInterval(this._timeLeftInterval);
  }

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

  _handleToggleTab = (tab: chrome$Tab, selected: boolean, multiselect: boolean) => {
    let tabsToToggle = [tab];
    if (multiselect && this._lastSelectedTab != null) {
      const lastSelectedTabIndex = this.state.tabs.indexOf(this._lastSelectedTab);
      if (lastSelectedTabIndex >= 0) {
        const tabIndex = this.state.tabs.indexOf(tab);
        tabsToToggle = this.state.tabs.slice(
          Math.min(tabIndex, lastSelectedTabIndex),
          Math.max(tabIndex, lastSelectedTabIndex) + 1
        );
      }
    }

    // Toggle only the tabs that are manually lockable.
    tabsToToggle.filter(tab => isManuallyLockable(tab)).forEach(tab => {
      if (selected) tabmanager.lockTab(tab.id);
      else tabmanager.unlockTab(tab.id);
    });

    this._lastSelectedTab = tab;
    this.forceUpdate();
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

  _getSortedTabs = memoize((tabs, sorter) => {
    return tabs.slice().sort(sorter.sort);
  });

  _toggleSortDropdown = () => {
    this.setState({ isSortDropdownOpen: !this.state.isSortDropdownOpen });
  };

  render() {
    return (
      <div className="tab-pane active">
        <div className="d-flex align-items-center justify-content-between border-bottom pb-2">
          <div style={{ paddingLeft: '0.55rem', paddingRight: '0.55rem' }}>
            <abbr title={chrome.i18n.getMessage('tabLock_lockLabel')}>
              <i className="fas fa-lock" />
            </abbr>
          </div>
          <div
            className="dropdown"
            ref={dropdown => {
              this._dropdownRef = dropdown;
            }}>
            <button
              aria-haspopup="true"
              className="btn btn-outline-dark btn-sm"
              id="sort-dropdown"
              onClick={this._toggleSortDropdown}
              title={chrome.i18n.getMessage('corral_currentSort', this.state.sorter.label)}>
              <span>{chrome.i18n.getMessage('corral_sortBy')}</span>
              <span> {this.state.sorter.shortLabel}</span> <i className="fas fa-caret-down" />
            </button>
            <div
              aria-labelledby="sort-dropdown"
              className={cx('dropdown-menu dropdown-menu-right shadow-sm', {
                show: this.state.isSortDropdownOpen,
              })}>
              {Sorters.map(sorter => (
                <a
                  className={cx('dropdown-item', { active: this.state.sorter === sorter })}
                  href="#"
                  key={sorter.label}
                  onClick={this._clickSorter.bind(this, sorter)}>
                  {sorter.label}
                </a>
              ))}
            </div>
          </div>
        </div>
        <table className="table table-hover table-sm table-th-unbordered">
          <tbody>
            {this._getSortedTabs(this.state.tabs, this.state.sorter).map(tab => (
              <OpenTabRow key={tab.id} onToggleTab={this._handleToggleTab} tab={tab} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
