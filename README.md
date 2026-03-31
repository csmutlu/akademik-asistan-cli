# Akademik Asistan CLI

Public npm package for the Akademik Asistan terminal experience.

## Install

### Homebrew

```bash
brew tap csmutlu/akademik-asistan-cli https://github.com/csmutlu/akademik-asistan-cli
brew install aasistan
```

This installs both commands:

```bash
aasistan
akademik-asistan
```

If you do not want to add the tap first, the fully qualified fallback is:

```bash
brew install csmutlu/akademik-asistan-cli/akademik-asistan
```

### npm

```bash
npm i -g aasistan
```

The short command is now:

```bash
aasistan
```

## Commands

```bash
aasistan login
aasistan whoami
aasistan gundem
aasistan bugun
aasistan duyurular
aasistan yemekhane --day tomorrow
aasistan teacher dashboard
aasistan watch
aasistan --json gundem
```

## TUI

```bash
aasistan
```

Inside the interface:

- `j/k`, arrows, `Tab`: navigate cards
- `Enter`: open selected view
- `/`: command palette
- `?`: help
- `r`: refresh
- `q`: quit

## Extras

- `aasistan watch` runs a brief always-on poller for agenda and announcement changes
- local memory consolidation is written to `~/.config/akademik-asistan/MEMORY.md`
