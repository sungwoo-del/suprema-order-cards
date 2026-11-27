#!/bin/bash
# GitHub 자동 배포용 — push 전에 카드 버전(Ver.NN)과 날짜를 올립니다 (Linux · macOS 공용)
# 사용법 : ./bump.sh            → 모든 카드 버전 +1
set -eu
cd "$(dirname "$0")"
TODAY=$(TZ=Asia/Seoul date +%Y-%m-%d)
bump() { # 파일 상수접두어
  local f="$1" k="$2"
  local cur nxt
  cur=$(grep -E "^(export )?const ${k}_VERSION = '[0-9]+';" "$f" | sed -E "s/.*'([0-9]+)'.*/\1/")
  nxt=$(printf "%02d" $((10#$cur + 1)))
  sed -E -i.bak "s/^((export )?const ${k}_VERSION = )'[0-9]+';/\1'$nxt';/; s/^((export )?const ${k}_UPDATED = )'[0-9-]+';/\1'$TODAY';/" "$f" && rm -f "$f.bak"
  echo "▶ $k Ver.$cur → Ver.$nxt ($TODAY)"
}
bump src/app/cards/OrderSetup.tsx CARD
bump src/app/cards/SidebarShared.tsx SIDEBAR
bump src/app/cards/EndCustomerShared.tsx EC
bump src/app/cards/ConvertShared.tsx CV
bump src/app/cards/OrderShared.tsx OD

# 앱 이름 = HubSpot 카드 하단 "…에 의해 구동됨" 문구 → "Suprema(YYYY-MM-DD / Ver.NN Beta) - HelloDigital"
APP=src/app/app-hsmeta.json
cur=$(grep -E '"name": "Suprema\(' "$APP" | sed -E 's/.*Ver\.([0-9]+).*/\1/')
nxt=$(printf "%02d" $((10#${cur:-17} + 1)))
sed -E -i.bak "s/\"name\": \"Suprema[^\"]*\"/\"name\": \"Suprema($TODAY \/ Ver.$nxt Beta) - HelloDigital\"/" "$APP" && rm -f "$APP.bak"
echo "▶ APP Ver.$nxt ($TODAY)"
