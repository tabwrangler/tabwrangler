import * as React from "react";
import { SessionTab, TabWithIndex } from "./types";
import {
  addSavedTabs,
  insertSavedTabsAt,
  removeSavedTabs,
  unwrangleTabs,
} from "./actions/localStorageActions";
import { assertUnreachable } from "./util";

interface RemoveAction {
  tabsWithIndices: TabWithIndex[];
  type: "remove";
}

interface RestoreAction {
  tabs: chrome.tabs.Tab[];
  type: "restore";
}

type UndoableAction = RemoveAction | RestoreAction;

function getActionTabs(action: UndoableAction): chrome.tabs.Tab[] {
  return action.type === "remove" ? action.tabsWithIndices.map((t) => t.tab) : action.tabs;
}

export interface ActionSummary {
  tabCount: number;
  type: "remove" | "restore";
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
  lastAction: ActionSummary | null;
  nextRedoAction: ActionSummary | null;
  redo: () => Promise<RedoResult | null>;
  removeTabs: (tabsWithIndices: TabWithIndex[]) => Promise<void>;
  restoreTabs: (sessionTabs: SessionTab[]) => Promise<void>;
  undo: () => Promise<void>;
}

const UndoContext = React.createContext<UndoContextValue | null>(null);

const MAX_HISTORY = 50;

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<UndoRedoState>({
    future: [],
    past: [],
  });

  const recordDelete = React.useCallback((tabsWithIndices: TabWithIndex[]) => {
    if (tabsWithIndices.length === 0) return;
    const action: RemoveAction = { type: "remove", tabsWithIndices };
    setState((prev) => ({
      past: [...prev.past, action].slice(-MAX_HISTORY),
      future: [],
    }));
  }, []);

  const recordRestore = React.useCallback((tabs: chrome.tabs.Tab[]) => {
    if (tabs.length === 0) return;
    const action: UndoableAction = { type: "restore", tabs };
    setState((prev) => ({
      past: [...prev.past, action].slice(-MAX_HISTORY),
      future: [],
    }));
  }, []);

  const removeTabs = React.useCallback(
    async (tabsWithIndices: TabWithIndex[]) => {
      if (tabsWithIndices.length === 0) return;
      await removeSavedTabs(tabsWithIndices.map((t) => t.tab));
      recordDelete(tabsWithIndices);
    },
    [recordDelete],
  );

  const restoreTabs = React.useCallback(
    async (sessionTabs: SessionTab[]) => {
      if (sessionTabs.length === 0) return;
      const tabs = sessionTabs.map((st) => st.tab);
      await unwrangleTabs(sessionTabs);
      recordRestore(tabs);
    },
    [recordRestore],
  );

  const undo = React.useCallback(async () => {
    const lastAction = state.past[state.past.length - 1];
    if (!lastAction) return;

    switch (lastAction.type) {
      case "remove":
        // Undo delete: Re-add the deleted tabs at their original positions
        await insertSavedTabsAt(lastAction.tabsWithIndices);
        break;
      case "restore":
        // Undo restore: Remove the restored tabs from savedTabs
        // Note: Does NOT close the browser tabs - this is intentional
        await removeSavedTabs(lastAction.tabs);
        break;
      default:
        assertUnreachable(lastAction, "lastAction.type");
    }

    setState((prev) => ({
      past: prev.past.slice(0, -1),
      future: [lastAction, ...prev.future].slice(0, MAX_HISTORY),
    }));
  }, [state.past]);

  const redo = React.useCallback(async (): Promise<RedoResult | null> => {
    const nextAction = state.future[0];
    if (!nextAction) return null;

    let tabs: chrome.tabs.Tab[];
    switch (nextAction.type) {
      case "remove":
        // Redo delete: Remove the tabs again by their indices
        await removeSavedTabs(nextAction.tabsWithIndices.map((t) => t.tab));
        tabs = nextAction.tabsWithIndices.map((t) => t.tab);
        break;
      case "restore":
        // Redo restore: Re-add tabs to savedTabs
        // Note: Does NOT re-open them because that seems strange
        await addSavedTabs(nextAction.tabs);
        tabs = nextAction.tabs;
        break;
      default:
        assertUnreachable(nextAction, "nextAction.type");
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

  const lastAction = React.useMemo(
    () => toSummary(state.past[state.past.length - 1]),
    [state.past],
  );

  const nextRedoAction = React.useMemo(() => toSummary(state.future[0]), [state.future]);

  const value = React.useMemo<UndoContextValue>(
    () => ({
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      lastAction,
      nextRedoAction,
      redo,
      removeTabs,
      restoreTabs,
      undo,
    }),
    [
      state.past.length,
      state.future.length,
      lastAction,
      nextRedoAction,
      redo,
      removeTabs,
      restoreTabs,
      undo,
    ],
  );

  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>;
}

export function useUndo(): UndoContextValue {
  const context = React.useContext(UndoContext);
  if (context === null) {
    throw new Error("useUndo must be used within an UndoProvider");
  }
  return context;
}
