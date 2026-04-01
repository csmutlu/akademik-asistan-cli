# Akademik Asistan CLI

Public npm package for the Akademik Asistan terminal experience.

## Install

### Homebrew

```bash
brew tap csmutlu/akademik-asistan-cli https://github.com/csmutlu/akademik-asistan-cli
brew install csmutlu/akademik-asistan-cli/akademik-asistan
```

This installs both commands:

```bash
aasistan
akademik-asistan
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
aasistan login --no-open
aasistan login --debug
aasistan whoami
aasistan buddy bugun neye odaklanayim
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

- `Tab`: switch between dashboard, detail drawer, and right rail
- `j/k`, arrows: move between dashboard cards
- `Enter`: open selected view
- `b`: toggle Buddy rail
- `/`: command palette
- `?`: help
- `r`: hard refresh
- `h`: back to home
- `q`: quit

## Extras

- `aasistan login` always prints a copyable login URL before trying to open the browser
- `aasistan login --no-open` prints the URL without auto-opening the browser
- `aasistan login --debug` writes structured login traces to `~/.config/akademik-asistan/logs/cli-debug-YYYY-MM-DD.jsonl`
- `AA_ASCII=1` forces ASCII fallback for terminal UI text
- `aasistan watch` runs a brief always-on poller for agenda and announcement changes
- `aasistan buddy ...` uses the built-in academic Buddy and persists local conversation history
- local memory consolidation is written to `~/.config/akademik-asistan/MEMORY.md`
