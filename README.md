<h1 align="center">pocket-tcg-deck-simulations</h1>

<div align="center">

![GitHub Latest Commit](https://img.shields.io/github/last-commit/johnameyer/pocket-tcg-deck-simulations?label=Latest%20Commit)
[![Documentation](https://img.shields.io/static/v1?label=docs&message=hosted&color=informational&logo=typescript)](https://johnameyer.github.io/pocket-tcg)
</div>

This project allows for simulation of relative performances of multiple decks and variations of decks. It simulates a number of games and finds optimum moves using information set monte carlo tree search.

It is built on an implementation of a trading card game battle system [johnameyer/pocket-tcg](https://github.com/johnameyer/pocket-tcg). It contains no actual game data and is intended for research purposes around gameplay strategization.

Developed mainly though generative AI so even with test coverage there is a chance of bugs.

## Running

...

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
