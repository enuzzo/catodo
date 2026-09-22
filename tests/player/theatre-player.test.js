import test from 'node:test';
import assert from 'node:assert/strict';
import { TheatrePlayer } from '../../src/player/theatre-player.js';
import { FakeVideo } from './fakes.js';
const film = { id: 'licensed', decision: 'usable', editions: [{ url: 'https://media.example/film.mp4' }] };
function setup() {
  const video = new FakeVideo(); video.getAttribute = (name) => video[name]; video.duration = 120;
  let otherPaused = 0;
  const player = new TheatrePlayer({ video, beforePlay: () => { otherPaused++; } });
  return { video, player, count: () => otherPaused };
}
test('No attachment or playback before explicit consent and an active Theatre', async () => {
  const { video, player } = setup();
  assert.equal(await player.play(film, { consent: true }), false);
  player.setActive(true);
  assert.equal(await player.play(film), false);
  assert.equal(await player.play({ ...film, decision: 'conditional' }, { consent: true }), false);
  assert.equal(await player.play({ ...film, editions: [{ url: 'javascript:alert(1)' }] }, { consent: true }), false);
  assert.equal(await player.play({ ...film, editions: [{ url: 'broken' }] }, { consent: true }), false);
  assert.equal(video.src, ''); assert.equal(video.playCalls, 0);
});
test('Playback resumes without reloading and leaving Theatre blocks delayed live events', async () => {
  const { video, player, count } = setup(); player.setActive(true);
  assert.equal(await player.play(film, { consent: true }), true);
  assert.equal(count(), 1); assert.equal(video.loadCalls, 1);
  player.pause(); video.currentTime = 42;
  await player.play(film, { consent: true });
  assert.equal(video.loadCalls, 1); assert.equal(video.currentTime, 42);
  player.setActive(false);
  video.paused = false; video.dispatchEvent(new Event('play'));
  assert.equal(video.paused, true);
});
test('A pending play is invalidated on navigation; source changes and teardown release media', async () => {
  const { video, player } = setup(); player.setActive(true);
  let resolve; video.play = () => new Promise((done) => { resolve = done; });
  const playing = player.play(film, { consent: true });
  player.setActive(false); resolve(); assert.equal(await playing, false);
  player.clear(); assert.equal(video.src, ''); assert.equal(player.title, null);
  player.destroy(); assert.equal(player.listeners.length, 0);
});
test('Autoplay rejection becomes a usable gesture message and seeking stays inside the film', async () => {
  const { video, player } = setup(); player.setActive(true);
  video.play = async () => { throw Object.assign(new Error('gesture'), { name: 'NotAllowedError' }); };
  assert.equal(await player.play(film, { consent: true }), false); assert.equal(player.snapshot().error, 'gesture');
  player.seek(-20); assert.equal(video.currentTime, 0); player.seek(200); assert.equal(video.currentTime, 120);
});
