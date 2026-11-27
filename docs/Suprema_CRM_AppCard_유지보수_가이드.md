# Suprema HubSpot CRM · 앱카드 유지보수 가이드 (통합본)

> 이 파일은 docs/00~04 문서를 하나로 합친 Breeze 지식 보관소용 통합본입니다. 기준일 2026-11-27.

---

# Suprema HubSpot CRM · 앱카드 유지보수 개요

> 기준일 : 2026-11-27 · 작성 : HelloDigital (Claude 작업 기록 기반)
> 이 문서 묶음은 Breeze(HubSpot AI)와 유지보수 담당자가 **현재 구성·유지보수 대상·운영 방법**을 정확히 답할 수 있도록 만든 기준 문서입니다.
> 문서가 서로 다르면 **번호가 큰 문서의 최신 날짜 기록**과 **GitHub 저장소 코드**가 우선합니다.

## 1. 한눈에 보기

| 항목 | 값 |
|---|---|
| 고객사 | 슈프리마(Suprema) — 세일즈포스 CRM·파트너 커뮤니티를 HubSpot으로 전환 |
| 구축·유지보수 | HelloDigital, Inc. (https://hellodigital.kr) |
| HubSpot 포털 | 245822501 (데이터 센터 na2, `app-na2.hubspot.com`) · Enterprise |
| 앱 | **Suprema Order - HelloDigital** (앱 ID 63902917, 비공개 · 정적 토큰) |
| 개발자 프로젝트 | `suprema-order-cards` · 플랫폼 2026.09 |
| 코드 저장소 | GitHub `sungwoo-del/suprema-order-cards` (비공개, `main` 브랜치 = 운영) |
| 배포 | `main`에 push → GitHub Actions 업로드 → HubSpot 빌드 → 자동 배포 (1~2분) |
| 설계 자료 | Figma `m3vOyx5PAhbexSC3kpHMyd` (UI Kit · 와이어프레임 페이지 00~07) |

## 2. 문서 목록

| 문서 | 내용 | 이런 질문에 |
|---|---|---|
| 00_유지보수_개요 | 전체 구조, 질문 가이드 | "무엇을 유지보수하나요?" |
| 01_CRM_설정 | 파이프라인·속성·연결 라벨·워크플로·레이아웃·팀 | "Order Route는 어떻게 정해지나요?", "W4는 무슨 일을 하나요?" |
| 02_앱카드_명세 | 카드 9종 + 설정 페이지의 기능·규칙·서버 함수 | "End Customer 카드는 몇 개까지 연결되나요?" |
| 03_배포_운영 | 배포·버전·권한·장애 대응 절차 | "카드가 안 바뀌어요", "배포는 어떻게 하나요?" |
| 04_변경이력_미결사항 | 날짜별 변경, 미결/확인 필요 사항, 테스트 레코드 | "최근 무엇이 바뀌었나요?", "남은 이슈는?" |

## 3. 시스템 구조

```
[Suprema 사용자 (HubSpot)] ── 거래(Deal) 레코드 화면
   ├─ 가운데 컬럼 : Order Setup · End Customer · Convert to Opportunity (앱카드)
   ├─ 오른쪽 사이드바 : Order Summary · Line Items · Buyer · Order Route·ERP · End Customer(간략) · Convert(간략)
   └─ 워크플로 W1~W8 : 주문 경로·판매 지사·가격표 등 자동 계산
[앱 서버 함수 (app-function)] ── HubSpot API 호출 (정적 토큰)
   ├─ order_setup · buyer_picker · route_editor · sidebar_cards · end_customer · convert_opp
   └─ 설정 저장 : HubDB 테이블 suprema_order_card_settings / 가이드 : suprema_order_setup_guide
[파트너 포털] ── 별도 구축(파트너사 사용자) · ERP(UniERP 본사 / D365 해외지사) 연동은 별도 범위
```

## 4. 유지보수 대상 (범위)

1. **앱카드·설정 페이지 코드** (GitHub 저장소) — 버그 수정, 문구·규칙 변경, 버전 관리
2. **앱 서버 함수** — HubSpot API 변경 대응, 권한(scope) 관리
3. **CRM 구성** — 거래 파이프라인, 주문 관련 속성, 연결 라벨, 주문 워크플로(W1~W8), 레코드 레이아웃
4. **앱 설정 값** (HubDB) — 수정 허용 팀, 속성 분류 규칙, 영업기회 전환 설정, 주문 가이드 문구
5. **데이터 품질 점검** — 주문 불가 파트너(Is Orderable), VAT ID 누락, 통화 누락 라인아이템 등

## 5. Breeze 질문 가이드 (예시)

- "Order Setup 카드에서 라인아이템이 있을 때 Order Type을 바꾸면 어떻게 되나요?"
- "End Customer 라벨 정책과 저장 규칙을 알려줘"
- "영업기회 전환 카드가 복사하는 항목과 라벨 변환 규칙은?"
- "앱카드 배포 절차와 장애 시 확인 순서는?"
- "현재 켜져 있는 거래 주문 워크플로 목록과 역할은?"
- "미결 사항과 확인 필요한 데이터 이슈는?"

## 6. 공통 원칙 (모든 카드)

- 문구 언어 : HubSpot UI 언어가 **한국어일 때만 한국어**, 그 외 영어("(한글)" 괄호 표기 제거)
- 라벨 표기 : "영문(한글)" 형식 · 안내 문구 형식 : "~없습니다 / ~불가합니다 / 필요한 조치 : ~하세요."
- 브랜딩 : 앱 이름 "{앱명} - HelloDigital", 지원/문서 URL https://hellodigital.kr, 카드 설명 끝 "(Update : YYYY-MM-DD / Ver.NN Beta)"
- 정식 오픈 전까지 **Beta** 표기 유지 (각 Shared 파일의 `*_STAGE` 상수를 `''`로 바꾸면 사라짐)

---

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

---

# 02. 앱카드 명세 — Suprema Order - HelloDigital

> 기준일 2026-11-27. 코드 위치는 GitHub `sungwoo-del/suprema-order-cards`의 `src/app/` 기준.
> 모든 카드는 **거래(Deal)** 레코드용. 서버 함수는 정적 토큰으로 HubSpot API 호출, 포털 245822501이 아니면 거부.

## 카드 목록

| 카드 (화면 이름) | uid | 위치 | 파일 | 서버 함수 | 버전 상수 |
|---|---|---|---|---|---|
| Order Setup (주문 설정) | order_setup_card | 가운데 컬럼 | cards/OrderSetup.tsx | order_setup (functions/orderSetup.js) | CARD_VERSION |
| Order Summary (주문 요약) | order_summary_card | 사이드바 | cards/OrderSummary.tsx | sidebar_cards (functions/sidebar.js) `summary` | SIDEBAR_VERSION |
| Line Items (라인아이템) | line_items_summary_card | 사이드바 | cards/LineItemsSummary.tsx | sidebar_cards `lineitems` | SIDEBAR_VERSION |
| Buyer (구매자) | buyer_info_card | 사이드바 | cards/BuyerInfo.tsx | sidebar_cards `buyer` | SIDEBAR_VERSION |
| Order Route · ERP (주문 경로 · ERP) | route_erp_card | 사이드바 | cards/RouteErp.tsx | sidebar_cards `route` | SIDEBAR_VERSION |
| End Customer (최종 고객사) | end_customer_card | 가운데 컬럼 | cards/EndCustomer.tsx | end_customer (functions/endCustomer.js) | EC_VERSION |
| End Customer (최종 고객사) · Sidebar | end_customer_side_card | 사이드바 | cards/EndCustomerSide.tsx | end_customer | EC_VERSION |
| Convert to Opportunity (영업기회 전환) | convert_opp_card | 가운데 컬럼 | cards/ConvertOpp.tsx | convert_opp (functions/convertOpp.js) | CV_VERSION |
| Convert to Opportunity · Sidebar | convert_opp_side_card | 사이드바 | cards/ConvertOppSide.tsx | convert_opp | CV_VERSION |
| (구) Buyer Picker · Order Route Info | buyer_picker_card · route_info_card | 가운데 | BuyerPicker.tsx · RouteInfo.tsx | buyer_picker · route_editor | — Order Setup으로 대체, Order Info 탭에서 제거됨 |
| 앱 설정 페이지 | suprema_order_cards_settings | 앱 설정 | settings/SettingsPage.tsx | route_editor · order_setup · convert_opp | — |

---

## 1. Order Setup (주문 설정) — 가운데 컬럼

**목적** : 구매자 · 주문 형태 · 가격표 · 주문 경로 · 배송을 한 카드에서 설정.

**구성**
- 진행 상태 : StepIndicator(기본 정보 · 구매자 · 주문 형태 · 가격표 · 라인아이템). 단계 이름 클릭 = 해당 그룹 펼치기/접기, 라인아이템 단계는 라인아이템 편집기로 이동
- 그룹(아코디언) : 기본 정보 / 구매자 / 주문 형태 / 가격표 / 주문 경로·ERP / 배송(선택). 그룹별 [취소][저장]
- 닫힌 그룹 제목 옆 요약 `[ … ]` 은 미저장 값·자동 반영 예정 값 미리보기 + "저장 시 반영 / 저장 시 초기화" 태그
- 처음 열 때 미입력 그룹만 펼침. 알림 박스는 오른쪽 ✕로 닫기
- 라인아이템 표 : 상품 · 수량 · 단가 · 할인율 · 금액 · 비고(remark, 30자)
- "주문 가이드 보기" : HubDB 가이드 패널

**속성 분류 규칙 (라인아이템 등록 후, 앱 설정에서 변경 가능)**
- edit(바로 저장) : buyer_contact · erp_sales_type · ship_to_address · requested_delivery_date
- lock(변경 시 라인아이템 초기화) : buyer_type · partner_region_select · buyer_company · order_type · pricebook_select
- team(허용 팀만 · 초기화) : order_route · selling_entity · revenue_type · erp_target
- auto(자동, 읽기 전용) : owning_entity(허용 팀은 수정 가능) · buying_branch · deal_currency_code

**서버 검증** : 가격표 'no' 저장 거부 / Dropship은 Partner 구매자만 / BSO는 Order Branch JP·ME만 / Owner Branch 변경 시 구매자·Order Branch 재지정 / ERP 지사 변경 시 가격표 최상단·통화 자동

## 2. 사이드바 4종 (읽기 전용)
- **Order Summary** : 주문 경로·진행 n/5·기본 정보·구매자·주문 형태·가격표·통화, 다음 단계 안내
- **Line Items** : 품목 수·합계·상위 5개, 편집기 링크, 빈 상태 안내
- **Buyer** : 구매 회사(VAT ID·Recommended Team·국가·주문 가능 여부) · 구매 담당자, HQ/Branch 구매 안내
- **Order Route · ERP** : 주문 경로 · ERP 대상 · ERP - Order Branch · 매출 구분 · 파이프라인 단계 세로 표시

## 3. End Customer (최종 고객사) — 가운데 + 사이드바

**규칙 (2026-11-27 확정)**
- 회사·담당자 모두 기존 **"End Customer"** 연결 라벨 사용
- **회사는 거래당 1개** (변경 시 기존 회사의 End Customer 라벨만 제거, 다른 연결은 유지)
- **담당자는 여러 명** (체크박스, 개별 연결 해제)
- 회사만 / 담당자만 / 둘 다 저장 가능

**회사 목록 필터** : 거래 소유자 팀 이름의 리전(예 APAC) = 회사 Recommended Team. 팀으로 못 찾으면 Owner Branch로 판단(HQ는 필터 없음 → 전체 + 안내). 검색어 없으면 최근 수정 순 20개, 있으면 관련도 순.

**담당자 목록** : 선택한 회사에 연결된 모든 Contact + 다른 회사에서 이미 연결된 End Customer 담당자("다른 회사에서 연결됨" 표시).

**신규 생성 (카드 안 폼)**
- 회사 : 회사명*, 웹사이트(도메인), #Country*, Industry — 같은 도메인 회사가 있으면 새로 만들지 않고 기존 회사 선택
- 담당자 : 이름*, 성, 이메일*, 직책(jobtitle), 직무(job_function) — 같은 이메일이 있으면 기존 담당자를 선택하고 회사 연결만 추가. 새 담당자는 선택한 회사와 Primary로 연결

**요약 표시**
- 회사 : #Country · Industry · Lifecycle Stage · Website · Recommended Team · Owner
- 담당자 : Email · Job title(직책) · Job function(직무) · Phone. 이름이 `*`로 가려진 경우 이메일을 이름으로 표시
- 바로가기 : [미리보기] = HubSpot 미리보기 패널(CrmActionButton PREVIEW_OBJECT), [새 탭 ↗] = 레코드 새 탭

**사이드바 간략버전** : 회사 요약 + 담당자 목록(이름 클릭 = 미리보기, ↗ = 새 탭). 선택·변경·추가·신규 생성은 오른쪽 Panel에서.

**서버 액션** (end_customer) : load · search · contacts · save · unlink · createCompany · createContact
- 라벨 ID는 이름("End Customer")으로 런타임 조회 → 라벨 ID가 바뀌어도 동작
- 저장·연결 해제 후 거래의 hd_card_sync 기록 → 다른 카드 자동 새로고침

## 4. Convert to Opportunity (영업기회 전환) — 가운데 + 사이드바

**표시 조건** : 거래 파이프라인 = 설정의 Lead 파이프라인(기본 Leads (Partner)). 활성 단계(기본 Converted (Opp Created))에 있을 때만 [Opportunity 생성] 버튼. 단계·파이프라인·소유자 변경 시 즉시 다시 읽음.

**생성 전 미리보기** : ① 복사할 속성(Lead 값) ② 복사할 연결과 라벨 ③ 활동 기록 건수(전체 기간) + 라인아이템 개수.

**확인 창** : Deal name(수정 가능) · Close date(Lead 마감일이 지났거나 없으면 오늘+90일 제안) · 생성 위치(파이프라인·단계).

**생성 시 처리 순서**
1. 새 거래 생성 : 설정의 복사 속성 + Deal owner(항상) + 생성 파이프라인·단계
2. 원본 Lead ↔ 새 Opportunity 연결 ("Opportunity" 라벨, 중복 생성 방지 기준)
3. 연결 복사 : 회사 · Contact · Partner · Partner Company — 같은 라벨 유지, **Lead 전용 라벨 변환** : Partner Company 217→219, Global Branch 326→324
4. 라인아이템 복사(설정 ON 시) : 새 라인아이템으로 생성(name, 상품, 수량, 단가, 할인, SKU, 통화, remark 등)
5. 활동 기록 공유(설정 ON 시) : 노트·이메일·통화·미팅·작업·커뮤니케이션·우편을 **복제 없이** 새 거래에도 연결(전체 기간)
6. 완료 화면 : 새 Opportunity 바로가기 + 복사 결과(일부 실패 시 [활동 다시 연결])

**제약** : Deal owner 없으면 생성 불가 / 이미 만든 Opportunity가 있으면 다시 생성 불가 / 활성 단계가 아니면 서버에서도 거부.

**설정(앱 설정 페이지 "영업기회 전환 카드")** : Lead 파이프라인 · 활성 단계(여러 개) · 생성 파이프라인 · 생성 단계 · 복사할 속성(거래 속성 목록에서 선택, Deal owner 고정) · 라인아이템 복사 ON/OFF · 활동 공유 ON/OFF. HubDB `convert_opp_settings`에 저장.

**사이드바 간략버전** : 전환 상태(현재 단계 / 전환 가능 / 생성됨)와 생성된 Opportunity 바로가기. 생성은 가운데 카드에서.

## 5. 앱 설정 페이지
1. 주문 경로 속성 수정 권한(허용 팀)
2. Owner Branch 수정 권한(허용 팀)
3. Order Setup 카드 속성 분류(edit/lock/team/auto)
4. 영업기회 전환 카드 설정

## 6. 공통 구현 메모 (UI Extensions 제약)
- Text 색상 지정 불가 · Alert 닫기 버튼 없음(✕는 상자 바깥 오른쪽 Link) · Flex/Box에 onClick 없음(Link로 처리) · 스크롤 API·브라우저 저장소 없음
- 카드 간 즉시 동기화 : 저장 → 서버가 hd_card_sync 기록 → 카드가 refreshObjectProperties 호출 → 다른 카드의 onCrmPropertiesUpdate(['hd_card_sync'])가 다시 읽음
- 업로드 직후 HubSpot이 이전 번들을 캐시로 보여줄 수 있음 → 페이지를 한 번 더 새로고침

---

# 03. 배포 · 운영 · 장애 대응

## 1. 배포 방식 (2026-11-27부터)

```
코드 수정 → ./bump.sh (카드 버전 +1, 날짜) → git push origin main
→ GitHub Actions "HubSpot project upload" (.github/workflows/hubspot-deploy.yml)
→ HubSpot 빌드 → "성공적인 빌드 자동 배포" ON → 운영 반영 (보통 1~2분)
```

- 저장소 : https://github.com/sungwoo-del/suprema-order-cards (비공개)
- GitHub Secrets : `HUBSPOT_ACCOUNT_ID`(245822501) · `HUBSPOT_PERSONAL_ACCESS_KEY`(HubSpot 개인 액세스 키). 키가 만료·재발급되면 Secrets 값을 갱신해야 배포됨
- 수동 재실행 : GitHub → Actions → HubSpot project upload → Run workflow
- 확인 : HubSpot 개발 → 프로젝트 → suprema-order-cards → 빌드 및 배포 (빌드 번호, 성공 여부)
- 이전 방식(맥 터미널 `./deploy.sh`, 로컬 `~/Documents/suprema-order-cards`)은 **사용 중지**. 로컬 폴더는 2026-11-27 18:52 상태로 멈춰 있음

## 2. 버전 표기
- `bump.sh`가 4개 상수를 함께 올림 : CARD_VERSION(Order Setup) · SIDEBAR_VERSION(사이드바 4종) · EC_VERSION(End Customer) · CV_VERSION(영업기회 전환)
- 카드 설명 끝 "(Update : 날짜 / Ver.NN Beta)"로 표시 → 운영 화면의 버전으로 배포 반영 여부 확인
- 2026-11-27 최종 : Order Setup Ver.12 · 사이드바 Ver.05 · End Customer Ver.03 · 영업기회 전환 Ver.03 (빌드 #40 전후)

## 3. 앱 권한(scope) — app-hsmeta.json
deals 읽기/쓰기 · custom objects 읽기/쓰기 · deals schema · companies/contacts 읽기/쓰기 · companies/contacts schema 읽기 · owners 읽기 · teams 읽기 · HubDB 테이블/행 · line_items 읽기/쓰기 · sales-email-read
- scope를 추가하면 배포 후 **설치 권한 재승인 필요** : https://app-na2.hubspot.com/static-token/245822501/authorize?appId=63902917 (관리자 계정으로 승인)
- 승인 전 증상 : 카드에 `HubSpot API 403 … requires …-read`

## 4. 장애 대응 체크리스트

| 증상 | 확인 순서 |
|---|---|
| 카드가 예전 버전으로 보임 | 카드 설명의 Ver. 확인 → 페이지 새로고침 1~2회(번들 캐시) → GitHub Actions 성공 여부 → HubSpot 빌드 성공/자동 배포 여부 |
| 카드에 403 오류 | 새 scope 미승인 → 위 승인 링크 |
| 카드에 "연결 라벨이 없습니다" | 거래↔회사/Contact "End Customer" 또는 거래↔거래 "Opportunity" 라벨이 삭제·이름 변경됨 → 연결 설정에서 같은 이름으로 복구 |
| 영업기회 전환 버튼이 안 보임 | 파이프라인·단계가 앱 설정의 Lead 파이프라인·활성 단계와 맞는지 / 이미 생성된 Opportunity가 있는지 / Deal owner 존재 |
| 전환 후 Partner Company 라벨 누락 | Lead 쪽 라벨 ID 확인(217·326 → 219·324 변환표, convertOpp.js LABEL_MAP) |
| 카드 간 내용이 바로 안 맞음 | hd_card_sync 속성 존재 확인, [새로고침] 링크 |
| 배포 실패 (Actions 빨간색) | Secrets 값(개인 액세스 키 만료) · hsmeta JSON 문법 · 빌드 로그 |
| 주문 값 자동 계산이 이상함 | 01_CRM_설정의 W1~W8 워크플로 켜짐 여부, 중복 W4b |

## 5. 테스트 방법 (운영 포털에서 진행)
- 테스트 거래는 이름에 `[TEST] … (HelloDigital)` 표시
- 테스트 레이아웃 : Global Branch - Sales User (모든 신규 카드 배치됨)
- 내부 API 확인 : 브라우저(로그인 상태)에서 `/api/crm/v4/objects/deals/{id}/associations/{type}?portalId=245822501`로 연결 라벨 검증 가능

## 6. 설계 자료
- Figma m3vOyx5PAhbexSC3kpHMyd : 01 Foundations · 02 Components · 03 Sample Wireframes · 04 Order Setup · 05 Right Column · **06 End Customer** · **07 Lead → Opportunity**

---

# 04. 변경 이력 · 미결 사항 · 테스트 레코드

## 1. 변경 이력 (최신이 위)

### 2026-11-27
- **배포 방식 변경** : 맥 터미널 deploy.sh → GitHub 비공개 저장소 + GitHub Actions 자동 배포 (빌드 #39부터)
- **Leads (Partner) 「Converted (Opp Created)」** : 성사(확률 100%) → **열린 단계(90%)** 로 변경
- 거래 속성 `hd_card_sync` 생성 (앱카드 간 즉시 새로고침용 시스템 값)
- **영업기회 전환 카드** 신규 (가운데 + 사이드바) · 앱 설정에 "영업기회 전환 카드" 섹션 추가
- **End Customer 카드** 신규 (가운데 + 사이드바) — 회사 1개 / 담당자 여러 명 / "End Customer" 라벨 공통
- End Customer 사용성 개선 : 담당자 추가 시 회사 검색 목록 자동 펼침 제거, 마스킹 이름(*)은 이메일 표시, 검색 기본 정렬 최근 수정 순, 담당자 요약 항목 = 이메일·직책·직무·전화
- 영업기회 전환 개선 : 금액 천 단위, 오너 이름 "성 이름"(한국어 UI), 마감일 제안(지났으면 +90일), 결과 표시 정리
- 사이드바 4종(Order Summary · Line Items · Buyer · Order Route·ERP) 신규, Global Branch - Sales User 레이아웃 배치
- Order Setup : 가격표 정책(IN → HQ_ 가격표, "The Price Book cannot be applied." 선택 불가), 라인아이템 표 할인율·비고, 그룹 제목 전체 클릭, 미입력 그룹 기본 펼침, 알림 닫기, Beta/버전 표기
- 앱 이름 "Suprema Order - HelloDigital", 지원 URL hellodigital.kr

### 2026-11-26 이전 (요약)
- 거래 속성 라벨 정리(Owner Branch · Order Branch · Order Branch Company · ERP - Order Branch · Buyer Company/Contact - {리전})
- 주문 워크플로 W1~W8 신규 구성, 11/24 구축분(A·B1~B4·WF-S)과 리전별 옵션 동기화 워크플로 OFF
- Buyer Picker · Order Route Info 카드 → Order Setup 통합 카드로 대체

## 2. 미결 · 확인 필요

| # | 항목 | 상태 / 다음 조치 |
|---|---|---|
| 1 | 팀별 거래 화면(레이아웃) 정리 — HQ 보기 별도 생성, 신규 카드 배치 | 카드 개발 완료 후 별도 진행 (사용자 결정) |
| 2 | 워크플로 **W4b가 2개 켜져 있음** (5496107742, 5500368625) | 중복 실행 여부 확인 후 하나 OFF 권장 |
| 3 | 데이터 : IQ Trading Partner Company — Is Orderable 비어 있음/false, VAT ID 없음 | 슈프리마 데이터 확인 |
| 4 | 데이터 : WF-TEST COLLAB 라인아이템 통화 코드 없음 | 라인아이템 통화 지정 |
| 5 | 사이드바 카드 ⑤ Quick Actions · ⑥ Notices (피그마 예시) | 필요 시 개발 (현재 보류) |
| 6 | 영업기회 전환 : Lead 쪽 Partner Company 라벨 ID 고정표(217→219, 326→324) | 라벨 재생성 시 convertOpp.js LABEL_MAP 갱신 필요 |
| 7 | 맥 로컬 폴더 `~/Documents/suprema-order-cards` 는 더 이상 갱신 안 됨 | 필요 시 GitHub에서 새로 받기 |
| 8 | ERP 연동(UniERP·D365) · 파트너 포털 | 별도 범위 (이 문서 대상 아님) |

## 3. 테스트 레코드 (삭제 예정 — 삭제 전 사용자 확인)

| 레코드 | ID | 비고 |
|---|---|---|
| [TEST] Lead→Opp 전환 테스트 (HelloDigital) — Leads (Partner) | 376484065996 | Converted 단계(구 설정에서 성사 처리되어 마감일 2026-11-27로 변경됨) |
| [TEST] Lead→Opp 전환 테스트 (HelloDigital) — Opportunity | 376602577610 | 전환 카드로 생성됨 |
| [TEST] BioStation 3 라인아이템 · [TEST] 노트 | 372577258223 · 431251922643 | 테스트 Lead에 연결 |
| test11111 | 376486004452 | Order Setup 테스트 거래 |
| WF-TEST COLLAB | 376485950153 | 사이드바 테스트 거래 |
