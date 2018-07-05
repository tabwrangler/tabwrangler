/* @flow */

type Action = {
  type: string,
};

type State = {};

const initialState = {};

export default function syncStorage(state: State = initialState, action: Action) {
  switch (action.type) {
    default:
      return state;
  }
}
