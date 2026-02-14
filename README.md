<h1 align="center">pocket-tcg-deck-simulations</h1>

<div align="center">

![GitHub Latest Commit](https://img.shields.io/github/last-commit/johnameyer/pocket-tcg-deck-simulations?label=Latest%20Commit)
[![Documentation](https://img.shields.io/static/v1?label=docs&message=hosted&color=informational&logo=typescript)](https://johnameyer.github.io/pocket-tcg)
</div>

This project allows for simulation of relative performances of multiple decks and variations of decks. It simulates a number of games and finds optimum moves using information set monte carlo tree search.

It is built on an implementation of a trading card game battle system [johnameyer/pocket-tcg](https://github.com/johnameyer/pocket-tcg). It contains no actual game data and is intended for research purposes around gameplay strategization.

Developed mainly though generative AI so even with test coverage there is a chance of bugs.

## Running

### CLI Usage

The `simulate` command runs games between two decks and reports win rates. Decks are loaded from game-data exports:

```bash
pnpm start simulate --config ../game-data
```

**Options:**
- `--config` (required): Path to game-data module or export (e.g., `../game-data` or `../game-data/dist/index.js`)
- `--deck1-id`: Deck ID to load (e.g., `suicune-greninja`). Uses first deck if not specified.
- `--deck2-id`: Deck ID to load (e.g., `charizard-sylveon`). Uses second deck if not specified.
- `--games`: Number of games to simulate (default: 10)
- `--handler`: Bot handler strategy: `default` or `ismcts` (default: `default`)
- `--ismcts-iterations`: Number of ISMCTS iterations (default: 100)
- `--ismcts-max-depth`: Max depth for ISMCTS simulation (default: 15)

**Examples:**

Compare first two available decks:
```bash
pnpm start simulate --config ../game-data --games 100
```

Compare specific decks:
```bash
pnpm start simulate \
  --config ../game-data \
  --deck1-id "suicune-greninja" \
  --deck2-id "charizard-sylveon" \
  --games 100
```

Use ISMCTS strategy:
```bash
pnpm start simulate \
  --config ../game-data \
  --handler ismcts \
  --ismcts-iterations 50 \
  --ismcts-max-depth 20
```

### Programmatic Usage

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

## Development

### Building

```bash
pnpm run build
```

### Testing

```bash
# Run all tests
pnpm test

# Run specific tests
pnpm test -- --grep 'Target'
```

### Linting

```bash
# Run linting
pnpm run lint
```

## 📚 Documentation Links

**Architecture & Framework:**

- [Cards-TS Framework](https://github.com/johnameyer/cards-ts) - The core framework this implementation is built on
- [Framework Documentation](https://johnameyer.github.io/cards-ts) - Hosted documentation for the Cards-TS framework

**Related Packages:**

- [@cards-ts/core](https://github.com/johnameyer/cards-ts/tree/master/libs/core) - Core game mechanics and state management
- [pocket-tcg](https://github.com/johnameyer/pocket-tcg) - Game implementation

## 📝 Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/johnameyer/cards-ts/tags).

## Authors

* **John Meyer** - *Initial work* - [johnameyer](https://github.com/johnameyer)

See also the list of [contributors](https://github.com/johnameyer/cards-ts/contributors) who participated in this project.
