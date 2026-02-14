#!/usr/bin/env node

import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CardRepository, AttachableEnergyType } from '@cards-ts/pocket-tcg';
import { SimulationRunner, HandlerStrategy, ISMCTSOptions } from './simulation-runner.js';
import { DeckConfiguration } from './simulation-types.js';

type SimulationConfig = {
    deck1: DeckConfiguration;
    deck2: DeckConfiguration;
    games: number;
};

type DeckBuild = Record<string, number>;

function validateDeck(deck: DeckConfiguration): void {
    if (!deck.cardIds || deck.cardIds.length === 0) {
        throw new Error(`Deck "${deck.name}" is empty (0 cards)`);
    }
    if (deck.cardIds.length < 20) {
        throw new Error(`Deck "${deck.name}" must have at least 20 cards, but has ${deck.cardIds.length}`);
    }
    if (!deck.energyTypes || deck.energyTypes.length === 0) {
        throw new Error(`Deck "${deck.name}" must specify energy types (e.g., --deck1-energy "fire,water")`);
    }
}

function expandDeckCards(deckCards: Record<string, number>): string[] {
    const expanded: string[] = [];
    for (const [ cardId, count ] of Object.entries(deckCards)) {
        for (let i = 0; i < count; i++) {
            expanded.push(cardId);
        }
    }
    return expanded;
}

function validateConfig(config: SimulationConfig): void {
    validateDeck(config.deck1);
    validateDeck(config.deck2);
}

async function loadConfigFromModule(
    modulePath: string,
    deck1Id?: string,
    deck2Id?: string,
    games?: number,
): Promise<{ config: SimulationConfig; repository: CardRepository }> {
    const absolutePath = modulePath.startsWith('/') ? modulePath : path.resolve(process.cwd(), modulePath);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const module = await import(absolutePath) as any;

    const typedConfig = module as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repository: CardRepository = (typedConfig.CARDS as any) || new CardRepository();

    if (process.env.DEBUG_REPOSITORY === 'true') {
        console.log(`[REPO] Using repository: ${typedConfig.CARDS ? 'from module.CARDS' : 'new empty CardRepository'}`);
        try {
            const testCard = repository.getCard('a1-087-froakie');
            console.log(`[REPO] Test card a1-087-froakie: ${testCard.data.name}`);
        } catch (e) {
            console.log('[REPO] Test card a1-087-froakie: NOT FOUND');
        }
    }

    // Expect DECKS structure from game-data
    if (!typedConfig.DECKS || typeof typedConfig.DECKS !== 'object') {
        throw new Error('Module must export DECKS object from game-data');
    }

    const allDecks: Record<string, { energyTypes: string[]; cards: DeckBuild }> = typedConfig.DECKS as any;
    const deckKeys = Object.keys(allDecks);

    if (deckKeys.length < 2) {
        throw new Error(`DECKS must contain at least 2 decks, found ${deckKeys.length}`);
    }

    const selectedDeck1Id = deck1Id || deckKeys[0];
    const selectedDeck2Id = deck2Id || deckKeys[1];

    if (!allDecks[selectedDeck1Id]) {
        const availableDecks = deckKeys.sort();
        throw new Error(`Deck not found: "${selectedDeck1Id}". Available decks: ${availableDecks.join(', ')}`);
    }
    if (!allDecks[selectedDeck2Id]) {
        const availableDecks = deckKeys.sort();
        throw new Error(`Deck not found: "${selectedDeck2Id}". Available decks: ${availableDecks.join(', ')}`);
    }

    const deck1Data = allDecks[selectedDeck1Id];
    const deck2Data = allDecks[selectedDeck2Id];

    return {
        config: {
            deck1: {
                name: selectedDeck1Id,
                cardIds: expandDeckCards(deck1Data.cards),
                energyTypes: (deck1Data.energyTypes as AttachableEnergyType[]) || [],
            },
            deck2: {
                name: selectedDeck2Id,
                cardIds: expandDeckCards(deck2Data.cards),
                energyTypes: (deck2Data.energyTypes as AttachableEnergyType[]) || [],
            },
            games: games || 10,
        },
        repository,
    };
}

