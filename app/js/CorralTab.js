/* @flow */

import "./CorralTab.scss";
import * as React from "react";
import { Table, WindowScroller } from "react-virtualized";
import ClosedTabRow from "./ClosedTabRow";
import type { Dispatch } from "./Types";
import { connect } from "react-redux";
import cx from "classnames";
import extractHostname from "./extractHostname";
import extractRootDomain from "./extractRootDomain";
import { removeSavedTabs } from "./actions/localStorageActions";

// Unpack TW.
const { settings, tabmanager } = chrome.extension.getBackgroundPage().TW;

function keywordFilter(keyword: string) {
  return function (tab: chrome$Tab) {
    const test = new RegExp(keyword, "i");
    return (tab.title != null && test.exec(tab.title)) || (tab.url != null && test.exec(tab.url));
  };
}

type Sorter = {
  key: string,
  label: string,
  shortLabel: string,
  sort: (a: ?chrome$Tab, b: ?chrome$Tab) => number,
};

const AlphaSorter: Sorter = {
  key: "alpha",
  label: chrome.i18n.getMessage("corral_sortPageTitle") || "",
  shortLabel: chrome.i18n.getMessage("corral_sortPageTitle_short") || "",
  sort(tabA, tabB) {
    if (tabA == null || tabB == null || tabA.title == null || tabB.title == null) {
      return 0;
    } else {
      return tabA.title.localeCompare(tabB.title);
    }
  },
};

const ReverseAlphaSorter: Sorter = {
  key: "reverseAlpha",
  label: chrome.i18n.getMessage("corral_sortPageTitle_descending") || "",
  shortLabel: chrome.i18n.getMessage("corral_sortPageTitle_descending_short") || "",
  sort(tabA, tabB) {
    return -1 * AlphaSorter.sort(tabA, tabB);
  },
};

const ChronoSorter: Sorter = {
  key: "chrono",
  label: chrome.i18n.getMessage("corral_sortTimeClosed") || "",
  shortLabel: chrome.i18n.getMessage("corral_sortTimeClosed_short") || "",
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
  key: "reverseChrono",
  label: chrome.i18n.getMessage("corral_sortTimeClosed_descending") || "",
  shortLabel: chrome.i18n.getMessage("corral_sortTimeClosed_descending_short") || "",
  sort(tabA, tabB) {
    return -1 * ChronoSorter.sort(tabA, tabB);
  },
};

const DomainSorter: Sorter = {
  key: "domain",
  label: chrome.i18n.getMessage("corral_sortDomain") || "",
  shortLabel: chrome.i18n.getMessage("corral_sortDomain_short") || "",
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
  key: "reverseDomain",
  label: chrome.i18n.getMessage("corral_sortDomain_descending") || "",
  shortLabel: chrome.i18n.getMessage("corral_sortDomain_descending_short") || "",
  sort(tabA, tabB) {
    return -1 * DomainSorter.sort(tabA, tabB);
  },
};

const DEFAULT_SORTER = ReverseChronoSorter;
const Sorters: Array<Sorter> = [
  DomainSorter,
  ReverseDomainSorter,
  AlphaSorter,
  ReverseAlphaSorter,
  ChronoSorter,
  ReverseChronoSorter,
];

