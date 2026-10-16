#!/bin/sh
# Tick 一行安装：
#   curl -fsSL https://raw.githubusercontent.com/Jacky-li-li-li/tick/main/scripts/install.sh | sh
#
# 为什么需要这个脚本：装 .app 是「下 dmg、挂载、拖进应用程序」三步，还要自己核对
# sha256。这里把三步做完，并且校验 Release 上的 SHA256SUMS.txt 通过才装。
#
# 注意：变量展开后面紧跟中文（多字节）时要写成 ${VAR}，否则 sh 会把多字节字节
# 当成变量名的一部分，报 unbound variable。
set -eu

REPO="Jacky-li-li-li/tick"
APP="Tick.app"
DEST="/Applications"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Tick 目前只有 macOS 版本。" >&2
  exit 1
fi

case "$(uname -m)" in
  arm64) ARCH="arm64" ;;
  x86_64) ARCH="x64" ;;
  *)
    echo "不支持的架构：$(uname -m)" >&2
    exit 1
    ;;
esac

if [ ! -w "${DEST}" ]; then
  echo "${DEST} 不可写，请用 sudo 重跑同一条命令。" >&2
  exit 1
fi

# 用 releases/latest 的跳转取版本号：比解析 API 的 JSON 稳，也不占 API 速率限制
TAG=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/${REPO}/releases/latest" | sed 's#.*/tag/##')
case "${TAG}" in
  v[0-9]*) VERSION="${TAG#v}" ;;
  *)
    echo "拿不到最新版本号（拿到的是 '${TAG}'）。" >&2
    exit 1
    ;;
esac

FILE="Tick-${VERSION}-${ARCH}.dmg"
BASE="https://github.com/${REPO}/releases/download/${TAG}"
TMP=$(mktemp -d)
trap 'rm -rf "${TMP}"' EXIT INT TERM

echo "下载 ${FILE}（${TAG}）…"
curl -fsSL -o "${TMP}/${FILE}" "${BASE}/${FILE}"

echo "校验 sha256…"
WANT=$(curl -fsSL "${BASE}/SHA256SUMS.txt" | awk -v f="${FILE}" '$2 == "./" f { print $1 }')
if [ -z "${WANT}" ]; then
  echo "SHA256SUMS.txt 里找不到 ${FILE}，已中止。" >&2
  exit 1
fi
GOT=$(shasum -a 256 "${TMP}/${FILE}" | awk '{ print $1 }')
if [ "${GOT}" != "${WANT}" ]; then
  echo "sha256 不匹配，已中止。" >&2
  echo "  期望 ${WANT}" >&2
  echo "  实际 ${GOT}" >&2
  exit 1
fi

echo "安装到 ${DEST} …"
osascript -e 'quit app "Tick"' >/dev/null 2>&1 || true
mkdir -p "${TMP}/mnt"
hdiutil attach "${TMP}/${FILE}" -nobrowse -quiet -mountpoint "${TMP}/mnt"
rm -rf "${DEST}/${APP}"
cp -R "${TMP}/mnt/${APP}" "${DEST}/"
hdiutil detach "${TMP}/mnt" -quiet

echo "Tick ${VERSION} 已装到 ${DEST}，从 Launchpad 或 Spotlight 打开即可。"
