/** Share one lazy import and discard renders superseded while it was loading. */
export function createDeferredRenderer(load) {
  let module;
  let pending;
  const requests = new WeakMap();
  const get = () => {
    if (module) return Promise.resolve(module);
    pending ||= Promise.resolve().then(load).then((loaded) => {
      module = loaded;
      return loaded;
    }).finally(() => { pending = null; });
    return pending;
  };
  return {
    peek: () => module,
    cancel: (target) => requests.delete(target),
    async render(target, method, args, onError = () => {}) {
      const request = {};
      requests.set(target, request);
      try {
        const loaded = await get();
        if (requests.get(target) === request) return loaded[method](target, ...args);
      } catch (error) {
        if (requests.get(target) === request) onError(error);
      }
      return null;
    },
  };
}
