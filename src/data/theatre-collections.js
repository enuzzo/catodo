/** CATODO selections are original editorial groupings, not imported playlists. */
export const THEATRE_COLLECTIONS = [
  { id: 'after-dark', title: 'After dark', ids: ['the-tunnel', 'decay', 'the-romantic', 'snowblind'] },
  { id: 'digital-lives', title: 'Digital lives', ids: ['bbs-documentary', 'code-rush', 'tpb-afk', 'us-now', 'lionshare', 'internet-own-boy'] },
  { id: 'look-up', title: 'Look up', ids: ['europe-to-the-stars', 'eyes-on-the-skies', 'alma'] },
  { id: 'human-connections', title: 'Human connections', ids: ['four-eyed-monsters', 'valkaama', 'nasty-old-people', 'lionshare', 'story-of-healing'] },
  { id: 'other-worlds', title: 'Small, strange worlds', ids: ['sintel', 'elephants-dream', 'tears-of-steel', 'big-buck-bunny'] },
  { id: 'change-makers', title: 'Questions worth asking', ids: ['just-do-it', 'california-dreaming', 'story-of-stuff', 'yes-men', 'forbidden-education', 'bookbinders-daughter'] },
];

/** External discovery only: collection membership does not clear a film edition. */
export const THEATRE_ARCHIVE_GUIDES = [
  { id: 'midnight', title: 'Midnight monsters', description: 'Haunted houses, unexpected visitors and science gone wrong. Start with the archive’s science-fiction and horror collection.', sourceUrl: 'https://archive.org/details/SciFi_Horror', curatorUrl: 'https://publicdomainreview.org/collections/all/genre/horror/', curator: 'The Public Domain Review', reviewed: '2026-09-22' },
  { id: 'noir', title: 'Shadows & double-crosses', description: 'Private eyes, dangerous bargains and the wrong turn home. Explore crime films from the 1940s and 1950s.', sourceUrl: 'https://archive.org/details/Film_Noir', curatorUrl: 'https://publicdomainreview.org/collection/d-o-a-1950/', curator: 'The Public Domain Review: D.O.A.', reviewed: '2026-09-22' },
  { id: 'silent', title: 'Before the first word', description: 'Visual comedy, impossible journeys and early screen nightmares. Discover silent cinema, with attention to each copy’s score and restoration.', sourceUrl: 'https://archive.org/details/silent_films', curatorUrl: 'https://publicdomainreview.org/collections/film/type/silent/', curator: 'The Public Domain Review', reviewed: '2026-09-22' },
];
