export type ClearTempStorageAction = {
  type: "CLEAR_TEMP_STORAGE";
};

type FetchSessionsRequestAction = {
  type: "FETCH_SESSIONS_REQUEST";
};

type FetchSessionsSuccessAction = {
  sessions: Array<chrome.sessions.Session>;
  type: "FETCH_SESSIONS_SUCCESS";
};

export type Action =
  | ClearTempStorageAction
  | FetchSessionsRequestAction
  | FetchSessionsSuccessAction;

export type State = {
  sessions: Array<chrome.sessions.Session>;
};

export function createInitialState(): State {
  return {
    sessions: [],
  };
}

const initialState = createInitialState();
export default function tempStorage(state: State = initialState, action: Action): State {
  switch (action.type) {
    case "CLEAR_TEMP_STORAGE":
      return createInitialState();
    case "FETCH_SESSIONS_REQUEST":
      return {
        ...state,
        sessions: [],
      };
    case "FETCH_SESSIONS_SUCCESS":
      return {
        ...state,
        sessions: action.sessions,
      };
    default:
      return state;
  }
}
