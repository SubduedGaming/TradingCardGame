import type { Action, BuildingInPlay, Card, GameEvent, GameState, LaneIndex, PlayerId, Row, TargetRef } from '../engine/types';
import { HAND_LIMIT, HQ_HP, HQ_INCOME, LANES, RESOURCE_CAP, RESOURCE_TYPES, TURN_LIMIT } from '../engine/types';
import { apply, createGame, legalActions } from '../engine/game';
import { canPlay } from '../engine/costs';
import { effectiveArmour, effectiveAttack, locateUnit } from '../engine/stats';
import { recruitAgent, veteranAgent, type Agent } from '../ai/agents';
import { actingSeat } from '../ai/sim';
import { CARD_BY_ID } from './storage';
import { buildingTile, cardFace, inspectOnHover, inspector, unitTile } from './cardview';
import { clear, h } from './dom';
import { DOCTRINE_INFO, NATION_LABEL, RESOURCE_LABEL, RESOURCE_SHORT } from './text';

export interface MatchConfig {
  humanDeck: Card[];
  aiDeck: Card[];
  level: 'recruit' | 'veteran';
  fast: boolean;
  seed: number;
  opponentName: string;
}

type Sel =
  | { kind: 'none' }
  | { kind: 'hand'; index: number }
  | { kind: 'unit'; uid: string }
  | { kind: 'pick'; title: string; actions: Action[] };

const HUMAN: PlayerId = 0;
const AI: PlayerId = 1;

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

function incomeOf(state: GameState, player: PlayerId): Record<(typeof RESOURCE_TYPES)[number], number> {
  const out = { manpower: HQ_INCOME.manpower ?? 0, steel: HQ_INCOME.steel ?? 0, fuel: HQ_INCOME.fuel ?? 0, supplies: HQ_INCOME.supplies ?? 0 };
  for (const b of state.players[player].buildings) for (const r of RESOURCE_TYPES) out[r] += b.card.produces[r] ?? 0;
  return out;
}

function nameMap(...states: GameState[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const s of states) {
    for (const p of s.players) {
      for (const lane of p.lanes) for (const u of [lane.front, lane.rear]) if (u) names.set(u.uid, u.card.name);
      for (const b of p.buildings) names.set(b.uid, b.card.name);
    }
  }
  return names;
}

const side = (p: PlayerId) => (p === HUMAN ? 'You' : 'Enemy');
const cardName = (id: string) => CARD_BY_ID.get(id)?.name ?? id;

function describeEvent(e: GameEvent, names: Map<string, string>): string | null {
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
      return `${side(e.player)} ${e.kept ? 'keep' : 'mulligan'}${e.player === HUMAN ? '' : 's'} the opening hand`;
    case 'buildingConstructed':
      return `${side(e.player)} construct${e.player === HUMAN ? '' : 's'} ${cardName(e.cardId)}`;
    case 'unitDeployed':
      return `${side(e.player)} deploy${e.player === HUMAN ? '' : 's'} ${cardName(e.cardId)} (lane ${e.lane + 1}, ${e.row})`;
    case 'unitRedeployed':
      return `${names.get(e.uid) ?? 'Unit'} redeploys to lane ${e.lane + 1}`;
    case 'orderPlayed':
      return `${side(e.player)} play${e.player === HUMAN ? '' : 's'} ${cardName(e.cardId)}`;
    case 'attack':
      return `${names.get(e.uid) ?? 'Unit'} attacks ${ref(e.target)}`;
    case 'damage':
      return `  ${ref(e.target)} takes ${e.amount}`;
    case 'healed':
      return `  ${names.get(e.uid) ?? 'Unit'} heals ${e.amount}`;
    case 'tenacity':
      return `  ${names.get(e.uid) ?? 'Unit'} holds on (Tenacity)`;
    case 'unitDestroyed':
      return `  ${cardName(e.cardId)} destroyed`;
    case 'buildingDestroyed':
      return `  ${cardName(e.cardId)} destroyed`;
    case 'upkeep':
      return e.paid ? null : `  ${names.get(e.uid) ?? 'Unit'} is Grounded (upkeep unpaid)`;
    case 'fatigue':
      return `${side(e.player)} take${e.player === HUMAN ? '' : 's'} ${e.damage} fatigue damage (deck empty)`;
    case 'discarded':
      return `${side(e.player)} discard${e.player === HUMAN ? '' : 's'} ${cardName(e.cardId)}`;
    case 'cardDrawn':
      return e.player === HUMAN ? `  You draw ${cardName(e.cardId)}` : null;
    case 'gameEnded':
      return e.reason === 'turnLimit'
        ? `Turn limit reached — ${e.winner === 'draw' ? 'draw' : `${side(e.winner)} win${e.winner === HUMAN ? '' : 's'} on HQ health`}`
        : `${e.winner === 'draw' ? 'Draw' : `${side(e.winner)} win${e.winner === HUMAN ? '' : 's'}`} (${e.reason === 'hq' ? 'HQ destroyed' : 'conceded'})`;
    default:
      return null;
  }
}

