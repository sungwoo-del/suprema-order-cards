// 오른쪽 컬럼(사이드바) 앱카드 4종 공용 서버 함수 — 읽기 전용
// actions: summary · lineitems · buyer · route
// 메시지 · 라벨은 사용자 UI 언어(lang)로 반환 — 한국어 UI일 때만 한국어, 그 외 영어

const BASE = 'https://api.hubapi.com';
const PORTAL_ID = 245822501;
const PARTNER_COMPANY = '2-268293662';
const PARTNER = '2-267605328';
const REGIONS = ['hq', 'eu', 'uk', 'us', 'jp', 'in', 'me', 'latam'];
const M = (lang, en, ko) => (lang === 'ko' ? ko : en);
const loc = (lang, s) => (lang === 'ko' || !s ? s : String(s).replace(/\s*\([^)]*[가-힣][^)]*\)/g, '').trim());

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.PRIVATE_APP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { message: text }; }
  if (!res.ok) throw new Error(`HubSpot API ${res.status}: ${data.message || text}`);
  return data;
}

const DEAL_PROPS = ['dealname', 'pipeline', 'dealstage', 'amount', 'owning_entity', 'buyer_type', 'partner_region_select', 'buying_branch',
  'order_type', 'erp_sales_type', 'pricebook_select', 'deal_currency_code', 'order_route', 'selling_entity', 'erp_target', 'revenue_type',
  'ship_to_address', 'requested_delivery_date', 'hs_num_of_associated_line_items'];

async function readDeal(dealId, extra = []) {
  const head = await api(`/crm/v3/objects/deals/${dealId}?properties=owning_entity`);
  const region = String((head.properties || {}).owning_entity || '').toLowerCase();
  const props = [...DEAL_PROPS, ...extra];
  if (REGIONS.includes(region)) props.push(`partner_${region}`, `partner_owner_${region}`);
  const d = await api(`/crm/v3/objects/deals/${dealId}?properties=${props.join(',')}`);
  return { region, p: d.properties || {} };
}

// 드롭다운 값 → 표시 라벨
async function labeler(names, lang) {
  const data = await api('/crm/v3/properties/deals/batch/read', { method: 'POST', body: { inputs: names.map((name) => ({ name })) } });
  const map = {};
  for (const prop of data.results || []) {
    const opts = {};
    for (const o of prop.options || []) opts[String(o.value)] = loc(lang, o.label);
    map[prop.name] = opts;
  }
  return (name, v) => (v === undefined || v === null || v === '' ? '' : (map[name] && map[name][String(v)]) || String(v));
}

async function lineItems(dealId) {
  const assoc = await api(`/crm/v4/objects/deals/${dealId}/associations/line_items?limit=500`);
  const ids = (assoc.results || []).map((r) => String(r.toObjectId));
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

async function pipelineInfo(pipelineId, stageId) {
  if (!pipelineId) return { pipeline: '', stages: [], current: -1 };
  try {
    const pl = await api(`/crm/v3/pipelines/deals/${pipelineId}`);
    const stages = (pl.stages || []).sort((a, b) => a.displayOrder - b.displayOrder).map((s) => ({ id: s.id, label: s.label }));
    return { pipeline: pl.label || '', stages, current: stages.findIndex((s) => s.id === stageId) };
  } catch (e) { return { pipeline: '', stages: [], current: -1 }; }
}

async function summary(p, lang) {
  const { region, p: d } = await readDeal(p.dealId);
  const L = await labeler(['owning_entity', 'buyer_type', 'partner_region_select', 'order_type', 'erp_sales_type', 'pricebook_select', 'order_route', 'selling_entity', 'revenue_type',
    ...(REGIONS.includes(region) ? [`partner_${region}`, `partner_owner_${region}`] : [])], lang);
  const internal = d.buyer_type === 'internal_entity';
  const count = Number(d.hs_num_of_associated_line_items || 0);
  const done = [
    !!(d.buyer_type && d.partner_region_select),
    internal || !!(d[`partner_${region}`] && d[`partner_owner_${region}`]),
    !!(d.order_type && d.erp_sales_type),
    !!d.pricebook_select,
    count > 0,
  ];
  const stripRef = (s) => String(s || '').replace(/\s*\[[^\]]*\]$/, '');
  return {
    ok: true,
    route: L('order_route', d.order_route), routeCode: d.order_route || '',
    doneCount: done.filter(Boolean).length,
    next: done.findIndex((x) => !x),
    rows: [
      { k: 'branch', v: [L('owning_entity', d.owning_entity), L('partner_region_select', d.partner_region_select)].filter(Boolean).join(' · ') },
      { k: 'buyer', v: internal ? M(lang, 'Branch entity (HQ/Branch)', '지사 법인 (HQ/Branch)') : [stripRef(L(`partner_${region}`, d[`partner_${region}`])), stripRef(L(`partner_owner_${region}`, d[`partner_owner_${region}`]))].filter(Boolean).join(' · ') },
      { k: 'type', v: [L('order_type', d.order_type), L('erp_sales_type', d.erp_sales_type)].filter(Boolean).join(' · ') },
      { k: 'price', v: [L('pricebook_select', d.pricebook_select), d.deal_currency_code].filter(Boolean).join(' · ') },
    ],
    lineItems: count,
  };
}

