import { gameFactory, CardRepository } from '@cards-ts/pocket-tcg';
import { ControllerState, HandlerChain } from '@cards-ts/core';
import { GameParams } from '@cards-ts/pocket-tcg/dist/game-params.js';
import { Controllers } from '@cards-ts/pocket-tcg/dist/controllers/controllers.js';
import { DefaultBotHandler } from '@cards-ts/pocket-tcg/dist/handlers/default-bot-handler.js';
import { CardUsageSummary, DeckConfiguration, GameOutcome, GameResult, SimulationResult, SimulationStats } from './simulation-types.js';
import { MessageCaptureHandler } from './message-capture-handler.js';
import * as fs from 'fs';

export type HandlerStrategy = 'default' | 'ismcts';
export type ISMCTSOptions = {
    iterations?: number;
    maxDepth?: number;
};

export class SimulationRunner {
    private cardRepository: CardRepository;
    private messageLog: string[] = [];
    private messageCaptureHandlers: MessageCaptureHandler[] = [];

    constructor(cardRepository?: CardRepository) {
        this.cardRepository = cardRepository || new CardRepository();
    }

    /**
     * Create a bot handler chain for the given strategy
     */
    private async createHandlerChainAsync(strategy: HandlerStrategy, ismctsOptions?: ISMCTSOptions): Promise<any> {
        if (strategy === 'ismcts') {
            try {
                // Dynamically import ismcts using the main entry point
                const ismctsModule = await import('@cards-ts/ismcts-ai');
                
                const ISMCTSDecisionStrategy = ismctsModule.ISMCTSDecisionStrategy;
                const PocketTCGHandler = ismctsModule.PocketTCGHandler;
                const createPocketTCGAdapterConfig = ismctsModule.createPocketTCGAdapterConfig;
                
                // @ts-ignore Private property mismatch
                const adapterConfig = createPocketTCGAdapterConfig(this.cardRepository);
                
                // Build ISMCTS config only with provided options (don't override defaults with empty object)
                let ismctsConfig: import('@cards-ts/ismcts-ai').ISMCTSConfig | undefined;
                if (ismctsOptions?.iterations !== undefined || ismctsOptions?.maxDepth !== undefined) {
                    ismctsConfig = {} as any;
                    if (ismctsOptions?.iterations !== undefined) {
                        (ismctsConfig as any).iterations = ismctsOptions.iterations;
                    }
                    if (ismctsOptions?.maxDepth !== undefined) {
                        (ismctsConfig as any).maxDepth = ismctsOptions.maxDepth;
                    }
                }
                
                // Create a single message capture handler shared by both players
                const captureHandler = new MessageCaptureHandler(this.messageLog);
                this.messageCaptureHandlers.push(captureHandler);
                
                // Create fresh handlers for each player with shared message capture handler prepended
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return Array.from({ length: 2 }, () => {
                    const ismctsStrategy = new ISMCTSDecisionStrategy(adapterConfig, ismctsConfig);
                    const handler = new PocketTCGHandler(ismctsStrategy);
                    // Add same capture handler first in the chain for both players
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return new HandlerChain([ captureHandler as any, handler as any ]);
                });
            } catch (error) {
                throw error;
            }
        }

        // For non-ISMCTS, use default strategy
        const factory = gameFactory(this.cardRepository);
        
        // Create a single message capture handler shared by both players
        const captureHandler = new MessageCaptureHandler(this.messageLog);
        this.messageCaptureHandlers.push(captureHandler);
        
        return Array.from({ length: 2 }, () => {
            const defaultChain = factory.getDefaultBotHandlerChain();
            // Prepend same capture handler to the default chain for both players
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new HandlerChain([ captureHandler as any ]).append(defaultChain as any);
        });
    }

