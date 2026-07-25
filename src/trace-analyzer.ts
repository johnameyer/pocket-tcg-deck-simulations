import { SimulationTraceEvent } from './trace-types.js';

export function collectPlayedCardTemplateIds(events: SimulationTraceEvent[]): Set<string> {
    const played = new Set<string>();

    for (const event of events) {
        if ((event.action === 'card-played' || event.action === 'evolve') && event.cardTemplateId) {
            played.add(event.cardTemplateId);
        }
    }

    return played;
}

/** Collect names of cards that were played via evolution (evolution-result events) */
export function collectEvolvedCardNames(events: SimulationTraceEvent[]): Set<string> {
    const names = new Set<string>();
    for (const event of events) {
        if (event.action === 'evolution-result' && (event as any).cardName) {
            names.add((event as any).cardName);
        }
    }
    return names;
}

export function findNeverPlayedCards(deckCardIds: string[], events: SimulationTraceEvent[]): string[] {
    const played = collectPlayedCardTemplateIds(events);
    return deckCardIds.filter(cardId => !played.has(cardId));
}