async function lineitemsAction(p) {
  const items = await lineItems(p.dealId);
  const cur = items[0] ? items[0].hs_line_item_currency_code || '' : '';
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const pre = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0);
  return { ok: true, items, total, discount: Math.max(0, pre - total), currency: cur };
}

async function buyer(p, lang) {
  const { region, p: d } = await readDeal(p.dealId);
  if (d.buyer_type === 'internal_entity') {
    return { ok: true, internal: true, region, branchCompanyId: d.buying_branch || '' };
  }
  const companyId = REGIONS.includes(region) ? d[`partner_${region}`] : '';
  const contactId = REGIONS.includes(region) ? d[`partner_owner_${region}`] : '';
  let company = null; let contact = null;
  if (companyId) {
    try {
      const c = await api(`/crm/v3/objects/${PARTNER_COMPANY}/${companyId}?properties=partner_company_name,vat_id,is_orderable,recommended_team,country,partner_type`);
      company = { id: String(c.id), ...c.properties };
    } catch (e) { company = { id: String(companyId), missing: true }; }
  }
  if (contactId) {
    try {
      const c = await api(`/crm/v3/objects/${PARTNER}/${contactId}?properties=partner_name,email`);
      contact = { id: String(c.id), ...c.properties };
    } catch (e) { contact = { id: String(contactId), missing: true }; }
  }
  return { ok: true, internal: false, region, company, contact, partnerCompanyType: PARTNER_COMPANY, partnerType: PARTNER };
}

async function route(p, lang) {
  const { p: d } = await readDeal(p.dealId);
  const L = await labeler(['order_route', 'selling_entity', 'revenue_type', 'order_type'], lang);
  const pi = await pipelineInfo(d.pipeline, d.dealstage);
  return {
    ok: true,
    route: L('order_route', d.order_route), routeCode: d.order_route || '',
    erpBranch: L('selling_entity', d.selling_entity), erpTarget: d.erp_target || '', revenue: L('revenue_type', d.revenue_type),
    orderType: L('order_type', d.order_type),
    pipeline: pi.pipeline, stages: pi.stages, current: pi.current,
  };
}

exports.main = async (context) => {
  const p = context.parameters || {};
  const lang = p.lang === 'ko' ? 'ko' : 'en';
  try {
    if (Number(context.portalId) !== PORTAL_ID) throw new Error(M(lang, 'This account is not allowed.', '허용되지 않은 계정입니다.'));
    if (!p.dealId) throw new Error(M(lang, 'There is no deal. Action required: open a deal record.', '거래가 없습니다. 필요한 조치 : 거래 레코드에서 여세요.'));
    switch (p.action) {
      case 'summary': return await summary(p, lang);
      case 'lineitems': return await lineitemsAction(p, lang);
      case 'buyer': return await buyer(p, lang);
      case 'route': return await route(p, lang);
      default: throw new Error(M(lang, `Unknown action: ${p.action}`, `알 수 없는 동작입니다 : ${p.action}`));
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
