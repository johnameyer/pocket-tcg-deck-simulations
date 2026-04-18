import { expect } from 'chai';
import { createRequire } from 'module';
import type { CardRepository } from '@cards-ts/pocket-tcg';
import { SimulationRunner } from '../src/simulation-runner.js';
import { DeckConfiguration } from '../src/simulation-types.js';
import { mockRepository } from '../../pocket-tcg/spec/mock-repository.js';

const require = createRequire(import.meta.url);

describe('SimulationRunner', () => {
    it('should run simulations between two identical decks', async () => {
        const runner = new SimulationRunner(mockRepository as unknown as CardRepository);

        const deckA: DeckConfiguration = {
            name: 'Deck A',
            cardIds: [ 'basic-creature', 'basic-supporter', 'basic-item' ],
            energyTypes: [ 'fire', 'fire', 'fire' ],
        };

        const deckB: DeckConfiguration = {
            name: 'Deck B',
            cardIds: [ 'basic-creature', 'basic-supporter', 'basic-item' ],
            energyTypes: [ 'fire', 'fire', 'fire' ],
        };

        const result = await runner.runSimulation(deckA, deckB, 3);

        expect(result).to.exist;
        expect(result.totalGames).to.equal(3);
        expect(result.outcomes.player1Wins + result.outcomes.player1Wins + result.outcomes.ties).to.equal(3);
        expect(result.player1WinRate).to.be.closeTo(result.outcomes.player1Wins / 3, 0.001);
        expect(result.player1WinRate).to.be.closeTo(result.outcomes.player2Wins / 3, 0.001);
        expect(result.tieRate).to.be.closeTo(result.outcomes.ties / 3, 0.001);
        expect(result.cardUsageSummary).to.be.an('array');
    });

    it('should not have 100% tie rate with ISMCTS handler using mock cards', async () => {
        try {
            require.resolve('@cards-ts/ismcts-ai');
        } catch {
            return;
        }

        const runner = new SimulationRunner(mockRepository as unknown as CardRepository);

        const deckA: DeckConfiguration = {
            name: 'Aggressive Deck',
            cardIds: [ 'basic-creature', 'high-hp-creature', 'basic-item' ],
            energyTypes: [ 'fire', 'fighting', 'fire' ],
        };

        const deckB: DeckConfiguration = {
            name: 'Defensive Deck',
            cardIds: [ 'tank-creature', 'basic-creature', 'basic-supporter' ],
            energyTypes: [ 'fighting', 'fire', 'fire' ],
        };

        const result = await runner.runSimulation(deckA, deckB, 5, 'ismcts');

        expect(result).to.exist;
        expect(result.totalGames).to.equal(5);
        expect(result.outcomes.player1Wins + result.outcomes.player1Wins + result.outcomes.ties).to.equal(5);
        // Validate that not all games are ties (tieRate < 100%)
        expect(result.tieRate).to.be.lessThan(1, 'Tie rate should be less than 100% - some games should have a decisive winner');
        // At least one decisive game should occur
        expect(result.outcomes.player2Wins + result.outcomes.player1Wins).to.be.greaterThan(0, 'At least one game should have a decisive outcome');
        expect(result.cardUsageSummary).to.be.an('array');
    });
});
