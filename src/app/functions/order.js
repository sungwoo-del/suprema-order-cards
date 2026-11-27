// Opportunity → Order 생성 · Order 진행(검토 · PI) 카드 공용 서버 함수
// actions: create_load · create_order · progress_load · request_review · review · pi(quote · issue · approve) · pi_template_get/save
// 단계 진입 조건(Stage Gate)은 카드에서 검사 — docs/06_Order_프로세스.md
// 메시지는 사용자 UI 언어(lang)로 반환 — 한국어 UI일 때만 한국어, 그 외 영어

const BASE = 'https://api.hubapi.com';
const PORTAL_ID = 245822501;
const PARTNER = '2-267605328';
const PARTNER_COMPANY = '2-268293662';
const OPP_PIPELINE = '2607290060';
const OPP_ORDER_STAGE = '4400078529'; // Opportunity · Order Confirm
const OPP_WON_STAGE = '4400056041'; // Opportunity · Closed Won
const ORDER_PIPELINE = '2607290061';
const S = {
  po: '4400056046', // PO Registration
  review: '4400056047', // Under Review
  processing: '4400056048', // Order Processing
  confirming: '4400056049', // Order Confirming
  dispatched: '4400056050', // Dispatched
  closed: '4400056051', // Closed
  lost: '4400056052', // Closed Lost
};
const REGIONS = ['hq', 'eu', 'uk', 'us', 'jp', 'in', 'me', 'latam'];
const COPY_PROPS = ['hubspot_owner_id', 'amount', 'deal_currency_code', 'closedate', 'description', 'owning_entity', 'buyer_type',
  'partner_region_select', 'buying_branch', 'order_type', 'erp_sales_type', 'pricebook_select', 'order_route', 'selling_entity',
  'erp_target', 'revenue_type', 'ship_to_address', 'requested_delivery_date', 'deal_partner_id', 'order_group_id',
  ...REGIONS.flatMap((r) => [`partner_${r}`, `partner_owner_${r}`])];
const ASSOC_TYPES = ['companies', 'contacts', PARTNER, PARTNER_COMPANY];
const ACTIVITY_TYPES = ['notes', 'emails', 'calls', 'meetings', 'tasks', 'communications', 'postal_mail'];
const LINE_PROPS = ['name', 'hs_product_id', 'quantity', 'price', 'hs_discount_percentage', 'discount', 'hs_sku', 'description',
  'hs_line_item_currency_code', 'remark', 'pricebook_price_discount', 'hs_position_on_quote', 'sf_hscode', 'sf_hs_code', 'sf_country_of_origin'];
const M = (lang, en, ko) => (lang === 'ko' ? ko : en);

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

async function assocAll(fromType, id, toType) {
  const out = [];
  let after = '';
  do {
    const data = await api(`/crm/v4/objects/${fromType}/${id}/associations/${toType}?limit=500${after ? `&after=${after}` : ''}`);
    for (const r of data.results || []) out.push({ id: String(r.toObjectId), types: r.associationTypes || [] });
    after = data.paging && data.paging.next ? data.paging.next.after : '';
  } while (after);
  return out;
}

// 거래 ↔ 거래 라벨 : "Order"(Opportunity → Order) · "Source Opportunity"(Order → Opportunity)
let dealLabels = null;
async function label(name, lang) {
  if (!dealLabels) dealLabels = (await api('/crm/v4/associations/deals/deals/labels')).results || [];
  const hit = dealLabels.find((l) => String(l.label || '').trim().toLowerCase() === name.toLowerCase());
  if (!hit) throw new Error(M(lang, `There is no "${name}" deal-to-deal association label. Action required: create it in the association settings.`,
    `거래 ↔ 거래 "${name}" 연결 라벨이 없습니다. 필요한 조치 : 연결 설정에서 라벨을 만드세요.`));
  return { associationCategory: hit.category, associationTypeId: Number(hit.typeId) };
}
async function linkedDeal(dealId, labelName, lang) {
  const t = await label(labelName, lang);
  const rows = await assocAll('deals', dealId, 'deals');
  const hit = rows.find((r) => r.types.some((x) => Number(x.typeId) === t.associationTypeId));
  if (!hit) return null;
  const d = await api(`/crm/v3/objects/deals/${hit.id}?properties=dealname,pipeline,dealstage,hubspot_owner_id,createdate,amount,deal_currency_code`);
  return { id: String(d.id), ...d.properties };
}

