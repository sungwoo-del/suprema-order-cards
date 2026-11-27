// Order Setup (주문 설정) 통합 카드 서버 함수
// actions: load · save · reset · guide · rules_get · rules_save
// 모든 메시지는 사용자 UI 언어(lang: 'ko' | 'en')로 반환합니다. 한국어 UI일 때만 한국어, 그 외는 영어.

const BASE = 'https://api.hubapi.com';
const PORTAL_ID = 245822501;
const SETTINGS_TABLE = 'suprema_order_card_settings';
const GUIDE_TABLE = 'suprema_order_setup_guide';
const KEY_EDIT_TEAMS = 'route_editor_team_ids';
const KEY_FIELD_RULES = 'order_setup_field_rules';
const KEY_OWNER_TEAMS = 'owner_branch_team_ids'; // Owner Branch 수정 허용 팀
const REGIONS = ['hq', 'eu', 'uk', 'us', 'jp', 'in', 'me', 'latam'];
// Order Branch(partner_region_select) → 따라오는 값 (B 기준 : ERP - Order Branch = Order Branch)
const ORDER_BRANCH_TO_ERP = { APAC: 'hq', EU: 'eu', UK: 'uk', US: 'us', JP: 'jp', IN: 'in', ME: 'me', LATAM: 'latam' };
const ORDER_BRANCH_TO_COMPANY = {
  APAC: '357681836740', EU: '345937632976', UK: '349137378015', US: '349077939946',
  JP: '349116873465', IN: '349133792993', ME: '349123272425', LATAM: '345946381010',
};
const OWNER_TO_ORDER_BRANCH = { hq: 'APAC', eu: 'EU', uk: 'UK', us: 'US', jp: 'JP', in: 'IN', me: 'ME', latam: 'LATAM' };
// ERP - Order Branch → 가격표 접두어 (2026-11-27 정책 변경: IN은 자체 가격표가 없어 HQ 가격표 사용)
const PB_PREFIX = { hq: 'HQ_', eu: 'EU_', uk: 'UK_', us: 'US_', jp: 'JP_', in: 'HQ_', me: 'ME_', latam: 'LATAM_' };
// ERP - Order Branch 기준 가격표 기본값 = 해당 리전 접두어의 최상단 옵션 (없으면 HQ 최상단, 그것도 없으면 빈 값) — W5와 같은 규칙
const pbCurrency = (v) => { const m = /_([A-Z]{3})$/.exec(String(v || '')); return m ? m[1] : ''; };
function pbDefaults(options) {
  const sorted = (options || []).filter((o) => !o.hidden).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const out = {};
  for (const [erp, pre] of Object.entries(PB_PREFIX)) {
    const top = sorted.find((o) => String(o.value).startsWith(pre)) || sorted.find((o) => String(o.value).startsWith('HQ_'));
    const value = top ? String(top.value) : '';
    out[erp] = { value, currency: pbCurrency(value) };
  }
  return out;
}

// 그룹 · 필드 정의 (buyer_company / buyer_contact 는 Owner Branch 리전의 partner_{r} / partner_owner_{r})
const GROUPS = [
  { key: 'basics', fields: ['owning_entity', 'buyer_type', 'partner_region_select', 'buying_branch'] },
  { key: 'buyer', fields: ['buyer_company', 'buyer_contact'] },
  { key: 'order_type', fields: ['order_type', 'erp_sales_type'] },
  { key: 'price', fields: ['pricebook_select', 'deal_currency_code'] },
  { key: 'route', fields: ['order_route', 'selling_entity', 'revenue_type', 'erp_target'] },
  { key: 'delivery', fields: ['ship_to_address', 'requested_delivery_date'] },
];
// edit = 항상 편집 · lock = 라인아이템이 있으면 변경 시 초기화 · team = 허용 팀만 + 초기화 · auto = 읽기 전용
const DEFAULT_RULES = {
  owning_entity: 'auto', buying_branch: 'auto', deal_currency_code: 'auto',
  buyer_type: 'lock', partner_region_select: 'lock', buyer_company: 'lock', order_type: 'lock', pricebook_select: 'lock',
  buyer_contact: 'edit', erp_sales_type: 'edit', ship_to_address: 'edit', requested_delivery_date: 'edit',
  order_route: 'team', selling_entity: 'team', revenue_type: 'team', erp_target: 'team',
};
// owner = Owner Branch (허용 팀만 수정, 변경 시 구매자 초기화 + 라인아이템 초기화)
const RESET_CLASSES = ['lock', 'team', 'owner'];

