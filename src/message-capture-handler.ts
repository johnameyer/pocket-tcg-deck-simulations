import { Message, HandlerResponsesQueue, MessageHandler } from '@cards-ts/core';
import { HandlerData } from '@cards-ts/pocket-tcg/dist/game-handler.js';
import { ResponseMessage } from '@cards-ts/pocket-tcg/dist/messages/response-message.js';
import { PlayCardResponseMessage } from '@cards-ts/pocket-tcg/dist/messages/response/play-card-response-message.js';
import { EvolveResponseMessage } from '@cards-ts/pocket-tcg/dist/messages/response/evolve-response-message.js';
import { AttackResponseMessage } from '@cards-ts/pocket-tcg/dist/messages/response/attack-response-message.js';
import { UseAbilityResponseMessage } from '@cards-ts/pocket-tcg/dist/messages/response/use-ability-response-message.js';
import { AttachEnergyResponseMessage } from '@cards-ts/pocket-tcg/dist/messages/response/attach-energy-response-message.js';
import { CreaturePlayedMessage } from '@cards-ts/pocket-tcg/dist/messages/status/creature-played-message.js';
import { ItemPlayedMessage } from '@cards-ts/pocket-tcg/dist/messages/status/item-played-message.js';
import { SupporterPlayedMessage } from '@cards-ts/pocket-tcg/dist/messages/status/supporter-played-message.js';
import { ToolPlayedMessage } from '@cards-ts/pocket-tcg/dist/messages/status/tool-played-message.js';
import { StadiumPlayedMessage } from '@cards-ts/pocket-tcg/dist/messages/status/stadium-played-message.js';
import { EvolutionMessage } from '@cards-ts/pocket-tcg/dist/messages/status/evolution-message.js';
import { AttackResultMessage } from '@cards-ts/pocket-tcg/dist/messages/status/attack-result-message.js';
import { EnergyAttachedMessage } from '@cards-ts/pocket-tcg/dist/messages/status/energy-attached-message.js';
import { KnockedOutMessage } from '@cards-ts/pocket-tcg/dist/messages/status/knocked-out-message.js';
import { TurnSummaryMessage } from '@cards-ts/pocket-tcg/dist/messages/status/turn-summary-message.js';
import { GameOverMessage } from '@cards-ts/pocket-tcg/dist/messages/status/game-over-message.js';
import { SimulationTraceEvent } from './trace-types.js';

/**
 * Handler that captures all messages for logging purposes, deduplicating when the same message
 * is sent to both players consecutively. Combines player indicators into a single line.
 */
export class MessageCaptureHandler extends MessageHandler<HandlerData, ResponseMessage> {
    private lastMessageType: string | null = null;

    private lastMessageContent: string | null = null;

    private lastPlayerPositions: Set<number> = new Set();

    private lastLogIndex: number = -1;

    private currentGameNumber: number = 0;

    private eventSequence: number = 0;

    constructor(
        private messageLog: string[],
        private traceSink?: (event: SimulationTraceEvent) => void,
    ) {
        super();
    }