let plCache = null;
async function pipelines() {
  if (!plCache) {
    const data = await api('/crm/v3/pipelines/deals');
    plCache = (data.results || []).map((p) => ({
      id: p.id, label: p.label,
      stages: (p.stages || []).sort((a, b) => a.displayOrder - b.displayOrder).map((s) => ({ id: s.id, label: s.label })),
    }));
  }
  return plCache;
}
async function stageLabel(pipelineId, stageId) {
  const pl = (await pipelines()).find((p) => p.id === pipelineId);
  return { pipelineLabel: pl ? pl.label : '', stageLabel: ((pl && pl.stages.find((s) => s.id === stageId)) || {}).label || '' };
}
async function ownerName(id, lang) {
  if (!id) return '';
  try {
    const o = await api(`/crm/v3/owners/${id}`);
    const parts = lang === 'ko' ? [o.lastName, o.firstName] : [o.firstName, o.lastName];
    return parts.filter(Boolean).join(' ') || o.email || '';
  } catch (e) { return ''; }
}
async function decorate(d, lang) {
  if (!d) return null;
  return { ...d, ...(await stageLabel(d.pipeline, d.dealstage)), ownerName: await ownerName(d.hubspot_owner_id, lang) };
}
const fmt = (v, cur) => { const n = Number(v || 0); return `${cur ? `${cur} ` : ''}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`; };

async function lineItems(dealId) {
  const ids = (await assocAll('deals', dealId, 'line_items')).map((r) => r.id);
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const data = await api('/crm/v3/objects/line_items/batch/read', { method: 'POST', body: { properties: LINE_PROPS, inputs: ids.slice(i, i + 100).map((id) => ({ id })) } });
    for (const r of data.results || []) out.push({ id: String(r.id), ...r.properties });
  }
  return out;
}

// 주문 조건 검사 (Opportunity · Order 공용)
async function checks(dealId, d, lang, { forCreate }) {
  const region = String(d.owning_entity || '').toLowerCase();
  const lines = await lineItems(dealId);
  const zero = lines.filter((l) => !(Number(l.price) > 0)).length;
  const internal = d.buyer_type === 'internal_entity';
  const buyerOk = internal || !!(REGIONS.includes(region) && d[`partner_${region}`]); // 구매 담당자는 선택값
  const list = [];
  if (forCreate) list.push({ key: 'stage', ok: d.dealstage === OPP_ORDER_STAGE, text: M(lang, 'Opportunity stage: Order Confirm', 'Opportunity 단계 : Order Confirm') });
  list.push(
    { key: 'owner', ok: !!d.hubspot_owner_id, text: M(lang, 'Deal owner', 'Deal owner 지정') },
    { key: 'buyer', ok: buyerOk, text: M(lang, 'Buyer (Order Setup card)', '구매자 지정 (Order Setup 카드)') },
    { key: 'price', ok: !!d.pricebook_select, text: M(lang, 'Price book', '가격표 지정') },
    { key: 'lines', ok: lines.length > 0, text: M(lang, `Line items: ${lines.length}`, `라인아이템 ${lines.length}개`) },
    { key: 'zero', ok: lines.length > 0 && zero === 0, text: zero ? M(lang, `Line items with price 0: ${zero}`, `단가 0 라인 ${zero}개`) : M(lang, 'No line item with price 0', '단가 0 라인 없음') },
  );
  return { list, ok: list.every((c) => c.ok), lines: lines.length, zero };
}