const M = (lang, en, ko) => (lang === 'ko' ? ko : en);
// 영어 UI에서는 "(한글)" 괄호 표기를 지웁니다.
const loc = (lang, s) => {
  if (lang === 'ko' || !s) return s;
  const out = String(s).replace(/\s*\([^)]*[가-힣][^)]*\)/g, '').replace(/\s+-\s+사용안함/g, '').trim();
  return out || s;
};

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.PRIVATE_APP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { message: text }; }
  if (!res.ok) {
    const err = new Error(`HubSpot API ${res.status}: ${data.message || text}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------- HubDB ----------
async function tableExists(name) {
  try { await api(`/cms/v3/hubdb/tables/${name}/draft`); return true; } catch (e) { if (e.status === 404) return false; throw e; }
}
async function readRows(table) {
  try {
    const data = await api(`/cms/v3/hubdb/tables/${table}/rows/draft?limit=500`);
    return data.results || [];
  } catch (e) { if (e.status === 404) return []; throw e; }
}
async function readSetting(key) {
  const row = (await readRows(SETTINGS_TABLE)).find((r) => r.values && r.values.setting_key === key);
  return row ? { id: row.id, value: row.values.setting_value } : null;
}
async function writeSetting(key, value) {
  if (!(await tableExists(SETTINGS_TABLE))) {
    await api('/cms/v3/hubdb/tables', { method: 'POST', body: {
      name: SETTINGS_TABLE, label: 'Suprema Order Cards - Settings', useForPages: false, allowPublicApiAccess: false,
      columns: [{ name: 'setting_key', label: 'Setting Key', type: 'TEXT' }, { name: 'setting_value', label: 'Setting Value', type: 'TEXT' }],
    } });
  }
  const cur = await readSetting(key);
  const values = { setting_key: key, setting_value: value };
  if (cur) await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/rows/${cur.id}/draft`, { method: 'PATCH', body: { values } });
  else await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/rows`, { method: 'POST', body: { values } });
  await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/draft/publish`, { method: 'POST' });
}
async function getRules() {
  const s = await readSetting(KEY_FIELD_RULES).catch(() => null);
  let custom = {};
  if (s && s.value) { try { custom = JSON.parse(s.value); } catch (e) { custom = {}; } }
  const rules = { ...DEFAULT_RULES };
  for (const [k, v] of Object.entries(custom)) if (k in rules && ['edit', 'lock', 'team', 'auto'].includes(v)) rules[k] = v;
  return rules;
}

