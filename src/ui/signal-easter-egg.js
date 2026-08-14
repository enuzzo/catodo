import { createSignalEasterEggDeck, drawSignalEasterEgg } from './signal-easter-egg-model.js';
import nyanCatGifUrl from '../../assets/easter-eggs/nyan-cat.gif?url';
import rickAstleyGifUrl from '../../assets/easter-eggs/rick-astley.gif?url';

const EFFECT_DURATIONS = Object.freeze({
  rickroll: 6800,
  'nyan-cat': 7200,
  teletext: 7600,
  'numbers-station': 8200,
  finale: 9200,
});

const EFFECT_ANNOUNCEMENTS = Object.freeze({
  rickroll: 'Broadcast hijacked. Never gonna give you up.',
  'nyan-cat': 'Nyan Cat crossed the signal path.',
  teletext: 'Pirate teletext page zero x dead opened.',
  'numbers-station': 'Unknown numbers station acquired.',
  breakout: 'EBU Breakout started. Use left and right arrows or drag to move the paddle.',
  finale: 'All five signal anomalies confirmed. Root access granted to the cow.',
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
    const image = node(documentRef, 'img', 'rick-dancer__gif');
    image.src = rickAstleyGifUrl;
    image.alt = index === 0 ? 'Rick Astley dancing' : '';
    if (index > 0) image.setAttribute('aria-hidden', 'true');
    dancer.append(image);
    dancers.append(dancer);
  }
  const meta = node(documentRef, 'span', 'signal-anomaly__meta mono', 'MEMETIC PAYLOAD ACCEPTED · AUDIO REMAINS MUTED');
  scene.append(eyebrow, title, dancers, meta);
  return scene;
}

