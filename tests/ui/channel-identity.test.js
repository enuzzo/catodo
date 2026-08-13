import assert from 'node:assert/strict';
import test from 'node:test';

import { featuredChannelIdentity } from '../../src/ui/channel-identity.js';

test('featured identity separates duplicate quality and availability from the channel name', () => {
  assert.deepEqual(
    featuredChannelIdentity({ name: 'ZEE ALWAN (576P) [NOT 24/7]' }, '576p', 'Unknown channel'),
    {
      rawName: 'ZEE ALWAN (576P) [NOT 24/7]',
      displayName: 'ZEE ALWAN',
      notAlwaysOn: true,
    },
  );
});

test('featured identity preserves meaningful parenthetical text', () => {
  assert.deepEqual(
    featuredChannelIdentity({ name: 'News One (West)' }, '1080p', 'Unknown channel'),
    {
      rawName: 'News One (West)',
      displayName: 'News One (West)',
      notAlwaysOn: false,
    },
  );
});

test('featured identity reflects structured availability metadata', () => {
  assert.equal(featuredChannelIdentity({ name: 'News One', notAlwaysOn: true }, '', '').notAlwaysOn, true);
});