// ---------- 주문 가이드 (HubDB: suprema_order_setup_guide) ----------
// 행 1개 = 가이드 섹션 1개(또는 주문 경로 1개). body_* 는 줄바꿈으로 항목을 나눕니다.
// section: flow · basics · buyer · order_type · route · route_case · price · line_items · delivery · permission · faq
// topic  : route_case 행은 order_route 옵션 값(case1_branch_to_hq …)
const GUIDE_SEED = [
  { section: 'flow', topic: '', sort_order: 10, applies_to: 'all',
    title_en: 'Setup order', title_ko: '설정 순서',
    body_en: '1. Basics: Choose Buyer Type. Owner Branch and Order Branch are set automatically.\n2. Buyer: If Buyer Type is Partner, choose the buyer company and buyer contact.\n3. Order Type: Check Order Type (default Standard) and Sales Type (default Normal).\n4. Price Book: Choose a price book of the Owner Branch. The currency is set automatically.\n5. Line Items: Add line items after the price book is set.\nAfter you save, workflows calculate Order Route, ERP Target and Revenue Type. Click Refresh after a few seconds to see the result.',
    body_ko: '1. 기본 정보 : Buyer Type을 선택합니다. Owner Branch와 Order Branch는 자동 지정됩니다.\n2. 구매자 : Buyer Type이 Partner이면 구매 회사와 구매 담당자를 선택합니다.\n3. 주문 형태 : Order Type(기본 Standard)과 Sales Type(기본 Normal)을 확인합니다.\n4. 가격표 : Owner Branch의 가격표를 선택합니다. 통화는 자동 지정됩니다.\n5. 라인아이템 : 가격표를 지정한 뒤 라인아이템을 등록합니다.\n저장하면 워크플로가 주문 경로 · ERP 대상 · 매출 구분을 자동 판정합니다. 몇 초 뒤 [새로고침]으로 결과를 확인합니다.' },
  { section: 'basics', topic: '', sort_order: 20, applies_to: 'all',
    title_en: 'Basics', title_ko: '기본 정보',
    body_en: "Owner Branch: Set automatically from the deal owner's team (Opportunity pipeline). If it is empty, assign a deal owner who belongs to a region team.\nBuyer Type: Partner = a partner buys / HQ/Branch = a branch buys from HQ (intercompany, CASE1). Required when registering a deal.\nOrder Branch: Set to the Owner Branch when Buyer Type is Partner, and to HQ (APAC) when it is HQ/Branch. Change it only when selling to a partner of another region. Changing it clears the selected buyer company and contact.\nOrder Branch Company: Set automatically to the legal entity of the Order Branch (read-only).",
    body_ko: 'Owner Branch : 거래 소유자의 팀 기준으로 자동 지정됩니다(Opportunity 파이프라인). 값이 없으면 리전 팀 소속 거래 소유자를 지정하세요.\nBuyer Type : Partner = 파트너가 구매 / HQ/Branch = 지사가 본사에서 구매(법인 간 거래, CASE1). 거래 등록 시 필수입니다.\nOrder Branch : Buyer Type이 Partner이면 Owner Branch와 같게, HQ/Branch이면 HQ(APAC)로 자동 지정됩니다. 다른 리전 파트너에게 판매할 때만 직접 변경하세요. 변경하면 선택한 구매 회사 · 구매 담당자가 초기화됩니다.\nOrder Branch Company : 판매 지사의 법인으로 자동 지정됩니다(읽기 전용).' },
  { section: 'buyer', topic: '', sort_order: 30, applies_to: 'all',
    title_en: 'Buyer', title_ko: '구매자',
    body_en: "Enter the buyer only when Buyer Type is Partner. For HQ/Branch, the buyer is the Owner Branch's legal entity, so this group is hidden.\nThe company list shows Partner Companies of the Owner Branch region. The number in brackets is the count of linked partner contacts.\nIf a company is missing, check its Recommended Team (region) on the Partner Company record.\nChoose the buyer contact from the Partner Contacts linked to the company. If the count is 0, create and link a Partner Contact first.\nThe buyer contact can be changed even after line items are added. Changing the buyer company resets the line items.\nThe deal is associated with the buyer records later, at the order stage after line items are added.",
    body_ko: 'Buyer Type이 Partner일 때만 입력합니다. HQ/Branch이면 구매자는 Owner Branch 지사 법인이므로 이 그룹은 숨겨집니다.\n구매 회사 목록은 Owner Branch 리전의 Partner Company이며, 괄호 안 숫자는 연결된 파트너 담당자 수입니다.\n원하는 회사가 없으면 Partner Company 레코드의 Recommended Team(리전) 값을 확인하세요.\n구매 담당자는 선택한 회사에 연결된 Partner Contact 중에서 고릅니다. 담당자 수가 0이면 먼저 Partner Contact를 등록 · 연결하세요.\n구매 담당자는 라인아이템 등록 후에도 변경할 수 있습니다. 구매 회사를 변경하면 라인아이템이 초기화됩니다.\n거래와 구매자 레코드의 연결은 라인아이템 등록 이후 주문 단계에서 진행됩니다.' },
  { section: 'order_type', topic: '', sort_order: 40, applies_to: 'all',
    title_en: 'Order Type · Sales Type', title_ko: '주문 형태 · 판매 유형',
    body_en: 'Standard: Regular order. HQ → CASE2, branch → CASE3 (CASE1 when Buyer Type is HQ/Branch).\nDropship: A branch ships directly to the end customer → CASE4. Always enter the Ship-to Address (end customer address).\nBSO (blanket order): A term contract order → CASE5. Used by the ME and JP branches only.\nSales Type: Normal · Repair(Sales) · Repair(Non-Sales) · 약정무상 (committed free) · Sample. Only Suprema staff enter Repair types.\nSample, Repair(Non-Sales) and 약정무상 are excluded from revenue reports.\nA paid sample is processed as a Normal order with discount approval.',
    body_ko: 'Standard(일반) : 일반 주문입니다. 본사 → CASE2, 지사 → CASE3 (Buyer Type이 HQ/Branch이면 CASE1).\nDropship(3자거래) : 지사가 최종 고객사로 직접 배송하는 거래 → CASE4. 배송지(최종 고객사 주소)를 반드시 입력하세요.\nBSO(블랭킷 오더) : 기간 계약 주문 → CASE5. ME · JP 지사만 사용합니다.\nSales Type : Normal(일반) · Repair(Sales)(유상 수리) · Repair(Non-Sales)(무상 수리) · 약정무상 · Sample. Repair 유형은 슈프리마 담당자만 입력합니다.\nSample · Repair(Non-Sales) · 약정무상은 매출 리포트에서 제외됩니다.\n유상 Sample은 Normal 주문으로 할인 승인을 받아 진행합니다.' },
  { section: 'route', topic: '', sort_order: 50, applies_to: 'all',
    title_en: 'Order Route · ERP', title_ko: '주문 경로 · ERP',
    body_en: 'Workflows decide the order route from Owner Branch, Buyer Type and Order Type. Only teams allowed in the app settings can change it manually.\nDecision order: Owner Branch HQ → CASE2 / Order Type BSO → CASE5 / Dropship → CASE4 / Buyer Type HQ/Branch → CASE1 / otherwise → CASE3.\nERP - Order Branch: CASE1 · 2 = HQ, CASE3 · 4 · 5 = the branch.\nRevenue Type: CASE1 and the HQ-linked order of CASE4 = Intercompany, others = External. Intercompany is excluded from group revenue reports.',
    body_ko: '주문 경로는 워크플로가 Owner Branch · Buyer Type · Order Type 기준으로 자동 판정합니다. 앱 설정에서 허용된 팀만 직접 수정할 수 있습니다.\n판정 순서 : Owner Branch HQ → CASE2 / Order Type BSO → CASE5 / Dropship → CASE4 / Buyer Type HQ/Branch → CASE1 / 그 외 → CASE3\nERP - Order Branch : CASE1 · 2 = HQ, CASE3 · 4 · 5 = 지사\nRevenue Type : CASE1 · CASE4 본사 연동 주문 = Intercompany, 그 외 = External. Intercompany는 그룹 매출 리포트에서 제외됩니다.' },
  { section: 'route_case', topic: 'case1_branch_to_hq', sort_order: 51, applies_to: 'all',
    title_en: 'CASE1 Branch → HQ', title_ko: 'CASE1 해외법인 → 본사',
    body_en: 'A branch buys from HQ. HQ approves and creates the PI → the branch approves the PI → UniERP SO + D365 PO are created.\nDefault currency is USD. Only CASE1 has a goods receipt step.\nExcluded from group revenue reports (intercompany).',
    body_ko: '지사가 본사에서 구매합니다. 본사 승인 · PI 생성 → 지사 PI 승인 → UniERP SO + D365 PO가 생성됩니다.\n기본 통화는 USD이며, 입고 단계는 CASE1에만 있습니다.\n법인 간 거래로 그룹 매출 리포트에서 제외됩니다.' },
  { section: 'route_case', topic: 'case2_hq_partner', sort_order: 52, applies_to: 'all',
    title_en: 'CASE2 HQ partner → HQ', title_ko: 'CASE2 본사 파트너 → 본사',
    body_en: 'Credit is checked in real time when the owner approves → PI → the partner approves the PI in the Partner Portal → UniERP SO.\nThe partner can view order, shipment, BL, serial, invoice and SOA in the portal.',
    body_ko: '담당자 승인 시 여신을 실시간 체크 → PI → 파트너가 Partner Portal에서 PI 승인 → UniERP SO가 생성됩니다.\n파트너는 포털에서 주문 · 출고 · BL · Serial · Invoice · SOA를 조회합니다.' },
  { section: 'route_case', topic: 'case3_branch_partner', sort_order: 53, applies_to: 'all',
    title_en: 'CASE3 Branch partner → branch', title_ko: 'CASE3 해외 파트너 → 해외법인',
    body_en: 'The branch approves → PI → the partner approves the PI → D365 SO.\nA D365 SO can’t be deleted, so cancellations are managed by status.',
    body_ko: '지사 승인 → PI → 파트너 PI 승인 → D365 SO가 생성됩니다.\nD365 SO는 삭제할 수 없어 취소는 상태로 관리합니다.' },
  { section: 'route_case', topic: 'case4_dropship', sort_order: 54, applies_to: 'all',
    title_en: 'CASE4 Dropship', title_ko: 'CASE4 3자거래 (Dropship)',
    body_en: 'When the branch approves the PI, a D365 SO (ship-to: end customer) and a D365 PO are created → an HQ-linked order is created automatically → HQ approves → UniERP SO.\nBill-to is the branch, ship-to is the end customer. Enter the end customer address in Ship-to Address.',
    body_ko: '지사 PI 승인 시 D365 SO(Ship-to 최종 고객사) + D365 PO 생성 → 본사 연동 주문 자동 생성 → 본사 승인 → UniERP SO가 생성됩니다.\nBill-to는 해외지사, Ship-to는 최종 고객사입니다. 배송지에 최종 고객사 주소를 입력하세요.' },
  { section: 'route_case', topic: 'case5_bso', sort_order: 55, applies_to: 'all',
    title_en: 'CASE5 Blanket order (BSO)', title_ko: 'CASE5 블랭킷 오더 (BSO)',
    body_en: 'The branch registers the BSO → approval · PI → the partner approves the PI → D365 BSO.\nFollow-up orders are placed by the partner in the portal by choosing the BSO (a D365 SO linked to the BSO). ME and JP branches only.',
    body_ko: '지사 담당자가 BSO 등록 → 승인 · PI → 파트너 PI 승인 → D365 BSO가 생성됩니다.\n하위 주문은 파트너가 포털에서 BSO를 선택해 주문합니다(D365 SO 생성 · BSO 연결). ME · JP 지사만 사용합니다.' },
  { section: 'price', topic: '', sort_order: 60, applies_to: 'all',
    title_en: 'Price Book · Currency', title_ko: '가격표 · 통화',
    body_en: 'Only price books of the ERP - Order Branch region are listed (e.g. EU → EU_Pricebook_…). When the Order Branch changes, the top price book of that region is set automatically.\nWhen you choose a price book, the deal currency changes to the price book currency (EUR · USD · JPY).\nRegions without their own price book (IN) use the HQ price books.\nAdd line items after the price book is set. Unit prices, MOQ and customer discounts follow the price book.\nChanging the price book resets the line items.',
    body_ko: 'ERP - Order Branch 리전의 가격표만 목록에 나옵니다(예: EU → EU_Pricebook_…). Order Branch가 바뀌면 해당 리전 맨 위 가격표가 자동 지정됩니다.\n가격표를 선택하면 거래 통화가 가격표 통화(EUR · USD · JPY)로 자동 변경됩니다.\n자체 가격표가 없는 리전(IN)은 HQ 가격표를 사용합니다.\n라인아이템은 가격표를 지정한 뒤 등록하세요. 단가 · MOQ · 고객별 할인율은 가격표 기준으로 적용됩니다.\n가격표를 변경하면 라인아이템이 초기화됩니다.' },
  { section: 'line_items', topic: '', sort_order: 70, applies_to: 'all',
    title_en: 'Line items · Reset', title_ko: '라인아이템 · 초기화',
    body_en: 'Once line items are added, the order route and price book are treated as confirmed, and fields that affect them are protected.\nⓘ green = saved right away / orange = changing it resets the line items / red = allowed teams only and resets the line items.\nWhen you change an orange field and save, a confirmation opens. "Reset and save" deletes all line items and then saves. This can’t be undone.\nAfter a reset, add the line items again. The line item editor link is in the summary at the top of the card.\nTo delete only the line items without changing fields, use "Reset line items" at the bottom right.',
    body_ko: '라인아이템이 등록되면 주문 경로 · 가격표가 확정된 것으로 보고, 이에 영향을 주는 속성은 보호됩니다.\nⓘ 초록 = 바로 저장 / 주황 = 변경 시 라인아이템 초기화 / 빨강 = 허용 팀만 수정 + 초기화\n주황 속성을 바꾸고 저장하면 확인 창이 열립니다. [초기화 후 저장]을 누르면 라인아이템을 모두 삭제한 뒤 저장하며, 되돌릴 수 없습니다.\n초기화 후에는 라인아이템을 다시 등록하세요. 라인아이템 편집기 링크는 카드 상단 요약에 있습니다.\n속성 변경 없이 라인아이템만 지우려면 하단 오른쪽 [라인아이템 초기화]를 사용합니다.' },
  { section: 'delivery', topic: '', sort_order: 80, applies_to: 'all',
    title_en: 'Delivery', title_ko: '배송',
    body_en: 'Default ship-to: CASE1 branch warehouse / CASE2 · 3 · 5 partner / CASE4 end customer address.\nFor Dropship (CASE4), always enter the end customer address. It is sent to the ERP with the order.\nRequested Delivery Date is the arrival date at the ship-to address.\nBoth values are copied to the Order when it is created.',
    body_ko: '배송지 기본값 : CASE1 지사 창고 / CASE2 · 3 · 5 파트너 / CASE4 최종 고객사 주소\n3자거래(CASE4)는 최종 고객사 주소를 꼭 입력하세요. 주문 시 ERP로 전송됩니다.\n희망 납기는 배송지 도착 기준 날짜입니다.\n두 값은 Order 생성 시 Order에 미리 채워집니다.' },
  { section: 'permission', topic: '', sort_order: 90, applies_to: 'all',
    title_en: 'Permissions · Settings', title_ko: '권한 · 설정',
    body_en: 'Order Route, ERP - Order Branch, Revenue Type and ERP Target can be changed only by teams allowed in the app settings.\nAdmins can change each field rule (editable / resets line items / allowed teams only / automatic) in the app settings.\nThis guide can be edited in the HubDB table suprema_order_setup_guide.',
    body_ko: 'Order Route · ERP - Order Branch · Revenue Type · ERP Target은 앱 설정의 수정 허용 팀만 변경할 수 있습니다.\n속성별 규칙(편집 가능 / 변경 시 초기화 / 허용 팀만 / 자동 계산)은 관리자가 앱 설정에서 변경할 수 있습니다.\n이 가이드는 HubDB 표 suprema_order_setup_guide에서 수정할 수 있습니다.' },
  { section: 'faq', topic: '', sort_order: 100, applies_to: 'all',
    title_en: 'Troubleshooting', title_ko: '문제 해결',
    body_en: 'Owner Branch is empty → Assign a deal owner who belongs to a region team.\nThe buyer company list is empty → Check the Owner Branch and the Recommended Team of the Partner Company.\nThe price book you need is not listed → The price book prefix (EU_, ME_ …) must match the ERP - Order Branch region (IN uses HQ_).\nThe currency differs from the price book → Choose the price book again, or click Refresh after a moment.\nThe order route did not change after saving → Workflows take a few seconds. Click Refresh.\n"No edit permission" → Ask an admin to add your team in the app settings.',
    body_ko: 'Owner Branch가 비어 있습니다 → 리전 팀 소속 거래 소유자를 지정하세요.\n구매 회사 목록이 비어 있습니다 → Owner Branch와 Partner Company의 Recommended Team 값을 확인하세요.\n원하는 가격표가 없습니다 → 가격표 접두어(EU_, ME_ …)가 ERP - Order Branch 리전과 같아야 합니다(IN은 HQ_).\n통화가 가격표와 다릅니다 → 가격표를 다시 선택하거나 잠시 후 [새로고침]하세요.\n저장 후 주문 경로가 바뀌지 않습니다 → 워크플로 처리에 몇 초 걸립니다. [새로고침]하세요.\n"수정 권한이 없습니다" → 관리자에게 앱 설정의 수정 허용 팀 추가를 요청하세요.' },
];
// 가이드 문구를 코드에서 바꾸면 GUIDE_VERSION을 올림 → 기존 HubDB 행(section+topic 일치)을 새 문구로 갱신
const GUIDE_VERSION = '2026-11-27b';
async function syncGuideRows() {
  const cur = await readSetting('guide_version');
  if (cur && cur.value === GUIDE_VERSION) return;
  const rows = await readRows(GUIDE_TABLE);
  let changed = false;
  for (const seed of GUIDE_SEED) {
    const row = rows.find((r) => r.values && r.values.section === seed.section && String(r.values.topic || '') === String(seed.topic || ''));
    if (!row) continue;
    const diff = ['title_en', 'title_ko', 'body_en', 'body_ko'].some((k) => String(row.values[k] || '') !== String(seed[k] || ''));
    if (diff) { await api(`/cms/v3/hubdb/tables/${GUIDE_TABLE}/rows/${row.id}/draft`, { method: 'PATCH', body: { values: { title_en: seed.title_en, title_ko: seed.title_ko, body_en: seed.body_en, body_ko: seed.body_ko } } }); changed = true; }
  }
  if (changed) await api(`/cms/v3/hubdb/tables/${GUIDE_TABLE}/draft/publish`, { method: 'POST' });
  await writeSetting('guide_version', GUIDE_VERSION);
}
async function ensureGuideTable() {
  if (await tableExists(GUIDE_TABLE)) { await syncGuideRows(); return; }
  await api('/cms/v3/hubdb/tables', { method: 'POST', body: {
    name: GUIDE_TABLE, label: 'Suprema Order Setup - Order Guide', useForPages: false, allowPublicApiAccess: false,
    columns: [
      { name: 'section', label: 'Section', type: 'TEXT' },
      { name: 'topic', label: 'Topic (order_route value for route_case)', type: 'TEXT' },
      { name: 'sort_order', label: 'Sort Order', type: 'NUMBER' },
      { name: 'applies_to', label: 'Applies To (all / before / after)', type: 'TEXT' },
      { name: 'title_en', label: 'Title (English)', type: 'TEXT' },
      { name: 'title_ko', label: 'Title (Korean)', type: 'TEXT' },
      { name: 'body_en', label: 'Body (English, one item per line)', type: 'TEXT' },
      { name: 'body_ko', label: 'Body (Korean, one item per line)', type: 'TEXT' },
    ],
  } });
  for (const values of GUIDE_SEED) await api(`/cms/v3/hubdb/tables/${GUIDE_TABLE}/rows`, { method: 'POST', body: { values } });
  await api(`/cms/v3/hubdb/tables/${GUIDE_TABLE}/draft/publish`, { method: 'POST' });
}

