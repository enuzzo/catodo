import { createSignalEasterEggDeck, drawSignalEasterEgg } from './signal-easter-egg-model.js';

const EFFECT_DURATIONS = Object.freeze({
  rickroll: 6800,
  'nyan-cow': 7200,
  teletext: 7600,
  'numbers-station': 8200,
  breakout: 8200,
  degauss: 6200,
  finale: 9200,
});

const EFFECT_ANNOUNCEMENTS = Object.freeze({
  rickroll: 'Broadcast hijacked. Never gonna give you up.',
  'nyan-cow': 'Nyan Cow crossed the signal path.',
  teletext: 'Pirate teletext page zero x dead opened.',
  'numbers-station': 'Unknown numbers station acquired.',
  breakout: 'Broadcast Breakout demo started.',
  degauss: 'Cathode degauss cycle started.',
  finale: 'All six signal anomalies confirmed. Root access granted to the cow.',
});

function node(documentRef, tagName, className, text) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function appendLines(documentRef, container, lines) {
  lines.forEach((line) => container.append(node(documentRef, 'p', '', line)));
}

function createRickroll(documentRef) {
  const scene = node(documentRef, 'div', 'signal-anomaly__scene signal-anomaly__scene--rickroll');
  const eyebrow = node(documentRef, 'span', 'signal-anomaly__eyebrow', 'SOURCE: ABSOLUTELY NOT YOUR PLAYLIST');
  const title = node(documentRef, 'strong', 'signal-anomaly__headline', 'NEVER GONNA GIVE YOU UP');
  const dancers = node(documentRef, 'div', 'rick-army');
  for (let index = 0; index < 8; index += 1) {
    const dancer = node(documentRef, 'span', 'rick-dancer');
    dancer.style.setProperty('--dancer-index', String(index));
    dancer.append(
      node(documentRef, 'i', 'rick-dancer__head'),
      node(documentRef, 'i', 'rick-dancer__body'),
      node(documentRef, 'i', 'rick-dancer__arm rick-dancer__arm--left'),
      node(documentRef, 'i', 'rick-dancer__arm rick-dancer__arm--right'),
      node(documentRef, 'i', 'rick-dancer__leg rick-dancer__leg--left'),
      node(documentRef, 'i', 'rick-dancer__leg rick-dancer__leg--right'),
    );
    dancers.append(dancer);
  }
  const meta = node(documentRef, 'span', 'signal-anomaly__meta mono', 'MEMETIC PAYLOAD ACCEPTED · AUDIO REMAINS MUTED');
  scene.append(eyebrow, title, dancers, meta);
  return scene;
}

function createNyanCow(documentRef) {
  const scene = node(documentRef, 'div', 'signal-anomaly__scene signal-anomaly__scene--nyan');
  const sky = node(documentRef, 'div', 'nyan-sky');
  for (let index = 0; index < 20; index += 1) {
    const star = node(documentRef, 'i', 'nyan-star', index % 3 ? '·' : '✦');
    star.style.setProperty('--star-index', String(index));
    star.style.setProperty('--star-x', `${(index * 53) % 96}%`);
    star.style.setProperty('--star-y', `${(index * 37) % 88}%`);
    sky.append(star);
  }
  const flyer = node(documentRef, 'div', 'nyan-flyer');
  const trail = node(documentRef, 'div', 'nyan-trail');
  for (let index = 0; index < 6; index += 1) trail.append(node(documentRef, 'i'));
  const cow = node(documentRef, 'div', 'nyan-cow');
  cow.append(
    node(documentRef, 'i', 'nyan-cow__body'),
    node(documentRef, 'i', 'nyan-cow__spot nyan-cow__spot--one'),
    node(documentRef, 'i', 'nyan-cow__spot nyan-cow__spot--two'),
    node(documentRef, 'i', 'nyan-cow__head'),
    node(documentRef, 'i', 'nyan-cow__horn nyan-cow__horn--left'),
    node(documentRef, 'i', 'nyan-cow__horn nyan-cow__horn--right'),
    node(documentRef, 'i', 'nyan-cow__leg nyan-cow__leg--one'),
    node(documentRef, 'i', 'nyan-cow__leg nyan-cow__leg--two'),
  );
  flyer.append(trail, cow);
  const copy = node(documentRef, 'strong', 'nyan-copy', 'NYAN COW HAS LEFT THE MULTIVIEW');
  const meta = node(documentRef, 'span', 'signal-anomaly__meta mono', 'MILK PACKETS: 8 · LATENCY: MOO');
  scene.append(sky, flyer, copy, meta);
  return scene;
}

