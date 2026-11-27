#!/bin/bash
# 배포 스크립트 — 카드 설명의 (Update : 날짜 / Ver.NN)을 자동으로 올린 뒤 hs project upload 실행
# 사용법: cd ~/Documents/suprema-order-cards && ./deploy.sh
# 업로드가 실패하면 버전 · 날짜를 원래대로 되돌립니다.
set -u
cd "$(dirname "$0")"
CARD="src/app/cards/OrderSetup.tsx"
SIDE="src/app/cards/SidebarShared.tsx"
EC="src/app/cards/EndCustomerShared.tsx"
CV="src/app/cards/ConvertShared.tsx"
cp "$CARD" "$CARD.bak_deploy"
cp "$SIDE" "$SIDE.bak_deploy"
cp "$EC" "$EC.bak_deploy"
cp "$CV" "$CV.bak_deploy"

TODAY=$(TZ=Asia/Seoul date +%Y-%m-%d)
CUR=$(grep -E "^const CARD_VERSION = '[0-9]+';" "$CARD" | sed -E "s/.*'([0-9]+)'.*/\1/")
NEXT=$(printf "%02d" $((10#$CUR + 1)))
sed -i '' -E "s/^const CARD_VERSION = '[0-9]+';/const CARD_VERSION = '$NEXT';/" "$CARD"
sed -i '' -E "s/^const CARD_UPDATED = '[0-9-]+';/const CARD_UPDATED = '$TODAY';/" "$CARD"
echo "▶ Order Setup 카드 버전 Ver.$CUR → Ver.$NEXT · Update : $TODAY"
# 오른쪽 컬럼 카드 4종 (SidebarShared.tsx) 도 함께 올림
SCUR=$(grep -E "^export const SIDEBAR_VERSION = '[0-9]+';" "$SIDE" | sed -E "s/.*'([0-9]+)'.*/\1/")
SNEXT=$(printf "%02d" $((10#$SCUR + 1)))
sed -i '' -E "s/^export const SIDEBAR_VERSION = '[0-9]+';/export const SIDEBAR_VERSION = '$SNEXT';/" "$SIDE"
sed -i '' -E "s/^export const SIDEBAR_UPDATED = '[0-9-]+';/export const SIDEBAR_UPDATED = '$TODAY';/" "$SIDE"
echo "▶ 오른쪽 컬럼 카드 버전 Ver.$SCUR → Ver.$SNEXT"
# End Customer 카드 2종 (EndCustomerShared.tsx)
ECUR=$(grep -E "^export const EC_VERSION = '[0-9]+';" "$EC" | sed -E "s/.*'([0-9]+)'.*/\1/")
ENEXT=$(printf "%02d" $((10#$ECUR + 1)))
sed -i '' -E "s/^export const EC_VERSION = '[0-9]+';/export const EC_VERSION = '$ENEXT';/" "$EC"
sed -i '' -E "s/^export const EC_UPDATED = '[0-9-]+';/export const EC_UPDATED = '$TODAY';/" "$EC"
echo "▶ End Customer 카드 버전 Ver.$ECUR → Ver.$ENEXT"
# 영업기회 전환 카드 2종 (ConvertShared.tsx)
CCUR=$(grep -E "^export const CV_VERSION = '[0-9]+';" "$CV" | sed -E "s/.*'([0-9]+)'.*/\1/")
CNEXT=$(printf "%02d" $((10#$CCUR + 1)))
sed -i '' -E "s/^export const CV_VERSION = '[0-9]+';/export const CV_VERSION = '$CNEXT';/" "$CV"
sed -i '' -E "s/^export const CV_UPDATED = '[0-9-]+';/export const CV_UPDATED = '$TODAY';/" "$CV"
echo "▶ 영업기회 전환 카드 버전 Ver.$CCUR → Ver.$CNEXT"

if hs project upload "$@"; then
  rm -f "$CARD.bak_deploy" "$SIDE.bak_deploy" "$EC.bak_deploy" "$CV.bak_deploy"
  echo "✅ 업로드 완료 (Ver.$NEXT / $TODAY)"
else
  mv "$CARD.bak_deploy" "$CARD"
  mv "$SIDE.bak_deploy" "$SIDE"
  mv "$EC.bak_deploy" "$EC"
  mv "$CV.bak_deploy" "$CV"
  echo "❌ 업로드 실패 — 버전 · 날짜를 Ver.$CUR 로 되돌렸습니다."
  exit 1
fi
