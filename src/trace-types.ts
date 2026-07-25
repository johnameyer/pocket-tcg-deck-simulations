export type TraceMessageRole = 'response' | 'status' | 'other';

export type TraceAction =
    | 'play-card'
    | 'evolve'
    | 'attack'
    | 'use-ability'
    | 'attach-energy'
    | 'card-played'
    | 'evolution-result'
    | 'attack-result'
    | 'energy-attached'
    | 'knocked-out'
    | 'turn-summary'
    | 'game-over'
    | 'unknown';

export type SimulationTraceEvent = {
    gameNumber: number;
    sequence: number;
    turnNumber: number | null;
    playerPosition: 0 | 1 | null;
    messageType: string;
    messageRole: TraceMessageRole;
    action: TraceAction;
    rendered: string | null;
    cardTemplateId?: string;
    cardName?: string;
    cardType?: string;
    attackIndex?: number;
    attackName?: string;
    evolutionTemplateId?: string;
    targetPlayerId?: number;
    targetFieldIndex?: number;
    fieldPosition?: number;
    energyType?: string;
    damage?: number;
    remainingHp?: number;
    sourceTemplateId?: string;
    sourceCardName?: string;
    sourcePlayerId?: number;
    targetCardName?: string;
};

export type SimulationTraceGame = {
    gameNumber: number;
    playerNames: [string, string];
    events: SimulationTraceEvent[];
};