function createTeletext(documentRef) {
  const scene = node(documentRef, 'div', 'signal-anomaly__scene signal-anomaly__scene--teletext');
  const header = node(documentRef, 'div', 'teletext__header');
  header.append(
    node(documentRef, 'strong', '', 'CATODO PIRATE TELETEXT'),
    node(documentRef, 'span', 'mono', 'P0xDEAD'),
  );
  const title = node(documentRef, 'h2', '', 'UNAUTHORIZED BROADCAST DETECTED');
  const body = node(documentRef, 'div', 'teletext__body mono');
  appendLines(documentRef, body, [
    'THE SPECTRUM IS PUBLIC.',
    'YOUR BUFFER IS NOT.',
    'NO GODS. NO MASTERS.',
    'ONLY TRANSPORT STREAMS.',
  ]);
  const footer = node(documentRef, 'div', 'teletext__footer mono', '404   REALITY NOT FOUND   888');
  scene.append(header, title, body, footer);
  return scene;
}

function randomDigits(random, groups = 7) {
  return Array.from({ length: groups }, () => String(Math.floor(random() * 100000)).padStart(5, '0')).join('  ');
}

function createNumbersStation(documentRef, random) {
  const scene = node(documentRef, 'div', 'signal-anomaly__scene signal-anomaly__scene--numbers');
  const header = node(documentRef, 'div', 'numbers-station__header mono');
  header.append(
    node(documentRef, 'span', '', 'STATION 0xC47D0'),
    node(documentRef, 'span', '', 'UNKNOWN ORIGIN'),
  );
  const eye = node(documentRef, 'div', 'numbers-station__eye');
  eye.append(node(documentRef, 'i'), node(documentRef, 'i'));
  const digits = node(documentRef, 'div', 'numbers-station__digits mono');
  appendLines(documentRef, digits, [randomDigits(random), randomDigits(random), randomDigits(random)]);
  const warning = node(documentRef, 'strong', 'numbers-station__warning', 'THE RECEIVER REMEMBERS YOU');
  const sub = node(documentRef, 'span', 'signal-anomaly__meta mono', 'DO NOT ANSWER CHANNEL ZERO · YOUR TELEVISION DREAMED THIS FIRST');
  scene.append(header, eye, digits, warning, sub);
  return scene;
}

function createBreakout(documentRef) {
  const scene = node(documentRef, 'div', 'signal-anomaly__scene signal-anomaly__scene--breakout');
  const header = node(documentRef, 'div', 'breakout__header mono', 'EBU BREAKOUT // ATTRACT MODE');
  const arena = node(documentRef, 'div', 'breakout__arena');
  const bricks = node(documentRef, 'div', 'breakout__bricks');
  for (let index = 0; index < 16; index += 1) {
    const brick = node(documentRef, 'i');
    brick.style.setProperty('--brick-index', String(index));
    bricks.append(brick);
  }
  arena.append(bricks, node(documentRef, 'i', 'breakout__ball'), node(documentRef, 'i', 'breakout__paddle'));
  const copy = node(documentRef, 'strong', 'breakout__copy', 'INSERT COIN? CUTE. THIS IS PRODUCTION.');
  scene.append(header, arena, copy);
  return scene;
}

function createDegauss(documentRef) {
  const scene = node(documentRef, 'div', 'signal-anomaly__scene signal-anomaly__scene--degauss');
  const tube = node(documentRef, 'div', 'degauss__tube');
  tube.append(
    node(documentRef, 'i', 'degauss__scanline'),
    node(documentRef, 'i', 'degauss__orb'),
    node(documentRef, 'span', 'degauss__error mono', 'ERR_COW_NOT_FOUND'),
    node(documentRef, 'strong', 'degauss__copy', 'RECALIBRATING REALITY'),
  );
  scene.append(tube, node(documentRef, 'span', 'signal-anomaly__meta mono', 'PLEASE STAND BY · MAGNETIC DIGNITY: 0%'));
  return scene;
}

