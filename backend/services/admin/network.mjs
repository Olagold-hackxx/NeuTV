// The network incentives: decoder channels and the viewers choice.
//
// Two things a creator gets for being on the network beyond the gift split
// and the bounties:
//
//   1. A channel. Decoder numbers are sold, once each, for KashCoin. Number 1
//      is the network's own Vision channel - the main stage - and every other
//      number lists a creator in the viewer's channels area. The sale is a
//      wallet charge keyed by the buyer, so a retried purchase replays.
//
//   2. The viewers choice. Every viewer gets one vote a quarter, movable
//      until the quarter closes. The board is public and the winner takes a
//      fixed share of the quarter's network revenue - subscriptions, channel
//      sales and the network's side of gifts - paid from the treasury when
//      the back office settles the quarter. Settlement is idempotent twice
//      over: the award row is the quarter's primary key, and the payout is
//      keyed by the quarter.
//
// The ledger is the source of the revenue number. Nothing here keeps a
// second copy of it.

import { validate } from '../../platform/validate.mjs';
import { notFound, badRequest, conflict } from '../../platform/errors.mjs';
import { quarterOf, quarterWindow, previousQuarter } from '../../platform/quarters.mjs';

// One decoder number costs this many coins. Numbers below the floor are the
// network's own; a creator picks from the floor up, or takes the next free one.
export const DECODER_PRICE = 1000;
export const DECODER_FLOOR = 100;
export const DECODER_CEILING = 999;

// The winner's share of the quarter's network revenue, in percent.
export const PRIZE_SHARE_PCT = 20;

export const VISION_CHANNEL = {
  number: 1,
  id: 'vision',
  name: 'NEU Vision',
  tagline: 'The network\'s own channel: the main stage, the programme, and every live event.',
};

