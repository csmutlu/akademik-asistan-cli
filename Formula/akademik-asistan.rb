class AkademikAsistan < Formula
  desc "Akademik Asistan command line interface"
  homepage "https://github.com/csmutlu/akademik-asistan-cli"
  url "https://github.com/csmutlu/akademik-asistan-cli/releases/download/cli-v0.1.29/aasistan-0.1.29.tgz"
  sha256 "a46ee8179dd1ab7ecc84afd3892f0eb5e8860df4e4f0ec7cc64115e81e88766f"
  license "MIT"

  depends_on "node"

  def install
    package_dir = buildpath/"package"
    package_dir = buildpath unless package_dir.directory?

    libexec.install package_dir/"dist"
    libexec.install package_dir/"package.json"
    libexec.install package_dir/"package-lock.json" if (package_dir/"package-lock.json").exist?
    libexec.install package_dir/"README.md"

    cd libexec do
      system "npm", "install", "--omit=dev"
    end

    bin.install_symlink libexec/"dist/index.js" => "aasistan"
    bin.install_symlink libexec/"dist/index.js" => "akademik-asistan"
  end

  test do
    output = shell_output("#{bin}/aasistan help")
    assert_match "Akademik Asistan CLI", output
  end

  def caveats
    <<~EOS
      Installed commands:
        aasistan
        akademik-asistan
    EOS
  end
end
