import "./CorralTab.scss";
import * as React from "react";
import { Table, WindowScroller, WindowScrollerChildProps } from "react-virtualized";
import { extractHostname, extractRootDomain, serializeTab } from "./util";
import { removeSavedTabs, unwrangleTabs } from "./actions/localStorageActions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ClosedTabRow from "./ClosedTabRow";
import cx from "classnames";
import settings from "./settings";
import { useStorageLocalPersistQuery } from "./storage";

function keywordFilter(keyword: string) {
  return function (tab: chrome.tabs.Tab) {
    const test = new RegExp(keyword, "i");
    return (tab.title != null && test.exec(tab.title)) || (tab.url != null && test.exec(tab.url));
  };
}

type Sorter = {
  key: string;
  label: () => string;
  shortLabel: () => string;
  sort: (a: chrome.tabs.Tab | null, b: chrome.tabs.Tab | null) => number;
};

const AlphaSorter: Sorter = {
  key: "alpha",
  label: () => chrome.i18n.getMessage("corral_sortPageTitle") || "",
  shortLabel: () => chrome.i18n.getMessage("corral_sortPageTitle_short") || "",
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
  label: () => chrome.i18n.getMessage("corral_sortPageTitle_descending") || "",
  shortLabel: () => chrome.i18n.getMessage("corral_sortPageTitle_descending_short") || "",
  sort(tabA, tabB) {
    return -1 * AlphaSorter.sort(tabA, tabB);
  },
};

const ChronoSorter: Sorter = {
  key: "chrono",
  label: () => chrome.i18n.getMessage("corral_sortTimeClosed") || "",
  shortLabel: () => chrome.i18n.getMessage("corral_sortTimeClosed_short") || "",
  sort(tabA, tabB) {
    if (tabA == null || tabB == null) {
      return 0;
    } else {
      // @ts-expect-error `closedAt` is a TW expando property on tabs
      return tabA.closedAt - tabB.closedAt;
    }
  },
};

const ReverseChronoSorter: Sorter = {
  key: "reverseChrono",
  label: () => chrome.i18n.getMessage("corral_sortTimeClosed_descending") || "",
  shortLabel: () => chrome.i18n.getMessage("corral_sortTimeClosed_descending_short") || "",
  sort(tabA, tabB) {
    return -1 * ChronoSorter.sort(tabA, tabB);
  },
};

const DomainSorter: Sorter = {
  key: "domain",
  label: () => chrome.i18n.getMessage("corral_sortDomain") || "",
  shortLabel: () => chrome.i18n.getMessage("corral_sortDomain_short") || "",
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
  label: () => chrome.i18n.getMessage("corral_sortDomain_descending") || "",
  shortLabel: () => chrome.i18n.getMessage("corral_sortDomain_descending_short") || "",
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

export function sessionFuzzyMatchesTab(
  session: chrome.sessions.Session,
  tab: chrome.tabs.Tab
): boolean {
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
    // @ts-expect-error `closedAt` is a TW expando property on tabs
    Math.abs(lastModifiedMs - tab.closedAt) < 1000
  );
}

