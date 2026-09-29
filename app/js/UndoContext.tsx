import { SessionTab, TabWithIndex } from "./types";
import {
  addSavedTabs,
  insertSavedTabsAt,
  removeSavedTabs,
  unwrangleTabs,
} from "./actions/localStorageActions";
import { assertUnreachable, serializeTab } from "./util";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { getStorageLocalPersist } from "./queries";
import { sessionFuzzyMatchesTab } from "./tabUtil";
import { wrangleNow as wrangleNowCommand } from "./commands";

interface RemoveAction {
  tabsWithIndices: TabWithIndex[];
  type: "remove";
}

interface RestoreAction {
  tabs: chrome.tabs.Tab[];
  type: "restore";
}

interface WrangleAction {
  tabs: chrome.tabs.Tab[];
  type: "wrangle";
}

type UndoableAction = RemoveAction | RestoreAction | WrangleAction;

function getActionTabs(action: UndoableAction): chrome.tabs.Tab[] {
  return action.type === "remove" ? action.tabsWithIndices.map((t) => t.tab) : action.tabs;
}

export interface ActionSummary {
  tabCount: number;
  type: UndoableAction["type"];
}

interface UndoRedoState {
  future: UndoableAction[];
  past: UndoableAction[];
}

interface RedoResult {
  tabs: chrome.tabs.Tab[];
  type: "remove" | "restore";
}

interface UndoContextValue {
  canRedo: boolean;
  canUndo: boolean;
  discardLastAction: (type: UndoableAction["type"]) => void;
  lastAction: ActionSummary | null;
  nextRedoAction: ActionSummary | null;
  redo: () => Promise<RedoResult | null>;
  removeTabs: (tabsWithIndices: TabWithIndex[]) => Promise<void>;
  reset: () => void;
  restoreTabs: (sessionTabs: SessionTab[]) => Promise<void>;
  undo: () => Promise<void>;
  wrangleNow: () => Promise<void>;
}

const UndoContext = createContext<UndoContextValue | null>(null);

