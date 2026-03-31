class AkademikAsistan < Formula
  desc "Akademik Asistan command line interface"
  homepage "https://github.com/csmutlu/akademik-asistan-cli"
  url "https://github.com/csmutlu/akademik-asistan-cli/releases/download/cli-v0.1.1/akademik-asistan-cli-0.1.1.tgz"
  sha256 "9f388918e24159888d5f2b9bf1475e4453172e595342a46360f34aaa892e44d9"
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
