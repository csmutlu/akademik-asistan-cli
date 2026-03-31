# Akademik Asistan CLI

Public npm package for the Akademik Asistan terminal experience.

## Install

### Homebrew

```bash
brew install --formula https://raw.githubusercontent.com/csmutlu/akademik-asistan-cli/main/Formula/akademik-asistan.rb
```

This installs the stable command:

```bash
akademik-asistan
```

### npm

```bash
npm i -g @akademik-asistan/cli
```

On macOS, the short `aa` command may conflict with Apple's built-in archive tool. The safest command is always `akademik-asistan`. If you want `aa`, ensure your npm global bin directory comes before `/usr/bin`.

## Commands

```bash
akademik-asistan login
akademik-asistan whoami
akademik-asistan gundem
akademik-asistan bugun
akademik-asistan duyurular
akademik-asistan yemekhane --day tomorrow
akademik-asistan teacher dashboard
akademik-asistan watch
akademik-asistan --json gundem
```

## TUI

```bash
akademik-asistan
```

Inside the interface:

- `j/k`, arrows, `Tab`: navigate cards
- `Enter`: open selected view
- `/`: command palette
- `?`: help
- `r`: refresh
- `q`: quit

## Extras

- `akademik-asistan watch` runs a brief always-on poller for agenda and announcement changes
- local memory consolidation is written to `~/.config/akademik-asistan/MEMORY.md`

If your shell is configured so that `aa` resolves to this package, the same commands also work with the short alias.
