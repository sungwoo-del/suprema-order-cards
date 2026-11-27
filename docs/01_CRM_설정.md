# 01. CRM 설정 (포털 245822501)

> 기준일 2026-11-27. 값은 HubSpot에서 직접 조회해 기록함. 이후 변경은 04_변경이력에 추가.

## 1. 거래(Deal) 파이프라인

| 파이프라인 | ID | 단계 (ID · 확률) |
|---|---|---|
| Leads (Partner) | 2608041662 | New 4400178916 (20%) → Working 4400178917 (40%) → Nurturing 4400178918 (60%) → Approval Request 4396792569 (80%) → **Converted (Opp Created) 4400178919 (90%, 열린 단계)** → Unqualified 4400178922 (0%, 종료) |
| Opportunity | 2607290060 | Qualification 4400056037 → Needs Analysis 4400056038 → Proposal 4400056039 → Negotiation 4400056040 → Order Confirm 4400078529 → Closed Won 4400056041 → Closed Lost 4400056042 |
| Order | 2607290061 | PO Registration → Under Review → Order Processing → Order Confirming → Dispatched → Closed → Closed Lost |
| KOR - Opportunity | 2607278805 | 한국 영업용 (기본 단계 한글) |
| ####test_pipeline / ####test_영업 파이프라인 | 2601148092 / default | 테스트용 — 운영 사용 안 함 |

- 2026-11-27 결정 : **Converted (Opp Created)는 성사(Closed Won)가 아닌 열린 단계**. 확률 100%였을 때 HubSpot이 마감일을 오늘로 덮어쓰고 성사 매출로 집계하는 문제가 있어 90%·열린 단계로 변경함.

## 2. 주문 관련 거래 속성 (주요)

| 속성(내부명) | 라벨 | 값 · 규칙 |
|---|---|---|
| owning_entity | Owner Branch (거래 소유자의 지사) | hq·eu·uk·us·jp·in·me·latam. 거래 소유자 팀으로 자동(W1). 허용 팀만 수정, 변경 시 구매자·라인아이템 초기화 |
| buyer_type | Buyer Type (구매자 유형) | internal_entity = HQ/Branch, partner = Partner |
| partner_region_select | Order Branch (판매 지사) | APAC(HQ)·EU·UK·US·JP·IN·ME·LATAM. Partner면 Owner Branch와 동일, HQ/Branch면 HQ(APAC) |
| buying_branch | Order Branch Company (판매 지사) | 판매 지사의 지사 법인 Partner Company 레코드 자동 지정(W3) |
| partner_{리전} / partner_owner_{리전} | Buyer Company / Buyer Contact - {리전} | 리전별 구매 회사·구매 담당자 (Owner Branch 리전 기준 노출) |
| order_type | Order Type (주문 형태) | standard(기본)·dropship·bso. Dropship은 Partner 구매자만, BSO는 Order Branch JP·ME만 |
| erp_sales_type | Sales Type (판매 유형) | Normal·Repair(Sales)·Repair(Non-Sales)·약정무상·Sample |
| order_route | Order Route (주문 경로) | case1_branch_to_hq ~ case5_bso. 워크플로 자동 판정, 허용 팀만 수정 |
| selling_entity | ERP - Order Branch | Order Branch 기준. CASE1·2 = HQ, CASE3·4·5 = 지사 |
| erp_target | ERP Target (ERP 대상) | UniERP SO · D365 SO · D365 PO · D365 BSO |
| revenue_type | Revenue Type (매출 구분) | external · intercompany · non-sales (Intercompany는 그룹 매출 리포트 제외) |
| pricebook_select | PriceBook Select | ERP - Order Branch 리전 접두어 최상단 옵션(W5). IN은 HQ_ 가격표. "The Price Book cannot be applied." 옵션은 보관(선택 불가) |
| deal_currency_code | 통화 | 가격표 이름 끝 통화로 자동(W8) |
| ship_to_address · requested_delivery_date | 배송지 · 희망 납기 | 선택 입력 (Dropship이면 배송지 권장) |
| hd_card_sync | HelloDigital Card Sync (시스템) | 앱카드 간 즉시 새로고침용. 카드가 저장할 때 시각 기록. **직접 수정 금지** |

### 주문 경로 판정 순서 (W4 계열)
Owner Branch HQ → CASE2 / Order Type BSO → CASE5 / Dropship → CASE4 / Buyer Type HQ/Branch → CASE1 / 그 외 → CASE3
- BSO는 Order Branch JP·ME에서만, 아니면 Standard로 되돌림 · Dropship인데 구매자가 HQ/Branch면 Standard로 되돌림
- Revenue Type : CASE1 및 CASE4 본사 연동 주문 = Intercompany, 그 외 External

## 3. 연결(Association) 라벨