    /**
     * Run a single game between two decks and return the outcome with points
     */
    private runSingleGame(deck0: DeckConfiguration, deck1: DeckConfiguration, handlers: any, gameNumber: number): GameResult {
        // Reset message log and handlers for this game (don't create a new array!)
        this.messageLog.length = 0;  // Clear array in-place
        this.messageCaptureHandlers.forEach(h => h.resetForNewGame());
        
        // Randomly assign decks to player positions
        const deck0Position = Math.random() < 0.5 ? (0 as const) : (1 as const);
        const deck1Position = deck0Position === 0 ? (1 as const) : (0 as const);
        
        // Assign decks to their positions
        const decksByPosition = deck0Position === 0 
            ? [ deck0, deck1 ]
            : [ deck1, deck0 ];
        
        // Handlers are already wrapped with MessageCaptureHandler
        const handlersByPosition = deck0Position === 0 
            ? handlers
            : [ handlers[1], handlers[0] ];
        
        console.log(`[SIMULATION] Game setup: "${deck0.name}" → Player ${deck0Position}, "${deck1.name}" → Player ${deck1Position}`);
        
        const factory = gameFactory(this.cardRepository);
        
        const params: GameParams = {
            ...factory.getGameSetup().getDefaultParams(),
            initialDecks: [ decksByPosition[0].cardIds, decksByPosition[1].cardIds ],
            playerEnergyTypes: [ decksByPosition[0].energyTypes, decksByPosition[1].energyTypes ],
        };
        
        const names = [ decksByPosition[0].name, decksByPosition[1].name ];
        const driver = factory.getGameDriver(handlersByPosition, params, names);
        
        driver.resume();
        
        const maxSteps = 200;
        let stepCount = 0;
        
        try {
            while (!driver.getState().completed && stepCount < maxSteps) {
                driver.handleSyncResponses();
                driver.resume();
                stepCount++;
            }
        } catch (error) {
            throw error;
        }
        
        console.log(`[SIMULATION] Game completed after ${stepCount} steps. Game completed: ${driver.getState().completed}`);
        
        const finalState = driver.getState() as ControllerState<Controllers>;
        const result = this.determineWinner(finalState, deck0Position, deck1Position, stepCount);
        const cardUsages = this.messageCaptureHandlers[this.messageCaptureHandlers.length - 1]?.getCardUsages() ?? {};
        
        // Save game log to file
        this.saveGameLog(gameNumber, result, stepCount, names);
        
        return {
            ...result,
            cardUsages,
        };
    }

