// KashCoin gift catalog. Mirrors the GIFTS array the frontend renders, and is
// the authority on cost: the client sends a giftId, never a price, so a viewer
// cannot post a cheaper amount for an expensive gift.

export const GIFTS = [
  { id: 'giftbox',  name: 'Luxury Gift Box', emoji: '🎁',  cost: 1000 },
  { id: 'crown',    name: 'Royal Crown',     emoji: '👑',  cost: 500 },
  { id: 'car',      name: 'Supercar Key',    emoji: '🏎️', cost: 350 },
  { id: 'diamond',  name: 'Diamond Gem',     emoji: '💎',  cost: 250 },
  { id: 'rocket',   name: 'Rocket Booster',  emoji: '🚀',  cost: 100 },
  { id: 'trophy',   name: 'Golden Trophy',   emoji: '🏆',  cost: 75 },
  { id: 'flame',    name: 'Super Flame',     emoji: '🔥',  cost: 50 },
  { id: 'spike',    name: 'Kash Spike',      emoji: '⚡',  cost: 25 },
  { id: 'applause', name: 'Applause',        emoji: '👏',  cost: 10 },
];

const withLabel = (g) => ({ ...g, label: `${g.cost.toLocaleString('en-US')} Coins` });

export const giftCatalog = () => GIFTS.map(withLabel);
export const giftById = (id) => {
  const hit = GIFTS.find((g) => g.id === id);
  return hit ? withLabel(hit) : null;
};
