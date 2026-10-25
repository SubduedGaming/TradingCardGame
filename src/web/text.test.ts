import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { WW2_CARDS } from '../cards/ww2';
import { KEYWORD_INFO, artUrl, cardRules, costText } from './text';

describe('card text', () => {
  it('describes every card without placeholder or broken text', () => {
    for (const card of WW2_CARDS) {
      const lines = cardRules(card);
      for (const line of lines) expect(line, card.id).not.toMatch(/undefined|NaN|\[object/);
      // orders are only their effects; every other card lists each keyword and effect it has
      if (card.type === 'order') expect(lines.length, card.id).toBe(card.effects.length);
      else {
        for (const k of card.keywords) expect(lines.join('\n'), card.id).toContain(KEYWORD_INFO[k].name);
        for (const _ of card.effects ?? []) expect(lines.length, card.id).toBeGreaterThan(card.keywords.length);
      }
    }
  });

  it('has a description for every keyword the set uses', () => {
    for (const card of WW2_CARDS) {
      if (card.type === 'order') continue;
      for (const k of card.keywords) expect(KEYWORD_INFO[k]).toBeDefined();
    }
  });

  it('points every card at an art file that exists', () => {
    for (const card of WW2_CARDS) {
      expect(existsSync(`assets${artUrl(card.id).replace(/^.*?\/ww2\//, '/ww2/')}`), card.id).toBe(true);
    }
  });

  it('formats costs', () => {
    expect(costText({ manpower: 2, fuel: 1 })).toBe('2 Mp 1 Fu');
  });
});