    /**
     * Save game log to a file
     */
    private saveGameLog(gameNumber: number, result: GameResult, stepCount: number, playerNames: string[]): void {
        const timestamp = new Date().toISOString();
        const gameDir = 'game_logs';
        
        if (!fs.existsSync(gameDir)) {
            fs.mkdirSync(gameDir, { recursive: true });
        }
        
        const fileName = `${gameDir}/game_${gameNumber}_${timestamp.replace(/[:.]/g, '-')}.log`;
        
        const logContent = [
            `=== GAME ${gameNumber} ===`,
            `Timestamp: ${timestamp}`,
            `Duration: ${stepCount} steps`,
            `Player 1: ${playerNames[0]}`,
            `Player 2: ${playerNames[1]}`,
            ``,
            `=== OUTCOME ===`,
            `Winner: ${result.outcome}`,
            `Player 1 Points: ${result.player0Points}`,
            `Player 2 Points: ${result.player1Points}`,
            ``,
            `=== MESSAGES ===`,
            ...this.messageLog,
        ].join('\n');
        
        fs.writeFileSync(fileName, logContent);
    }
    private determineWinner(state: ControllerState<Controllers>, deck0PlayerPosition: 0 | 1, deck1PlayerPosition: 0 | 1, stepCount: number): GameResult {
        const debug = process.env.DEBUG_SIMULATION === 'true';
        
        // Get points
        const points = (state as unknown as { points: Record<string, number> }).points;
        const player0Points = points?.[0] ?? points?.['0'] ?? 0;
        const player1Points = points?.[1] ?? points?.['1'] ?? 0;
        
        // Check turn counter
         
        const turnCounter = (state as unknown as any).turnCounter;
        
        if (debug) {
            console.log('[DEBUG] Full state keys:', Object.keys(state as any));
            console.log('[DEBUG] turnCounter structure:', JSON.stringify(turnCounter));
        }
        console.log(`[SIMULATION] Turn counter: ${turnCounter?.turnNumber}/${turnCounter?.maxTurns}`);
        
        // Check creature field states
        const fieldState = (state as unknown as any).field;
        const p0Creatures = fieldState?.creatures?.[0] ?? [];
        const p1Creatures = fieldState?.creatures?.[1] ?? [];
        
        // Log creature HP details
        const formatCreatures = (creatures: any[]) => {
            if (creatures.length === 0) {
                return 'None'; 
            }
            return creatures
                .map(c => {
                    const evolutionStack = c?.evolutionStack ?? [];
                    if (evolutionStack.length === 0) {
                        return 'Unknown (N/A/N/A HP)';
                    }
                    
                    // Get the top of evolution stack (the current creature)
                    const topCard = evolutionStack[evolutionStack.length - 1];
                    const templateId = topCard?.templateId;
                    
                    if (!templateId) {
                        return 'Unknown (N/A/N/A HP)';
                    }
                    
                    try {
                        const card = this.cardRepository.getCard(templateId);
                        const name = card.data.name ?? 'Unknown';
                        // CreatureData has maxHp property
                        const maxHp = (card.data as any).maxHp ?? 0;
                        const damageTaken = c?.damageTaken ?? 0;
                        const currentHp = Math.max(0, maxHp - damageTaken);
                        return `${name} (${currentHp}/${maxHp} HP)`;
                    } catch {
                        if (process.env.DEBUG_CREATURES === 'true') {
                            console.log(`[DEBUG] Card lookup failed for ${templateId}`);
                        }
                        return `${templateId} (N/A/N/A HP)`;
                    }
                })
                .join(', ');
        };
        
        console.log(`[SIMULATION] Final creatures - P1: ${formatCreatures(p0Creatures)}`);
        console.log(`[SIMULATION] Final creatures - P2: ${formatCreatures(p1Creatures)}`);
        console.log(`[SIMULATION] Points - P1: ${player0Points}, P2: ${player1Points}`);
        
        // Log game duration
        console.log(`[SIMULATION] Game duration: ${stepCount} steps`);
        
        // Log discards
        const discard = (state as unknown as any).discard;
        const p0Discards = discard?.[0] ?? [];
        const p1Discards = discard?.[1] ?? [];
        
        const formatDiscards = (discardList: any[]) => {
            if (discardList.length === 0) {
                return 'None'; 
            }
            return discardList
                .map(cardInstance => {
                    try {
                        // Card instance has templateId property
                        const templateId = cardInstance?.templateId;
                        if (!templateId) {
                            return 'Unknown';
                        }
                        const card = this.cardRepository.getCard(templateId);
                        return card.data.name ?? templateId;
                    } catch {
                        return cardInstance?.templateId ?? 'Unknown';
                    }
                })
                .join(', ');
        };
        
        console.log(`[SIMULATION] Discards - P1: ${formatDiscards(p0Discards)}`);
        console.log(`[SIMULATION] Discards - P2: ${formatDiscards(p1Discards)}`);
        
        // Log hands
        const hand = (state as unknown as any).hand;
        const p0Hand = hand?.[0] ?? [];
        const p1Hand = hand?.[1] ?? [];
        
        const formatHand = (handList: any[]) => {
            if (handList.length === 0) {
                return 'None'; 
            }
            return handList
                .map(cardInstance => {
                    try {
                        const templateId = cardInstance?.templateId;
                        if (!templateId) {
                            return 'Unknown';
                        }
                        const card = this.cardRepository.getCard(templateId);
                        return card.data.name ?? templateId;
                    } catch {
                        return cardInstance?.templateId ?? 'Unknown';
                    }
                })
                .join(', ');
        };
        
        console.log(`[SIMULATION] Hands - P1: ${formatHand(p0Hand)}`);
        console.log(`[SIMULATION] Hands - P2: ${formatHand(p1Hand)}`);

        let outcome: GameOutcome = 'tie';

        // Winner is determined by who still has creatures
        if (p0Creatures.length > 0 && p1Creatures.length === 0) {
            outcome = 'player1';
        } else if (p1Creatures.length > 0 && p0Creatures.length === 0) {
            outcome = 'player2';
        } else if (player0Points >= 3 && player0Points > player1Points) {
            outcome = 'player1';
        } else if (player1Points >= 3 && player1Points > player0Points) {
            outcome = 'player2';
        } else if (turnCounter && turnCounter.turnNumber >= turnCounter.maxTurns) {
            if (debug) {
                console.log(`[SIMULATION] Game reached max turns: ${turnCounter.turnNumber}/${turnCounter.maxTurns} - TIE`);
            }
            outcome = 'tie';
        }

        if (debug) {
            console.log(`[SIMULATION] Game outcome: ${outcome}, Points - P1: ${player0Points}, P2: ${player1Points}`);
        }

        return {
            outcome,
            player0Points,
            player1Points,
            deck0PlayerPosition,
            deck1PlayerPosition,
            cardUsages: {},
        };
    }

