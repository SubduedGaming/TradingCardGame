import type { Action, BuildingInPlay, Card, GameEvent, GameState, LaneIndex, PlayerId, Row, TargetRef } from '../engine/types';
import type { Observation } from '../engine';
import { HAND_LIMIT, HQ_HP, HQ_INCOME, LANES, RESOURCE_CAP, RESOURCE_TYPES, TURN_LIMIT } from '../engine/types';
import { canPlay } from '../engine/costs';
import { effectiveArmour, effectiveAttack, locateUnit } from '../engine/stats';
import type { OpponentInfo, RewardView, ServerMsg } from '../shared/protocol';
import { connection } from './net';
import { CARD_BY_ID } from './storage';
import { buildingTile, cardFace, inspectOnHover, inspector, unitTile } from './cardview';
import { clear, h } from './dom';
import { sound } from './sound';
import { DOCTRINE_INFO, NATION_LABEL, RESOURCE_LABEL, RESOURCE_SHORT } from './text';

export interface MatchContext {
  matchId: string;
  seat: PlayerId;
  opponent: OpponentInfo;
  rated: boolean;
  onExit: () => void;
  onRematch: () => void;
}

type Sel =
  | { kind: 'none' }
  | { kind: 'hand'; index: number }
  | { kind: 'unit'; uid: string }
  | { kind: 'pick'; title: string; actions: Action[] };

type Over = Extract<ServerMsg, { type: 'gameOver' }>;

function refKey(ref: TargetRef): string {
  switch (ref.kind) {
    case 'unit':
    case 'building':
      return `${ref.kind}:${ref.uid}`;
    case 'hq':
      return `hq:${ref.player}`;
    case 'lane':
      return `lane:${ref.lane}`;
    case 'resource':
      return `resource:${ref.resource}`;
  }
}

/**
 * The server only sends what this player may know. Rebuild a GameState-shaped value from it so the
 * engine's read-only helpers (costs, attack values, unit lookup) work on the client; the hidden
 * hand and deck contents are placeholders that nothing reads, only their sizes.
 */
function pseudoState(obs: Observation): GameState {
  const hidden = (n: number) => Array.from({ length: n }, () => null) as unknown as Card[];
  const { deckSize: yourDeck, ...you } = obs.you;
  const { deckSize: oppDeck, handSize, ...opponent } = obs.opponent;
  const mine = { ...you, deck: hidden(yourDeck) };
  const theirs = { ...opponent, hand: hidden(handSize), deck: hidden(oppDeck) };
  return {
    dataVersion: obs.dataVersion,
    rng: 0,
    turn: obs.turn,
    first: obs.first,
    active: obs.active,
    phase: obs.phase,
    players: obs.viewer === 0 ? [mine, theirs] : [theirs, mine],
    winner: obs.winner,
    nextUid: 0,
  };
}

function incomeOf(state: GameState, player: PlayerId): Record<(typeof RESOURCE_TYPES)[number], number> {
  const out = { manpower: HQ_INCOME.manpower ?? 0, steel: HQ_INCOME.steel ?? 0, fuel: HQ_INCOME.fuel ?? 0, supplies: HQ_INCOME.supplies ?? 0 };
  for (const b of state.players[player].buildings) for (const r of RESOURCE_TYPES) out[r] += b.card.produces[r] ?? 0;
  return out;
}

function nameMap(...states: Array<GameState | null>): Map<string, string> {
  const names = new Map<string, string>();
  for (const s of states) {
    if (!s) continue;
    for (const p of s.players) {
      for (const lane of p.lanes) for (const u of [lane.front, lane.rear]) if (u) names.set(u.uid, u.card.name);
      for (const b of p.buildings) names.set(b.uid, b.card.name);
    }
  }
  return names;
}

const cardName = (id: string) => CARD_BY_ID.get(id)?.name ?? id;