const READ_PROPS = ['dealname', 'pipeline', 'dealstage', 'hubspot_owner_id', 'amount', 'deal_currency_code', 'closedate', 'owning_entity', 'buyer_type', 'pricebook_select',
  'order_review_status', 'order_review_note', 'order_reviewed_by', 'pi_status', 'confirmed_amount', 'selling_entity', 'erp_target',
  'unierp_if_status', 'd365_if_status', 'unierp_so_no', 'd365_so_no', 'd365_po_no', 'shipment_status',
  ...REGIONS.flatMap((r) => [`partner_${r}`, `partner_owner_${r}`])];
async function readDeal(dealId) {
  const d = await api(`/crm/v3/objects/deals/${dealId}?properties=${READ_PROPS.join(',')}`);
  return d.properties || {};
}

async function touch(dealId, tag) {
  try { await api(`/crm/v3/objects/deals/${dealId}`, { method: 'PATCH', body: { properties: { hd_card_sync: `${tag}:${Date.now()}` } } }); } catch (e) { /* 무시 */ }
}


// ---------- 앱 설정 (HubDB suprema_order_card_settings) : 검토 승인 팀 ----------
const SETTINGS_TABLE = 'suprema_order_card_settings';
const KEY_REVIEW_TEAMS = 'order_review_teams';
async function readRows() {
  try { return (await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/rows/draft?limit=500`)).results || []; }
  catch (e) { if (e.status === 404) return []; throw e; }
}
async function readJson(key, fallback) {
  const row = (await readRows()).find((r) => r.values && r.values.setting_key === key);
  if (!row || !row.values.setting_value) return fallback;
  try { return JSON.parse(row.values.setting_value); } catch (e) { return fallback; }
}
async function writeJson(key, value) {
  let exists = true;
  try { await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/draft`); } catch (e) { if (e.status === 404) exists = false; else throw e; }
  if (!exists) {
    await api('/cms/v3/hubdb/tables', { method: 'POST', body: {
      name: SETTINGS_TABLE, label: 'Suprema Order Cards - Settings', useForPages: false, allowPublicApiAccess: false,
      columns: [{ name: 'setting_key', label: 'Setting Key', type: 'TEXT' }, { name: 'setting_value', label: 'Setting Value', type: 'TEXT' }],
    } });
  }
  const row = (await readRows()).find((r) => r.values && r.values.setting_key === key);
  const values = { setting_key: key, setting_value: JSON.stringify(value) };
  if (row) await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/rows/${row.id}/draft`, { method: 'PATCH', body: { values } });
  else await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/rows`, { method: 'POST', body: { values } });
  await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/draft/publish`, { method: 'POST' });
}
async function allTeams() {
  const data = await api('/settings/v3/users/teams');
  return (data.results || []).map((t) => ({ id: String(t.id), name: t.name, members: [...(t.userIds || []), ...(t.secondaryUserIds || [])].map(String) }));
}
// 사용자가 검토 승인 팀 소속인지 (주 팀 · 보조 팀 모두)
async function approverInfo(userId) {
  const allowed = (await readJson(KEY_REVIEW_TEAMS, [])).map(String);
  if (!allowed.length) return { can: false, hasRule: false, teams: [] };
  const teams = await allTeams();
  const names = teams.filter((t) => allowed.includes(t.id)).map((t) => t.name);
  return { can: teams.some((t) => allowed.includes(t.id) && t.members.includes(String(userId))), hasRule: true, teams: names };
}

// ---------- Create Order (Opportunity) ----------
async function createLoad(p, lang) {
  const d = await readDeal(p.dealId);
  if (d.pipeline === ORDER_PIPELINE) return { ok: true, mode: 'order', source: await decorate(await linkedDeal(p.dealId, 'Source Opportunity', lang), lang) };
  if (d.pipeline !== OPP_PIPELINE) return { ok: true, mode: 'none' };
  const existing = await decorate(await linkedDeal(p.dealId, 'Order', lang), lang);
  const base = { ok: true, mode: 'opp', existing, dealname: d.dealname || '', stage: (await stageLabel(d.pipeline, d.dealstage)).stageLabel,
    amount: fmt(d.amount, d.deal_currency_code), owner: await ownerName(d.hubspot_owner_id, lang),
    target: { pipeline: (await stageLabel(ORDER_PIPELINE, S.po)).pipelineLabel, stage: (await stageLabel(ORDER_PIPELINE, S.po)).stageLabel } };
  if (existing) return base;
  const c = await checks(p.dealId, d, lang, { forCreate: true });
  let assoc = 0;
  for (const t of ASSOC_TYPES) { try { assoc += (await assocAll('deals', p.dealId, t)).length; } catch (e) { /* 무시 */ } }
  const all = await api(`/crm/v3/objects/deals/${p.dealId}?properties=${COPY_PROPS.join(',')}`);
  const props = Object.entries(all.properties || {}).filter(([k, v]) => COPY_PROPS.includes(k) && v !== null && v !== '').length;
  return { ...base, checks: c.list, ready: c.ok, lines: c.lines, assoc, props };
}

async function copyAssociations(fromId, toId) {
  const result = { linked: 0, failed: 0 };
  for (const to of ASSOC_TYPES) {
    let rows = [];
    try { rows = await assocAll('deals', fromId, to); } catch (e) { continue; }
    const inputs = rows.map((r) => {
      const seen = new Set();
      const types = [];
      for (const x of r.types) { const k = `${x.category}:${x.typeId}`; if (!seen.has(k)) { seen.add(k); types.push({ associationCategory: x.category, associationTypeId: Number(x.typeId) }); } }
      return { from: { id: String(toId) }, to: { id: r.id }, types };
    });
    for (let i = 0; i < inputs.length; i += 100) {
      const chunk = inputs.slice(i, i + 100);
      try { await api(`/crm/v4/associations/deals/${to}/batch/create`, { method: 'POST', body: { inputs: chunk } }); result.linked += chunk.length; }
      catch (e) { result.failed += chunk.length; }
    }
  }
  return result;
}
async function copyLines(fromId, toId) {
  const result = { created: 0, failed: 0 };
  const items = await lineItems(fromId);
  const inputs = items.map((r) => {
    const props = {};
    for (const k of LINE_PROPS) { const v = r[k]; if (v !== null && v !== undefined && v !== '') props[k] = v; }
    return { properties: props, associations: [{ to: { id: String(toId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 20 }] }] };
  });
  for (let i = 0; i < inputs.length; i += 100) {
    const chunk = inputs.slice(i, i + 100);
    try { await api('/crm/v3/objects/line_items/batch/create', { method: 'POST', body: { inputs: chunk } }); result.created += chunk.length; }
    catch (e) { result.failed += chunk.length; }
  }
  return result;
}
async function shareActivities(fromId, toId) {
  const result = { linked: 0, failed: 0 };
  for (const t of ACTIVITY_TYPES) {
    let rows = [];
    try { rows = await assocAll('deals', fromId, t); } catch (e) { continue; }
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      try { await api(`/crm/v4/associations/deals/${t}/batch/associate/default`, { method: 'POST', body: { inputs: chunk.map((r) => ({ from: { id: String(toId) }, to: { id: r.id } })) } }); result.linked += chunk.length; }
      catch (e) { result.failed += chunk.length; }
    }
  }
  return result;
}

async function createOrder(p, lang) {
  const d = await readDeal(p.dealId);
  if (d.pipeline !== OPP_PIPELINE) throw new Error(M(lang, 'Only an opportunity can create an order.', 'Opportunity 거래에서만 Order를 만들 수 있습니다.'));
  if (await linkedDeal(p.dealId, 'Order', lang)) throw new Error(M(lang, 'An order was already created from this opportunity. Creating it again is not possible.', '이 영업기회에서 만든 Order가 이미 있습니다. 다시 만들기는 불가합니다.'));
  const c = await checks(p.dealId, d, lang, { forCreate: true });
  if (!c.ok) throw new Error(M(lang, 'The order conditions are not met. Action required: complete the unchecked items.', '주문 조건이 충족되지 않았습니다. 필요한 조치 : 체크되지 않은 항목을 완료하세요.'));
  const all = await api(`/crm/v3/objects/deals/${p.dealId}?properties=${COPY_PROPS.join(',')}`);
  const props = {};
  for (const [k, v] of Object.entries(all.properties || {})) if (COPY_PROPS.includes(k) && v !== null && v !== '') props[k] = v;
  props.dealname = String(p.dealname || '').trim() || `${d.dealname} - Order`;
  props.pipeline = ORDER_PIPELINE;
  props.dealstage = S.po;
  props.pi_status = 'not_issued';
  const created = await api('/crm/v3/objects/deals', { method: 'POST', body: { properties: props } });
  const newId = String(created.id);
  const t = await label('Order', lang);
  await api('/crm/v4/associations/deals/deals/batch/create', { method: 'POST', body: { inputs: [{ from: { id: String(p.dealId) }, to: { id: newId }, types: [t] }] } });
  const assoc = await copyAssociations(p.dealId, newId);
  const lines = await copyLines(p.dealId, newId);
  const acts = await shareActivities(p.dealId, newId);
  // Order를 만들면 Opportunity는 Closed Won
  let oppClosed = true;
  try { await api(`/crm/v3/objects/deals/${p.dealId}`, { method: 'PATCH', body: { properties: { dealstage: OPP_WON_STAGE } } }); } catch (e) { oppClosed = false; }
  await touch(p.dealId, 'order');
  return { ok: true, id: newId, oppClosed, result: { props: Object.keys(props).length - 3, assoc, lines, acts } };
}

// ---------- Order Progress (Order) ----------
const STEP_KEYS = ['po', 'review', 'processing', 'confirming', 'dispatched', 'closed'];
async function progressLoad(p, lang, userId) {
  const d = await readDeal(p.dealId);
  if (d.pipeline !== ORDER_PIPELINE) return { ok: true, mode: 'none' };
  const pl = (await pipelines()).find((x) => x.id === ORDER_PIPELINE);
  const stages = STEP_KEYS.map((k) => ({ key: k, id: S[k], label: ((pl && pl.stages.find((s) => s.id === S[k])) || {}).label || k }));
  const current = d.dealstage === S.lost ? 'lost' : (STEP_KEYS.find((k) => S[k] === d.dealstage) || '');
  const c = await checks(p.dealId, d, lang, { forCreate: false });
  return {
    ok: true, mode: 'order', current, stages,
    stageLabel: (await stageLabel(d.pipeline, d.dealstage)).stageLabel,
    checks: c.list, ready: c.ok,
    review: { status: d.order_review_status || '', note: d.order_review_note || '', by: d.order_reviewed_by || '' },
    pi: d.pi_status || 'not_issued',
    piQuote: (['processing', 'confirming', 'dispatched', 'closed'].includes(STEP_KEYS.find((k) => S[k] === d.dealstage) || '')) ? await piQuote(p.dealId, lang) : null,
    amount: fmt(d.amount, d.deal_currency_code), confirmed: d.confirmed_amount ? fmt(d.confirmed_amount, d.deal_currency_code) : '',
    erp: { branch: d.selling_entity || '', target: d.erp_target || '', unierp: d.unierp_if_status || '', d365: d.d365_if_status || '',
      so: d.unierp_so_no || d.d365_so_no || '', po: d.d365_po_no || '', shipment: d.shipment_status || '' },
    source: await decorate(await linkedDeal(p.dealId, 'Source Opportunity', lang), lang),
    approver: await approverInfo(userId),
  };
}

async function setDeal(dealId, properties) {
  await api(`/crm/v3/objects/deals/${dealId}`, { method: 'PATCH', body: { properties } });
}
const stamp = (who) => `${who || '-'} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

