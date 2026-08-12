export function emit(target, type, detail, callback) {
  let event;
  if (typeof CustomEvent === "function") {
    event = new CustomEvent(type, { detail: detail });
  } else {
    event = new Event(type);
    Object.defineProperty(event, "detail", { value: detail });
  }
  target.dispatchEvent(event);
  if (typeof callback === "function") callback(type, detail);
  return detail;
}
export function listen(target, type, handler) {
  target.addEventListener(type, handler);
  return function removeListener() {
    target.removeEventListener(type, handler);
  };
}
