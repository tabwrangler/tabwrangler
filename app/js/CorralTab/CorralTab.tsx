import "./CorralTab.scss";
import * as React from "react";
import { Table, WindowScroller, WindowScrollerChildProps } from "react-virtualized";
import { extractHostname, extractRootDomain, serializeTab } from "../util";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ClosedTabRow from "./ClosedTabRow";
import Dropdown from "react-bootstrap/Dropdown";
import { TabWithIndex } from "../types";
import escape from "regexp.escape";
import settings from "../settings";
import { useStorageLocalPersistQuery } from "../storage";
import { useUndo } from "../UndoContext";

function keywordFilter(keyword: string) {
  return function (tab: chrome.tabs.Tab) {
    const test = new RegExp(escape(keyword), "i");
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
  tab: chrome.tabs.Tab,
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

interface RowData {
  index: number;
  isSelected: boolean;
  session: chrome.sessions.Session | null;
  tab: chrome.tabs.Tab;
  onOpenTab: (tab: chrome.tabs.Tab, index: number, session: chrome.sessions.Session | null) => void;
  onRemoveTab: (tab: chrome.tabs.Tab, index: number) => void;
  onToggleTab: (
    tab: chrome.tabs.Tab,
    index: number,
    selected: boolean,
    multiselect: boolean,
  ) => void;
}

function rowRenderer({
  key,
  rowData,
  style,
}: {
  key: React.Key;
  rowData: RowData;
  style: Record<string, unknown>;
}) {
  return (
    <ClosedTabRow
      index={rowData.index}
      isSelected={rowData.isSelected}
      key={key}
      session={rowData.session}
      style={style}
      tab={rowData.tab}
      onOpenTab={rowData.onOpenTab}
      onRemoveTab={rowData.onRemoveTab}
      onToggleTab={rowData.onToggleTab}
    />
  );
}

export default function CorralTab() {
  const { canUndo, canRedo, lastAction, nextRedoAction, undo, redo, removeTabs, restoreTabs } =
    useUndo();

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
    settings.get<string | null>("corralTabSortOrder"),
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
  const lastSelectedTabRef = React.useRef<TabWithIndex | null>(null);
  const [selectedTabs, setSelectedTabs] = React.useState<Set<string>>(new Set());
  const closedTabs: TabWithIndex[] = React.useMemo(() => {
    if (localStorageData == null || !("savedTabs" in localStorageData)) return [];
    return localStorageData.savedTabs
      .map((tab: chrome.tabs.Tab, index: number): TabWithIndex => ({ tab, index }))
      .filter(({ tab }: TabWithIndex) => keywordFilter(filter)(tab))
      .sort((a: TabWithIndex, b: TabWithIndex) => currSorter.sort(a.tab, b.tab));
  }, [currSorter, filter, localStorageData]);

  const areAllClosedTabsSelected =
    closedTabs.length > 0 && closedTabs.every(({ tab }) => selectedTabs.has(serializeTab(tab)));
  const hasVisibleSelectedTabs = closedTabs.some(({ tab }) => selectedTabs.has(serializeTab(tab)));
  const percentClosed =
    localStorageData == null ||
    !("totalTabsRemoved" in localStorageData) ||
    !("totalTabsWrangled" in localStorageData) ||
    localStorageData.totalTabsRemoved === 0
      ? 0
      : Math.trunc((localStorageData.totalTabsWrangled / localStorageData.totalTabsRemoved) * 100);

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

  function handleChangeSaveSortOrder(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.checked) {
      settings.set("corralTabSortOrder", currSorter.key);
      setSavedSortOrder(currSorter.key);
    } else {
      settings.set("corralTabSortOrder", null);
      setSavedSortOrder(null);
    }
  }

  async function handleRedo() {
    const result = await redo();
    if (result?.type === "remove") {
      setSelectedTabs((curr) => {
        const nextSelectedTabs = new Set(curr);
        result.tabs.forEach((tab) => {
          nextSelectedTabs.delete(serializeTab(tab));
        });
        return nextSelectedTabs;
      });
    }
  }

  async function handleRemoveSelectedTabs() {
    const tabsToRemove = closedTabs.filter(({ tab }) => selectedTabs.has(serializeTab(tab)));
    await removeTabs(tabsToRemove);
    setSelectedTabs(new Set());
  }

  async function handleOpenTab(
    tab: chrome.tabs.Tab,
    _index: number,
    session: chrome.sessions.Session | undefined,
  ) {
    await restoreTabs([{ session, tab }]);
    const nextSelectedTabs = new Set(selectedTabs);
    nextSelectedTabs.delete(serializeTab(tab));
    setSelectedTabs(nextSelectedTabs);
  }

  async function handleOpenSelectedTabs() {
    const tabsToRestore = closedTabs.filter(({ tab }) => selectedTabs.has(serializeTab(tab)));
    await restoreTabs(
      tabsToRestore.map(({ tab }) => ({
        session: sessions?.find((session) => sessionFuzzyMatchesTab(session, tab)),
        tab,
      })),
    );
    setSelectedTabs(new Set());
  }

  async function handleRemoveTab(tab: chrome.tabs.Tab, index: number) {
    await removeTabs([{ tab, index }]);
    const nextSelectedTabs = new Set(selectedTabs);
    nextSelectedTabs.delete(serializeTab(tab));
    setSelectedTabs(nextSelectedTabs);
  }

  function handleToggleTab(
    tab: chrome.tabs.Tab,
    index: number,
    isSelected: boolean,
    multiselect: boolean,
  ) {
    // If this is a multiselect (done by holding the Shift key and clicking), see if the last
    // selected tab is still visible and, if it is, toggle all tabs between it and this new clicked
    // tab.
    const nextSelectedTabs = new Set(selectedTabs);
    const lastSelectedTab = lastSelectedTabRef.current;
    if (multiselect && lastSelectedTab != null) {
      const lastSelectedTabIndex = closedTabs.findIndex((t) => t.index === lastSelectedTab.index);
      if (lastSelectedTabIndex >= 0) {
        const tabIndex = closedTabs.findIndex((t) => t.index === index);
        for (
          let i = Math.min(lastSelectedTabIndex, tabIndex);
          i <= Math.max(lastSelectedTabIndex, tabIndex);
          i++
        ) {
          if (isSelected) {
            nextSelectedTabs.add(serializeTab(closedTabs[i].tab));
          } else {
            nextSelectedTabs.delete(serializeTab(closedTabs[i].tab));
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

    lastSelectedTabRef.current = { tab, index };
    setSelectedTabs(nextSelectedTabs);
  }

  function toggleAllTabs() {
    let nextSelectedTabs: Set<string>;
    if (areAllClosedTabsSelected) {
      nextSelectedTabs = new Set(selectedTabs);
      closedTabs.forEach(({ tab }) => {
        nextSelectedTabs.delete(serializeTab(tab));
      });
    } else {
      nextSelectedTabs = new Set(closedTabs.map(({ tab }) => serializeTab(tab)));
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
      <div className="row align-items-center mb-1">
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
        <div className="col text-end">
          {chrome.i18n.getMessage("corral_tabsWrangledFull", [
            String(
              localStorageData == null || !("totalTabsWrangled" in localStorageData)
                ? 0
                : localStorageData.totalTabsWrangled,
            ),
            String(percentClosed),
          ])}
        </div>
      </div>

      <div className="corral-tab--control-bar py-2 border-bottom">
        <div className="d-flex gap-1">
          <button
            className="btn btn-secondary btn-sm"
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
                className="btn btn-secondary btn-sm px-3"
                onClick={handleOpenSelectedTabs}
                title={chrome.i18n.getMessage("corral_restoreSelectedTabs")}
                type="button"
              >
                <span className="sr-only">
                  {chrome.i18n.getMessage("corral_restoreSelectedTabs")}
                </span>
                <i className="fas fa-external-link-alt" />
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRemoveSelectedTabs}
                title={chrome.i18n.getMessage("corral_removeSelectedTabs")}
                type="button"
              >
                <i className="fas fa-trash-alt" /> {chrome.i18n.getMessage("corral_remove")}
              </button>
            </>
          ) : null}
        </div>
        <div className="d-flex gap-2">
          {filter.length > 0 ? (
            <span className="badge rounded-pill text-bg-primary d-flex align-items-center gap-1 px-2">
              {chrome.i18n.getMessage("corral_searchResults_label", `${closedTabs.length}`)}
              <button
                className="btn-close btn-xs"
                onClick={() => {
                  setFilter("");
                }}
                title={chrome.i18n.getMessage("corral_searchResults_clear")}
              />
            </span>
          ) : null}
          <div className="btn-group">
            <button
              className="btn btn-secondary btn-sm"
              disabled={!canUndo}
              onClick={undo}
              title={
                lastAction
                  ? chrome.i18n.getMessage(
                      lastAction.type === "remove" ? "corral_undo_remove" : "corral_undo_restore",
                      String(lastAction.tabCount),
                    )
                  : chrome.i18n.getMessage("corral_undo")
              }
              type="button"
            >
              <i className="fas fa-undo" /> {chrome.i18n.getMessage("corral_undo")}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!canRedo}
              onClick={handleRedo}
              title={
                nextRedoAction
                  ? chrome.i18n.getMessage(
                      nextRedoAction.type === "remove"
                        ? "corral_redo_remove"
                        : "corral_redo_restore",
                      String(nextRedoAction.tabCount),
                    )
                  : chrome.i18n.getMessage("corral_redo")
              }
              type="button"
            >
              <i className="fas fa-redo" /> {chrome.i18n.getMessage("corral_redo")}
            </button>
          </div>
          <Dropdown>
            <Dropdown.Toggle
              size="sm"
              title={chrome.i18n.getMessage("corral_currentSort", currSorter.label())}
              variant="secondary"
            >
              {chrome.i18n.getMessage("corral_sortBy")} {currSorter.shortLabel()}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {Sorters.map((sorter) => (
                <Dropdown.Item
                  active={currSorter === sorter}
                  as="button"
                  key={sorter.label()}
                  onClick={() => {
                    if (sorter !== currSorter) {
                      // When the saved sort order is not null then the user wants to preserve it.
                      // Update to the new sort order and persist it.
                      if (settings.get("corralTabSortOrder") != null) {
                        settings.set("corralTabSortOrder", sorter.key);
                      }
                      setCurrSorter(sorter);
                    }
                  }}
                >
                  {sorter.label()}
                </Dropdown.Item>
              ))}
              <Dropdown.Divider />
              <Dropdown.ItemText>
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
              </Dropdown.ItemText>
            </Dropdown.Menu>
          </Dropdown>
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
            rowGetter={({ index: rowIndex }: { index: number }) => {
              const { tab, index } = closedTabs[rowIndex];
              return {
                index,
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
