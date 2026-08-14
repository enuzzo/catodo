export const SIGNAL_EASTER_EGGS = Object.freeze([
  'rickroll',
  'nyan-cow',
  'teletext',
  'numbers-station',
  'breakout',
  'degauss',
]);

function normaliseRandom(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(0.999999999, number));
}

export function shuffleSignalEasterEggs(random = Math.random) {
  const effects = [...SIGNAL_EASTER_EGGS];
  for (let index = effects.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(normaliseRandom(random()) * (index + 1));
    [effects[index], effects[swapIndex]] = [effects[swapIndex], effects[index]];
  }
  return effects;
}

export function createSignalEasterEggDeck(random = Math.random) {
  return {
    remaining: shuffleSignalEasterEggs(random),
    discovered: [],
    cycle: 0,
  };
}

export function drawSignalEasterEgg(deck, random = Math.random) {
  const current = deck && Array.isArray(deck.remaining)
    ? deck
    : createSignalEasterEggDeck(random);

  if (!current.remaining.length) {
    return {
      effect: 'finale',
      deck: {
        remaining: shuffleSignalEasterEggs(random),
        discovered: [],
        cycle: (Number(current.cycle) || 0) + 1,
      },
    };
  }

  const [effect, ...remaining] = current.remaining;
  return {
    effect,
    deck: {
      remaining,
      discovered: [...(current.discovered || []), effect],
      cycle: Number(current.cycle) || 0,
    },
  };
}
