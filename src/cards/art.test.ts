import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NEUTRAL_CARDS } from './ww2-neutral';
import { USA_CARDS } from './ww2-usa';
import { UK_CARDS } from './ww2-uk';
import { USSR_CARDS } from './ww2-ussr';
import { GERMANY_CARDS } from './ww2-germany';
import { JAPAN_CARDS } from './ww2-japan';
import { CORE_CARDS, WW2_CARDS } from './ww2';
import type { Card } from '../engine/types';

const root = join(__dirname, '..', '..');
const read = <T>(file: string): T => JSON.parse(readFileSync(join(root, file), 'utf8')) as T;

/** One entry per art batch: the cards and the prompts file that describes their pictures. */
const BATCHES: { name: string; cards: Card[]; promptsFile: string }[] = [
  { name: 'core', cards: CORE_CARDS, promptsFile: 'art/ww2-core-prompts.json' },
  { name: 'neutral', cards: NEUTRAL_CARDS, promptsFile: 'art/ww2-neutral-prompts.json' },
  { name: 'USA', cards: USA_CARDS, promptsFile: 'art/ww2-usa-prompts.json' },
  { name: 'UK', cards: UK_CARDS, promptsFile: 'art/ww2-uk-prompts.json' },
  { name: 'USSR', cards: USSR_CARDS, promptsFile: 'art/ww2-ussr-prompts.json' },
  { name: 'Germany', cards: GERMANY_CARDS, promptsFile: 'art/ww2-germany-prompts.json' },
  { name: 'Japan', cards: JAPAN_CARDS, promptsFile: 'art/ww2-japan-prompts.json' },
];

const style = read<{ prefix: string; suffix: string }>('art/style.json');
const provenance = read<Record<string, { variant: number; seed: number; model: string; styleHash: string }>>(
  'art/provenance.json',
);
const cardIds = new Set(WW2_CARDS.map((c) => c.id));

for (const batch of BATCHES) {
  const prompts = read<Record<string, string>>(batch.promptsFile);

  describe(`card art (${batch.name} batch)`, () => {
    it('has a prompt for every card and no prompt for an unknown card', () => {
      for (const c of batch.cards) expect(prompts[c.id], `missing prompt: ${c.id}`).toBeTruthy();
      for (const id of Object.keys(prompts)) expect(cardIds.has(id), `unknown card: ${id}`).toBe(true);
      expect(Object.keys(prompts).sort()).toEqual(batch.cards.map((c) => c.id).sort());
    });

    it('keeps prompts free of text, symbols and national insignia', () => {
      for (const [id, p] of Object.entries(prompts)) {
        expect(p, id).not.toMatch(
          /\b(swastikas?|nazis?|ss runes|insignia|flags?|banners?|logos?|lettering|captions?|stars?|crosses|cross)\b/i,
        );
      }
    });

    it('has a generated image for every card', () => {
      for (const c of batch.cards) {
        const file = join(root, 'assets', 'ww2', `${c.id}.webp`);
        expect(existsSync(file), `missing art: ${c.id}`).toBe(true);
        expect(statSync(file).size, `empty art: ${c.id}`).toBeGreaterThan(10_000);
      }
    });

    it('records how every image was made', () => {
      for (const c of batch.cards) {
        const p = provenance[c.id];
        expect(p, `no provenance: ${c.id}`).toBeTruthy();
        expect(Number.isInteger(p!.variant) && p!.variant >= 0).toBe(true);
        expect(p!.model).toMatch(/\.safetensors$/);
      }
    });
  });
}

describe('art style', () => {
  it('is described only in positive terms', () => {
    // The model ignores negative prompts, and naming an unwanted thing ("no crosses") makes it appear.
    expect(`${style.prefix} ${style.suffix}`).not.toMatch(/\b(no|not|without|never)\b/i);
  });

  it('has provenance only for cards that exist', () => {
    for (const id of Object.keys(provenance)) expect(cardIds.has(id), `unknown card: ${id}`).toBe(true);
  });
});
