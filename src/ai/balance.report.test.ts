import { describe, it } from 'vitest';
import { formatReport, nationCardRates, runBalance } from './balance';

/** Balance sweep. Slow, so it only runs on request: BALANCE=1 [GAMES=300] npm run balance */
describe.skipIf(!process.env.BALANCE)('balance report', () => {
  it('prints the nation matrix and card outliers', () => {
    const report = runBalance(Number(process.env.GAMES ?? 300), 1, process.env.NODOCTRINE !== '1');
    console.log('\n' + formatReport(report));
    for (const nation of (process.env.NATIONS ?? '').split(',').filter(Boolean) as ('usa' | 'uk' | 'ussr' | 'germany' | 'japan')[]) {
      const rates = nationCardRates(report, nation);
      const fmt = (r: (typeof rates)[number]) => `${r.name} (${r.rarity}) ${(r.rate * 100).toFixed(0)}%`;
      console.log(`${nation} top: ${rates.slice(0, 10).map(fmt).join(', ')}\n${nation} bottom: ${rates.slice(-10).map(fmt).join(', ')}`);
    }
  }, 1_200_000);
});
