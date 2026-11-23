export function theatreTvPrograms(featured, recordings) {
  const archiveIds = new Set(recordings.map(({ archiveId }) => archiveId));
  return featured.flatMap((record) => {
    const editionIndex = record.editions.findIndex(({ url }) => {
      const media = new URL(url);
      return media.hostname === 'archive.org' && media.pathname.startsWith('/download/') && archiveIds.has(media.pathname.split('/')[2]);
    });
    return editionIndex < 0 ? [] : [{ record, editionIndex }];
  });
}

export function shuffleTvPrograms(programs, random = Math.random) {
  const order = [...programs];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  return order;
}
