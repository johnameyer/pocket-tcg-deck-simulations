import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { expect } from 'chai';
import type { CardRepository } from '@cards-ts/pocket-tcg';
import { SimulationRunner } from '../src/simulation-runner.js';
import { DeckConfiguration } from '../src/simulation-types.js';
import { collectPlayedCardTemplateIds, findNeverPlayedCards } from '../src/trace-analyzer.js';
import type { SimulationTraceEvent } from '../src/trace-types.js';
import { mockRepository } from './mock-repository.js';

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
        expect(result.outcomes.player1Wins + result.outcomes.player2Wins + result.outcomes.ties).to.equal(3);
        expect(result.player1WinRate).to.be.closeTo(result.outcomes.player1Wins / 3, 0.001);
        expect(result.tieRate).to.be.closeTo(result.outcomes.ties / 3, 0.001);
    });

    it('should not have 100% tie rate with ISMCTS handler using mock cards', async function() {
        this.timeout(120000);
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

        const result = await runner.runSimulation(deckA, deckB, 5, 'ismcts', {
            iterations: 10,
            maxDepth: 20,
        });

        expect(result).to.exist;
        expect(result.totalGames).to.equal(5);
        expect(result.outcomes.player1Wins + result.outcomes.player2Wins + result.outcomes.ties).to.equal(5);
        // Validate that not all games are ties (tieRate < 100%)
        expect(result.tieRate).to.be.lessThan(1, 'Tie rate should be less than 100% - some games should have a decisive winner');
        // At least one decisive game should occur
        expect(result.outcomes.player2Wins + result.outcomes.player1Wins).to.be.greaterThan(0, 'At least one game should have a decisive outcome');
    });

    it('should collect played cards from trace events', () => {
        const events: SimulationTraceEvent[] = [
            {
                gameNumber: 1,
                sequence: 0,
                turnNumber: 1,
                playerPosition: 0,
                messageType: 'PlayCardResponseMessage',
                messageRole: 'response',
                action: 'play-card',
                rendered: 'Chose to play card a1-001-bulbasaur',
                cardTemplateId: 'a1-001-bulbasaur',
                cardType: 'creature',
            },
            {
                gameNumber: 1,
                sequence: 1,
                turnNumber: 1,
                playerPosition: 0,
                messageType: 'CreaturePlayedMessage',
                messageRole: 'status',
                action: 'card-played',
                rendered: 'Player 1 played Bulbasaur to the bench!',
                cardTemplateId: 'a1-001-bulbasaur',
                cardName: 'Bulbasaur',
                cardType: 'creature',
            },
            {
                gameNumber: 1,
                sequence: 2,
                turnNumber: 2,
                playerPosition: 0,
                messageType: 'EvolveResponseMessage',
                messageRole: 'response',
                action: 'evolve',
                rendered: 'Evolving creature at position 0 to a1-002-ivysaur',
                cardTemplateId: 'a1-002-ivysaur',
                evolutionTemplateId: 'a1-002-ivysaur',
                fieldPosition: 0,
            },
            {
                gameNumber: 1,
                sequence: 3,
                turnNumber: 2,
                playerPosition: 0,
                messageType: 'EvolutionMessage',
                messageRole: 'status',
                action: 'evolution-result',
                rendered: 'Player 1\'s Bulbasaur evolved into Ivysaur!',
            },
        ];

        const played = collectPlayedCardTemplateIds(events);
        expect(played.has('a1-001-bulbasaur')).to.equal(true);
        expect(played.has('a1-002-ivysaur')).to.equal(true);
        expect(findNeverPlayedCards([ 'a1-001-bulbasaur', 'a1-002-ivysaur', 'a1-003-venusaur' ], events)).to.deep.equal([ 'a1-003-venusaur' ]);
    });

    it('should write structured trace logs when enabled', async function() {
        this.timeout(120000);
        const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-sim-trace-'));
        const runner = new SimulationRunner(mockRepository as unknown as CardRepository, {
            traceEnabled: true,
            traceDir,
        });

        const deckA: DeckConfiguration = {
            name: 'Trace Deck A',
            cardIds: [ 'basic-creature', 'basic-supporter', 'basic-item' ],
            energyTypes: [ 'fire', 'fire', 'fire' ],
        };

        const deckB: DeckConfiguration = {
            name: 'Trace Deck B',
            cardIds: [ 'basic-creature', 'basic-supporter', 'basic-item' ],
            energyTypes: [ 'fire', 'fire', 'fire' ],
        };

        try {
            await runner.runSimulation(deckA, deckB, 1);

            const traceFiles = fs.readdirSync(traceDir).filter(file => file.endsWith('.trace.jsonl'));
            expect(traceFiles).to.have.length(1);

            const traceContent = fs.readFileSync(path.join(traceDir, traceFiles[0]), 'utf8');
            expect(traceContent).to.contain('"gameNumber":1');
            expect(traceContent).to.contain('"action"');
        } finally {
            fs.rmSync(traceDir, { recursive: true, force: true });
        }
    });
});
