export function programmeCardNeedsExpansion(card) {
  const title = card?.querySelector?.('strong');
  return Boolean(title && title.scrollWidth > title.clientWidth)
    || Number(card?.scrollHeight || 0) > Number(card?.clientHeight || 0);
}
