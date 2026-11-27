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

## 결정 필요
1. Order 생성 시 Opportunity 단계 자동 변경 여부(현재 변경 안 함)
2. 검토 승인 권한 규칙(현재 팀 이름 기준 임시) — 실제 Leader 팀 확정 필요
3. PI PDF 생성 방식(견적 · 문서 템플릿)
4. Order 파이프라인 단계 수동 변경 제한(파이프라인 설정에서 편집 권한 제한 권장)
