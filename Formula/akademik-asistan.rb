class AkademikAsistan < Formula
  desc "Akademik Asistan command line interface"
  homepage "https://github.com/csmutlu/akademik-asistan-cli"
  url "https://github.com/csmutlu/akademik-asistan-cli/releases/download/cli-v0.1.0/akademik-asistan-cli-0.1.0.tgz"
  sha256 "42e8c01ebbaa7ffbb10f827fe7c937259ca4077addfa5df346da390463f33d34"
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