// ---------- 팀 권한 ----------
async function canUserEdit(userId, key = KEY_EDIT_TEAMS) {
  const s = await readSetting(key).catch(() => null);
  let allowed = [];
  if (s && s.value) { try { allowed = JSON.parse(s.value).map(String); } catch (e) { allowed = []; } }
  if (!allowed.length) return { canEdit: false, hasRule: false, myTeams: [] };
  const data = await api('/settings/v3/users/teams');
  const mine = (data.results || []).filter((t) => [...(t.userIds || []), ...(t.secondaryUserIds || [])].map(String).includes(String(userId)));
  return { canEdit: mine.some((t) => allowed.includes(String(t.id))), hasRule: true, myTeams: mine.map((t) => t.name) };
}

// ---------- 거래 / 라인아이템 ----------
const realProp = (field, region) =>
  field === 'buyer_company' ? `partner_${region}` : field === 'buyer_contact' ? `partner_owner_${region}` : field;

async function propDefs(names) {
  const data = await api('/crm/v3/properties/deals/batch/read', { method: 'POST', body: { inputs: names.map((name) => ({ name })) } });
  const map = {};
  for (const p of data.results || []) map[p.name] = p;
  return map;
}

async function lineItems(dealId) {
  const assoc = await api(`/crm/v4/objects/deals/${dealId}/associations/line_items?limit=500`);
  const ids = (assoc.results || []).map((r) => String(r.toObjectId));
  if (!ids.length) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const data = await api('/crm/v3/objects/line_items/batch/read', { method: 'POST', body: {
      properties: ['name', 'quantity', 'price', 'amount', 'hs_line_item_currency_code', 'hs_discount_percentage', 'pricebook_price_discount', 'remark'],
      inputs: ids.slice(i, i + 100).map((id) => ({ id })),
    } });
    for (const r of data.results || []) out.push({ id: String(r.id), ...r.properties });
  }
  return out;
}