async function requestReview(p, lang) {
  const d = await readDeal(p.dealId);
  if (d.pipeline !== ORDER_PIPELINE || d.dealstage !== S.po) throw new Error(M(lang, 'Review can be requested only in PO Registration.', 'PO Registration 단계에서만 검토 요청이 가능합니다.'));
  const c = await checks(p.dealId, d, lang, { forCreate: false });
  if (!c.ok) throw new Error(M(lang, 'The order conditions are not met. Action required: complete the unchecked items.', '주문 조건이 충족되지 않았습니다. 필요한 조치 : 체크되지 않은 항목을 완료하세요.'));
  await setDeal(p.dealId, { dealstage: S.review, order_review_status: 'pending', order_review_note: '' });
  await touch(p.dealId, 'op');
  return { ok: true };
}

async function review(p, lang, userId) {
  if (!(await approverInfo(userId)).can) throw new Error(M(lang, 'You do not have approval permission. Action required: ask the region team leader.', '승인 권한이 없습니다. 필요한 조치 : 리전팀 Leader에게 요청하세요.'));
  const d = await readDeal(p.dealId);
  if (d.dealstage !== S.review) throw new Error(M(lang, 'The order is not under review.', 'Under Review 단계가 아닙니다.'));
  const note = String(p.note || '').trim();
  if (p.decision === 'approve') {
    await setDeal(p.dealId, { order_review_status: 'approved', order_reviewed_by: stamp(p.userName), order_review_note: note, dealstage: S.processing });
  } else if (p.decision === 'reject') {
    if (!note) throw new Error(M(lang, 'There is no review note. Action required: enter the reason for rejection.', '검토 의견이 없습니다. 필요한 조치 : 반려 사유를 입력하세요.'));
    await setDeal(p.dealId, { order_review_status: 'rejected', order_reviewed_by: stamp(p.userName), order_review_note: note, dealstage: S.po });
  } else throw new Error('Unknown decision');
  await touch(p.dealId, 'op');
  return { ok: true };
}

