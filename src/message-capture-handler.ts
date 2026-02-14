import { Message, HandlerResponsesQueue, MessageHandler } from '@cards-ts/core';
import { HandlerData } from '@cards-ts/pocket-tcg/dist/game-handler.js';
import { ResponseMessage } from '@cards-ts/pocket-tcg/dist/messages/response-message.js';

/**
 * Handler that captures all messages for logging purposes, deduplicating when the same message
 * is sent to both players consecutively. Combines player indicators into a single line.
 */
export class MessageCaptureHandler extends MessageHandler<HandlerData, ResponseMessage> {
    private lastMessageType: string | null = null;
    private lastMessageContent: string | null = null;
    private lastPlayerPositions: Set<number> = new Set();
    private lastLogIndex: number = -1;

    constructor(private messageLog: string[]) {
        super();
    }

    public handleMessage = (handlerData: HandlerData, _response: HandlerResponsesQueue<ResponseMessage>, msg: Message) => {
        // Render message using components
        const rendered = Message.defaultTransformer(msg.components);
        const messageType = (msg.constructor as any).name || 'UnknownMessage';
        const currentPlayerPosition = handlerData.players.position;

        // Check if message content is player-specific (contains "You" or other player-specific language)
        const isPlayerSpecific = rendered && (rendered.includes('You ') || rendered.includes('Your ') || rendered.includes('Opponent'));

        // Check if this is the same message type and content as the last one
        if (!isPlayerSpecific && messageType === this.lastMessageType && rendered === this.lastMessageContent) {
            // Same broadcast message, add player to the set
            this.lastPlayerPositions.add(currentPlayerPosition);
            
            // Update the last log entry with combined player indicators
            if (this.lastLogIndex >= 0) {
                // If both players received the same broadcast message, use '-'
                const playerDisplay = this.lastPlayerPositions.size === 2 ? '-' : 
                    Array.from(this.lastPlayerPositions)
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

    /**
     * Reset the last message tracker for the next game
     */
    public resetForNewGame(): void {
        this.lastMessageType = null;
        this.lastMessageContent = null;
        this.lastPlayerPositions.clear();
        this.lastLogIndex = -1;
    }
}