function refLabel(state: GameState, ref: TargetRef): string {
  switch (ref.kind) {
    case 'unit': {
      const loc = locateUnit(state, ref.uid);
      return loc ? `${loc.unit.card.name} (${loc.owner === HUMAN ? 'yours' : 'enemy'}, lane ${loc.lane + 1} ${loc.row})` : 'unit';
    }
    case 'building': {
      for (const p of state.players) {
        const b = p.buildings.find((x) => x.uid === ref.uid);
        if (b) return `${b.card.name} (${b.owner === HUMAN ? 'yours' : 'enemy'})`;
      }
      return 'building';
    }
    case 'hq':
      return `${side(ref.player)} HQ`;
    case 'lane':
      return `Lane ${ref.lane + 1}`;
    case 'resource':
      return RESOURCE_LABEL[ref.resource];
  }
}

function actionLabel(state: GameState, a: Action): string {
  const targets = 'targets' in a ? a.targets : [];
  const base = a.type === 'construct' ? 'Construct' : a.type === 'order' ? 'Play order' : a.type === 'deploy' ? 'Deploy' : a.type;
  return targets.length > 0 ? `${base} → ${targets.map((t) => refLabel(state, t)).join(' + ')}` : `${base}`;
}

/** Why a card in hand can't be played right now, for the hover hint. */
function whyNot(state: GameState, card: Card): string {
  const p = state.players[HUMAN];
  if (state.phase !== 'main' || state.active !== HUMAN) return 'Not your main phase';
  if (card.type === 'building') {
    if (p.constructedThisTurn) return 'Only one Building per turn';
    if (p.buildings.length >= 6) return 'All 6 building slots are full';
  }
  if (!canPlay(state, HUMAN, card)) return 'Not enough resources';
  if (card.type === 'unit') return 'No free slot';
  return 'No legal target';
}