async function pi(p, lang) {
  const d = await readDeal(p.dealId);
  if (d.dealstage !== S.processing) throw new Error(M(lang, 'PI can be handled only in Order Processing.', 'Order Processing 단계에서만 PI 처리가 가능합니다.'));
  if (p.step === 'quote') return await createPiQuote(p, lang);
  if (p.step === 'issue') await setDeal(p.dealId, { pi_status: 'issued' }); // 수동 기록 (견적 권한이 없을 때)
  else if (p.step === 'approve') {
    if (d.pi_status !== 'issued') throw new Error(M(lang, 'The PI has not been issued. Action required: issue the PI first.', 'PI가 발행되지 않았습니다. 필요한 조치 : PI를 먼저 발행하세요.'));
    await setDeal(p.dealId, { pi_status: 'buyer_approved', confirmed_amount: d.amount || '0', dealstage: S.confirming });
  } else throw new Error('Unknown step');
  await touch(p.dealId, 'op');
  return { ok: true };
}


// ---------- PI = HubSpot 견적(CPQ Quote) + PI 템플릿 ----------
const KEY_PI_TEMPLATE = 'pi_quote_template';
const DEFAULT_PI_TEMPLATE = '920511988410'; // 견적 템플릿 'Suprema PI (Proforma Invoice)'
const QUOTE_PROPS = ['hs_title', 'hs_status', 'hs_expiration_date', 'hs_quote_link', 'hs_pdf_download_link', 'hs_createdate', 'hs_quote_amount', 'hs_currency'];
const QUOTE_STATUS = {
  DRAFT: ['Draft', '초안', 'default'], PENDING_APPROVAL: ['Pending approval', '승인 대기', 'warning'], APPROVAL_NOT_NEEDED: ['Published', '게시됨', 'info'],
  APPROVED: ['Published', '게시됨', 'info'], REJECTED: ['Rejected', '반려', 'danger'], ACCEPTED: ['Accepted', '구매자 승인', 'success'],
};
const scopeError = (e) => e && (e.status === 403 || e.status === 401);
const noScopeMsg = (lang) => M(lang, 'The app has no quote permission. Action required: ask a Super Admin to re-authorize the app.', '앱에 견적 권한이 없습니다. 필요한 조치 : 슈퍼 관리자에게 앱 재승인을 요청하세요.');

