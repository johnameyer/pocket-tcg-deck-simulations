# Deck Simulations

This project provides tools to simulate Pocket TCG games between different deck configurations and track win rates using the DefaultBotHandler from pocket-tcg.

## Commands

```bash
pnpm install
pnpm run build
# Run eslint
pnpm run lint
# Run all tests
pnpm test
# Run specific tests
pnpm test -- --grep 'SimulationRunner'
```

## Structure

```
deck-simulations/
├── src/
│   ├── simulation-runner.ts       # Main simulation orchestration
│   ├── simulation-types.ts        # Type definitions for decks and results
│   ├── start.ts                   # CLI entry point with yargs commands
│   └── index.ts                   # Public exports
├── spec/
│   └── simulation-runner.spec.ts  # Tests for simulation runner
├── dist/                          # Compiled output
└── package.json
```

## Usage

### CLI

Three ways to run simulations:

#### 1. Inline arguments
```bash
pnpm start simulate \
  --deck1-cards "card1,card2,card3" \
  --deck1-energy "fire,fire,water" \
  --deck2-cards "card4,card5,card6" \
  --deck2-energy "grass,grass,grass" \
  --games 10 \
  --deck1-name "Fire Deck" \
  --deck2-name "Grass Deck"
```

#### 2. JSON config file
Create a `config.json`:
```json
{
  "deck1": {
    "name": "Fire Deck",
    "cardIds": ["card1", "card2", "card3"],
    "energyTypes": ["fire", "fire", "water"]
  },
  "deck2": {
    "name": "Grass Deck",
    "cardIds": ["card4", "card5", "card6"],
    "energyTypes": ["grass", "grass", "grass"]
  },
  "games": 10
}
```

Then run:
```bash
pnpm start simulate --config ./config.json
```

#### 3. Module import (game-data compatible)
Works with `game-data` exports or any module that exports:
- `SimulationConfig` (same shape as JSON config)
- Deck builds object like `{ deck1Name: { cardId: count }, deck2Name: { cardId: count } }`

```bash
pnpm start simulate --module ../game-data/dist/index.js
```

### Programmatic

```typescript
import { SimulationRunner, DeckConfiguration } from '@cards-ts/pocket-tcg';

const runner = new SimulationRunner();

const deck1: DeckConfiguration = {
  name: 'Deck 1',
  cardIds: ['card1', 'card2', 'card3'],
  energyTypes: ['fire', 'fire', 'water'],
};

const deck2: DeckConfiguration = {
  name: 'Deck 2',
  cardIds: ['card4', 'card5', 'card6'],
  energyTypes: ['grass', 'grass', 'grass'],
};

const stats = await runner.runSimulation(deck1, deck2, 100);
console.log(`${deck1.name} win rate: ${(stats.player0WinRate * 100).toFixed(1)}%`);
```

## Conventions

- Use the DefaultBotHandler from pocket-tcg for all simulations (no custom handlers yet)
- Deck configurations require matching card IDs that exist in CardRepository
- Energy types must be valid AttachableEnergyType values
- Win determination is based on:
  - First player to reach 3 points wins
  - If turn limit is reached without a winner, it's a tie
- Each simulation runs up to 200 game steps (configurable) before timing out

## Notes

- The SimulationRunner uses deep imports for types from @cards-ts/pocket-tcg because not all types are exported from the main entry point
- Points and turn tracking come directly from the game state
- The CardRepository must be initialized with valid card definitions for card ID lookups

## Dependencies

- `@cards-ts/pocket-tcg` - Game engine and bot handler
- `@cards-ts/core` - Core game state management
- `yargs` - CLI argument parsing

## References

- pocket-tcg provides gameFactory, CardRepository, and DefaultBotHandler
- Simulation results track win rates, ties, and individual game outcomes