function createNyanCat(documentRef) {
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
  const cat = node(documentRef, 'img', 'nyan-cat');
  cat.src = nyanCatGifUrl;
  cat.alt = 'Nyan Cat';
  flyer.append(cat);
  const copy = node(documentRef, 'strong', 'nyan-copy', 'NYAN CAT HAS LEFT THE MULTIVIEW');
  const meta = node(documentRef, 'span', 'signal-anomaly__meta mono', 'POP-TART PACKETS: 8 · LATENCY: NYAN');
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

function createBreakout(documentRef, windowRef) {
  const scene = node(documentRef, 'div', 'signal-anomaly__scene signal-anomaly__scene--breakout');
  const header = node(documentRef, 'div', 'breakout__header mono');
  const title = node(documentRef, 'strong', '', 'EBU BREAKOUT // LIVE');
  const hud = node(documentRef, 'span', 'breakout__hud');
  const score = node(documentRef, 'span', '', 'SCORE 0000');
  const lives = node(documentRef, 'span', '', 'LIVES 3');
  hud.append(score, lives);
  header.append(title, hud);
  const arena = node(documentRef, 'div', 'breakout__arena');
  arena.tabIndex = 0;
  arena.setAttribute('role', 'application');
  arena.setAttribute('aria-label', 'EBU Breakout. Use left and right arrows, A and D, or drag to move the paddle.');
  const bricks = node(documentRef, 'div', 'breakout__bricks');
  const brickNodes = [];
  for (let index = 0; index < 24; index += 1) {
    const brick = node(documentRef, 'i');
    brick.style.setProperty('--brick-index', String(index));
    bricks.append(brick);
    brickNodes.push(brick);
  }
  const ball = node(documentRef, 'i', 'breakout__ball');
  const paddle = node(documentRef, 'i', 'breakout__paddle');
  const victory = node(documentRef, 'div', 'breakout__victory');
  victory.setAttribute('aria-hidden', 'true');
  const victoryRick = node(documentRef, 'img', 'breakout__victory-rick');
  victoryRick.src = rickAstleyGifUrl;
  victoryRick.alt = '';
  const victoryTitle = node(documentRef, 'strong', '', 'SIGNAL CLEARED');
  const victoryCopy = node(documentRef, 'span', 'mono', 'YOU HAVE BEEN RICKROLLED');
  victory.append(victoryRick, victoryTitle, victoryCopy);
  arena.append(bricks, ball, paddle, victory);
  const copy = node(documentRef, 'strong', 'breakout__copy', 'SPACE / TAP TO START · ← → / A D / DRAG');
  copy.setAttribute('aria-live', 'polite');
  scene.append(header, arena, copy);

  const requestFrame = windowRef.requestAnimationFrame?.bind(windowRef)
    || ((callback) => windowRef.setTimeout(() => callback(Date.now()), 16));
  const cancelFrame = windowRef.cancelAnimationFrame?.bind(windowRef) || windowRef.clearTimeout.bind(windowRef);
  const activeBricks = new Set(brickNodes);
  const keys = { left: false, right: false };
  const state = {
    status: 'ready',
    score: 0,
    lives: 3,
    width: 0,
    height: 0,
    paddleX: 0,
    ballX: 0,
    ballY: 0,
    velocityX: 190,
    velocityY: -210,
  };
  let frameId = 0;
  let previousTime = 0;
  let pointerId = null;

  const renderHud = () => {
    score.textContent = `SCORE ${String(state.score).padStart(4, '0')}`;
    lives.textContent = `LIVES ${state.lives}`;
  };

  const positionPaddle = (x) => {
    const half = paddle.offsetWidth / 2 || 54;
    state.paddleX = Math.max(half, Math.min(state.width - half, x));
    paddle.style.transform = `translate3d(${state.paddleX - half}px, 0, 0)`;
  };

  const positionBall = () => {
    const radius = ball.offsetWidth / 2 || 8;
    ball.style.transform = `translate3d(${state.ballX - radius}px, ${state.ballY - radius}px, 0)`;
  };

  const resetBall = (direction = 1) => {
    state.ballX = state.width / 2;
    state.ballY = Math.max(80, state.height - 52);
    state.velocityX = 190 * direction;
    state.velocityY = -210;
    positionBall();
  };

  const syncLayout = () => {
    const nextWidth = arena.clientWidth;
    const nextHeight = arena.clientHeight;
    if (!nextWidth || !nextHeight) return false;
    if (!state.width) {
      state.width = nextWidth;
      state.height = nextHeight;
      positionPaddle(nextWidth / 2);
      resetBall(Math.random() < 0.5 ? -1 : 1);
      return true;
    }
    if (nextWidth !== state.width || nextHeight !== state.height) {
      const widthRatio = nextWidth / state.width;
      const heightRatio = nextHeight / state.height;
      state.width = nextWidth;
      state.height = nextHeight;
      positionPaddle(state.paddleX * widthRatio);
      state.ballX *= widthRatio;
      state.ballY *= heightRatio;
      positionBall();
    }
    return true;
  };

  const finish = (won) => {
    state.status = won ? 'won' : 'lost';
    copy.textContent = won ? 'NEVER GONNA GIVE YOU UP · R / SPACE / TAP TO REPLAY' : 'SIGNAL LOST · R / SPACE TO RETRY';
    arena.dataset.state = state.status;
  };

  const begin = () => {
    if (state.status !== 'ready') return;
    syncLayout();
    state.status = 'playing';
    delete arena.dataset.state;
    copy.textContent = '← → / A D / DRAG · CLEAR THE SIGNAL';
    previousTime = 0;
    cancelFrame(frameId);
    frameId = requestFrame(tick);
  };

  const restart = () => {
    activeBricks.clear();
    brickNodes.forEach((brick) => {
      brick.classList.remove('is-hit');
      activeBricks.add(brick);
    });
    state.status = 'playing';
    state.score = 0;
    state.lives = 3;
    delete arena.dataset.state;
    copy.textContent = '← → / A D / DRAG · CLEAR THE SIGNAL';
    renderHud();
    syncLayout();
    positionPaddle(state.width / 2);
    resetBall(Math.random() < 0.5 ? -1 : 1);
    previousTime = 0;
    cancelFrame(frameId);
    frameId = requestFrame(tick);
  };

  const hitBrick = (previousX, previousY, radius) => {
    for (const brick of activeBricks) {
      const left = brick.offsetLeft;
      const top = brick.offsetTop;
      const right = left + brick.offsetWidth;
      const bottom = top + brick.offsetHeight;
      if (state.ballX + radius < left || state.ballX - radius > right
        || state.ballY + radius < top || state.ballY - radius > bottom) continue;
      activeBricks.delete(brick);
      brick.classList.add('is-hit');
      state.score += 100;
      renderHud();
      if (previousX + radius <= left || previousX - radius >= right) state.velocityX *= -1;
      else state.velocityY *= -1;
      if (!activeBricks.size) finish(true);
      return;
    }
  };

  function tick(time) {
    if (!syncLayout()) {
      frameId = requestFrame(tick);
      return;
    }
    if (state.status !== 'playing') return;
    if (!previousTime) previousTime = time;
    const delta = Math.min(0.032, Math.max(0, (time - previousTime) / 1000));
    previousTime = time;

    const paddleSpeed = 430;
    if (keys.left !== keys.right) positionPaddle(state.paddleX + (keys.left ? -1 : 1) * paddleSpeed * delta);

    const radius = ball.offsetWidth / 2 || 8;
    const previousX = state.ballX;
    const previousY = state.ballY;
    state.ballX += state.velocityX * delta;
    state.ballY += state.velocityY * delta;

    if (state.ballX - radius <= 0 && state.velocityX < 0) {
      state.ballX = radius;
      state.velocityX *= -1;
    } else if (state.ballX + radius >= state.width && state.velocityX > 0) {
      state.ballX = state.width - radius;
      state.velocityX *= -1;
    }
    if (state.ballY - radius <= 0 && state.velocityY < 0) {
      state.ballY = radius;
      state.velocityY *= -1;
    }

    const paddleTop = state.height - 28;
    const paddleHalf = paddle.offsetWidth / 2 || 54;
    if (state.velocityY > 0 && state.ballY + radius >= paddleTop
      && previousY + radius <= paddleTop + 4
      && state.ballX + radius >= state.paddleX - paddleHalf
      && state.ballX - radius <= state.paddleX + paddleHalf) {
      const impact = Math.max(-1, Math.min(1, (state.ballX - state.paddleX) / paddleHalf));
      const speed = Math.min(430, Math.hypot(state.velocityX, state.velocityY) * 1.035);
      state.velocityX = speed * Math.sin(impact * 1.08);
      state.velocityY = -Math.max(155, speed * Math.cos(impact * 1.08));
      state.ballY = paddleTop - radius;
    }

    hitBrick(previousX, previousY, radius);

    if (state.ballY - radius > state.height) {
      state.lives -= 1;
      renderHud();
      if (!state.lives) finish(false);
      else resetBall(state.velocityX < 0 ? -1 : 1);
    }

    positionBall();
    if (state.status === 'playing') frameId = requestFrame(tick);
  }

  const onKeydown = (event) => {
    const key = event.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') {
      if (state.status === 'ready') begin();
      if (state.status !== 'playing') return;
      keys.left = true;
      positionPaddle(state.paddleX - 26);
    } else if (key === 'arrowright' || key === 'd') {
      if (state.status === 'ready') begin();
      if (state.status !== 'playing') return;
      keys.right = true;
      positionPaddle(state.paddleX + 26);
    }
    else if ((key === ' ' || key === 'enter') && state.status === 'ready') begin();
    else if ((key === 'r' || key === ' ' || key === 'enter') && state.status !== 'playing') restart();
    else return;
    event.preventDefault();
  };

  const onKeyup = (event) => {
    const key = event.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') keys.left = false;
    else if (key === 'arrowright' || key === 'd') keys.right = false;
    else return;
    event.preventDefault();
  };

  const movePaddleFromPointer = (event) => {
    const bounds = arena.getBoundingClientRect();
    positionPaddle(event.clientX - bounds.left);
  };

  const onPointerDown = (event) => {
    if (state.status === 'ready') begin();
    else if (state.status !== 'playing') restart();
    pointerId = event.pointerId;
    arena.setPointerCapture?.(pointerId);
    arena.focus({ preventScroll: true });
    movePaddleFromPointer(event);
  };

  const onPointerMove = (event) => {
    if (event.pointerId === pointerId) movePaddleFromPointer(event);
  };

  const onPointerUp = (event) => {
    if (event.pointerId === pointerId) pointerId = null;
  };

  windowRef.addEventListener('keydown', onKeydown);
  windowRef.addEventListener('keyup', onKeyup);
  arena.addEventListener('pointerdown', onPointerDown);
  arena.addEventListener('pointermove', onPointerMove);
  arena.addEventListener('pointerup', onPointerUp);
  arena.addEventListener('pointercancel', onPointerUp);
  renderHud();
  arena.dataset.state = 'ready';
  frameId = requestFrame(tick);

  return {
    element: scene,
    cleanup() {
      cancelFrame(frameId);
      windowRef.removeEventListener('keydown', onKeydown);
      windowRef.removeEventListener('keyup', onKeyup);
      arena.removeEventListener('pointerdown', onPointerDown);
      arena.removeEventListener('pointermove', onPointerMove);
      arena.removeEventListener('pointerup', onPointerUp);
      arena.removeEventListener('pointercancel', onPointerUp);
    },
  };
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
  const eyebrow = node(documentRef, 'span', 'signal-anomaly__eyebrow', 'ALL FIVE ANOMALIES CONFIRMED');
  const title = node(documentRef, 'strong', 'finale__title', 'THE COW HAS ROOT');
  const terminal = node(documentRef, 'div', 'finale__terminal mono');
  appendLines(documentRef, terminal, [
    '> sudo catodo --unlock-channel-zero',
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

function effectScene(documentRef, windowRef, effect, random) {
  if (effect === 'breakout') return createBreakout(documentRef, windowRef);
  if (effect === 'rickroll') return { element: createRickroll(documentRef) };
  if (effect === 'nyan-cat') return { element: createNyanCat(documentRef) };
  if (effect === 'teletext') return { element: createTeletext(documentRef) };
  if (effect === 'numbers-station') return { element: createNumbersStation(documentRef, random) };
  return { element: createFinale(documentRef) };
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
  let activeCleanup = null;

  const stop = () => {
    windowRef.clearTimeout(timer);
    activeCleanup?.();
    timer = 0;
    activeEffect = '';
    activeCleanup = null;
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
    const effect = effectScene(documentRef, windowRef, activeEffect, random);
    activeCleanup = effect.cleanup || null;
    stage.replaceChildren(effect.element);
    overlay.className = `signal-anomaly signal-anomaly--${activeEffect}`;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    bars.classList.add('is-anomalous');
    bars.setAttribute('aria-pressed', 'true');
    bars.dataset.effect = activeEffect;
    root.dataset.signalAnomaly = activeEffect;
    announcement.textContent = EFFECT_ANNOUNCEMENTS[activeEffect];
    const reduced = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (activeEffect !== 'breakout') {
      timer = windowRef.setTimeout(stop, reduced ? 2800 : EFFECT_DURATIONS[activeEffect]);
    }
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
