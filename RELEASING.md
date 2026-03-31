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
git tag cli-v0.1.0
git push origin cli-v0.1.0
```

The release workflow will:

- build and test the CLI
- create `akademik-asistan-cli-<version>.tgz`
- upload that tarball to the GitHub release
- generate `Formula/akademik-asistan.rb`
- optionally publish to npm if `NPM_TOKEN` exists

Workflow file:

```bash
.github/workflows/cli-release.yml
```

## 3. Publish to npm (optional)

Local publish requires npm authentication first:

```bash
npm adduser
npm publish --access public
```

The package name is:

```bash
@akademik-asistan/cli
```

If the repository has an `NPM_TOKEN` secret, the GitHub release workflow can do this automatically.

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
https://github.com/csmutlu/akademik-asistan-cli/releases/download/cli-v<version>/akademik-asistan-cli-<version>.tgz
```

Homebrew install command:

```bash
brew tap csmutlu/akademik-asistan-cli https://github.com/csmutlu/akademik-asistan-cli
brew install csmutlu/akademik-asistan-cli/akademik-asistan
```

## 5. Manual release verification

After the tag workflow finishes, verify:

```bash
curl -I https://github.com/csmutlu/akademik-asistan-cli/releases/download/cli-v0.1.0/akademik-asistan-cli-0.1.0.tgz
brew tap csmutlu/akademik-asistan-cli https://github.com/csmutlu/akademik-asistan-cli
brew install csmutlu/akademik-asistan-cli/akademik-asistan
akademik-asistan help
```