const publicChannel = (row) => ({
  number: row.number,
  ownerId: row.owner_id,
  name: row.name,
  tagline: row.tagline,
  price: row.price,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const publicAward = (row, winner) => ({
  quarter: row.quarter,
  winnerId: row.winner_id,
  winner: winner ?? null,
  votes: row.votes,
  revenue: row.revenue,
  sharePct: row.share_pct,
  prize: row.prize,
  settledAt: row.settled_at,
});

export function createNetwork({
  runtime,
  store,
  creators,                    // { cardFor } - the Creators Network card builder
  mainStage,                   // async () => { event, programme } - what Vision is showing
  wallet = {},                 // { charge, payPrize, revenueBetween }
  identity = {},               // { profile, accountByHandle }
}) {
  const ownChannel = async (userId) =>
    store.get('SELECT * FROM channels WHERE owner_id = ?', userId);

  const takenNumbers = async () =>
    new Set((await store.all('SELECT number FROM channels')).map((r) => Number(r.number)));

  const nextFree = (taken) => {
    for (let n = DECODER_FLOOR; n <= DECODER_CEILING; n++) if (!taken.has(n)) return n;
    return null;
  };

  const currentQuarter = () => quarterOf(runtime.now());

  const standings = async (quarter, limit = 20) => {
    const rows = await store.all(
      `SELECT creator_id, COUNT(*) AS votes, MIN(created_at) AS first_vote
       FROM creator_votes WHERE quarter = ?
       GROUP BY creator_id ORDER BY votes DESC, first_vote ASC LIMIT ?`,
      quarter, Math.min(limit, 100),
    );
    const out = [];
    for (const row of rows) {
      const profile = (await identity.profile?.(row.creator_id)) ?? null;
      if (!profile) continue;
      const channel = await ownChannel(row.creator_id);
      out.push({
        rank: out.length + 1,
        userId: row.creator_id,
        name: profile.name,
        handle: profile.handle?.startsWith('@') ? profile.handle : `@${profile.handle}`,
        avatar: profile.avatar,
        votes: Number(row.votes),
        channelNumber: channel ? Number(channel.number) : null,
      });
    }
    return out;
  };

  const prizeFor = async (window) => {
    const revenue = (await wallet.revenueBetween?.(window.startsAt, window.endsAt)) ?? { total: 0 };
    return { revenue, prize: Math.floor((revenue.total ?? 0) * PRIZE_SHARE_PCT / 100) };
  };

  return {
    // --- the channels area ------------------------------------------------

    /**
     * Public. Vision on 1, showing whatever the main stage is showing, then
     * every creator channel by number with the same card the Creators
     * Network rail uses - live session first, latest published work
     * otherwise, and a bare listing when the channel has nothing up yet.
     */
    async channelsArea() {
      const stage = (await mainStage?.()) ?? { event: null, programme: null };
      const vision = {
        ...VISION_CHANNEL,
        network: true,
        isLive: Boolean(stage.event?.isLive),
        title: stage.event?.title ?? stage.programme?.video?.title ?? null,
        thumbnail: stage.event?.posterUrl ?? stage.programme?.video?.posterUrl ?? null,
      };
      const rows = await store.all('SELECT * FROM channels ORDER BY number ASC');
      const channels = [];
      for (const row of rows) {
        const card = await creators.cardFor(row.owner_id);
        channels.push({
          ...publicChannel(row),
          network: false,
          isLive: Boolean(card?.isLive),
          title: card?.title ?? null,
          thumbnail: card?.thumbnail ?? null,
          card,
        });
      }
      return { channels: [vision, ...channels], price: DECODER_PRICE, at: runtime.now() };
    },

    async myChannel(auth) {
      const row = await ownChannel(auth.userId);
      const taken = await takenNumbers();
      return {
        channel: row ? publicChannel(row) : null,
        price: DECODER_PRICE,
        floor: DECODER_FLOOR,
        ceiling: DECODER_CEILING,
        nextFree: nextFree(taken),
        taken: [...taken].sort((a, b) => a - b),
      };
    },

    /**
     * Buy a decoder number. One per creator; the charge is keyed by the
     * buyer so a double-click replays the purchase rather than paying twice,
     * and the row insert rides on the number's primary key so two buyers
     * racing for the same number cannot both win it.
     */
    async buyChannel(auth, input) {
      const v = validate(input ?? {}, {
        number: { type: 'int', required: false, min: DECODER_FLOOR, max: DECODER_CEILING },
        name: { type: 'string', required: false, min: 2, max: 60 },
        tagline: { type: 'string', required: false, default: '', max: 160 },
      });
      if (await ownChannel(auth.userId)) throw conflict('You already hold a decoder number. One channel per creator.');
      const taken = await takenNumbers();
      const number = v.number ?? nextFree(taken);
      if (number === null) throw conflict('Every decoder number is taken.');
      if (taken.has(number)) throw conflict(`Channel ${number} is already taken.`, { nextFree: nextFree(taken) });

      const profile = (await identity.profile?.(auth.userId)) ?? null;
      const name = v.name ?? profile?.name ?? auth.user?.name ?? `Channel ${number}`;
      const paid = await wallet.charge?.(auth.userId, DECODER_PRICE, `channel-${auth.userId}`, `Decoder channel ${number}`);
      if (!paid) throw conflict('The wallet is not wired, so channels cannot be sold right now.');

      const now = runtime.now();
      try {
        await store.run(
          'INSERT INTO channels (number, owner_id, name, tagline, price, txn_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
          number, auth.userId, name, v.tagline, DECODER_PRICE, paid.transactionId ?? null, now, now,
        );
      } catch (err) {
        // The charge replays by reference, so the buyer is not out of pocket
        // when the retry lands on a free number.
        if (await ownChannel(auth.userId)) throw conflict('You already hold a decoder number. One channel per creator.');
        throw conflict(`Channel ${number} was taken a moment ago. Try again for another number.`, { nextFree: nextFree(await takenNumbers()) });
      }
      return { channel: publicChannel(await ownChannel(auth.userId)), paid };
    },

    async updateChannel(auth, input) {
      const row = await ownChannel(auth.userId);
      if (!row) throw notFound('You do not hold a decoder number yet.');
      const v = validate(input ?? {}, {
        name: { type: 'string', required: false, min: 2, max: 60 },
        tagline: { type: 'string', required: false, max: 160 },
      });
      await store.run(
        'UPDATE channels SET name = ?, tagline = ?, updated_at = ? WHERE owner_id = ?',
        v.name ?? row.name, v.tagline ?? row.tagline, runtime.now(), auth.userId,
      );
      return { channel: publicChannel(await ownChannel(auth.userId)) };
    },

    // --- the viewers choice -----------------------------------------------

    /** Public, richer when signed in: the board, the pool, and your vote. */
    async leaderboard(auth) {
      const quarter = currentQuarter();
      const window = quarterWindow(quarter);
      const [rows, pool, mine, last] = await Promise.all([
        standings(quarter),
        prizeFor(window),
        auth ? store.get('SELECT creator_id FROM creator_votes WHERE quarter = ? AND voter_id = ?', quarter, auth.userId) : null,
        store.get('SELECT * FROM leaderboard_awards ORDER BY settled_at DESC LIMIT 1'),
      ]);
      const totalVotes = rows.reduce((sum, r) => sum + r.votes, 0);
      const lastWinner = last?.winner_id ? await identity.profile?.(last.winner_id) : null;
      return {
        quarter,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        sharePct: PRIZE_SHARE_PCT,
        revenue: pool.revenue.total ?? 0,
        prize: pool.prize,
        totalVotes,
        standings: rows,
        myVote: mine?.creator_id ?? null,
        lastAward: last ? publicAward(last, lastWinner) : null,
        at: runtime.now(),
      };
    },

    /**
     * Cast or move this quarter's vote. A handle has to name a creator - a
     * viewer cannot be voted for - and nobody votes for themselves.
     */
    async vote(auth, handle) {
      const account = await identity.accountByHandle?.(handle);
      if (!account || account.role !== 'creator') throw notFound(`No creator "${handle}" on the network.`);
      if (account.id === auth.userId) throw badRequest('You cannot vote for yourself.');
      const quarter = currentQuarter();
      const now = runtime.now();
      const existing = await store.get('SELECT * FROM creator_votes WHERE quarter = ? AND voter_id = ?', quarter, auth.userId);
      if (existing) {
        await store.run(
          'UPDATE creator_votes SET creator_id = ?, updated_at = ? WHERE quarter = ? AND voter_id = ?',
          account.id, now, quarter, auth.userId,
        );
      } else {
        await store.run(
          'INSERT INTO creator_votes (quarter, voter_id, creator_id, created_at, updated_at) VALUES (?,?,?,?,?)',
          quarter, auth.userId, account.id, now, now,
        );
      }
      return { quarter, vote: { creatorId: account.id, handle: `@${account.handle}`, name: account.name }, moved: Boolean(existing), at: now };
    },

    async adminAwards() {
      const rows = await store.all('SELECT * FROM leaderboard_awards ORDER BY quarter DESC LIMIT 24');
      const awards = [];
      for (const row of rows) {
        const winner = row.winner_id ? await identity.profile?.(row.winner_id) : null;
        awards.push(publicAward(row, winner));
      }
      const quarter = currentQuarter();
      const window = quarterWindow(quarter);
      const open = { quarter, ...window, ...(await prizeFor(window)), standings: await standings(quarter, 5) };
      const previous = previousQuarter(quarter);
      const previousWindow = quarterWindow(previous);
      const settleable = !(await store.get('SELECT quarter FROM leaderboard_awards WHERE quarter = ?', previous))
        ? { quarter: previous, ...previousWindow, ...(await prizeFor(previousWindow)), standings: await standings(previous, 5) }
        : null;
      return { awards, open, settleable, sharePct: PRIZE_SHARE_PCT, at: runtime.now() };
    },

    /**
     * Close a finished quarter. Refused while the quarter is still running -
     * a leaderboard settled early is a leaderboard nobody can move any more.
     * Runs at most once per quarter; a second call returns the award as it
     * stands.
     */
    async adminSettle(actorId, input) {
      const { quarter } = validate(input ?? {}, {
        quarter: { type: 'string', required: true, max: 12 },
      });
      const window = quarterWindow(quarter);
      if (!window) throw badRequest('A quarter reads like "2026-Q3".');
      if (window.endsAt > runtime.now()) throw conflict(`${quarter} is still running. Settle it after ${new Date(window.endsAt).toISOString().slice(0, 10)}.`);

      const prior = await store.get('SELECT * FROM leaderboard_awards WHERE quarter = ?', quarter);
      if (prior) {
        const winner = prior.winner_id ? await identity.profile?.(prior.winner_id) : null;
        return { award: publicAward(prior, winner), replayed: true };
      }

      const [top] = await standings(quarter, 1);
      const { revenue, prize } = await prizeFor(window);
      const paid = top && prize > 0
        ? await wallet.payPrize?.(top.userId, prize, `prize-${quarter}`, `Viewers choice ${quarter}: ${PRIZE_SHARE_PCT}% of network revenue`)
        : null;
      const now = runtime.now();
      await store.run(
        `INSERT INTO leaderboard_awards (quarter, winner_id, votes, revenue, share_pct, prize, settled_by, settled_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        quarter, top?.userId ?? null, top?.votes ?? 0, revenue.total ?? 0, PRIZE_SHARE_PCT, top ? prize : 0, actorId, now,
      );
      const row = await store.get('SELECT * FROM leaderboard_awards WHERE quarter = ?', quarter);
      return { award: publicAward(row, top ? { id: top.userId, name: top.name, handle: top.handle, avatar: top.avatar } : null), paid, replayed: false };
    },
  };
}
