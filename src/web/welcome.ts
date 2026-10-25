import type { Nation } from '../engine/types';
import { newProfile } from '../economy/profile';
import { loadSettings, saveDeck, saveProfile, saveSettings } from './storage';
import { clear, h } from './dom';
import { DOCTRINE_INFO, NATION_LABEL } from './text';

const NATIONS: Exclude<Nation, 'neutral'>[] = ['usa', 'uk', 'ussr', 'germany', 'japan'];

/** First run: choose the nation of the starter army, which creates the profile (docs/04 section 10). */
export function mountWelcome(root: HTMLElement, done: () => void): void {
  const choose = (nation: Exclude<Nation, 'neutral'>) => {
    const seed = (Math.random() * 2 ** 31) | 0;
    const { profile, starterIds } = newProfile(nation, seed, Date.now());
    saveProfile(profile);
    saveSettings({ ...loadSettings(), deckId: 'starter' });
    saveDeck({ id: 'starter', name: `Starter army (${NATION_LABEL[nation]})`, cardIds: starterIds });
    done();
  };
  clear(root);
  root.append(
    h(
      'div',
      { class: 'menu' },
      h('h1', null, 'Front Line'),
      h('p', { class: 'tag' }, 'Choose the nation of your starter army. You start with 30 cards, 200 War Bonds and a free pack, and you grow your collection from there.'),
      h(
        'div',
        { class: 'nation-grid' },
        ...NATIONS.map((n) =>
          h(
            'button',
            { class: 'nation-card', onclick: () => choose(n) },
            h('strong', null, NATION_LABEL[n]),
            h('span', { class: 'doctrine' }, DOCTRINE_INFO[n].name),
            h('span', { class: 'muted small' }, DOCTRINE_INFO[n].text),
          ),
        ),
      ),
    ),
  );
}