export function sessionFuzzyMatchesTab(session: chrome$Session, tab: chrome$Tab): boolean {
  // Sessions' `lastModified` is only accurate to the second in Chrome whereas `closedAt` is
  // accurate to the millisecond. Convert to ms if needed.
  const lastModifiedMs =
    session.lastModified < 10000000000 ? session.lastModified * 1000 : session.lastModified;

  return (
    session.tab != null &&
    // Tabs with no favIcons have the value `undefined`, but once converted into a session the tab
    // has an empty string (`''`) as its favIcon value. Account for that case for "equality".
    (session.tab.favIconUrl === tab.favIconUrl ||
      (session.tab.favIconUrl === "" && tab.favIconUrl == null)) &&
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
  savedSortOrder: ?string,
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
    const savedSortOrder = settings.get("corralTabSortOrder");
    let sorter =
      savedSortOrder == null
        ? DEFAULT_SORTER
        : Sorters.find((sorter) => sorter.key === savedSortOrder);

    // If settings somehow stores a bad value, always fall back to default order.
    if (sorter == null) sorter = DEFAULT_SORTER;

    this.state = {
      filter: "",
      isSortDropdownOpen: false,
      savedSortOrder,
      selectedTabs: new Set(),
      sorter,
    };
  }

  componentDidMount() {
    // Focus the search input so it's simple to type immediately. This must be done after the popup
    // is available, which is roughly 150ms after the popup is opened (determined empirically). Use
    // 250ms to ensure this always works.
    this._searchRefFocusTimeout = setTimeout(() => {
      if (this._searchRef != null) this._searchRef.focus();
    }, 350);

    window.addEventListener("click", this._handleWindowClick);
    window.addEventListener("keypress", this._handleKeypress);
  }

  componentWillUnmount() {
    clearTimeout(this._searchRefFocusTimeout);
    window.removeEventListener("click", this._handleWindowClick);
    window.removeEventListener("keypress", this._handleKeypress);
  }

  _areAllClosedTabsSelected() {
    const closedTabs = this._getClosedTabs();
    return closedTabs.length > 0 && closedTabs.every((tab) => this.state.selectedTabs.has(tab));
  }

  _clearFilter = () => {
    this._setFilter("");
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
      // When the saved sort order is not null then the user wants to preserve it. Update to the
      // new sort order and persist it.
      if (settings.get("corralTabSortOrder") != null) {
        settings.set("corralTabSortOrder", sorter.key);
      }

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

  _handleChangeSaveSortOrder = (event: SyntheticInputEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      settings.set("corralTabSortOrder", this.state.sorter.key);
      this.setState({ savedSortOrder: this.state.sorter.key });
    } else {
      settings.set("corralTabSortOrder", null);
      this.setState({ savedSortOrder: null });
    }
  };

  _handleKeypress = (event: SyntheticKeyboardEvent<>) => {
    if (event.key !== "/") return;

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
    const tabs = closedTabs.filter((tab) => this.state.selectedTabs.has(tab));
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
    const sessionTabs = closedTabs
      .filter((tab) => this.state.selectedTabs.has(tab))
      .map((tab) => ({
        session: this.props.sessions.find((session) => sessionFuzzyMatchesTab(session, tab)),
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
          style={{ flex: 1, padding: "8px" }}
        >
          {this.props.savedTabs.length === 0
            ? chrome.i18n.getMessage("corral_emptyList")
            : chrome.i18n.getMessage("corral_noTabsMatch")}
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
      closedTabs.forEach((tab) => this.state.selectedTabs.delete(tab));
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
    const hasVisibleSelectedTabs = closedTabs.some((tab) => this.state.selectedTabs.has(tab));
    const percentClosed =
      totalTabsRemoved === 0 ? 0 : Math.trunc((totalTabsWrangled / totalTabsRemoved) * 100);

    return (
      <div className="tab-pane active">
        <div className="row mb-1">
          <form className="form-search col">
            <div className="form-group mb-0">
              <input
                className="form-control"
                name="search"
                onChange={this._handleSearchChange}
                placeholder={chrome.i18n.getMessage("corral_searchTabs")}
                ref={(_searchRef: ?HTMLElement) => {
                  this._searchRef = _searchRef;
                }}
                type="search"
                value={this.state.filter}
              />
            </div>
          </form>
          <div className="col text-right" style={{ lineHeight: "30px" }}>
            <span className="text-muted">{chrome.i18n.getMessage("corral_tabsWrangled")}</span>{" "}
            {totalTabsWrangled} {chrome.i18n.getMessage("corral_tabsWrangled_or")}{" "}
            <abbr title={chrome.i18n.getMessage("corral_tabsWrangled_formula")}>
              {percentClosed}%
            </abbr>
          </div>
        </div>

        <div className="corral-tab--control-bar py-2 border-bottom">
          <div>
            <button
              className="btn btn-outline-dark btn-sm"
              disabled={closedTabs.length === 0}
              onClick={this._toggleAllTabs}
              title={
                areAllClosedTabsSelected
                  ? chrome.i18n.getMessage("corral_toggleAllTabs_deselectAll")
                  : chrome.i18n.getMessage("corral_toggleAllTabs_selectAll")
              }
            >
              <input
                checked={areAllClosedTabsSelected}
                readOnly
                style={{ margin: 0 }}
                type="checkbox"
              />
            </button>
            {hasVisibleSelectedTabs ? (
              <>
                <button
                  className="btn btn-outline-dark btn-sm ml-1 px-3"
                  onClick={this._handleRemoveSelectedTabs}
                  title={chrome.i18n.getMessage("corral_removeSelectedTabs")}
                  type="button"
                >
                  <span className="sr-only">
                    {chrome.i18n.getMessage("corral_removeSelectedTabs")}
                  </span>
                  <i className="fas fa-trash-alt" />
                </button>
                <button
                  className="btn btn-outline-dark btn-sm ml-1 px-3"
                  onClick={this._handleRestoreSelectedTabs}
                  title={chrome.i18n.getMessage("corral_restoreSelectedTabs")}
                  type="button"
                >
                  <span className="sr-only">
                    {chrome.i18n.getMessage("corral_removeSelectedTabs")}
                  </span>
                  <i className="fas fa-external-link-alt" />
                </button>
              </>
            ) : null}
          </div>
          <div className="d-flex">
            {this.state.filter.length > 0 ? (
              <span
                className={"badge badge-pill badge-primary d-flex align-items-center px-2 mr-1"}
              >
                {chrome.i18n.getMessage("corral_searchResults_label", `${closedTabs.length}`)}
                <button
                  className="close close-xs ml-1"
                  onClick={this._clearFilter}
                  style={{ marginTop: "-2px" }}
                  title={chrome.i18n.getMessage("corral_searchResults_clear")}
                >
                  &times;
                </button>
              </span>
            ) : null}
            <div
              className="dropdown"
              ref={(dropdown) => {
                this._dropdownRef = dropdown;
              }}
            >
              <button
                aria-haspopup="true"
                className="btn btn-outline-dark btn-sm"
                id="sort-dropdown"
                onClick={this._toggleSortDropdown}
                title={chrome.i18n.getMessage("corral_currentSort", this.state.sorter.label)}
              >
                <span>{chrome.i18n.getMessage("corral_sortBy")}</span>
                <span> {this.state.sorter.shortLabel}</span> <i className="fas fa-caret-down" />
              </button>
              <div
                aria-labelledby="sort-dropdown"
                className={cx("dropdown-menu dropdown-menu-right shadow-sm", {
                  show: this.state.isSortDropdownOpen,
                })}
              >
                {Sorters.map((sorter) => (
                  <a
                    className={cx("dropdown-item", { active: this.state.sorter === sorter })}
                    href="#"
                    key={sorter.label}
                    onClick={this._clickSorter.bind(this, sorter)}
                  >
                    {sorter.label}
                  </a>
                ))}
                <div className="dropdown-divider" />
                <form className="px-4 pb-1">
                  <div className="form-group mb-0">
                    <div className="form-check">
                      <input
                        checked={this.state.savedSortOrder != null}
                        className="form-check-input"
                        id="corral-tab--save-sort-order"
                        onChange={this._handleChangeSaveSortOrder}
                        type="checkbox"
                      />
                      <label className="form-check-label" htmlFor="corral-tab--save-sort-order">
                        {chrome.i18n.getMessage("options_option_saveSortOrder")}
                      </label>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

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

                // The Chrome extension API claims [`getRecentlyClosed`][0] always returns an
                // Array<chrome$Session>, but in at least one case a user is getting an exception
                // where `this.props.sessions` is null. Because it's safe to continue without
                // Sessions, do a null check and continue on unless a more thorough solution is
                // eventually found.
                //
                // See https://github.com/tabwrangler/tabwrangler/issues/275
                const session =
                  this.props.sessions == null
                    ? null
                    : this.props.sessions.find((session) => sessionFuzzyMatchesTab(session, tab));

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
      </div>
    );
  }
}

export default (connect((state) => ({
  savedTabs: state.localStorage.savedTabs,
  sessions: state.tempStorage.sessions,
  totalTabsRemoved: state.localStorage.totalTabsRemoved,
  totalTabsWrangled: state.localStorage.totalTabsWrangled,
}))(CorralTab): React.AbstractComponent<{}>);

// [0]: https://developer.chrome.com/extensions/sessions#method-getRecentlyClosed