| 연결 | 라벨 (typeId) | 용도 |
|---|---|---|
| 거래 → 회사 | **End Customer** (320, USER_DEFINED) · Primary (5) | 최종 고객사 — 거래당 1개 |
| 거래 → Contact | **End Customer** (4, USER_DEFINED — 기본 연결 3과 별개) | 최종 고객사 담당자 — 여러 명 |
| 거래 ↔ 거래 | **Opportunity** (322) / **Lead** (323) · 기본 451 | Lead 거래에서 본 새 Opportunity = "Opportunity" 라벨 |
| 거래 → Partner (2-267605328) | Partner User 164 · Sales Owner 332 · 🟢 Sales Manager 338 · 🟡 Sales Support Manager 340 | 파트너 측 담당자 역할 |
| 거래 → Partner Company (2-268293662) | Partner Company : Lead 217 / Opportunity 219 / Order 221 · Global Branch : Opportunity 324 / Lead 326 / Order 328 | 같은 이름이라도 거래 파이프라인별 라벨 ID가 다름 |

## 4. 거래 주문 워크플로 (2026-11-27 기준 켜짐)

| ID | 이름 | 역할 |
|---|---|---|
| 5495583421 | W1 Owner Branch · Buyer Type 지정 | 거래 소유자 확인 시 Owner Branch·Buyer Type 자동 (Opportunity 파이프라인) |
| 5500368620 | W1b Owner Branch 변경 → 구매자 초기화 | |
| 5495583422 | W2 Order Branch (판매 지사) 지정 | Owner Branch → 판매 지사 |
| 5495616225 | W2b 판매 지사 지정 - Buyer Type 변경 | |
| 5495616226 | W3 Order Branch Company 지정 | |
| 5495617220 | W4 주문 경로 판정 - Order Branch 변경 | |
| 5496107742 · 5500368625 | W4b 주문 경로 판정 - Order Type 변경 | ⚠️ 같은 이름 2개가 모두 켜져 있음 — 04 미결사항 참고 |
| 5496113872 | W4c 주문 경로 판정 - Buyer Type 변경 | |
| 5496107748 / 5495618247 | W4r / W4r2 매출 구분 | 주문 경로 / Sales Type 변경 시 Revenue Type |
| 5496107759 | W5 PriceBook 기본값 - ERP Order Branch 변경 | |
| 5495778032~35, 5496113874~77 | W6-{리전} 구매 회사·담당자 연결 | HQ·EU·US·IN·UK·JP·ME·LATAM |
| 5496115945~48, 5496293074~77 | W6c-{리전} 구매 회사 변경 → 담당자 초기화 | |
| 5496113878 / 5496115955 | W7 주문 경로 요약 - 라인 아이템 / W7b 0개 → 요약 해제 | |
| 5496880867 | W8 PriceBook 통화 동기화 | |
| 5496666862 | [회사] #Country 자동 지정 | 국가/지역 → #Country |

- 꺼둔 워크플로 : 11/24 구축분(A·B1~B4·WF-S), 리전별 파트너 옵션 동기화 16개, "🟡APP카드 대체 - 사용안함" 표시 워크플로 등 — 앱카드가 대체함.
- 워크플로 게시·켜기는 사용자가 직접 진행(정책).

## 5. 레코드 레이아웃 (거래)

- **기본 보기** : 할당되지 않은 모든 팀·사용자
- **Global Branch - Sales User** (layout 885334764) : 30여 개 팀 할당. 현재 테스트용으로 신규 카드 전부 배치
  - 첫 탭(✅ Opportunity Info) 상단 : Convert to Opportunity → End Customer
  - 오른쪽 사이드바 상단 : End Customer · Sidebar → Convert · Sidebar → Order Summary → Line Items → Buyer → Order Route · ERP
- 결정 : 카드 개발 완료 후 **팀별 화면 설정(HQ 보기 포함)을 별도로 진행**. HQ 보기는 기본 보기를 복제해 만들 예정.

## 6. 팀·권한

- 팀 구조 : Sales Global 아래 APAC·EU·IN·JP·KBS·LATAM·ME·UK (각 Admin/Leader·Sales), Suprema Admin, HubSpot Partner, Suprema MKT 등
- 리전 판정 : 팀 이름 앞부분(예 "APAC - Sales" → APAC)
- 앱 설정에서 관리하는 권한 : 주문 경로 속성 수정 허용 팀, Owner Branch 수정 허용 팀(현재 Suprema Admin · HubSpot Partner)

## 7. 앱 설정 저장소 (HubDB)

| 테이블 | 키 | 내용 |
|---|---|---|
| suprema_order_card_settings | route_editor_team_ids | 주문 경로 속성 수정 허용 팀 |
| | owner_branch_team_ids | Owner Branch 수정 허용 팀 |
| | order_setup_field_rules | Order Setup 속성 분류(edit · lock · team · auto) |
| | convert_opp_settings | 영업기회 전환 카드 설정(JSON) |
| suprema_order_setup_guide | 섹션별 행 | Order Setup "주문 가이드 보기" 패널 문구 (GUIDE_VERSION으로 자동 동기화) |

## 8. 기타 CRM 정책 (요약)

- Owner : Deal Owner = 슈프리마 내부 담당자, 파트너 측은 Partner(Sales Owner 라벨)
- Partner Company 상태 : Active = Is Orderable true + VAT ID 있음
- 회사 Recommended Team(recommended_team) : #Country 기반 팀 배정 (APAC·ME·LATAM·UK·US·IN·JP·EU·KBS·Etc)
- 다중 통화 사용(GBP·CNY 추가)
