# 06. Order 프로세스 · 주문 앱카드 (2026-11-27 Ver.01 Beta)

## 흐름
Opportunity(Order Confirm 4400078529) → [Create Order] → Order 파이프라인(2607290061)
PO Registration(4400056046) → Under Review(4400056047) → Order Processing(4400056048) → Order Confirming(4400056049) → Dispatched(4400056050) → Closed(4400056051) / Closed Lost(4400056052)

## 연결 라벨 (거래 ↔ 거래)
- 366 "Order" (Opportunity → Order) · 367 "Source Opportunity" (Order → Opportunity) — 11/27 생성
- 기존 322 "Opportunity" / 323 "Lead" (Lead ↔ Opportunity)

## 단계 진입 조건 (카드가 검사)
| 단계 | 조건 | 카드 동작 | 기록 속성 |
|---|---|---|---|
| PO Registration | Opp 단계 Order Confirm · Owner · 구매자 · 가격표 · 라인아이템 ≥1 · 단가 0 없음 | Create Order | pipeline=Order, pi_status=not_issued |
| Under Review | 위 조건(단계 제외) | 검토 요청 | order_review_status=pending |
| Order Processing | 검토 승인 (팀 이름에 Leader·admin·HubSpot Partner) | 승인 / 반려(의견 필수 → PO로 되돌림) | order_review_status · order_reviewed_by · order_review_note |
| Order Confirming | PI 발행 → 구매자 승인 | PI 발행 처리 · 구매자 승인 처리 | pi_status · confirmed_amount |
| Dispatched · Closed | ERP 회신 | (ERP I/F 개발 후 자동) | unierp/d365_if_status · *_so_no · shipment_status |

## 앱카드
- Create Order (create_order_card, 가운데) : Opportunity = 조건 체크/생성, Order = 원본 Opportunity
- Order Progress (order_progress_card, 가운데) · Sidebar (order_progress_side_card)
- 서버 함수 order_cards (functions/order.js)
- 복사 : 주문 속성 COPY_PROPS(소유자·금액·통화·주문 설정·리전별 구매자 등) · 라인아이템 · 연결(회사·담당자·Partner·Partner Company, 라벨 유지) · 활동 공유

## 신규 거래 속성 (11/27)
order_review_status (Pending/Approved/Rejected) · order_review_note · order_reviewed_by · pi_status (Not issued/Issued/Buyer approved)

## 결정 사항 (2026-11-27)
- Order 생성 시 원본 Opportunity → Closed Won 자동 변경 (order.js createOrder)
- 검토 승인 권한: 앱 설정 '주문 검토 승인 팀'(HubDB order_review_teams), 서버에서 사용자 팀을 검사. 현재 Suprema Admin, HubSpot Partner
- 워크플로 W2~W6c, W8: 시작 조건 '파이프라인 = Opportunity' 추가·게시. W7·W7b(라인 항목 트리거)는 제외
- PI: HubSpot 견적(CPQ Quote) + 견적 템플릿 'Suprema PI (Proforma Invoice)'(id 920511988410, 게시). 'PROFORMA INVOICE[Sample]'을 복제해 PI 샘플(Suprema_PI_sample.pdf)에 맞춤
  - 라인 항목 열: Product · Q'ty · Unit Price · Amount · H/S Code(sf_hscode) · Country Of Origin(sf_country_of_origin) · Remarks
  - 요약 · 결제 모듈 숨김, 세금 · 소계 할인 · 발효일 기한 행 숨김, 합계 = Total
  - 조건 모듈: 무역 조건 표(기본값 + 견적마다 입력) · Payment Information · Terms and Conditions. Account No.는 사용자가 직접 입력
  - 수락: 서명 없이 수락(Accept this Proforma Invoice) → 견적 상태 ACCEPTED
  - Order Progress 카드 [PI 견적서 만들기]: 초안 견적 생성(딜 · 첫 담당자 · 첫 회사 연결, 라인아이템 사본), 앱 설정에서 템플릿 변경 가능
  - 앱 범위 crm.objects.quotes.read/write 추가 → 앱 재승인 필요
- W4b 중복본 5500368625 게시 취소(원본 5496107742 유지)
- Order 단계 수동 변경 제한: 사용자가 추후 적용
- 기본·팀별 보기: 팀 화면 작업 때 적용

## 진행 기록 (2026-11-28)
- 견적서 권한 승인 완료, Order Progress 카드 [PI 견적서 만들기] 실제 생성 확인 (템플릿 연결 286 정상)
- 판매자(Sales Manager) = 거래 소유자 자동 입력 (없으면 사용자)
- PI 보는 곳 : Order 거래 → Order Progress 탭의 견적서 칸 / 거래 오른쪽 '견적' / 영업 → 견적. PDF · 구매자 링크는 견적서 게시 후 생성

