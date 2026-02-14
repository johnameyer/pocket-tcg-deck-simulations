import { AttachableEnergyType } from '@cards-ts/pocket-tcg';

export type DeckConfiguration = {
    name: string;
    cardIds: string[];
    energyTypes: AttachableEnergyType[];
};

export type GameOutcome = 'player1' | 'player2' | 'tie';

export type GameResult = {
    outcome: GameOutcome;
    player0Points: number;
    player1Points: number;
    deck0PlayerPosition: 0 | 1;
    deck1PlayerPosition: 0 | 1;
};

export type SimulationResult = {
    deck0: DeckConfiguration;
    deck1: DeckConfiguration;
    totalGames: number;
    outcomes: {
        player1Wins: number;
        player2Wins: number;
        ties: number;
    };
    gameResults: GameResult[];
};

export type SimulationStats = SimulationResult & {
    player1WinRate: number;
    player2WinRate: number;
    tieRate: number;
};
