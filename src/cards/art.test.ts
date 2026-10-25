import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NEUTRAL_CARDS } from './ww2-neutral';
import { WW2_CARDS } from './ww2';

const root = join(__dirname, '..', '..');
const prompts: Record<string, string> = JSON.parse(
  readFileSync(join(root, 'art/ww2-neutral-prompts.json'), 'utf8'),
);
const cardIds = new Set(WW2_CARDS.map((c) => c.id));
const style: { prefix: string; suffix: string } = JSON.parse(readFileSync(join(root, 'art/style.json'), 'utf8'));
const provenance: Record<string, { variant: number; seed: number; model: string; styleHash: string }> = JSON.parse(
  readFileSync(join(root, 'art/provenance.json'), 'utf8'),
);

describe('card art (neutral batch)', () => {
  it('has a prompt for every neutral card and no prompt for an unknown card', () => {
    for (const c of NEUTRAL_CARDS) expect(prompts[c.id], `missing prompt: ${c.id}`).toBeTruthy();
    for (const id of Object.keys(prompts)) expect(cardIds.has(id), `unknown card: ${id}`).toBe(true);
    expect(Object.keys(prompts)).toHaveLength(NEUTRAL_CARDS.length);
  });

  it('keeps prompts free of text, symbols and national insignia', () => {
    for (const [id, p] of Object.entries(prompts)) {
      expect(p, id).not.toMatch(/\b(swastikas?|nazis?|ss runes|insignia|flags?|logos?|lettering|captions?)\b/i);
    }
  });

  it('has a generated image for every neutral card', () => {
    for (const c of NEUTRAL_CARDS) {
      const file = join(root, 'assets', 'ww2', `${c.id}.webp`);
      expect(existsSync(file), `missing art: ${c.id}`).toBe(true);
      expect(statSync(file).size, `empty art: ${c.id}`).toBeGreaterThan(10_000);
    }
  });

  it('describes the style only in positive terms', () => {
    // The model ignores negative prompts, and naming an unwanted thing ("no crosses") makes it appear.
    expect(`${style.prefix} ${style.suffix}`).not.toMatch(/\b(no|not|without|never)\b/i);
  });

  it('records how every image was made', () => {
    for (const c of NEUTRAL_CARDS) {
      const p = provenance[c.id];
      expect(p, `no provenance: ${c.id}`).toBeTruthy();
      expect(Number.isInteger(p!.variant) && p!.variant >= 0).toBe(true);
      expect(p!.model).toMatch(/\.safetensors$/);
    }
    expect(Object.keys(provenance).sort()).toEqual(Object.keys(prompts).sort());
  });
});
