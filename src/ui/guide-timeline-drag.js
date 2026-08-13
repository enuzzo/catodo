const DEFAULT_DRAG_THRESHOLD = 6;

function isCustomDragPointer(event) {
  return event?.button === 0 && event?.pointerType !== 'touch';
}

export function enableGuideTimelineDrag(element, { threshold = DEFAULT_DRAG_THRESHOLD } = {}) {
  if (!element?.addEventListener) throw new TypeError('A guide timeline element is required');

  let gesture = null;
  let suppressClick = false;

  const finishGesture = ({ suppress = false } = {}) => {
    if (!gesture) return;
    const pointerId = gesture.pointerId;
    const dragged = gesture.dragged;
    gesture = null;
    element.classList?.remove('is-dragging');
    if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture?.(pointerId);
    if (!dragged || !suppress) return;
    suppressClick = true;
    const ownerWindow = element.ownerDocument?.defaultView;
    const schedule = ownerWindow?.setTimeout?.bind(ownerWindow) || globalThis.setTimeout;
    schedule?.(() => { suppressClick = false; }, 0);
  };

  const onPointerDown = (event) => {
    if (!isCustomDragPointer(event)) return;
    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: element.scrollLeft,
      dragged: false,
    };
  };

  const onPointerMove = (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (!gesture.dragged) {
      if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      gesture.dragged = true;
      element.classList?.add('is-dragging');
      element.setPointerCapture?.(event.pointerId);
    }
    event.preventDefault?.();
    element.scrollLeft = gesture.startScrollLeft - deltaX;
  };

  const onPointerUp = (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    finishGesture({ suppress: true });
  };

  const onPointerCancel = (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    finishGesture();
  };

  const onClick = (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerCancel);
  element.addEventListener('click', onClick, true);

  return () => {
    finishGesture();
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerCancel);
    element.removeEventListener('click', onClick, true);
  };
}
