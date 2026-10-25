import type { Nation } from '../engine/types';
import { api } from './api';
import { clear, h } from './dom';
import { DOCTRINE_INFO, NATION_LABEL } from './text';

const NATIONS: Exclude<Nation, 'neutral'>[] = ['usa', 'uk', 'ussr', 'germany', 'japan'];

/** Sign in, or create an account by choosing the nation of the starter army (docs/04 section 10). */
export function mountLogin(root: HTMLElement, done: () => void, notice = ''): void {
  let mode: 'login' | 'register' = 'register';
  let nation: Exclude<Nation, 'neutral'> = 'usa';
  let error = notice;
  let busy = false;

  function render(): void {
    const name = h('input', { id: 'name', type: 'text', autocomplete: 'username', maxlength: 20, placeholder: 'Commander name' });
    const pass = h('input', { id: 'password', type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password', placeholder: 'Password (8+ characters)' });
    const submit = async (e: Event) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      error = '';
      render();
      try {
        if (mode === 'login') await api.login((name as HTMLInputElement).value, (pass as HTMLInputElement).value);
        else await api.register((name as HTMLInputElement).value, (pass as HTMLInputElement).value, nation);
        done();
        return;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      busy = false;
      render();
    };
    const keep = { name: (document.getElementById('name') as HTMLInputElement | null)?.value ?? '' };
    clear(root);
    root.append(
      h(
        'div',
        { class: 'menu' },
        h('h1', null, 'Front Line'),
        h('p', { class: 'tag' }, 'A World War II army card game. Build an army, deploy across three lanes, break the enemy Command Post.'),
        h(
          'div',
          { class: 'tabs', style: 'justify-content:center;margin-bottom:12px' },
          h('button', { class: `btn ${mode === 'register' ? 'on' : ''}`, onclick: () => { mode = 'register'; error = ''; render(); } }, 'New player'),
          h('button', { class: `btn ${mode === 'login' ? 'on' : ''}`, onclick: () => { mode = 'login'; error = ''; render(); } }, 'I have an account'),
        ),
        h(
          'form',
          { class: 'panel', onsubmit: submit },
          h('label', null, 'Name', name),
          h('label', null, 'Password', pass),
          mode === 'register'
            ? h(
                'div',
                null,
                h('p', { class: 'muted small', style: 'margin:0 0 8px' }, 'Choose your starter army. You get 30 cards, 200 War Bonds and a free pack.'),
                h(
                  'div',
                  { class: 'nation-grid' },
                  ...NATIONS.map((n) =>
                    h(
                      'button',
                      { type: 'button', class: `nation-card ${nation === n ? 'chosen' : ''}`, onclick: () => { nation = n; render(); } },
                      h('strong', null, NATION_LABEL[n]),
                      h('span', { class: 'doctrine' }, DOCTRINE_INFO[n].name),
                      h('span', { class: 'muted small' }, DOCTRINE_INFO[n].text),
                    ),
                  ),
                ),
              )
            : null,
          error ? h('p', { class: 'errors', style: 'margin:0;padding:0;list-style:none' }, error) : null,
          h('button', { class: 'btn primary big', type: 'submit', disabled: busy }, busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account and start'),
        ),
      ),
    );
    if (keep.name) (document.getElementById('name') as HTMLInputElement).value = keep.name;
  }
  render();
}
