// flow-typed signature: 7c0d6e7317aca6bbfe8d8a64efdb241f
// flow-typed version: c6154227d1/fast-memoize_v2.x.x/flow_>=v0.104.x

declare module 'fast-memoize' {
  declare type Cache<K, V> = {
    get: (key: K) => V,
    set: (key: K, value: V) => void,
    has: (key: K) =>  boolean,
    ...
  }

  declare type Options = {
    cache?: Cache<*, *>,
    serializer?: (...args: any[]) => any,
    strategy?: <T>(fn: T, options?: Options) => T,
    ...
  }


  declare module.exports: <T>(fn: T, options?: Options) => T;
}