    public handleMessage = (handlerData: HandlerData, _response: HandlerResponsesQueue<ResponseMessage>, msg: Message): void => {
        // Render message using components
        const rendered = Message.defaultTransformer(msg.components);
        const messageType = msg.constructor.name || 'UnknownMessage';
        const currentPlayerPosition = handlerData.players.position;
        const traceEvent = this.createTraceEvent(handlerData, msg, messageType, rendered, currentPlayerPosition);
        if (this.traceSink) {
            this.traceSink(traceEvent);
        }

        // Check if message content is player-specific (contains "You" or other player-specific language)
        const isPlayerSpecific = rendered && (rendered.includes('You ') || rendered.includes('Your ') || rendered.includes('Opponent'));

        // Check if this is the same message type and content as the last one
        if (!isPlayerSpecific && messageType === this.lastMessageType && rendered === this.lastMessageContent) {
            // Same broadcast message, add player to the set
            this.lastPlayerPositions.add(currentPlayerPosition);
            
            // Update the last log entry with combined player indicators
            if (this.lastLogIndex >= 0) {
                // If both players received the same broadcast message, use '-'
                const playerDisplay = this.lastPlayerPositions.size === 2 ? '-' 
                    : Array.from(this.lastPlayerPositions)
                        .map(pos => pos === 0 ? '1' : pos === 1 ? '2' : '-')[0];
                
                const contentPart = rendered ? ` ${rendered}` : '';
                this.messageLog[this.lastLogIndex] = `[Player ${playerDisplay}] [${messageType}]${contentPart}`;
            }
        } else {
            // Different message, log it
            const playerDisplay = currentPlayerPosition === 0 ? '1' : currentPlayerPosition === 1 ? '2' : '-';
            const fullMessage = rendered
                ? `[Player ${playerDisplay}] [${messageType}] ${rendered}`
                : `[Player ${playerDisplay}] [${messageType}]`;

            this.messageLog.push(fullMessage);
            this.lastLogIndex = this.messageLog.length - 1;
            this.lastMessageType = messageType;
            this.lastMessageContent = rendered;
            this.lastPlayerPositions.clear();
            this.lastPlayerPositions.add(currentPlayerPosition);
        }
    };