    private buildCardUsageSummary(gameResults: GameResult[]): CardUsageSummary[] {
        const summaryByCard: Record<string, CardUsageSummary> = {};

        for (const gameResult of gameResults) {
            for (const [ cardId, uses ] of Object.entries(gameResult.cardUsages)) {
                const existing = summaryByCard[cardId];
                if (!existing) {
                    let cardName = cardId;
                    try {
                        cardName = this.cardRepository.getCard(cardId).data.name ?? cardId;
                    } catch {
                        cardName = cardId;
                    }

                    summaryByCard[cardId] = {
                        cardId,
                        cardName,
                        uses: 0,
                        gamesPlayed: 0,
                    };
                }

                summaryByCard[cardId].uses += uses;
                summaryByCard[cardId].gamesPlayed += 1;
            }
        }

        return Object.values(summaryByCard)
            .sort((a, b) => b.uses - a.uses || a.cardName.localeCompare(b.cardName));
    }

    /**
     * Run multiple games between two decks
     */
    async runSimulation(
        deck0: DeckConfiguration,
        deck1: DeckConfiguration,
        numGames: number,
        strategy: HandlerStrategy = 'default',
        ismctsOptions?: ISMCTSOptions,
    ): Promise<SimulationStats> {
        const outcomes = {
            player1Wins: 0,
            player2Wins: 0,
            ties: 0,
        };
        const gameResults: GameResult[] = [];

        for (let i = 0; i < numGames; i++) {
            const handlers = await this.createHandlerChainAsync(strategy, ismctsOptions);
            const gameResult = this.runSingleGame(deck0, deck1, handlers, i + 1);
            gameResults.push(gameResult);
            
            if (gameResult.outcome === 'player1') {
                outcomes.player1Wins++;
            } else if (gameResult.outcome === 'player2') {
                outcomes.player2Wins++;
            } else {
                outcomes.ties++;
            }
        }
        
        // All games completed
        console.log('[SIMULATION] All games completed');

        const result: SimulationResult = {
            deck0,
            deck1,
            totalGames: numGames,
            outcomes,
            gameResults,
            cardUsageSummary: this.buildCardUsageSummary(gameResults),
        };

        return {
            ...result,
            player1WinRate: outcomes.player1Wins / numGames,
            player2WinRate: outcomes.player2Wins / numGames,
            tieRate: outcomes.ties / numGames,
        };
    }
}
