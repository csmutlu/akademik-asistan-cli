import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function resolveRepoRoot() {
  let currentDir = path.resolve(process.cwd());

  while (true) {
    if (existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      console.error('Repository root bulunamadi. package.json bekleniyordu.');
      process.exit(1);
    }

    currentDir = parentDir;
  }
}

const repoRoot = resolveRepoRoot();
const cliPackagePath = path.join(repoRoot, 'package.json');
const cliPackage = JSON.parse(readFileSync(cliPackagePath, 'utf8'));
const version = cliPackage.version;
const packageName = cliPackage.name;
const repositoryUrl = cliPackage.repository?.url ?? '';
const repositoryMatch = repositoryUrl.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
const repositoryOwner = repositoryMatch?.[1];
const repositoryName = repositoryMatch?.[2];
const formulaDir = path.join(repoRoot, 'Formula');
const formulaPath = path.join(formulaDir, 'akademik-asistan.rb');
const tgzFileName = `akademik-asistan-cli-${version}.tgz`;
const tgzPath = path.join(repoRoot, tgzFileName);

if (!existsSync(tgzPath)) {
  console.error(`Tarball bulunamadi: ${tgzPath}`);
  process.exit(1);
}

if (!repositoryOwner || !repositoryName) {
  console.error(`GitHub repository bilgisi okunamadi: ${repositoryUrl}`);
  process.exit(1);
}

const tarballBuffer = readFileSync(tgzPath);
const sha256 = createHash('sha256').update(tarballBuffer).digest('hex');
const releaseTag = `cli-v${version}`;
const releaseTarballUrl = `https://github.com/${repositoryOwner}/${repositoryName}/releases/download/${releaseTag}/${tgzFileName}`;

mkdirSync(formulaDir, { recursive: true });

const formula = `class AkademikAsistan < Formula
  desc "Akademik Asistan command line interface"
  homepage "https://github.com/${repositoryOwner}/${repositoryName}"
  url "${releaseTarballUrl}"
  sha256 "${sha256}"
  license "MIT"

  depends_on "node"

  def install
    libexec.install Dir["package/*"]
    bin.install_symlink libexec/"dist/index.js" => "akademik-asistan"
  end

  test do
    output = shell_output("#{bin}/akademik-asistan help")
    assert_match "Akademik Asistan CLI", output
  end

  def caveats
    <<~EOS
      The Homebrew build installs the stable command:
        akademik-asistan

      The short aa alias is intentionally omitted because macOS ships a
      conflicting /usr/bin/aa binary.
    EOS
  end
end
`;

writeFileSync(formulaPath, formula, 'utf8');
console.log(`Formula guncellendi: ${formulaPath}`);
console.log(`Release asset URL: ${releaseTarballUrl}`);
console.log(`Package source: ${packageName}`);