async function quoteTemplates() {
  const body = { filterGroups: [{ filters: [{ propertyName: 'hs_type', operator: 'EQ', value: 'cpq_template' }] }], properties: ['hs_name', 'hs_type'], limit: 100 };
  let data;
  try { data = await api('/crm/v3/objects/quote_template/search', { method: 'POST', body }); }
  catch (e) { if (scopeError(e)) throw e; data = await api('/crm/objects/2026-03/quote_templates/search', { method: 'POST', body }); }
  return (data.results || []).map((r) => ({ id: String(r.id), name: (r.properties || {}).hs_name || String(r.id) }));
}

// Order에 연결된 견적 중 가장 최근 것 = PI
async function piQuote(dealId, lang) {
  let ids;
  try { ids = (await assocAll('deals', dealId, 'quotes')).map((r) => r.id); }
  catch (e) { if (scopeError(e)) return { error: 'scope', message: noScopeMsg(lang) }; throw e; }
  if (!ids.length) return null;
  const data = await api('/crm/v3/objects/quotes/batch/read', { method: 'POST', body: { properties: QUOTE_PROPS, inputs: ids.map((id) => ({ id })) } });
  const list = (data.results || []).map((r) => ({ id: String(r.id), ...r.properties }));
  list.sort((a, b) => String(b.hs_createdate || '').localeCompare(String(a.hs_createdate || '')));
  const q = list[0];
  const st = QUOTE_STATUS[q.hs_status] || [q.hs_status || '-', q.hs_status || '-', 'default'];
  return {
    id: q.id, title: q.hs_title || '', status: q.hs_status || '', statusLabel: M(lang, st[0], st[1]), variant: st[2],
    link: q.hs_quote_link || '', pdf: q.hs_pdf_download_link || '', expires: String(q.hs_expiration_date || '').slice(0, 10),
    amount: q.hs_quote_amount ? fmt(q.hs_quote_amount, q.hs_currency) : '',
  };
}

