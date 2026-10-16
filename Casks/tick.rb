cask "tick" do
  version "0.1.6"

  on_arm do
    sha256 "afc6e95b57d1cf238f48a76becdedb550cb907adefa7e8b55d48ae70d4e889ec"
    url "https://github.com/Jacky-li-li-li/tick/releases/download/v#{version}/Tick-#{version}-arm64.dmg",
        verified: "github.com/Jacky-li-li-li/tick/"
  end

  on_intel do
    sha256 "32adac459ccba892e33743ed5d7eacbee32f1dc90572892af1acb7f7fad218b7"
    url "https://github.com/Jacky-li-li-li/tick/releases/download/v#{version}/Tick-#{version}-x64.dmg",
        verified: "github.com/Jacky-li-li-li/tick/"
  end

  name "Tick"
  desc "Always-on-top todo panel"
  homepage "https://github.com/Jacky-li-li-li/tick"

  app "Tick.app"
end