const MAX_HISTORY = 50;

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UndoRedoState>({
    future: [],
    past: [],
  });

  // Guard against concurrent undo/redo operations from rapid clicks
  const isProcessingRef = useRef(false);

  const discardLastAction = useCallback((type: UndoableAction["type"]) => {
    setState((prev) =>
      prev.past[prev.past.length - 1]?.type === type
        ? { past: prev.past.slice(0, -1), future: prev.future }
        : prev,
    );
  }, []);

  const recordDelete = useCallback((tabsWithIndices: TabWithIndex[]) => {
    if (tabsWithIndices.length === 0) return;
    const action: RemoveAction = { type: "remove", tabsWithIndices };
    setState((prev) => ({
      past: [...prev.past, action].slice(-MAX_HISTORY),
      future: [],
    }));
  }, []);

  const recordRestore = useCallback((tabs: chrome.tabs.Tab[]) => {
    if (tabs.length === 0) return;
    const action: UndoableAction = { type: "restore", tabs };
    setState((prev) => ({
      past: [...prev.past, action].slice(-MAX_HISTORY),
      future: [],
    }));
  }, []);

  const recordWrangle = useCallback((tabs: chrome.tabs.Tab[]) => {
    if (tabs.length === 0) return;
    const action: WrangleAction = { type: "wrangle", tabs };
    setState((prev) => ({
      past: [...prev.past, action].slice(-MAX_HISTORY),
      future: [],
    }));
  }, []);

  const reset = useCallback(() => {
    setState({ past: [], future: [] });
  }, []);

  const removeTabs = useCallback(
    async (tabsWithIndices: TabWithIndex[]) => {
      if (tabsWithIndices.length === 0) return;
      await removeSavedTabs(tabsWithIndices.map((t) => t.tab));
      recordDelete(tabsWithIndices);
    },
    [recordDelete],
  );

  const restoreTabs = useCallback(
    async (sessionTabs: SessionTab[]) => {
      if (sessionTabs.length === 0) return;
      const tabs = sessionTabs.map((st) => st.tab);
      await unwrangleTabs(sessionTabs);
      recordRestore(tabs);
    },
    [recordRestore],
  );

  const wrangleNow = useCallback(async () => {
    recordWrangle(await wrangleNowCommand());
  }, [recordWrangle]);

  const undo = useCallback(async () => {
    if (isProcessingRef.current) return;

    const lastAction = state.past[state.past.length - 1];
    if (!lastAction) return;

    isProcessingRef.current = true;
    try {
      switch (lastAction.type) {
        case "remove":
          // Undo delete: Re-add the deleted tabs at their original positions
          await insertSavedTabsAt(lastAction.tabsWithIndices);
          break;
        case "restore":
          // Undo restore: Add restored tabs back to savedTabs
          // Note: Does NOT close the browser tabs - this is intentional
          await addSavedTabs(lastAction.tabs);
          break;
        case "wrangle": {
          // Undo wrangle: Reopen the wrangled tabs that are still in the corral
          const [{ savedTabs }, sessions] = await Promise.all([
            getStorageLocalPersist(),
            chrome.sessions.getRecentlyClosed(),
          ]);
          const savedTabKeys = new Set(savedTabs.map(serializeTab));
          await unwrangleTabs(
            lastAction.tabs
              .filter((tab) => savedTabKeys.has(serializeTab(tab)))
              .map((tab) => ({
                session: sessions.find((session) => sessionFuzzyMatchesTab(session, tab)),
                tab,
              })),
          );
          break;
        }
        default:
          assertUnreachable(lastAction, "lastAction.type");
      }
    } catch {
      return;
    } finally {
      isProcessingRef.current = false;
    }

    setState((prev) => ({
      past: prev.past.slice(0, -1),
      // Reopened tabs have new IDs and cannot be re-wrangled, so wrangles are not redoable.
      future:
        lastAction.type === "wrangle"
          ? prev.future
          : [lastAction, ...prev.future].slice(0, MAX_HISTORY),
    }));
  }, [state.past]);

  const redo = useCallback(async (): Promise<RedoResult | null> => {
    if (isProcessingRef.current) return null;

    const nextAction = state.future[0];
    if (!nextAction) return null;

    isProcessingRef.current = true;
    let tabs: chrome.tabs.Tab[];
    try {
      switch (nextAction.type) {
        case "remove":
          // Redo delete: Remove the tabs again by their indices
          await removeSavedTabs(nextAction.tabsWithIndices.map((t) => t.tab));
          tabs = nextAction.tabsWithIndices.map((t) => t.tab);
          break;
        case "restore":
          // Redo restore: re-remove tabs from savedTabs
          // Note: Does NOT re-open them because that seems strange
          await removeSavedTabs(nextAction.tabs);
          tabs = nextAction.tabs;
          break;
        case "wrangle":
          return null;
        default:
          assertUnreachable(nextAction, "nextAction.type");
      }
    } catch {
      return null;
    } finally {
      isProcessingRef.current = false;
    }

    setState((prev) => ({
      future: prev.future.slice(1),
      past: [...prev.past, nextAction].slice(-MAX_HISTORY),
    }));

    return { tabs, type: nextAction.type };
  }, [state.future]);

  function toSummary(action: UndoableAction | undefined): ActionSummary | null {
    if (!action) return null;
    return {
      tabCount: getActionTabs(action).length,
      type: action.type,
    };
  }

  const lastAction = useMemo(() => toSummary(state.past[state.past.length - 1]), [state.past]);
  const nextRedoAction = useMemo(() => toSummary(state.future[0]), [state.future]);
  const value = useMemo<UndoContextValue>(
    () => ({
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      discardLastAction,
      lastAction,
      nextRedoAction,
      redo,
      removeTabs,
      reset,
      restoreTabs,
      undo,
      wrangleNow,
    }),
    [
      state.past.length,
      state.future.length,
      discardLastAction,
      lastAction,
      nextRedoAction,
      redo,
      removeTabs,
      reset,
      restoreTabs,
      undo,
      wrangleNow,
    ],
  );

  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>;
}

export function useUndo(): UndoContextValue {
  const context = useContext(UndoContext);
  if (context === null) {
    throw new Error("useUndo must be used within an UndoProvider");
  }
  return context;
}
