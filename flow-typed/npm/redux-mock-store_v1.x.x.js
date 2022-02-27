// flow-typed signature: 391af34d1983e15b80d2f18fd8273954
// flow-typed version: 032de4a35a/redux-mock-store_v1.x.x/flow_>=v0.104.x

declare module "redux-mock-store" {
  /*
    S = State
    A = Action
  */

  declare type mockStore = { <S, A>(state: S): mockStoreWithoutMiddleware<S, A>, ... };
  declare type DispatchAPI<A> = (action: A) => A;
  declare type Dispatch<A: $ReadOnly<{ type: string, ... }>> = DispatchAPI<A>;
  declare type mockStoreWithoutMiddleware<S, A> = {
    getState(): S,
    getActions(): Array<A>,
    dispatch: Dispatch<A>,
    clearActions(): void,
    subscribe(callback: () => void): () => void,
    replaceReducer(nextReducer: Function): void,
    ...
  };

  declare type Middleware = any => any => any;

  declare module.exports: (middlewares: ?Array<Middleware>) => mockStore;
}

// Filename aliases
declare module "redux-mock-store/src/index" {
  declare module.exports: $Exports<"redux-mock-store">;
}
declare module "redux-mock-store/src/index.js" {
  declare module.exports: $Exports<"redux-mock-store">;
}
