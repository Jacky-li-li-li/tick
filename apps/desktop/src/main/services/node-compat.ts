/**
 * Electron 33 ships Node 20, where `Promise.withResolvers` (Node 22+) is
 * missing and @earendil-works packages call it at runtime. Import this module
 * first so the patch is in place before any dependency code runs.
 */
const P = Promise as unknown as {
  withResolvers?: <T>() => {
    promise: Promise<T>;
    resolve: (v: T | PromiseLike<T>) => void;
    reject: (e?: unknown) => void;
  };
};

if (typeof P.withResolvers !== "function") {
  P.withResolvers = function <T>() {
    let resolve!: (v: T | PromiseLike<T>) => void;
    let reject!: (e?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