    private createTraceEvent(
        handlerData: HandlerData,
        msg: Message,
        messageType: string,
        rendered: string | null,
        currentPlayerPosition: number,
    ): SimulationTraceEvent {
        const turnNumber = handlerData.turnCounter.turnNumber ?? null;
        const baseEvent: SimulationTraceEvent = {
            gameNumber: this.currentGameNumber,
            sequence: this.eventSequence++,
            turnNumber,
            playerPosition: currentPlayerPosition === 0 || currentPlayerPosition === 1 ? currentPlayerPosition : null,
            messageType,
            messageRole: this.getMessageRole(msg),
            action: 'unknown',
            rendered,
        };

        if (msg instanceof PlayCardResponseMessage) {
            return {
                ...baseEvent,
                action: 'play-card',
                cardTemplateId: msg.templateId,
                cardType: msg.cardType,
                targetPlayerId: msg.targetPlayerId,
                targetFieldIndex: msg.targetFieldIndex,
            };
        }

        if (msg instanceof EvolveResponseMessage) {
            return {
                ...baseEvent,
                action: 'evolve',
                cardTemplateId: msg.evolutionId,
                evolutionTemplateId: msg.evolutionId,
                fieldPosition: msg.position,
            };
        }

        if (msg instanceof AttackResponseMessage) {
            const activeCard = handlerData.field.creatures[currentPlayerPosition]?.[0];
            const activeTemplateId = activeCard?.evolutionStack?.[activeCard.evolutionStack.length - 1]?.templateId;
            return {
                ...baseEvent,
                action: 'attack',
                cardTemplateId: activeTemplateId,
                attackIndex: msg.attackIndex,
            };
        }

        if (msg instanceof UseAbilityResponseMessage) {
            const fieldCard = handlerData.field.creatures[currentPlayerPosition]?.[msg.fieldCardPosition];
            const templateId = fieldCard?.evolutionStack?.[fieldCard.evolutionStack.length - 1]?.templateId;
            return {
                ...baseEvent,
                action: 'use-ability',
                cardTemplateId: templateId,
                fieldPosition: msg.fieldCardPosition,
            };
        }

        if (msg instanceof AttachEnergyResponseMessage) {
            const fieldCard = handlerData.field.creatures[currentPlayerPosition]?.[msg.fieldPosition];
            const templateId = fieldCard?.evolutionStack?.[fieldCard.evolutionStack.length - 1]?.templateId;
            return {
                ...baseEvent,
                action: 'attach-energy',
                cardTemplateId: templateId,
                fieldPosition: msg.fieldPosition,
            };
        }

        if (msg instanceof CreaturePlayedMessage) {
            return {
                ...baseEvent,
                action: 'card-played',
                cardTemplateId: msg.cardTemplateId,
                cardName: msg.cardName,
                cardType: 'creature',
                sourcePlayerId: msg.playerId,
            };
        }

        if (msg instanceof ItemPlayedMessage) {
            return {
                ...baseEvent,
                action: 'card-played',
                cardTemplateId: msg.cardTemplateId,
                cardName: msg.cardName,
                cardType: 'item',
                sourcePlayerId: msg.playerId,
            };
        }

        if (msg instanceof SupporterPlayedMessage) {
            return {
                ...baseEvent,
                action: 'card-played',
                cardTemplateId: msg.cardTemplateId,
                cardName: msg.cardName,
                cardType: 'supporter',
                sourcePlayerId: msg.playerId,
            };
        }

        if (msg instanceof ToolPlayedMessage) {
            return {
                ...baseEvent,
                action: 'card-played',
                cardTemplateId: msg.cardTemplateId,
                cardName: msg.cardName,
                cardType: 'tool',
                targetPlayerId: msg.targetPlayerId,
                targetFieldIndex: msg.targetFieldPosition,
                sourcePlayerId: msg.playerId,
                sourceCardName: msg.targetCardTemplateId,
            };
        }

        if (msg instanceof StadiumPlayedMessage) {
            return {
                ...baseEvent,
                action: 'card-played',
                cardTemplateId: msg.cardTemplateId,
                cardName: msg.cardName,
                cardType: 'stadium',
                sourcePlayerId: msg.playerId,
            };
        }

        if (msg instanceof EvolutionMessage) {
            return {
                ...baseEvent,
                action: 'evolution-result',
                cardName: msg.toName,
                sourceCardName: msg.fromName,
            };
        }

        if (msg instanceof AttackResultMessage) {
            return {
                ...baseEvent,
                action: 'attack-result',
                cardName: msg.attackName,
                damage: msg.damage,
                attackName: msg.attackName,
                remainingHp: msg.remainingHp,
                sourceCardName: msg.attackerName,
            };
        }

        if (msg instanceof EnergyAttachedMessage) {
            return {
                ...baseEvent,
                action: 'energy-attached',
                energyType: String(msg.energyType),
                cardName: msg.creatureName,
            };
        }

        if (msg instanceof KnockedOutMessage) {
            return {
                ...baseEvent,
                action: 'knocked-out',
                cardName: msg.player,
            };
        }

        if (msg instanceof TurnSummaryMessage) {
            return {
                ...baseEvent,
                action: 'turn-summary',
            };
        }

        if (msg instanceof GameOverMessage) {
            return {
                ...baseEvent,
                action: 'game-over',
                cardName: msg.player,
            };
        }

        return baseEvent;
    }

    private getMessageRole(msg: Message): 'response' | 'status' | 'other' {
        if (msg.type.endsWith('-response')) {
            return 'response';
        }
        if (
            msg instanceof CreaturePlayedMessage ||
            msg instanceof ItemPlayedMessage ||
            msg instanceof SupporterPlayedMessage ||
            msg instanceof ToolPlayedMessage ||
            msg instanceof StadiumPlayedMessage ||
            msg instanceof EvolutionMessage ||
            msg instanceof AttackResultMessage ||
            msg instanceof EnergyAttachedMessage ||
            msg instanceof KnockedOutMessage ||
            msg instanceof TurnSummaryMessage ||
            msg instanceof GameOverMessage ||
            msg.type.endsWith('-message')
        ) {
            return 'status';
        }
        return 'other';
    }

    public beginGame(gameNumber: number): void {
        this.currentGameNumber = gameNumber;
        this.eventSequence = 0;
    }

    /**
     * Reset the last message tracker for the next game
     */
    public resetForNewGame(): void {
        this.lastMessageType = null;
        this.lastMessageContent = null;
        this.lastPlayerPositions.clear();
        this.lastLogIndex = -1;
        this.eventSequence = 0;
    }
}