async function archiveLineItems(ids) {
  for (let i = 0; i < ids.length; i += 100) {
    await api('/crm/v3/objects/line_items/batch/archive', { method: 'POST', body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })) } });
  }
}

async function ensureOption(propName, value, label) {
  const prop = await api(`/crm/v3/properties/deals/${propName}`);
  const options = prop.options || [];
  if (options.some((o) => String(o.value) === String(value))) return;
  options.push({ value: String(value), label, hidden: false, displayOrder: options.length });
  await api(`/crm/v3/properties/deals/${propName}`, { method: 'PATCH', body: { options } });
}

async function readDeal(dealId, region) {
  const names = new Set(['pipeline', 'order_route_summary', 'hs_num_of_associated_line_items']);
  for (const g of GROUPS) for (const f of g.fields) names.add(realProp(f, region));
  const deal = await api(`/crm/v3/objects/deals/${dealId}?properties=${[...names].join(',')}`);
  const props = deal.properties || {};
  const values = {};
  for (const g of GROUPS) for (const f of g.fields) values[f] = props[realProp(f, region)] || '';
  return { props, values };
}

async function load(p, lang, userId) {
  const head = await api(`/crm/v3/objects/deals/${p.dealId}?properties=owning_entity`);
  const region = String((head.properties || {}).owning_entity || '').toLowerCase();
  const hasRegion = REGIONS.includes(region);
  const [{ props, values }, rules, perm, items, permOwner] = await Promise.all([
    readDeal(p.dealId, region), getRules(), canUserEdit(userId), lineItems(p.dealId), canUserEdit(userId, KEY_OWNER_TEAMS),
  ]);
  if (permOwner.canEdit) rules.owning_entity = 'owner';
  const realNames = [];
  for (const g of GROUPS) for (const f of g.fields) if (hasRegion || !f.startsWith('buyer_c')) realNames.push(realProp(f, region));
  const defs = await propDefs(realNames);

  const groups = GROUPS.map((g) => ({
    key: g.key,
    fields: g.fields.filter((f) => hasRegion || !f.startsWith('buyer_c')).map((f) => {
      const d = defs[realProp(f, region)] || {};
      const curVal = String(values[f] || '');
      let options = (d.options || [])
        .filter((o) => !o.hidden || String(o.value) === curVal || f === 'buying_branch')
        .map((o) => ({ value: String(o.value), label: loc(lang, o.label) }));
      const pbErp = String(values.selling_entity || region);
      if (f === 'pricebook_select' && PB_PREFIX[pbErp]) options = options.filter((o) => o.value.startsWith(PB_PREFIX[pbErp]));
      // 'no'(The Price Book cannot be applied.)는 선택지에서 제외 (2026-11-27 정책)
      if (f === 'pricebook_select') options = options.filter((o) => o.value !== 'no');
      return {
        name: f,
        label: loc(lang, d.label || f),
        type: d.type || 'string',
        fieldType: d.fieldType || 'text',
        rule: rules[f] || 'edit',
        options: f.startsWith('buyer_c') ? [] : options,
      };
    }),
  }));
  const pbDef = defs.pricebook_select || {};
  const pbAll = (pbDef.options || []).map((o) => ({ value: String(o.value), label: loc(lang, o.label) }));
  let pipelineLabel = props.pipeline || '';
  if (pipelineLabel) {
    try { pipelineLabel = (await api(`/crm/v3/pipelines/deals/${props.pipeline}`)).label || pipelineLabel; } catch (e) { /* 라벨 조회 실패 시 ID 표시 */ }
  }
  return {
    ok: true, lang, region, hasRegion, groups, values,
    pipeline: pipelineLabel,
    orderRouteSummary: props.order_route_summary || '',
    lineItems: items,
    canEdit: perm.canEdit, hasRule: perm.hasRule, myTeams: perm.myTeams,
    canEditOwner: permOwner.canEdit,
    pbDefaults: pbDefaults(pbDef.options), pbAll,
  };
}

