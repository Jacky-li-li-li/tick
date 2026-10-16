cask "tick" do
  version "0.1.5"

  on_arm do
    sha256 "b81be33b6dd8fb4380e1f9c6b957c715820a22b3886b42d98cc67ce6046c41c4"
    url "https://github.com/Jacky-li-li-li/tick/releases/download/v#{version}/Tick-#{version}-arm64.dmg",
        verified: "github.com/Jacky-li-li-li/tick/"
  end

  on_intel do
    sha256 "bc7f8b543be44f3017127e9bff85283e84490575398c541655453dd9bd385ae4"
    url "https://github.com/Jacky-li-li-li/tick/releases/download/v#{version}/Tick-#{version}-x64.dmg",
        verified: "github.com/Jacky-li-li-li/tick/"
  end

  name "Tick"
  desc "Always-on-top todo panel"
  homepage "https://github.com/Jacky-li-li-li/tick"

  app "Tick.app"
end