async function createPiQuote(p, lang) {
  const d = await readDeal(p.dealId);
  if (d.pipeline !== ORDER_PIPELINE || d.dealstage !== S.processing) throw new Error(M(lang, 'PI can be issued only in Order Processing.', 'Order Processing 단계에서만 PI 발행이 가능합니다.'));
  const existing = await piQuote(p.dealId, lang);
  if (existing && existing.error) throw new Error(existing.message);
  if (existing && existing.status !== 'REJECTED') throw new Error(M(lang, 'A PI quote already exists. Action required: open the existing quote.', '이미 PI 견적서가 있습니다. 필요한 조치 : 기존 견적서를 여세요.'));
  const lines = await lineItems(p.dealId);
  if (!lines.length) throw new Error(M(lang, 'There are no line items. Action required: add line items to the order.', '라인아이템이 없습니다. 필요한 조치 : 주문에 라인아이템을 추가하세요.'));
  const contacts = (await assocAll('deals', p.dealId, 'contacts')).map((r) => r.id);
  if (!contacts.length) throw new Error(M(lang, 'There is no buyer contact. Action required: associate a contact with the order.', '구매 담당자가 없습니다. 필요한 조치 : 주문에 담당자를 연결하세요.'));
  const companies = (await assocAll('deals', p.dealId, 'companies')).map((r) => r.id);
  const templateId = String(await readJson(KEY_PI_TEMPLATE, '') || DEFAULT_PI_TEMPLATE);
  const full = await api(`/crm/v3/objects/deals/${p.dealId}?properties=dealname`);
  const exp = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10); // Validity : 발행일로부터 1개월
  const properties = { hs_title: `PI - ${(full.properties || {}).dealname || p.dealId}`, hs_expiration_date: exp, hs_template_type: 'CPQ_QUOTE', hs_language: 'en' };
  if (d.deal_currency_code) properties.hs_currency = d.deal_currency_code;
  if (d.hubspot_owner_id) properties.hubspot_owner_id = d.hubspot_owner_id;
  const tplAssoc = templateId ? [{ to: { id: templateId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 286 }] }] : [];
  let quote;
  try { quote = await api('/crm/v3/objects/quotes', { method: 'POST', body: { properties, associations: tplAssoc } }); }
  catch (e) {
    if (scopeError(e)) throw new Error(noScopeMsg(lang));
    if (!tplAssoc.length) throw e;
    quote = await api('/crm/v3/objects/quotes', { method: 'POST', body: { properties } }); // 템플릿 연결 실패 시 기본 템플릿
  }
  const qid = String(quote.id);
  const link = (type, id) => api(`/crm/v4/objects/quotes/${qid}/associations/default/${type}/${id}`, { method: 'PUT' });
  await link('deals', p.dealId);
  await link('contacts', contacts[0]);
  if (companies[0]) { try { await link('companies', companies[0]); } catch (e) { /* 선택 */ } }
  // 라인아이템은 견적 전용 사본으로 연결 (거래 라인아이템은 그대로 유지)
  const copyProps = LINE_PROPS.filter((k) => k !== 'hs_position_on_quote');
  for (let i = 0; i < lines.length; i += 100) {
    const inputs = lines.slice(i, i + 100).map((l, j) => {
      const props = {};
      for (const k of copyProps) if (l[k] !== null && l[k] !== undefined && l[k] !== '') props[k] = l[k];
      props.hs_position_on_quote = String(i + j);
      return { properties: props };
    });
    const made = await api('/crm/v3/objects/line_items/batch/create', { method: 'POST', body: { inputs } });
    for (const r of made.results || []) await link('line_items', r.id);
  }
  await setDeal(p.dealId, { pi_status: 'issued' });
  await touch(p.dealId, 'op');
  return { ok: true, quoteId: qid, templateUsed: !!templateId };
}

