/* @flow */

type ClearTempStorageAction = {
  type: 'CLEAR_TEMP_STORAGE',
};

type SetCommandsAction = {
  commands: Array<chrome$Command>,
  type: 'SET_COMMANDS',
};

type FetchSessionsRequestAction = { type: 'FETCH_SESSIONS_REQUEST' };
type FetchSessionsSuccessAction = {
  sessions: Array<chrome$Session>,
  type: 'FETCH_SESSIONS_SUCCESS',
};

export type Action =
  | ClearTempStorageAction
  | FetchSessionsRequestAction
  | FetchSessionsSuccessAction
  | SetCommandsAction;

export type State = {
  commands: Array<chrome$Command>,
  sessions: Array<chrome$Session>,
};

export function createInitialState() {
  return {
    commands: [],
    sessions: [],
  };
}

const initialState = createInitialState();
export default function tempStorage(state: State = initialState, action: Action) {
  switch (action.type) {
    case 'CLEAR_TEMP_STORAGE':
      return createInitialState();
    case 'SET_COMMANDS':
      return {
        ...state,
        commands: action.commands,
      };
    case 'FETCH_SESSIONS_REQUEST':
      return {
        ...state,
        sessions: [],
      };
    case 'FETCH_SESSIONS_SUCCESS':
      return {
        ...state,
        sessions: action.sessions,
      };
    default:
      return state;
  }
}