function describeEvent(e: GameEvent, names: Map<string, string>, me: PlayerId): string | null {
  const side = (p: PlayerId) => (p === me ? 'You' : 'Enemy');
  const s = (p: PlayerId) => (p === me ? '' : 's');
  const ref = (t: TargetRef): string => {
    switch (t.kind) {
      case 'unit':
      case 'building':
        return names.get(t.uid) ?? 'target';
      case 'hq':
        return `${side(t.player)} HQ`;
      case 'lane':
        return `lane ${t.lane + 1}`;
      case 'resource':
        return RESOURCE_LABEL[t.resource];
    }
  };
  switch (e.type) {
    case 'turnStarted':
      return `— Turn ${e.turn}: ${side(e.player)} —`;
    case 'mulligan':
      return `${side(e.player)} ${e.kept ? 'keep' : 'mulligan'}${s(e.player)} the opening hand`;
    case 'buildingConstructed':
      return `${side(e.player)} construct${s(e.player)} ${cardName(e.cardId)}`;
    case 'unitDeployed':
      return `${side(e.player)} deploy${s(e.player)} ${cardName(e.cardId)} (lane ${e.lane + 1}, ${e.row})`;
    case 'unitRedeployed':
      return `${names.get(e.uid) ?? 'Unit'} redeploys to lane ${e.lane + 1}`;
    case 'orderPlayed':
      return `${side(e.player)} play${s(e.player)} ${cardName(e.cardId)}`;
    case 'attack':
      return `${names.get(e.uid) ?? 'Unit'} attacks ${ref(e.target)}`;
    case 'damage':
      return `  ${ref(e.target)} takes ${e.amount}`;
    case 'healed':
      return `  ${names.get(e.uid) ?? 'Unit'} heals ${e.amount}`;
    case 'tenacity':
      return `  ${names.get(e.uid) ?? 'Unit'} holds on (Tenacity)`;
    case 'unitDestroyed':
    case 'buildingDestroyed':
      return `  ${cardName(e.cardId)} destroyed`;
    case 'upkeep':
      return e.paid ? null : `  ${names.get(e.uid) ?? 'Unit'} is Grounded (upkeep unpaid)`;
    case 'fatigue':
      return `${side(e.player)} take${s(e.player)} ${e.damage} fatigue damage (deck empty)`;
    case 'discarded':
      return `${side(e.player)} discard${s(e.player)} ${cardName(e.cardId)}`;
    case 'cardDrawn':
      return e.player === me ? `  You draw ${cardName(e.cardId)}` : null;
    case 'gameEnded':
      return e.reason === 'turnLimit'
        ? `Turn limit reached — ${e.winner === 'draw' ? 'draw' : `${side(e.winner)} win${e.winner === me ? '' : 's'} on HQ health`}`
        : `${e.winner === 'draw' ? 'Draw' : `${side(e.winner)} win${e.winner === me ? '' : 's'}`} (${e.reason === 'hq' ? 'HQ destroyed' : 'conceded'})`;
    default:
      return null;
  }
}

function refLabel(state: GameState, ref: TargetRef, me: PlayerId): string {
  switch (ref.kind) {
    case 'unit': {
      const loc = locateUnit(state, ref.uid);
      return loc ? `${loc.unit.card.name} (${loc.owner === me ? 'yours' : 'enemy'}, lane ${loc.lane + 1} ${loc.row})` : 'unit';
    }
    case 'building': {
      for (const p of state.players) {
        const b = p.buildings.find((x) => x.uid === ref.uid);
        if (b) return `${b.card.name} (${b.owner === me ? 'yours' : 'enemy'})`;
      }
      return 'building';
    }
    case 'hq':
      return ref.player === me ? 'Your HQ' : 'Enemy HQ';
    case 'lane':
      return `Lane ${ref.lane + 1}`;
    case 'resource':
      return RESOURCE_LABEL[ref.resource];
  }
}

function actionLabel(state: GameState, a: Action, me: PlayerId): string {
  const targets = 'targets' in a ? a.targets : [];
  const base = a.type === 'construct' ? 'Construct' : a.type === 'order' ? 'Play order' : a.type === 'deploy' ? 'Deploy' : a.type;
  return targets.length > 0 ? `${base} → ${targets.map((t) => refLabel(state, t, me)).join(' + ')}` : `${base}`;
}

/** Why a card in hand can't be played right now, for the hover hint. */
function whyNot(state: GameState, card: Card, me: PlayerId, yourMain: boolean): string {
  const p = state.players[me];
  if (!yourMain) return 'Not your main phase';
  if (card.type === 'building') {
    if (p.constructedThisTurn) return 'Only one Building per turn';
    if (p.buildings.length >= 6) return 'All 6 building slots are full';
  }
  if (!canPlay(state, me, card)) return 'Not enough resources';
  if (card.type === 'unit') return 'No free slot';
  return 'No legal target';
}