function createFinale(documentRef) {
  const scene = node(documentRef, 'div', 'signal-anomaly__scene signal-anomaly__scene--finale');
  const noise = node(documentRef, 'div', 'finale__noise');
  const crown = node(documentRef, 'div', 'finale__cow');
  crown.append(
    node(documentRef, 'i', 'finale__horn finale__horn--left'),
    node(documentRef, 'i', 'finale__horn finale__horn--right'),
    node(documentRef, 'span', '', '🐄'),
  );
  const eyebrow = node(documentRef, 'span', 'signal-anomaly__eyebrow', 'ALL SIX ANOMALIES CONFIRMED');
  const title = node(documentRef, 'strong', 'finale__title', 'THE COW HAS ROOT');
  const terminal = node(documentRef, 'div', 'finale__terminal mono');
  appendLines(documentRef, terminal, [
    '> sudo catodo --degauss-reality',
    '[ OK ] timeline contaminated',
    '[ OK ] teletext escaped containment',
    '[ OK ] bovine privilege escalation',
    'ROOT ACCESS GRANTED // CHANNEL 7½',
  ]);
  const bars = node(documentRef, 'div', 'finale__bars');
  for (let index = 0; index < 8; index += 1) bars.append(node(documentRef, 'i'));
  scene.append(noise, crown, eyebrow, title, terminal, bars);
  return scene;
}

function effectScene(documentRef, effect, random) {
  if (effect === 'rickroll') return createRickroll(documentRef);
  if (effect === 'nyan-cow') return createNyanCow(documentRef);
  if (effect === 'teletext') return createTeletext(documentRef);
  if (effect === 'numbers-station') return createNumbersStation(documentRef, random);
  if (effect === 'breakout') return createBreakout(documentRef);
  if (effect === 'degauss') return createDegauss(documentRef);
  return createFinale(documentRef);
}

export function createSignalEasterEgg({ root, bars, random = Math.random } = {}) {
  if (!(root instanceof Element) || !(bars instanceof Element)) {
    throw new TypeError('createSignalEasterEgg requires root and bars elements');
  }
  const documentRef = root.ownerDocument;
  const windowRef = documentRef.defaultView || window;
  const overlay = node(documentRef, 'section', 'signal-anomaly');
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  const dismiss = node(documentRef, 'button', 'signal-anomaly__dismiss', '×');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Dismiss signal anomaly');
  const stage = node(documentRef, 'div', 'signal-anomaly__stage');
  overlay.append(stage, dismiss);
  const announcement = node(documentRef, 'span', 'sr-only');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  root.append(overlay, announcement);

  let deck = createSignalEasterEggDeck(random);
  let timer = 0;
  let activeEffect = '';

  const stop = () => {
    windowRef.clearTimeout(timer);
    timer = 0;
    activeEffect = '';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.className = 'signal-anomaly';
    stage.replaceChildren();
    bars.classList.remove('is-anomalous');
    bars.removeAttribute('aria-pressed');
    delete bars.dataset.effect;
    delete root.dataset.signalAnomaly;
  };

  const play = () => {
    if (activeEffect) {
      stop();
      return 'cancelled';
    }
    const draw = drawSignalEasterEgg(deck, random);
    deck = draw.deck;
    activeEffect = draw.effect;
    stage.replaceChildren(effectScene(documentRef, activeEffect, random));
    overlay.className = `signal-anomaly signal-anomaly--${activeEffect}`;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    bars.classList.add('is-anomalous');
    bars.setAttribute('aria-pressed', 'true');
    bars.dataset.effect = activeEffect;
    root.dataset.signalAnomaly = activeEffect;
    announcement.textContent = EFFECT_ANNOUNCEMENTS[activeEffect];
    const reduced = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    timer = windowRef.setTimeout(stop, reduced ? 2800 : EFFECT_DURATIONS[activeEffect]);
    return activeEffect;
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape' && activeEffect) stop();
  };
  dismiss.addEventListener('click', stop);
  documentRef.addEventListener('keydown', onKeydown);

  return {
    play,
    stop,
    get activeEffect() {
      return activeEffect;
    },
    destroy() {
      stop();
      dismiss.removeEventListener('click', stop);
      documentRef.removeEventListener('keydown', onKeydown);
      overlay.remove();
      announcement.remove();
    },
  };
}
