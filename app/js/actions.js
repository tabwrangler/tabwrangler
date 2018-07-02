/* @flow */

export function setCommands(commands: Array<chrome$Command>) {
  return {
    commands,
    type: 'SET_COMMANDS',
  };
}

export function setSessions(sessions: Array<chrome$Session>) {
  return {
    sessions,
    type: 'SET_SESSIONS',
  };
}
