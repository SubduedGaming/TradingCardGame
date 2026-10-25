import type { AiTier } from '../shared/protocol';
import { recruitAgent, veteranAgent, type Agent } from './agents';
import { commanderAgent } from './commander';
import { marshalAgent } from './marshal';

/** One agent per AI tier. Agents keep per-turn plans, so use a fresh one for each seat. */
export function agentFor(tier: AiTier): Agent {
  switch (tier) {
    case 'recruit':
      return recruitAgent();
    case 'veteran':
      return veteranAgent();
    case 'commander':
      return commanderAgent();
    case 'marshal':
      return marshalAgent();
  }
}