function rowRenderer({
  key,
  rowData,
  style,
}: {
  key: React.Key;
  rowData: {
    isSelected: boolean;
    onOpenTab: () => void;
    onRemoveTab: () => void;
    onToggleTab: () => void;
    session: chrome.sessions.Session;
    tab: chrome.tabs.Tab;
  };
  style: Record<string, unknown>;
}) {
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

export default function CorralTab() {
  // Focus the search input so it's simple to type immediately. This must be done after the popup
  // is available, which is roughly 150ms after the popup is opened (determined empirically). Use
  // 350ms to ensure this always works.
  const searchRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    const searchRefFocusTimeout = setTimeout(() => {
      if (searchRef.current != null) searchRef.current.focus();
    }, 350);
    return () => {
      clearTimeout(searchRefFocusTimeout);
    };
  }, []);

  const [filter, setFilter] = React.useState("");
  const [savedSortOrder, setSavedSortOrder] = React.useState(
    settings.get<string | null>("corralTabSortOrder")
  );
  const [currSorter, setCurrSorter] = React.useState(() => {
    const savedSortOrder = settings.get<string>("corralTabSortOrder");
    let nextSorter =
      savedSortOrder == null ? DEFAULT_SORTER : Sorters.find((s) => s.key === savedSortOrder);

    // If settings somehow stores a bad value, always fall back to default order.
    if (nextSorter == null) nextSorter = DEFAULT_SORTER;
    return nextSorter;
  });

  const queryClient = useQueryClient();
  const { data: sessions } = useQuery({
    queryFn: () => chrome.sessions.getRecentlyClosed(),
    queryKey: ["sessionsQuery"],
  });
  React.useEffect(() => {
    function handleChanged() {
      queryClient.invalidateQueries({ queryKey: ["sessionsQuery"] });
    }
    chrome.sessions.onChanged.addListener(handleChanged);
    return () => {
      chrome.sessions.onChanged.removeListener(handleChanged);
    };
  }, [queryClient]);

  const { data: localStorageData } = useStorageLocalPersistQuery();
  const lastSelectedTabRef = React.useRef<chrome.tabs.Tab | null>(null);
  const [selectedTabs, setSelectedTabs] = React.useState<Set<string>>(new Set());
  const closedTabs: chrome.tabs.Tab[] = React.useMemo(() => {
    if (localStorageData == null || !("savedTabs" in localStorageData)) return [];
    return localStorageData.savedTabs.filter(keywordFilter(filter)).sort(currSorter.sort);
  }, [currSorter.sort, filter, localStorageData]);

  const dropdownRef = React.useRef<HTMLElement | null>(null);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = React.useState(false);
  const areAllClosedTabsSelected =
    closedTabs.length > 0 && closedTabs.every((tab) => selectedTabs.has(serializeTab(tab)));
  const hasVisibleSelectedTabs = closedTabs.some((tab) => selectedTabs.has(serializeTab(tab)));
  const percentClosed =
    localStorageData == null ||
    !("totalTabsRemoved" in localStorageData) ||
    !("totalTabsWrangled" in localStorageData) ||
    localStorageData.totalTabsRemoved === 0
      ? 0
      : Math.trunc((localStorageData.totalTabsWrangled / localStorageData.totalTabsRemoved) * 100);

  React.useEffect(() => {
    function handleWindowClick(event: MouseEvent) {
      if (
        isSortDropdownOpen &&
        dropdownRef.current != null &&
        event.target instanceof Node &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsSortDropdownOpen(false);
      }
    }
    window.addEventListener("click", handleWindowClick);
    return () => {
      window.removeEventListener("click", handleWindowClick);
    };
  }, [isSortDropdownOpen]);

  React.useEffect(() => {
    function handleKeypress(event: KeyboardEvent) {
      if (event.key !== "/") return;

      // Focus and prevent default only if the input is not already active. This way the intial act of
      // focusing does not print a '/' character, but if the input is already active then '/' can be
      // typed.
      if (searchRef.current != null && document.activeElement !== searchRef.current) {
        searchRef.current.focus();
        event.preventDefault();
      }
    }
    window.addEventListener("keypress", handleKeypress);
    return () => {
      window.removeEventListener("keypress", handleKeypress);
    };
  }, []);

  function toggleSortDropdown() {
    setIsSortDropdownOpen((val) => !val);
  }

  function handleChangeSaveSortOrder(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.checked) {
      settings.set("corralTabSortOrder", currSorter.key);
      setSavedSortOrder(currSorter.key);
    } else {
      settings.set("corralTabSortOrder", null);
      setSavedSortOrder(null);
    }
  }

  async function handleRemoveSelectedTabs() {
    await removeSavedTabs(closedTabs.filter((tab) => selectedTabs.has(serializeTab(tab))));
    setSelectedTabs(new Set());
  }

  async function handleOpenTab(tab: chrome.tabs.Tab, session: chrome.sessions.Session | undefined) {
    await unwrangleTabs([{ session, tab }]);
    const nextSelectedTabs = new Set(selectedTabs);
    nextSelectedTabs.delete(serializeTab(tab));
    setSelectedTabs(nextSelectedTabs);
  }

  async function handleOpenSelectedTabs() {
    await unwrangleTabs(
      closedTabs
        .filter((tab) => selectedTabs.has(serializeTab(tab)))
        .map((tab) => ({
          session: sessions?.find((session) => sessionFuzzyMatchesTab(session, tab)),
          tab,
        }))
    );
    setSelectedTabs(new Set());
  }

  async function handleRemoveTab(tab: chrome.tabs.Tab) {
    await removeSavedTabs([tab]);
    const nextSelectedTabs = new Set(selectedTabs);
    nextSelectedTabs.delete(serializeTab(tab));
    setSelectedTabs(nextSelectedTabs);
  }

  function handleToggleTab(tab: chrome.tabs.Tab, isSelected: boolean, multiselect: boolean) {
    // If this is a multiselect (done by holding the Shift key and clicking), see if the last
    // selected tab is still visible and, if it is, toggle all tabs between it and this new clicked
    // tab.
    const nextSelectedTabs = new Set(selectedTabs);
    if (multiselect && lastSelectedTabRef.current != null) {
      const lastSelectedTabIndex = closedTabs.indexOf(lastSelectedTabRef.current);
      if (lastSelectedTabIndex >= 0) {
        const tabIndex = closedTabs.indexOf(tab);
        for (
          let i = Math.min(lastSelectedTabIndex, tabIndex);
          i <= Math.max(lastSelectedTabIndex, tabIndex);
          i++
        ) {
          if (isSelected) {
            nextSelectedTabs.add(serializeTab(closedTabs[i]));
          } else {
            nextSelectedTabs.delete(serializeTab(closedTabs[i]));
          }
        }
      }
    } else {
      if (isSelected) {
        nextSelectedTabs.add(serializeTab(tab));
      } else {
        nextSelectedTabs.delete(serializeTab(tab));
      }
    }

    lastSelectedTabRef.current = tab;
    setSelectedTabs(nextSelectedTabs);
  }

  function toggleAllTabs() {
    let nextSelectedTabs: Set<string>;
    if (areAllClosedTabsSelected) {
      nextSelectedTabs = new Set(selectedTabs);
      closedTabs.forEach((tab) => {
        nextSelectedTabs.delete(serializeTab(tab));
      });
    } else {
      nextSelectedTabs = new Set(closedTabs.map(serializeTab));
    }

    lastSelectedTabRef.current = null;
    setSelectedTabs(nextSelectedTabs);
  }

  function renderNoRows() {
    return (
      <div aria-label="row" className="ReactVirtualized__Table__row" role="row">
        <div
          className="ReactVirtualized__Table__rowColumn text-center"
          style={{ flex: 1, padding: "8px" }}
        >
          {localStorageData == null ||
          !("savedTabs" in localStorageData) ||
          localStorageData.savedTabs.length === 0
            ? chrome.i18n.getMessage("corral_emptyList")
            : chrome.i18n.getMessage("corral_noTabsMatch")}
        </div>
      </div>
    );
  }

  return (
    <div className="tab-pane active">
      <div className="row mb-1">
        <form className="form-search col">
          <div className="form-group mb-0">
            <input
              className="form-control"
              name="search"
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setFilter(event.target.value);
              }}
              placeholder={chrome.i18n.getMessage("corral_searchTabs")}
              ref={(nextSearchRef: HTMLElement | null) => {
                searchRef.current = nextSearchRef;
              }}
              type="search"
              value={filter}
            />
          </div>
        </form>
        <div className="col text-right" style={{ lineHeight: "30px" }}>
          {chrome.i18n.getMessage("corral_tabsWrangledFull", [
            String(
              localStorageData == null || !("totalTabsWrangled" in localStorageData)
                ? 0
                : localStorageData.totalTabsWrangled
            ),
            String(percentClosed),
          ])}
        </div>
      </div>

      <div className="corral-tab--control-bar py-2 border-bottom">
        <div>
          <button
            className="btn btn-outline-dark btn-sm"
            disabled={closedTabs.length === 0}
            onClick={toggleAllTabs}
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
                onClick={handleRemoveSelectedTabs}
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
                onClick={handleOpenSelectedTabs}
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
          {filter.length > 0 ? (
            <span className={"badge badge-pill badge-primary d-flex align-items-center px-2 mr-1"}>
              {chrome.i18n.getMessage("corral_searchResults_label", `${closedTabs.length}`)}
              <button
                className="close close-xs ml-1"
                onClick={() => {
                  setFilter("");
                }}
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
              dropdownRef.current = dropdown;
            }}
          >
            <button
              aria-haspopup="true"
              className="btn btn-outline-dark btn-sm"
              id="sort-dropdown"
              onClick={toggleSortDropdown}
              title={chrome.i18n.getMessage("corral_currentSort", currSorter.label())}
            >
              <span>{chrome.i18n.getMessage("corral_sortBy")}</span>{" "}
              <span>{currSorter.shortLabel()}</span> <i className="fas fa-caret-down" />
            </button>
            <div
              aria-labelledby="sort-dropdown"
              className={cx("dropdown-menu dropdown-menu-right shadow-sm", {
                show: isSortDropdownOpen,
              })}
            >
              {Sorters.map((sorter) => (
                <a
                  className={cx("dropdown-item", { active: currSorter === sorter })}
                  href="#"
                  key={sorter.label()}
                  onClick={(event: React.MouseEvent<HTMLElement>) => {
                    // The dropdown wraps items in bogus `<a href="#">` elements in order to match
                    // Bootstrap's style. Prevent default on the event in order to prevent scrolling
                    // to the top of the window (the default action for an empty anchor "#").
                    event.preventDefault();

                    if (sorter === currSorter) {
                      // If this is already the active sorter, close the dropdown and do no work
                      // since the state is already correct.
                      setIsSortDropdownOpen(false);
                    } else {
                      // When the saved sort order is not null then the user wants to preserve it.
                      // Update to the ``new sort order and persist it.
                      if (settings.get("corralTabSortOrder") != null) {
                        settings.set("corralTabSortOrder", sorter.key);
                      }

                      setIsSortDropdownOpen(false);
                      setCurrSorter(sorter);
                    }
                  }}
                >
                  {sorter.label()}
                </a>
              ))}
              <div className="dropdown-divider" />
              <form className="px-4 pb-1">
                <div className="form-group mb-0">
                  <div className="form-check">
                    <input
                      checked={savedSortOrder != null}
                      className="form-check-input"
                      id="corral-tab--save-sort-order"
                      onChange={handleChangeSaveSortOrder}
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
        {({ height, isScrolling, onChildScroll, scrollTop }: WindowScrollerChildProps) => (
          <Table
            autoHeight
            className="table table-hover"
            headerHeight={0}
            height={height}
            isScrolling={isScrolling}
            noRowsRenderer={renderNoRows}
            onScroll={onChildScroll}
            rowCount={closedTabs.length}
            rowGetter={({ index }: { index: number }) => {
              const tab = closedTabs[index];
              return {
                isSelected: selectedTabs.has(serializeTab(tab)),
                onOpenTab: handleOpenTab,
                onRemoveTab: handleRemoveTab,
                onToggleTab: handleToggleTab,
                // The Chrome extension API claims [`getRecentlyClosed`][0] always returns an
                // Array<chrome.sessions.Session>, but in at least one case a user is getting an
                // exception where `this.props.sessions` is null. Because it's safe to continue
                // without Sessions, do a null check and continue on unless a more thorough solution
                // is eventually found.
                //
                // See https://github.com/tabwrangler/tabwrangler/issues/275
                session: sessions?.find((session) => sessionFuzzyMatchesTab(session, tab)),
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

// [0]: https://developer.chrome.com/extensions/sessions#method-getRecentlyClosed
