/* @flow */

type SetCommandsAction = {
  commands: Array<chrome$Command>,
  type: 'SET_COMMANDS',
};

type SetSessionsAction = {
  sessions: Array<chrome$Session>,
  type: 'SET_SESSIONS',
};

type Action = SetCommandsAction | SetSessionsAction;

type State = {
  commands: Array<chrome$Command>,
  sessions: Array<chrome$Session>,
};

const initialState = {
  commands: [],
  sessions: [],
};

export default function reducers(state: State = initialState, action: Action) {
  switch (action.type) {
    case 'SET_COMMANDS':
      return {
        ...state,
        commands: action.commands,
      };
    case 'SET_SESSIONS':
      return {
        ...state,
        sessions: action.sessions,
      };
    default:
      return state;
  }
}