interface Fx {
  /** Floating number over a target: unit/building uid or hq:<player>. */
  float?: { key: string; text: string; cls: string };
  lunge?: { uid: string; dir: 'up' | 'down' };
  delay: number;
}

export function mountMatch(root: HTMLElement, ctx: MatchContext): () => void {
  const ME = ctx.seat;
  const FOE: PlayerId = ME === 0 ? 1 : 0;
  let state: GameState | null = null;
  let legal: Action[] = [];
  let acting: PlayerId = 0;
  let awayOpponent = false;
  let sel: Sel = { kind: 'none' };
  let notice = '';
  let pending = false;
  let over: Over | null = null;
  let connected = connection.connected;
  const log: string[] = [];
  let hits = new Set<string>();
  let fresh = new Set<string>();
  let fx: Fx[] = [];
  let lastDom = new Map<string, HTMLElement>();
  let ghosts = new Map<string, HTMLElement>();

  // ------------------------------------------------------------ server messages

  function onState(msg: Extract<ServerMsg, { type: 'state' }>): void {
    const prev = state;
    const next = pseudoState(msg.obs);
    const names = nameMap(prev, next);
    hits = new Set();
    fresh = new Set();
    fx = [];
    ghosts = new Map();
    let t = 0;
    for (const e of msg.events) {
      const line = describeEvent(e, names, ME);
      if (line) log.push(line);
      switch (e.type) {
        case 'turnStarted':
          if (e.player === ME) sound.play('turn');
          break;
        case 'unitDeployed':
          fresh.add(e.uid);
          sound.play('deploy', t);
          t += 120;
          break;
        case 'buildingConstructed':
          fresh.add(e.uid);
          sound.play('construct', t);
          t += 120;
          break;
        case 'orderPlayed':
          sound.play('order', t);
          t += 150;
          break;
        case 'cardDrawn':
          if (e.player === ME) sound.play('draw', t);
          break;
        case 'attack': {
          const attacker = prev ? locateUnit(prev, e.uid) : null;
          fx.push({ lunge: { uid: e.uid, dir: attacker && attacker.owner === ME ? 'up' : 'down' }, delay: t });
          sound.play('attack', t);
          t += 220;
          break;
        }
        case 'damage': {
          const key = e.target.kind === 'hq' ? `hq:${e.target.player}` : e.target.kind === 'unit' || e.target.kind === 'building' ? e.target.uid : null;
          if (key) {
            hits.add(key);
            fx.push({ float: { key, text: `-${e.amount}`, cls: 'dmg' }, delay: t });
            sound.play(e.target.kind === 'hq' ? 'hqHit' : 'hit', t);
          }
          t += 160;
          break;
        }
        case 'healed':
          fx.push({ float: { key: e.uid, text: `+${e.amount}`, cls: 'heal' }, delay: t });
          break;
        case 'tenacity':
          fx.push({ float: { key: e.uid, text: 'Holds!', cls: 'note' }, delay: t });
          sound.play('tenacity', t);
          break;
        case 'unitDestroyed': {
          sound.play('destroy', t + 80);
          const loc = prev ? locateUnit(prev, e.uid) : null;
          const dom = lastDom.get(e.uid);
          if (loc && dom) ghosts.set(`${loc.owner}:${loc.lane}:${loc.row}`, dom.cloneNode(true) as HTMLElement);
          break;
        }
        default:
          break;
      }
    }
    if (log.length > 300) log.splice(0, log.length - 300);
    state = next;
    legal = msg.legal;
    acting = msg.acting;
    awayOpponent = msg.away;
    pending = false;
    sel = { kind: 'none' };
    notice = '';
    render();
  }

  const offMsg = connection.on((msg) => {
    if (msg.type === 'state' && msg.matchId === ctx.matchId) onState(msg);
    else if (msg.type === 'gameOver' && msg.matchId === ctx.matchId) {
      over = msg;
      sound.play(msg.winner === ME ? 'win' : msg.winner === 'draw' ? 'turn' : 'lose', 400);
      render();
    } else if (msg.type === 'error') {
      notice = msg.message;
      pending = false;
      if (state) render();
    }
  });
  const offStatus = connection.onStatus((c) => {
    connected = c;
    if (state) render();
  });

  function act(action: Action): void {
    if (pending || over) return;
    if (!connection.send({ type: 'action', matchId: ctx.matchId, action })) {
      notice = 'Not connected. Reconnecting…';
      render();
      return;
    }
    pending = true;
    sel = { kind: 'none' };
    notice = '';
    sound.play('click');
  }

  // ------------------------------------------------------------ rendering

  function render(): void {
    if (!state) {
      clear(root);
      root.append(h('div', { class: 'menu' }, h('p', { class: 'muted' }, 'Joining the match…')));
      return;
    }
    const st = state;
    const yourTurn = st.winner === null && acting === ME;
    const me = st.players[ME];
    const foe = st.players[FOE];

    const slotActions = new Map<string, Action[]>();
    const targetActions = new Map<string, Action>();
    const addSlot = (lane: LaneIndex, row: Row, a: Action) => {
      const key = `${lane}:${row}`;
      slotActions.set(key, [...(slotActions.get(key) ?? []), a]);
    };
    if (yourTurn) {
      if (sel.kind === 'hand') {
        for (const a of legal) if (a.type === 'deploy' && a.cardIndex === sel.index) addSlot(a.lane, a.row, a);
      } else if (sel.kind === 'unit') {
        for (const a of legal) {
          if (a.type === 'redeploy' && a.unitUid === sel.uid) addSlot(a.lane, a.row, a);
          if (a.type === 'attack' && a.unitUid === sel.uid) targetActions.set(refKey(a.target), a);
        }
      }
    }
    const play = legal.filter((a) => a.type !== 'concede');
    const redeployable = new Set(play.flatMap((a) => (a.type === 'redeploy' ? [a.unitUid] : [])));
    const attackers = new Set(play.flatMap((a) => (a.type === 'attack' ? [a.unitUid] : [])));
    const playableIdx = new Set(play.flatMap((a) => (a.type === 'construct' || a.type === 'deploy' || a.type === 'order' ? [a.cardIndex] : [])));
    const discarding = yourTurn && st.phase === 'discard';
    const yourMain = yourTurn && st.phase === 'main';

    const unitCell = (owner: PlayerId, lane: LaneIndex, row: Row): HTMLElement => {
      const unit = st.players[owner].lanes[lane][row];
      const key = `${lane}:${row}`;
      const ghost = ghosts.get(`${owner}:${lane}:${row}`);
      if (unit) {
        const classes: string[] = [];
        let onclick: (() => void) | undefined;
        if (hits.has(unit.uid)) classes.push('hit');
        if (fresh.has(unit.uid)) classes.push('pop');
        if (owner === ME) {
          if (sel.kind === 'unit' && sel.uid === unit.uid) classes.push('selected');
          else if (attackers.has(unit.uid) || redeployable.has(unit.uid)) classes.push('ready');
          if (yourTurn && (attackers.has(unit.uid) || redeployable.has(unit.uid))) {
            onclick = () => {
              sel = sel.kind === 'unit' && sel.uid === unit.uid ? { kind: 'none' } : { kind: 'unit', uid: unit.uid };
              render();
            };
          }
        } else {
          const attack = targetActions.get(`unit:${unit.uid}`);
          if (attack) {
            classes.push('targetable');
            onclick = () => act(attack);
          }
        }
        return inspectOnHover(unitTile(unit, effectiveAttack(st, unit), effectiveArmour(st, unit), { classes, onclick }), unit.card);
      }
      const slotA = owner === ME ? slotActions.get(key) : undefined;
      const slot = slotA
        ? h('div', { class: 'slot open', onclick: () => chooseSlot(slotA) }, h('span', null, 'Place here'))
        : h('div', { class: 'slot' }, h('span', null, row === 'front' ? 'Front' : 'Rear'));
      if (ghost) {
        ghost.classList.add('dying');
        slot.append(ghost);
      }
      return slot;
    };

    const buildingRow = (owner: PlayerId): HTMLElement => {
      const row = h('div', { class: 'buildings' });
      const list = st.players[owner].buildings;
      for (let i = 0; i < 6; i++) {
        const b: BuildingInPlay | undefined = list[i];
        if (!b) {
          row.append(h('div', { class: 'tile empty' }, 'Building slot'));
          continue;
        }
        const classes: string[] = [];
        let onclick: (() => void) | undefined;
        if (hits.has(b.uid)) classes.push('hit');
        if (fresh.has(b.uid)) classes.push('pop');
        const attack = owner === FOE ? targetActions.get(`building:${b.uid}`) : undefined;
        if (attack) {
          classes.push('targetable');
          onclick = () => act(attack);
        }
        row.append(inspectOnHover(buildingTile(b, { classes, onclick }), b.card));
      }
      return row;
    };

    const hqBox = (owner: PlayerId): HTMLElement => {
      const p = st.players[owner];
      const attack = owner === FOE ? targetActions.get(`hq:${owner}`) : undefined;
      const classes = ['hq', owner === ME ? 'mine' : 'theirs'];
      if (hits.has(`hq:${owner}`)) classes.push('hit');
      if (attack) classes.push('targetable');
      return h(
        'div',
        { class: classes.join(' '), 'data-hq': owner, onclick: attack ? () => act(attack) : undefined, title: 'Command Post' },
        h('div', { class: 'hq-label' }, 'HQ'),
        h('div', { class: 'hq-hp' }, `${p.hq}`),
        h('div', { class: 'hq-bar' }, h('div', { class: 'hq-fill', style: `width:${Math.max(0, (p.hq / HQ_HP) * 100)}%` })),
      );
    };

    const resourceBar = (owner: PlayerId): HTMLElement => {
      const p = st.players[owner];
      const income = incomeOf(st, owner);
      const bar = h('div', { class: 'resources' });
      for (const r of RESOURCE_TYPES) {
        bar.append(
          h(
            'div',
            { class: `res res-${r}`, title: `${RESOURCE_LABEL[r]}: ${p.resources[r]} of ${RESOURCE_CAP}, +${income[r]} per turn` },
            h('span', { class: 'res-name' }, RESOURCE_SHORT[r]),
            h('span', { class: 'res-n' }, `${p.resources[r]}`),
            h('span', { class: 'res-inc' }, `+${income[r]}`),
          ),
        );
      }
      return bar;
    };

    const playerBar = (owner: PlayerId): HTMLElement => {
      const p = st.players[owner];
      const doc = p.doctrine;
      const name = owner === ME ? 'You' : ctx.opponent.name;
      return h(
        'div',
        { class: `playerbar ${owner === ME ? 'mine' : 'theirs'} ${st.active === owner && st.winner === null ? 'active' : ''}` },
        hqBox(owner),
        h(
          'div',
          { class: 'who' },
          h('strong', null, name, owner === FOE && ctx.opponent.kind === 'human' ? h('span', { class: 'muted small' }, ` · rating ${ctx.opponent.rating ?? '?'}`) : null),
          doc && doc !== 'neutral'
            ? h('span', { class: 'doctrine', title: `${DOCTRINE_INFO[doc].name}: ${DOCTRINE_INFO[doc].text}` }, `${NATION_LABEL[doc]} · ${DOCTRINE_INFO[doc].name}`)
            : h('span', { class: 'doctrine none' }, 'No doctrine'),
          h('span', { class: 'counts' }, `Hand ${p.hand.length} · Deck ${p.deck.length}`),
        ),
        resourceBar(owner),
      );
    };

    const lanes = h('div', { class: 'lanes' });
    for (const lane of LANES) {
      lanes.append(
        h(
          'div',
          { class: 'lane' },
          h('div', { class: 'lane-title' }, `Lane ${lane + 1}`, foe.smoke[lane] ? h('span', { class: 'smoke', title: 'Enemy Ranged units cannot attack into this lane' }, ' smoke') : null),
          unitCell(FOE, lane, 'rear'),
          unitCell(FOE, lane, 'front'),
          h('div', { class: 'lane-mid' }),
          unitCell(ME, lane, 'front'),
          unitCell(ME, lane, 'rear'),
        ),
      );
    }

    const handEl = h('div', { class: 'hand' });
    me.hand.forEach((card, index) => {
      const playable = playableIdx.has(index);
      const classes = ['hand-card'];
      if (sel.kind === 'hand' && sel.index === index) classes.push('selected');
      if (discarding) classes.push('discardable');
      else if (yourMain) classes.push(playable ? 'playable' : 'dim');
      const face = cardFace(card, { className: classes.join(' ') });
      face.addEventListener('click', () => clickHand(index, card, playable));
      if (!playable && yourMain) face.title = whyNot(st, card, ME, yourMain);
      handEl.append(inspectOnHover(face, card));
    });

    let hint: string;
    if (st.winner !== null) hint = 'The match is over.';
    else if (!yourTurn) hint = st.phase === 'mulligan' ? 'Waiting for the opponent\'s mulligan…' : awayOpponent ? 'Opponent disconnected — an AI is covering their seat.' : `${ctx.opponent.name}'s turn…`;
    else if (st.phase === 'mulligan') hint = 'Keep your opening hand, or mulligan (shuffle it back and draw one fewer, minimum 3).';
    else if (st.phase === 'discard') hint = `Your hand is over the limit of ${HAND_LIMIT}. Click a card to discard it.`;
    else if (st.phase === 'main') hint = 'Main phase: construct one Building, deploy units, play orders. Select a unit to redeploy it for 1 Supplies.';
    else hint = 'Combat: select one of your ready units, then click its target.';

    const actions = h('div', { class: 'actionbar' });
    if (sel.kind === 'hand' && !playableIdx.has(sel.index)) sel = { kind: 'none' };
    if (sel.kind === 'pick' && yourTurn) {
      actions.append(h('span', { class: 'pick-title' }, sel.title));
      for (const a of sel.actions) actions.append(h('button', { class: 'btn primary', onclick: () => act(a) }, actionLabel(st, a, ME)));
      actions.append(h('button', { class: 'btn', onclick: () => { sel = { kind: 'none' }; render(); } }, 'Cancel'));
    } else if (yourMain) {
      actions.append(h('button', { class: 'btn primary', onclick: () => act({ type: 'endMain', player: ME }) }, 'End main phase → Combat'));
    } else if (yourTurn && st.phase === 'combat') {
      actions.append(h('button', { class: 'btn primary', onclick: () => act({ type: 'endTurn', player: ME }) }, 'End turn'));
    }
    if (notice) actions.append(h('span', { class: 'notice' }, notice));

    const topbar = h(
      'div',
      { class: 'topbar' },
      h('span', { class: 'turn' }, `Turn ${st.turn} of ${TURN_LIMIT}`),
      h('span', { class: 'phase' }, st.winner !== null ? 'Ended' : `${st.active === ME ? 'Your' : 'Enemy'} ${st.phase}`),
      !connected ? h('span', { class: 'conn-lost' }, 'Reconnecting…') : null,
      ctx.rated ? h('span', { class: 'tag-rated', title: 'Ratings change with the result' }, 'Rated') : null,
      h('button', { class: 'btn small', title: 'Sound effects', onclick: () => { sound.setMuted(!sound.muted); render(); } }, sound.muted ? 'Sound: off' : 'Sound: on'),
      h('button', { class: 'btn small danger', onclick: () => { if (st.winner === null && confirm('Concede this match?')) act({ type: 'concede', player: ME }); } }, 'Concede'),
      h('button', { class: 'btn small', onclick: () => { if (st.winner !== null || confirm('Leave the match screen? The match carries on without you and an AI plays your seat.')) ctx.onExit(); } }, 'Menu'),
    );

    const logEl = h('div', { class: 'log' }, ...log.map((l) => h('div', { class: l.startsWith('—') ? 'log-turn' : 'log-line' }, l)));
    const board = h('div', { class: 'board-col' }, topbar, playerBar(FOE), buildingRow(FOE), lanes, buildingRow(ME), playerBar(ME), h('div', { class: 'hint' }, hint), actions, handEl);
    const aside = h('aside', { class: 'side' }, inspector.el, h('h3', null, 'Battle log'), logEl);

    clear(root);
    root.append(h('div', { class: 'match' }, board, aside));
    logEl.scrollTop = logEl.scrollHeight;

    if (yourTurn && st.phase === 'mulligan') root.append(mulliganOverlay(st));
    if (over) root.append(resultOverlay(st, over));

    // remember the tiles so a destroyed unit can fade out where it stood
    lastDom = new Map();
    root.querySelectorAll<HTMLElement>('.tile.unit[data-uid]').forEach((el) => lastDom.set(el.dataset.uid!, el.cloneNode(true) as HTMLElement));
    playFx();
  }

  /** Floating numbers and attack lunges for the events of the latest update. */
  function playFx(): void {
    const batch = fx;
    fx = [];
    for (const f of batch) {
      if (f.lunge) {
        const el = root.querySelector<HTMLElement>(`.tile[data-uid="${f.lunge.uid}"]`);
        if (el) {
          el.style.setProperty('--delay', `${f.delay}ms`);
          el.classList.add(f.lunge.dir === 'up' ? 'lunge-up' : 'lunge-down');
        }
      }
      if (f.float) {
        const { key, text, cls } = f.float;
        const el = key.startsWith('hq:') ? root.querySelector<HTMLElement>(`.hq[data-hq="${key.slice(3)}"]`) : root.querySelector<HTMLElement>(`.tile[data-uid="${key}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const span = h('span', { class: `float ${cls}`, style: `left:${r.left + r.width / 2}px;top:${r.top + r.height / 3}px;animation-delay:${f.delay}ms` }, text);
        document.body.append(span);
        window.setTimeout(() => span.remove(), f.delay + 1400);
      }
    }
  }

  function mulliganOverlay(st: GameState): HTMLElement {
    return h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: 'modal wide' },
        h('h2', null, 'Opening hand'),
        h('p', { class: 'muted' }, st.first === ME ? 'You go first.' : 'The opponent goes first; you start with +1 Supplies.'),
        h('div', { class: 'hand static' }, ...st.players[ME].hand.map((c) => inspectOnHover(cardFace(c, { className: 'hand-card' }), c))),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => act({ type: 'mulligan', player: ME, keep: true }) }, 'Keep hand'),
          h('button', { class: 'btn', onclick: () => act({ type: 'mulligan', player: ME, keep: false }) }, 'Mulligan'),
        ),
      ),
    );
  }

  function resultOverlay(st: GameState, o: Over): HTMLElement {
    const title = o.winner === 'draw' ? 'Draw' : o.winner === ME ? 'Victory' : 'Defeat';
    const reason = o.reason === 'turnLimit' ? 'Turn limit reached: decided on HQ health.' : o.reason === 'concede' ? (o.winner === ME ? 'Your opponent conceded.' : 'You conceded.') : o.winner === ME ? 'You destroyed the enemy HQ.' : 'Your HQ was destroyed.';
    const rewards = (r: RewardView | null) => (r ? h('div', { class: 'rewards' }, ...r.lines.map((l) => h('p', null, l)), h('p', null, `Total: +${r.total} WB (now ${r.wb} WB)`)) : null);
    return h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: `modal result ${o.winner === ME ? 'win' : o.winner === 'draw' ? 'draw' : 'loss'}` },
        h('h2', null, title),
        h('p', null, reason),
        rewards(o.rewards),
        o.rating ? h('p', { class: 'rating' }, `Rating ${o.rating.before} → ${o.rating.after} (${o.rating.after >= o.rating.before ? '+' : ''}${o.rating.after - o.rating.before})`) : null,
        h('p', { class: 'muted' }, `Ended on turn ${st.turn}. Your HQ: ${st.players[ME].hq}. Enemy HQ: ${st.players[FOE].hq}.`),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: ctx.onRematch }, 'Play again'), h('button', { class: 'btn', onclick: ctx.onExit }, 'Menu')),
      ),
    );
  }

  // ------------------------------------------------------------ input

  function clickHand(index: number, card: Card, playable: boolean): void {
    const st = state!;
    if (over || acting !== ME || pending) return;
    if (st.phase === 'discard') {
      act({ type: 'discard', player: ME, cardIndex: index });
      return;
    }
    if (st.phase !== 'main') return;
    if (!playable) {
      notice = `${card.name}: ${whyNot(st, card, ME, true)}.`;
      sel = { kind: 'none' };
      render();
      return;
    }
    notice = '';
    if (sel.kind === 'hand' && sel.index === index) {
      sel = { kind: 'none' };
      render();
      return;
    }
    if (card.type === 'unit') sel = { kind: 'hand', index };
    else {
      const mine = legal.filter((a) => 'cardIndex' in a && a.cardIndex === index);
      sel = { kind: 'pick', title: card.type === 'building' ? `Construct ${card.name}?` : `Play ${card.name}?`, actions: mine };
    }
    render();
  }

  function chooseSlot(actions: Action[]): void {
    if (actions.length === 1) {
      act(actions[0]!);
      return;
    }
    const first = actions[0]!;
    const card = first.type === 'deploy' ? state!.players[ME].hand[first.cardIndex] : undefined;
    sel = { kind: 'pick', title: `${card?.name ?? 'Unit'}: choose targets`, actions };
    render();
  }

  render();
  return () => {
    offMsg();
    offStatus();
  };
}