async function runSimulation(config: SimulationConfig, gameRunner: SimulationRunner, strategy: HandlerStrategy = 'default', ismctsOptions?: ISMCTSOptions): Promise<void> {
    console.log(`Running ${config.games} simulations (handler: ${strategy})...`);
    if (strategy === 'ismcts' && ismctsOptions) {
        if (ismctsOptions.iterations !== undefined) {
            console.log(`  ISMCTS iterations: ${ismctsOptions.iterations}`);
        }
        if (ismctsOptions.maxDepth !== undefined) {
            console.log(`  ISMCTS max depth: ${ismctsOptions.maxDepth}`);
        }
    }
    console.log(`  Deck 1 (${config.deck1.name}): ${config.deck1.cardIds.length} cards, energies: ${config.deck1.energyTypes.join(', ') || 'none'}`);
    console.log(`  Deck 2 (${config.deck2.name}): ${config.deck2.cardIds.length} cards, energies: ${config.deck2.energyTypes.join(', ') || 'none'}`);
    console.log('');

    const stats = await gameRunner.runSimulation(config.deck1, config.deck2, config.games, strategy, ismctsOptions);

    // Track wins by deck, not by player position
    let deck1Wins = 0;
    let deck2Wins = 0;
    let deck1WhenPlayer0 = 0;
    let deck1WhenPlayer1 = 0;
    let deck2WhenPlayer0 = 0;
    let deck2WhenPlayer1 = 0;

    console.log('Match Results:');
    stats.gameResults.forEach((result, index) => {
        const deck1WasPlayer0 = result.deck0PlayerPosition === 0;
        const deck1Position = deck1WasPlayer0 ? 'P0' : 'P1';
        const deck2Position = deck1WasPlayer0 ? 'P1' : 'P0';
        
        let winnerName = '';
        
        if (result.outcome === 'player1') {
            // Player 1 won - check which deck was in position 0
            if (deck1WasPlayer0) {
                deck1Wins++;
                deck1WhenPlayer0++;
                winnerName = `${config.deck1.name} (${deck1Position})`;
            } else {
                deck2Wins++;
                deck2WhenPlayer0++;
                winnerName = `${config.deck2.name} (${deck2Position})`;
            }
        } else if (result.outcome === 'player2') {
            // Player 2 won - check which deck was in position 1
            if (deck1WasPlayer0) {
                deck2Wins++;
                deck2WhenPlayer1++;
                winnerName = `${config.deck2.name} (${deck2Position})`;
            } else {
                deck1Wins++;
                deck1WhenPlayer1++;
                winnerName = `${config.deck1.name} (${deck1Position})`;
            }
        } else {
            winnerName = 'Tie';
        }
        
        const deck1Points = deck1WasPlayer0 ? result.player0Points : result.player1Points;
        const deck2Points = deck1WasPlayer0 ? result.player1Points : result.player0Points;
        
        console.log(`  Game ${index + 1}: ${winnerName} (${config.deck1.name}: ${deck1Points} pts, ${config.deck2.name}: ${deck2Points} pts)`);
    });
    
    console.log('');
    console.log('Simulation Results:');
    console.log(`  Total Games: ${stats.totalGames}`);
    console.log(`  ${config.deck1.name} Wins: ${deck1Wins} (${((deck1Wins / config.games) * 100).toFixed(1)}%)`);
    console.log(`    - When Player 0: ${deck1WhenPlayer0} wins`);
    console.log(`    - When Player 1: ${deck1WhenPlayer1} wins`);
    console.log(`  ${config.deck2.name} Wins: ${deck2Wins} (${((deck2Wins / config.games) * 100).toFixed(1)}%)`);
    console.log(`    - When Player 0: ${deck2WhenPlayer0} wins`);
    console.log(`    - When Player 1: ${deck2WhenPlayer1} wins`);
    console.log(`  Ties: ${stats.outcomes.ties} (${(stats.tieRate * 100).toFixed(1)}%)`);
}

void yargs(hideBin(process.argv))
    .command(
        'simulate',
        'Run simulations between two decks',
        (yargs) => yargs
            .option('config', {
                alias: 'c',
                description: 'Path to game-data module (e.g., ../game-data or ../game-data/dist/index.js)',
                type: 'string',
                demandOption: true,
            })
            .option('games', {
                description: 'Number of games to simulate',
                type: 'number',
                default: 10,
            })
            .option('deck1-id', {
                description: 'Deck ID to load (e.g., suicune-greninja). Uses first deck if not specified.',
                type: 'string',
            })
            .option('deck2-id', {
                description: 'Deck ID to load (e.g., charizard-sylveon). Uses second deck if not specified.',
                type: 'string',
            })
            .option('handler', {
                alias: 'h',
                description: 'Bot handler strategy (default or ismcts)',
                type: 'string',
                choices: [ 'default', 'ismcts' ],
                default: 'default',
            })
            .option('ismcts-iterations', {
                description: 'ISMCTS iterations (default: 100)',
                type: 'number',
            })
            .option('ismcts-max-depth', {
                description: 'ISMCTS max depth (default: 15)',
                type: 'number',
            }),
        async (argv) => {
            const result = await loadConfigFromModule(
                argv.config as string,
                argv['deck1-id'] as string | undefined,
                argv['deck2-id'] as string | undefined,
                argv.games as number | undefined,
            );
            const config = result.config;
            const repo = result.repository;

            validateConfig(config);

            const gameRunner = new SimulationRunner(repo);
            const strategy = argv.handler as HandlerStrategy;
            
            const ismctsOptions: ISMCTSOptions = {};
            if (argv['ismcts-iterations'] !== undefined) {
                ismctsOptions.iterations = argv['ismcts-iterations'] as number;
            }
            if (argv['ismcts-max-depth'] !== undefined) {
                ismctsOptions.maxDepth = argv['ismcts-max-depth'] as number;
            }
            
            await runSimulation(config, gameRunner, strategy, ismctsOptions);
        },
    )
    .parseAsync();