async function save(p, lang, userId) {
  const head = await api(`/crm/v3/objects/deals/${p.dealId}?properties=owning_entity`);
  const region = String((head.properties || {}).owning_entity || '').toLowerCase();
  const [{ values: cur }, rules, items] = await Promise.all([readDeal(p.dealId, region), getRules(), lineItems(p.dealId)]);
  const incoming = p.values || {};
  const changed = Object.keys(incoming).filter((f) => f in DEFAULT_RULES && String(incoming[f] ?? '') !== String(cur[f] ?? ''));
  if (!changed.length) return { ok: true, saved: {}, resetCount: 0 };

  if (changed.includes('owning_entity')) {
    const po = await canUserEdit(userId, KEY_OWNER_TEAMS);
    if (!po.canEdit) throw new Error(M(lang, 'No permission to change Owner Branch. Action required: ask an admin to add your team in the app settings.', 'Owner Branch 수정 권한이 없습니다. 필요한 조치 : 앱 설정의 Owner Branch 수정 허용 팀에 포함되어야 합니다.'));
    if (!REGIONS.includes(String(incoming.owning_entity || ''))) throw new Error(M(lang, 'Owner Branch is required.', 'Owner Branch는 비워 둘 수 없습니다.'));
    rules.owning_entity = 'owner';
  }
  // 주문 형태 규칙 (W4와 동일) — Dropship은 Partner 구매자만, BSO는 Order Branch JP · ME만
  if (changed.includes('order_type') || changed.includes('buyer_type') || changed.includes('partner_region_select')) {
    const ot = String(changed.includes('order_type') ? incoming.order_type : cur.order_type || '');
    const bt = String(changed.includes('buyer_type') ? incoming.buyer_type : cur.buyer_type || '');
    const obv = String(changed.includes('partner_region_select') ? incoming.partner_region_select : cur.partner_region_select || '');
    if (changed.includes('order_type') && ot === 'dropship' && bt === 'internal_entity') throw new Error(M(lang, 'Not allowed: Dropship is only for Partner buyers.', '변경 불가합니다 : Dropship(3자거래)은 Buyer Type이 Partner일 때만 선택할 수 있습니다.'));
    if (changed.includes('order_type') && ot === 'bso' && !['JP', 'ME'].includes(obv)) throw new Error(M(lang, 'Not allowed: BSO is only for Order Branch JP or ME.', '변경 불가합니다 : BSO는 Order Branch가 JP 또는 ME일 때만 선택할 수 있습니다.'));
  }
  if (changed.includes('pricebook_select') && String(incoming.pricebook_select) === 'no') throw new Error(M(lang, 'Not allowed: "The Price Book cannot be applied." can no longer be selected. Action required: choose a price book.', '변경 불가합니다 : "The Price Book cannot be applied."는 선택할 수 없습니다. 필요한 조치 : 가격표를 선택하세요.'));
  const autoF = changed.filter((f) => rules[f] === 'auto');
  if (autoF.length) throw new Error(M(lang, `Not allowed: ${autoF.join(', ')} is calculated automatically.`, `변경 불가합니다 : ${autoF.join(', ')} 속성은 자동 계산됩니다.`));
  const teamF = changed.filter((f) => rules[f] === 'team');
  if (teamF.length) {
    const perm = await canUserEdit(userId);
    if (!perm.canEdit) throw new Error(M(lang, 'No edit permission. Action required: ask an admin to add your team in the app settings.', '수정 권한이 없습니다. 필요한 조치 : 앱 설정에서 허용된 팀에 포함되어야 합니다.'));
  }
  if ((changed.includes('buyer_company') || changed.includes('buyer_contact')) && !REGIONS.includes(region)) {
    throw new Error(M(lang, 'There is no Owner Branch. Action required: assign a deal owner.', 'Owner Branch가 없습니다. 필요한 조치 : 거래 소유자를 지정하세요.'));
  }
  const resetF = changed.filter((f) => RESET_CLASSES.includes(rules[f]));
  if (resetF.length && items.length && !p.confirmReset) {
    return { ok: false, code: 'RESET_REQUIRED', fields: resetF, count: items.length,
      error: M(lang, `Changing these fields resets ${items.length} line item(s). Confirm to continue.`, `이 속성을 변경하면 라인아이템 ${items.length}개가 초기화됩니다. 확인 후 진행하세요.`) };
  }

  const derived = {};
  // Owner Branch 변경 → 구매 회사 · 구매 담당자 초기화, Order Branch · 가격표 재지정
  const newRegion = changed.includes('owning_entity') ? String(incoming.owning_entity) : region;
  if (changed.includes('owning_entity')) {
    if (REGIONS.includes(region)) {
      derived[`partner_${region}`] = '';
      derived[`partner_owner_${region}`] = '';
    }
    derived.deal_partner_id = '';
    derived.selected_partner_owner_id = '';
  }
  // Buyer Type · Owner Branch 변경 → Order Branch 자동 (HQ/Branch = HQ(APAC), Partner = Owner Branch)
  if ((changed.includes('buyer_type') || changed.includes('owning_entity')) && !changed.includes('partner_region_select')) {
    const bt = changed.includes('buyer_type') ? incoming.buyer_type : cur.buyer_type;
    const ob = bt === 'internal_entity' ? 'APAC' : OWNER_TO_ORDER_BRANCH[newRegion];
    if (ob && ob !== cur.partner_region_select) derived.partner_region_select = ob;
  }
  // Order Branch 변경 → Order Branch Company · ERP - Order Branch 함께 변경
  const newOB = derived.partner_region_select || (changed.includes('partner_region_select') ? incoming.partner_region_select : '');
  if (newOB) {
    if (!changed.includes('buying_branch') && ORDER_BRANCH_TO_COMPANY[newOB]) derived.buying_branch = ORDER_BRANCH_TO_COMPANY[newOB];
    if (!changed.includes('selling_entity') && ORDER_BRANCH_TO_ERP[newOB]) derived.selling_entity = ORDER_BRANCH_TO_ERP[newOB];
  }

  // 주문 형태 규칙(W4와 동일) — 구매자 유형 · Order Branch가 바뀌어 허용되지 않으면 Standard로
  if (!changed.includes('order_type')) {
    const bt = String(changed.includes('buyer_type') ? incoming.buyer_type : cur.buyer_type || '');
    const obv = String(derived.partner_region_select || (changed.includes('partner_region_select') ? incoming.partner_region_select : cur.partner_region_select) || '');
    const ot = String(cur.order_type || '');
    if ((ot === 'dropship' && bt === 'internal_entity') || (ot === 'bso' && !['JP', 'ME'].includes(obv))) derived.order_type = 'standard';
  }
  // ERP - Order Branch 기준 가격표 · 통화 자동 지정 (ERP가 바뀌었거나 가격표 접두어가 ERP와 다를 때, 사용자가 가격표를 직접 고른 경우 제외)
  const erp = String((changed.includes('selling_entity') ? incoming.selling_entity : derived.selling_entity) || cur.selling_entity || '');
  if (erp && PB_PREFIX[erp] && !changed.includes('pricebook_select')) {
    const curPb = String(cur.pricebook_select || '');
    const erpChanged = erp !== String(cur.selling_entity || '');
    const mismatch = !curPb || !curPb.startsWith(PB_PREFIX[erp]);
    if (erpChanged || mismatch) {
      const pbProp = (await propDefs(['pricebook_select'])).pricebook_select || {};
      const d = pbDefaults(pbProp.options)[erp];
      if (d && d.value && d.value !== curPb) {
        derived.pricebook_select = d.value;
        if (d.currency && d.currency !== cur.deal_currency_code) derived.deal_currency_code = d.currency;
      }
    }
  }

  const properties = { ...derived };
  const labels = p.labels || {};
  for (const f of changed) {
    if (changed.includes('owning_entity') && f.startsWith('buyer_c')) continue;
    const prop = realProp(f, region);
    let v = String(incoming[f] ?? '');
    if ((f === 'buyer_company' || f === 'buyer_contact') && v) await ensureOption(prop, v, labels[f] || v);
    properties[prop] = v;
  }
  // 구매 회사가 바뀌면 구매 담당자는 새 회사 기준으로 다시 선택
  if (changed.includes('buyer_company') && !changed.includes('buyer_contact')) properties[realProp('buyer_contact', region)] = '';

  let resetCount = 0;
  if (resetF.length && items.length) {
    await archiveLineItems(items.map((i) => i.id));
    resetCount = items.length;
  }
  await api(`/crm/v3/objects/deals/${p.dealId}`, { method: 'PATCH', body: { properties } });
  return { ok: true, saved: properties, changed, derived: Object.keys(derived), resetCount };
}