exports.main = async (context) => {
  const p = context.parameters || {};
  const lang = p.lang === 'ko' ? 'ko' : 'en';
  try {
    if (Number(context.portalId) !== PORTAL_ID) throw new Error(M(lang, 'This account is not allowed.', '허용되지 않은 계정입니다.'));
    const userId = context.user && context.user.userId;
    switch (p.action) {
      case 'review_teams_get': return { ok: true, teams: (await allTeams()).map((t) => ({ id: t.id, name: t.name, members: t.members.length })), allowed: (await readJson(KEY_REVIEW_TEAMS, [])).map(String) };
      case 'review_teams_save': { const ids = (p.teamIds || []).map(String); await writeJson(KEY_REVIEW_TEAMS, ids); return { ok: true, allowed: ids }; }
      case 'pi_template_get': {
        let templates = []; let error = '';
        try { templates = await quoteTemplates(); } catch (e) { error = scopeError(e) ? noScopeMsg(lang) : e.message; }
        return { ok: true, templates, selected: String(await readJson(KEY_PI_TEMPLATE, '') || DEFAULT_PI_TEMPLATE), error };
      }
      case 'pi_template_save': { await writeJson(KEY_PI_TEMPLATE, String(p.templateId || '')); return { ok: true, selected: String(p.templateId || '') }; }
      default: break;
    }
    if (!p.dealId) throw new Error(M(lang, 'There is no deal. Action required: open a deal record.', '거래가 없습니다. 필요한 조치 : 거래 레코드에서 여세요.'));
    switch (p.action) {
      case 'create_load': return await createLoad(p, lang);
      case 'create_order': return await createOrder(p, lang);
      case 'progress_load': return await progressLoad(p, lang, userId);
      case 'request_review': return await requestReview(p, lang);
      case 'review': return await review(p, lang, userId);
      case 'pi': return await pi(p, lang);
      default: throw new Error(M(lang, `Unknown action: ${p.action}`, `알 수 없는 동작입니다 : ${p.action}`));
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
