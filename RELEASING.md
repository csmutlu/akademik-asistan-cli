# CLI Releasing

## 1. Local verification

```bash
npm ci
npm run build
npm test
npm pack
```

## 2. Create the GitHub release asset

The Homebrew formula now points to a GitHub release asset, not the npm registry tarball.
Push a version tag:

```bash
git tag cli-v0.1.2
git push origin cli-v0.1.2
```

The release workflow will:

- build and test the CLI
- create `aasistan-<version>.tgz`
- upload that tarball to the GitHub release
- generate `Formula/akademik-asistan.rb`
- optionally publish to npm if `NPM_TOKEN` exists

Workflow file:

```bash
.github/workflows/cli-release.yml
```

## 3. Publish to npm

Preferred path: npm trusted publishing with GitHub Actions.

Package name:

```bash
aasistan
```

Repository:

```bash
csmutlu/akademik-asistan-cli
```

After npm trusted publishing is connected to this repository, every new tag release can publish automatically:

```bash
git tag cli-v0.1.2
git push origin cli-v0.1.2
```

Manual local fallback still works with npm authentication:

```bash
npm adduser
npm publish --access public
```

## 4. Generate or refresh the Homebrew formula locally

After `npm pack`:

```bash
node scripts/update_homebrew_formula.mjs
```

This updates:

```bash
Formula/akademik-asistan.rb
```

The formula references the GitHub release tarball URL:

```text
https://github.com/csmutlu/akademik-asistan-cli/releases/download/cli-v<version>/aasistan-<version>.tgz
```

Homebrew install command:

```bash
brew tap csmutlu/akademik-asistan-cli https://github.com/csmutlu/akademik-asistan-cli
brew install csmutlu/akademik-asistan-cli/akademik-asistan
```

## 5. Manual release verification

After the tag workflow finishes, verify:

```bash
curl -I https://github.com/csmutlu/akademik-asistan-cli/releases/download/cli-v0.1.2/aasistan-0.1.2.tgz
brew tap csmutlu/akademik-asistan-cli https://github.com/csmutlu/akademik-asistan-cli
brew install csmutlu/akademik-asistan-cli/akademik-asistan
aasistan help
```
