cask "tick" do
  version "0.1.7"

  on_arm do
    sha256 "a78b626c12b28b614a466692ec7198a877e4441f82c2c67ab8b20cf2140a536c"
    url "https://github.com/Jacky-li-li-li/tick/releases/download/v#{version}/Tick-#{version}-arm64.dmg"
  end

  on_intel do
    sha256 "28534454c7b8ba5b33204fe141f3d0f8f15fb75ae6ddba4641bf40b896e138d1"
    url "https://github.com/Jacky-li-li-li/tick/releases/download/v#{version}/Tick-#{version}-x64.dmg"
  end

  name "Tick"
  desc "Always-on-top todo panel"
  homepage "https://github.com/Jacky-li-li-li/tick"

  app "Tick.app"
end