async function guide(p, lang) {
  await ensureGuideTable();
  const state = p.hasLineItems ? 'after' : 'before';
  const pick = (v, k) => (lang === 'ko' ? v[`${k}_ko`] : v[`${k}_en`]) || v[`${k}_en`] || '';
  const rows = (await readRows(GUIDE_TABLE))
    .map((r) => r.values || {})
    .filter((v) => !v.applies_to || v.applies_to === 'all' || v.applies_to === state)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const toItem = (v) => ({
    section: v.section || '',
    topic: v.topic || '',
    title: pick(v, 'title'),
    lines: pick(v, 'body').split('\n').map((x) => x.trim()).filter(Boolean),
  });
  return {
    ok: true,
    sections: rows.filter((v) => v.section !== 'route_case').map(toItem),
    routes: rows.filter((v) => v.section === 'route_case').map(toItem),
  };
}

exports.main = async (context) => {
  const p = context.parameters || {};
  const lang = p.lang === 'ko' ? 'ko' : 'en';
  try {
    if (Number(context.portalId) !== PORTAL_ID) throw new Error(M(lang, 'This account is not allowed.', '허용되지 않은 계정입니다.'));
    const userId = context.user && context.user.userId;
    switch (p.action) {
      case 'load': return await load(p, lang, userId);
      case 'save': return await save(p, lang, userId);
      case 'reset': {
        const items = await lineItems(p.dealId);
        await archiveLineItems(items.map((i) => i.id));
        return { ok: true, resetCount: items.length };
      }
      case 'guide': return await guide(p, lang);
      case 'owner_teams_get': {
        const s = await readSetting(KEY_OWNER_TEAMS).catch(() => null);
        let ids = [];
        if (s && s.value) { try { ids = JSON.parse(s.value).map(String); } catch (e) { ids = []; } }
        return { ok: true, allowed: ids };
      }
      case 'owner_teams_save': {
        const ids = (p.teamIds || []).map(String);
        await writeSetting(KEY_OWNER_TEAMS, JSON.stringify(ids));
        return { ok: true, allowed: ids };
      }
      case 'rules_get': return { ok: true, rules: await getRules(), defaults: DEFAULT_RULES };
      case 'rules_save': {
        const clean = {};
        for (const [k, v] of Object.entries(p.rules || {})) if (k in DEFAULT_RULES && ['edit', 'lock', 'team', 'auto'].includes(v)) clean[k] = v;
        await writeSetting(KEY_FIELD_RULES, JSON.stringify(clean));
        return { ok: true, rules: await getRules() };
      }
      default: throw new Error(M(lang, `Unknown action: ${p.action}`, `알 수 없는 작업입니다 : ${p.action}`));
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