export function mountMatch(root: HTMLElement, cfg: MatchConfig, onExit: () => void, onRematch: () => void): () => void {
  let state = createGame({ seed: cfg.seed, decks: [cfg.humanDeck, cfg.aiDeck] });
  const agent: Agent = cfg.level === 'veteran' ? veteranAgent() : recruitAgent();
  const aiRng = { rng: (cfg.seed * 2654435761 + 12345) | 0 };
  let sel: Sel = { kind: 'none' };
  let notice = '';
  const log: string[] = [];
  let hits = new Set<string>();
  let fresh = new Set<string>();
  let fast = cfg.fast;
  let timer: number | undefined;
  let disposed = false;
  let logEl: HTMLElement | null = null;

  const doctrineOf = (p: PlayerId) => state.players[p].doctrine;

  function act(action: Action): void {
    const before = state;
    const result = apply(state, action);
    state = result.state;
    const names = nameMap(before, state);
    hits = new Set();
    fresh = new Set();
    for (const e of result.events) {
      const line = describeEvent(e, names);
      if (line) log.push(line);
      if (e.type === 'damage' && (e.target.kind === 'unit' || e.target.kind === 'building')) hits.add(e.target.uid);
      if (e.type === 'damage' && e.target.kind === 'hq') hits.add(`hq:${e.target.player}`);
      if (e.type === 'unitDeployed' || e.type === 'buildingConstructed') fresh.add(e.uid);
    }
    if (log.length > 300) log.splice(0, log.length - 300);
    sel = { kind: 'none' };
    notice = '';
    render();
    schedule();
  }

  function schedule(): void {
    window.clearTimeout(timer);
    if (disposed || state.winner !== null) return;
    if (actingSeat(state) !== AI) return;
    timer = window.setTimeout(() => {
      if (disposed || state.winner !== null) return;
      act(agent.choose(state, AI, aiRng));
    }, fast ? 30 : state.phase === 'mulligan' ? 250 : 550);
  }

  // ------------------------------------------------------------ rendering

  function render(): void {
    const yourTurn = state.winner === null && actingSeat(state) === HUMAN;
    const legal = yourTurn ? legalActions(state, HUMAN).filter((a) => a.type !== 'concede') : [];
    const me = state.players[HUMAN];
    const foe = state.players[AI];

    // What the current selection lets the player click.
    const slotActions = new Map<string, Action[]>();
    const targetActions = new Map<string, Action>();
    const addSlot = (lane: LaneIndex, row: Row, a: Action) => {
      const key = `${lane}:${row}`;
      slotActions.set(key, [...(slotActions.get(key) ?? []), a]);
    };
    if (sel.kind === 'hand') {
      for (const a of legal) if (a.type === 'deploy' && a.cardIndex === sel.index) addSlot(a.lane, a.row, a);
    } else if (sel.kind === 'unit') {
      for (const a of legal) {
        if (a.type === 'redeploy' && a.unitUid === sel.uid) addSlot(a.lane, a.row, a);
        if (a.type === 'attack' && a.unitUid === sel.uid) targetActions.set(refKey(a.target), a);
      }
    }
    const redeployable = new Set(legal.flatMap((a) => (a.type === 'redeploy' ? [a.unitUid] : [])));
    const attackers = new Set(legal.flatMap((a) => (a.type === 'attack' ? [a.unitUid] : [])));
    const playableIdx = new Set(legal.flatMap((a) => (a.type === 'construct' || a.type === 'deploy' || a.type === 'order' ? [a.cardIndex] : [])));
    const discarding = yourTurn && state.phase === 'discard';

    const unitCell = (owner: PlayerId, lane: LaneIndex, row: Row): HTMLElement => {
      const unit = state.players[owner].lanes[lane][row];
      const key = `${lane}:${row}`;
      const classes: string[] = [];
      let onclick: (() => void) | undefined;
      if (unit) {
        if (hits.has(unit.uid)) classes.push('hit');
        if (fresh.has(unit.uid)) classes.push('pop');
        if (owner === HUMAN) {
          if (sel.kind === 'unit' && sel.uid === unit.uid) classes.push('selected');
          else if (attackers.has(unit.uid) || redeployable.has(unit.uid)) classes.push('ready');
          if (attackers.has(unit.uid) || redeployable.has(unit.uid)) {
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
        const tile = unitTile(unit, effectiveAttack(state, unit), effectiveArmour(state, unit), { classes, onclick });
        return inspectOnHover(tile, unit.card);
      }
      const slotA = owner === HUMAN ? slotActions.get(key) : undefined;
      if (slotA) {
        return h('div', { class: 'slot open', onclick: () => chooseSlot(slotA) }, h('span', null, 'Place here'));
      }
      return h('div', { class: 'slot' }, h('span', null, row === 'front' ? 'Front' : 'Rear'));
    };

    const buildingRow = (owner: PlayerId): HTMLElement => {
      const row = h('div', { class: 'buildings' });
      const list = state.players[owner].buildings;
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
        const attack = owner === AI ? targetActions.get(`building:${b.uid}`) : undefined;
        if (attack) {
          classes.push('targetable');
          onclick = () => act(attack);
        }
        row.append(inspectOnHover(buildingTile(b, { classes, onclick }), b.card));
      }
      return row;
    };

    const hqBox = (owner: PlayerId): HTMLElement => {
      const p = state.players[owner];
      const attack = owner === AI ? targetActions.get(`hq:${owner}`) : undefined;
      const classes = ['hq', owner === HUMAN ? 'mine' : 'theirs'];
      if (hits.has(`hq:${owner}`)) classes.push('hit');
      if (attack) classes.push('targetable');
      return h(
        'div',
        { class: classes.join(' '), onclick: attack ? () => act(attack) : undefined, title: 'Command Post' },
        h('div', { class: 'hq-label' }, 'HQ'),
        h('div', { class: 'hq-hp' }, `${p.hq}`),
        h('div', { class: 'hq-bar' }, h('div', { class: 'hq-fill', style: `width:${Math.max(0, (p.hq / HQ_HP) * 100)}%` })),
      );
    };

    const resourceBar = (owner: PlayerId): HTMLElement => {
      const p = state.players[owner];
      const income = incomeOf(state, owner);
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
      const p = state.players[owner];
      const doc = doctrineOf(owner);
      return h(
        'div',
        { class: `playerbar ${owner === HUMAN ? 'mine' : 'theirs'} ${state.active === owner && state.winner === null ? 'active' : ''}` },
        hqBox(owner),
        h(
          'div',
          { class: 'who' },
          h('strong', null, owner === HUMAN ? 'You' : cfg.opponentName),
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
          unitCell(AI, lane, 'rear'),
          unitCell(AI, lane, 'front'),
          h('div', { class: 'lane-mid' }),
          unitCell(HUMAN, lane, 'front'),
          unitCell(HUMAN, lane, 'rear'),
        ),
      );
    }

    // hand
    const handEl = h('div', { class: 'hand' });
    me.hand.forEach((card, index) => {
      const playable = playableIdx.has(index);
      const classes = ['hand-card'];
      if (sel.kind === 'hand' && sel.index === index) classes.push('selected');
      if (discarding) classes.push('discardable');
      else if (yourTurn && state.phase === 'main') classes.push(playable ? 'playable' : 'dim');
      const face = cardFace(card, { className: classes.join(' ') });
      face.addEventListener('click', () => clickHand(index, card, playable));
      if (!playable && yourTurn && state.phase === 'main') face.title = whyNot(state, card);
      handEl.append(inspectOnHover(face, card));
    });

    // hint + action bar
    let hint: string;
    if (state.winner !== null) hint = 'The match is over.';
    else if (!yourTurn) hint = state.phase === 'mulligan' ? 'Waiting for the enemy mulligan…' : 'Enemy turn…';
    else if (state.phase === 'mulligan') hint = 'Keep your opening hand, or mulligan (shuffle it back and draw one fewer, minimum 3).';
    else if (state.phase === 'discard') hint = `Your hand is over the limit of ${HAND_LIMIT}. Click a card to discard it.`;
    else if (state.phase === 'main')
      hint = 'Main phase: construct one Building, deploy units, play orders. Select a unit to redeploy it for 1 Supplies.';
    else hint = 'Combat: select one of your ready units, then click its target.';

    const actions = h('div', { class: 'actionbar' });
    if (sel.kind === 'hand' && !playableIdx.has(sel.index)) sel = { kind: 'none' };
    if (sel.kind === 'pick') {
      actions.append(h('span', { class: 'pick-title' }, sel.title));
      for (const a of sel.actions) actions.append(h('button', { class: 'btn primary', onclick: () => act(a) }, actionLabel(state, a)));
      actions.append(h('button', { class: 'btn', onclick: () => { sel = { kind: 'none' }; render(); } }, 'Cancel'));
    } else if (yourTurn && state.phase === 'main') {
      actions.append(h('button', { class: 'btn primary', onclick: () => act({ type: 'endMain', player: HUMAN }) }, 'End main phase → Combat'));
    } else if (yourTurn && state.phase === 'combat') {
      actions.append(h('button', { class: 'btn primary', onclick: () => act({ type: 'endTurn', player: HUMAN }) }, 'End turn'));
    }
    if (notice) actions.append(h('span', { class: 'notice' }, notice));

    const topbar = h(
      'div',
      { class: 'topbar' },
      h('span', { class: 'turn' }, `Turn ${state.turn} of ${TURN_LIMIT}`),
      h('span', { class: 'phase' }, state.winner !== null ? 'Ended' : `${state.active === HUMAN ? 'Your' : 'Enemy'} ${state.phase}`),
      h('button', { class: 'btn small', onclick: () => { fast = !fast; render(); } }, fast ? 'Speed: fast' : 'Speed: normal'),
      h('button', { class: 'btn small danger', onclick: () => { if (state.winner === null && confirm('Concede this match?')) act({ type: 'concede', player: HUMAN }); } }, 'Concede'),
      h('button', { class: 'btn small', onclick: () => { if (state.winner !== null || confirm('Leave the match? It will count as abandoned.')) onExit(); } }, 'Menu'),
    );

    logEl = h('div', { class: 'log' }, ...log.map((l) => h('div', { class: l.startsWith('—') ? 'log-turn' : 'log-line' }, l)));

    const board = h(
      'div',
      { class: 'board-col' },
      topbar,
      playerBar(AI),
      buildingRow(AI),
      lanes,
      buildingRow(HUMAN),
      playerBar(HUMAN),
      h('div', { class: 'hint' }, hint),
      actions,
      handEl,
    );
    const aside = h('aside', { class: 'side' }, inspector.el, h('h3', null, 'Battle log'), logEl);

    clear(root);
    root.append(h('div', { class: 'match' }, board, aside));
    if (logEl) logEl.scrollTop = logEl.scrollHeight;

    if (yourTurn && state.phase === 'mulligan') root.append(mulliganOverlay());
    if (state.winner !== null) root.append(resultOverlay());
  }

  function mulliganOverlay(): HTMLElement {
    return h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: 'modal wide' },
        h('h2', null, 'Opening hand'),
        h('p', { class: 'muted' }, state.first === HUMAN ? 'You go first.' : 'The enemy goes first; you start with +1 Supplies.'),
        h('div', { class: 'hand static' }, ...state.players[HUMAN].hand.map((c) => inspectOnHover(cardFace(c, { className: 'hand-card' }), c))),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => act({ type: 'mulligan', player: HUMAN, keep: true }) }, 'Keep hand'),
          h('button', { class: 'btn', onclick: () => act({ type: 'mulligan', player: HUMAN, keep: false }) }, 'Mulligan'),
        ),
      ),
    );
  }

  function resultOverlay(): HTMLElement {
    const w = state.winner;
    const title = w === 'draw' ? 'Draw' : w === HUMAN ? 'Victory' : 'Defeat';
    const last = [...log].reverse().find((l) => l.startsWith('Turn limit') || l.includes('(HQ destroyed)') || l.includes('(conceded)')) ?? '';
    return h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: `modal result ${w === HUMAN ? 'win' : w === 'draw' ? 'draw' : 'loss'}` },
        h('h2', null, title),
        h('p', null, last),
        h('p', { class: 'muted' }, `Ended on turn ${state.turn}. Your HQ: ${state.players[HUMAN].hq}. Enemy HQ: ${state.players[AI].hq}.`),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn primary', onclick: onRematch }, 'Play again'),
          h('button', { class: 'btn', onclick: onExit }, 'Menu'),
        ),
      ),
    );
  }

  // ------------------------------------------------------------ input

  function clickHand(index: number, card: Card, playable: boolean): void {
    if (state.winner !== null || actingSeat(state) !== HUMAN) return;
    if (state.phase === 'discard') {
      act({ type: 'discard', player: HUMAN, cardIndex: index });
      return;
    }
    if (state.phase !== 'main') return;
    if (!playable) {
      notice = `${card.name}: ${whyNot(state, card)}.`;
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
    const mine = legalActions(state, HUMAN).filter((a) => 'cardIndex' in a && a.cardIndex === index);
    if (card.type === 'unit') {
      sel = { kind: 'hand', index };
    } else {
      sel = { kind: 'pick', title: card.type === 'building' ? `Construct ${card.name}?` : `Play ${card.name}?`, actions: mine };
    }
    render();
  }

  function chooseSlot(actions: Action[]): void {
    if (actions.length === 1) {
      act(actions[0]!);
      return;
    }
    const card = actions[0]!.type === 'deploy' ? state.players[HUMAN].hand[actions[0]!.cardIndex] : undefined;
    sel = { kind: 'pick', title: `${card?.name ?? 'Unit'}: choose targets`, actions };
    render();
  }

  render();
  schedule();
  return () => {
    disposed = true;
    window.clearTimeout(timer);
  };
}
