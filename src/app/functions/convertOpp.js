// Lead(Partner) → Opportunity 전환 카드 공용 서버 함수 (가운데 컬럼 · 사이드바 · 설정 페이지)
// 설정(HubDB suprema_order_card_settings · convert_opp_settings) : 시작 파이프라인 · 활성 단계 · 생성 파이프라인 · 생성 단계 · 복사 속성 · 라인아이템 / 활동 복사 여부
// actions: load · convert · relink · settings_get · settings_save
// 메시지는 사용자 UI 언어(lang)로 반환 — 한국어 UI일 때만 한국어, 그 외 영어

const BASE = 'https://api.hubapi.com';
const PORTAL_ID = 245822501;
const SETTINGS_TABLE = 'suprema_order_card_settings';
const KEY = 'convert_opp_settings';
const PARTNER = '2-267605328';
const PARTNER_COMPANY = '2-268293662';
const DEFAULTS = {
  sourcePipeline: '2608041662', // Leads (Partner)
  triggerStages: ['4400178919'], // Converted (Opp Created)
  targetPipeline: '2607290060', // Opportunity
  targetStage: '4400056037', // Qualification
  copyProps: ['hubspot_owner_id', 'owning_entity', 'amount', 'closedate', 'deal_currency_code', 'description'],
  copyLineItems: true,
  copyActivities: true,
};
// 항상 복사(설정에서 뺄 수 없음)
const ALWAYS = ['hubspot_owner_id'];
// Lead 전용 라벨 → Opportunity 라벨 (거래 → Partner Company 연결, 포털 245822501 기준)
//   217 Partner Company(Lead) → 219 Partner Company(Opportunity) · 326 Global Branch(Lead) → 324 Global Branch(Opportunity)
const LABEL_MAP = { [PARTNER_COMPANY]: { 217: 219, 326: 324 } };
// 활동 기록 종류
const ACTIVITY_TYPES = ['notes', 'emails', 'calls', 'meetings', 'tasks', 'communications', 'postal_mail'];
// 연결을 복사할 대상
const ASSOC_TYPES = ['companies', 'contacts', PARTNER, PARTNER_COMPANY];
const LINE_PROPS = ['name', 'hs_product_id', 'quantity', 'price', 'hs_discount_percentage', 'discount', 'hs_sku', 'description',
  'hs_line_item_currency_code', 'remark', 'pricebook_price_discount', 'recurringbillingfrequency', 'hs_recurring_billing_period',
  'hs_recurring_billing_start_date', 'hs_position_on_quote'];
// 설정 화면에서 고를 수 없는 속성(시스템 · 계산 · 파이프라인)
const EXCLUDE = new Set(['dealname', 'pipeline', 'dealstage', 'hs_object_id', 'createdate', 'hs_lastmodifieddate', 'closed_lost_reason', 'closed_won_reason']);
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

// ---------- 설정 (HubDB) ----------
async function readRows() {
  try { return (await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/rows/draft?limit=500`)).results || []; }
  catch (e) { if (e.status === 404) return []; throw e; }
}
async function getSettings() {
  const row = (await readRows()).find((r) => r.values && r.values.setting_key === KEY);
  let s = {};
  if (row && row.values.setting_value) { try { s = JSON.parse(row.values.setting_value); } catch (e) { s = {}; } }
  const out = { ...DEFAULTS, ...s };
  out.copyProps = [...new Set([...ALWAYS, ...(Array.isArray(out.copyProps) ? out.copyProps : DEFAULTS.copyProps)])];
  out.triggerStages = Array.isArray(out.triggerStages) ? out.triggerStages.map(String) : DEFAULTS.triggerStages;
  return out;
}
async function saveSettings(s) {
  let exists = true;
  try { await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/draft`); } catch (e) { if (e.status === 404) exists = false; else throw e; }
  if (!exists) {
    await api('/cms/v3/hubdb/tables', { method: 'POST', body: {
      name: SETTINGS_TABLE, label: 'Suprema Order Cards - Settings', useForPages: false, allowPublicApiAccess: false,
      columns: [{ name: 'setting_key', label: 'Setting Key', type: 'TEXT' }, { name: 'setting_value', label: 'Setting Value', type: 'TEXT' }],
    } });
  }
  const row = (await readRows()).find((r) => r.values && r.values.setting_key === KEY);
  const values = { setting_key: KEY, setting_value: JSON.stringify(s) };
  if (row) await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/rows/${row.id}/draft`, { method: 'PATCH', body: { values } });
  else await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/rows`, { method: 'POST', body: { values } });
  await api(`/cms/v3/hubdb/tables/${SETTINGS_TABLE}/draft/publish`, { method: 'POST' });
}

async function pipelines() {
  const data = await api('/crm/v3/pipelines/deals');
  return (data.results || []).sort((a, b) => a.displayOrder - b.displayOrder).map((p) => ({
    id: p.id, label: p.label,
    stages: (p.stages || []).sort((a, b) => a.displayOrder - b.displayOrder).map((s) => ({ id: s.id, label: s.label })),
  }));
}
async function dealProps() {
  const data = await api('/crm/v3/properties/deals');
  return (data.results || [])
    .filter((p) => !EXCLUDE.has(p.name) && !(p.modificationMetadata && p.modificationMetadata.readOnlyValue) && !p.calculated && p.fieldType !== 'calculation_equation')
    .map((p) => ({ name: p.name, label: p.label, type: p.type, group: p.groupName, options: (p.options || []).map((o) => ({ value: String(o.value), label: o.label })) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ---------- 연결 ----------
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
const labelsCache = {};
async function labelsOf(toType) {
  if (!labelsCache[toType]) {
    const data = await api(`/crm/v4/associations/deals/${toType}/labels`);
    labelsCache[toType] = data.results || [];
  }
  return labelsCache[toType];
}
// Lead → Opportunity 거래 간 라벨("Opportunity" : Lead 쪽에서 본 새 거래)
async function oppLabel(lang) {
  const hit = (await labelsOf('deals')).find((l) => String(l.label || '').trim().toLowerCase() === 'opportunity');
  if (!hit) throw new Error(M(lang, 'There is no "Opportunity" deal-to-deal association label. Action required: create it in the association settings.',
    '거래 ↔ 거래 "Opportunity" 연결 라벨이 없습니다. 필요한 조치 : 연결 설정에서 라벨을 만드세요.'));
  return { associationCategory: hit.category, associationTypeId: hit.typeId };
}
async function existingOpp(dealId, lang) {
  const t = await oppLabel(lang);
  const rows = await assocAll('deals', dealId, 'deals');
  const ids = rows.filter((r) => r.types.some((x) => Number(x.typeId) === Number(t.associationTypeId))).map((r) => r.id);
  if (!ids.length) return null;
  const d = await api(`/crm/v3/objects/deals/${ids[0]}?properties=dealname,pipeline,dealstage,hubspot_owner_id,createdate`);
  return { id: String(d.id), ...d.properties };
}

async function ownerName(id, lang) {
  if (!id) return '';
  try {
    const o = await api(`/crm/v3/owners/${id}`);
    const parts = lang === 'ko' ? [o.lastName, o.firstName] : [o.firstName, o.lastName];
    return parts.filter(Boolean).join(' ') || o.email || '';
  } catch (e) { return ''; }
}
const realName = (s) => (s && /[^*\s]/.test(String(s)) ? String(s).trim() : '');
const fmtNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v); };
// 새 Opportunity 마감일 기본값 : Lead 마감일이 오늘 이후면 그대로, 지났거나 없으면 오늘 + 90일
const defaultClose = (v) => {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const d = v ? new Date(v) : null;
  if (d && !Number.isNaN(d.getTime()) && d.getTime() > today.getTime()) return d.toISOString().slice(0, 10);
  const n = new Date(today.getTime() + 90 * 86400000); return n.toISOString().slice(0, 10);
};

// 연결 요약 (미리보기용)
async function assocSummary(dealId) {
  const out = [];
  const typeLabels = {};
  for (const to of ASSOC_TYPES) {
    try {
      const rows = await assocAll('deals', dealId, to);
      if (!rows.length) continue;
      const labs = await labelsOf(to).catch(() => []);
      for (const l of labs) typeLabels[`${to}:${l.typeId}`] = l.label;
      const names = await namesOf(to, rows.map((r) => r.id));
      for (const r of rows) {
        const labels = r.types.map((x) => x.label || typeLabels[`${to}:${x.typeId}`]).filter(Boolean);
        out.push({ type: to, id: r.id, name: names[r.id] || `#${r.id}`, labels: [...new Set(labels)] });
      }
    } catch (e) { out.push({ type: to, error: e.message }); }
  }
  return out;
}
async function namesOf(type, ids) {
  const prop = { companies: ['name'], contacts: ['firstname', 'lastname', 'email'], [PARTNER]: ['partner_name'], [PARTNER_COMPANY]: ['partner_company_name'] }[type] || ['name'];
  const out = {};
  for (let i = 0; i < ids.length; i += 100) {
    const data = await api(`/crm/v3/objects/${type}/batch/read`, { method: 'POST', body: { properties: prop, inputs: ids.slice(i, i + 100).map((id) => ({ id })) } });
    for (const r of data.results || []) {
      const p = r.properties || {};
      out[String(r.id)] = type === 'contacts' ? [realName(p.firstname), realName(p.lastname)].filter(Boolean).join(' ') || p.email : p[prop[0]];
    }
  }
  return out;
}
async function activityCount(dealId) {
  const res = {};
  let total = 0;
  for (const t of ACTIVITY_TYPES) {
    try { const n = (await assocAll('deals', dealId, t)).length; res[t] = n; total += n; } catch (e) { res[t] = null; }
  }
  return { byType: res, total };
}

// ---------- 화면 데이터 ----------
async function load(p, lang) {
  const s = await getSettings();
  const pls = await pipelines();
  const head = await api(`/crm/v3/objects/deals/${p.dealId}?properties=pipeline,dealstage,dealname,closedate,hubspot_owner_id`);
  const d = head.properties || {};
  const src = pls.find((x) => x.id === s.sourcePipeline);
  const tgt = pls.find((x) => x.id === s.targetPipeline);
  const base = {
    ok: true,
    inSource: d.pipeline === s.sourcePipeline,
    active: d.pipeline === s.sourcePipeline && s.triggerStages.includes(String(d.dealstage)),
    stages: src ? src.stages : [], current: d.dealstage || '',
    triggerStages: s.triggerStages, triggerLabels: (src ? src.stages : []).filter((x) => s.triggerStages.includes(x.id)).map((x) => x.label),
    target: { pipeline: tgt ? tgt.label : s.targetPipeline, stage: ((tgt && tgt.stages.find((x) => x.id === s.targetStage)) || {}).label || s.targetStage },
    dealname: d.dealname || '', closedate: d.closedate || '', owner: await ownerName(d.hubspot_owner_id, lang), closeDefault: defaultClose(d.closedate), hasOwner: !!d.hubspot_owner_id,
    copyLineItems: s.copyLineItems, copyActivities: s.copyActivities,
  };
  if (!base.inSource) return base;
  const existing = await existingOpp(p.dealId, lang).catch(() => null);
  if (existing) {
    const pl = pls.find((x) => x.id === existing.pipeline);
    existing.pipelineLabel = pl ? pl.label : '';
    existing.stageLabel = ((pl && pl.stages.find((x) => x.id === existing.dealstage)) || {}).label || '';
    existing.ownerName = await ownerName(existing.hubspot_owner_id, lang);
  }
  base.existing = existing;
  if (p.light) return base;
  // 복사 미리보기
  const props = await api('/crm/v3/properties/deals/batch/read', { method: 'POST', body: { inputs: s.copyProps.map((name) => ({ name })) } }).catch(() => ({ results: [] }));
  const deal = await api(`/crm/v3/objects/deals/${p.dealId}?properties=${s.copyProps.join(',')}`);
  const vals = deal.properties || {};
  const defs = {};
  for (const x of props.results || []) defs[x.name] = x;
  const show = async (name) => {
    const v = vals[name];
    if (v === undefined || v === null || v === '') return '';
    if (name === 'hubspot_owner_id') return ownerName(v, lang);
    const def = defs[name];
    if (def && def.options && def.options.length) {
      return String(v).split(';').map((x) => (def.options.find((o) => String(o.value) === x) || {}).label || x).join(', ');
    }
    if (def && (def.type === 'datetime' || def.type === 'date')) return String(v).slice(0, 10);
    if (def && def.type === 'number') return fmtNum(v);
    return String(v);
  };
  base.props = [];
  for (const name of s.copyProps) base.props.push({ name, label: (defs[name] || {}).label || name, value: await show(name) });
  base.assoc = await assocSummary(p.dealId);
  base.lineItems = s.copyLineItems ? (await assocAll('deals', p.dealId, 'line_items')).length : 0;
  base.activities = s.copyActivities ? await activityCount(p.dealId) : { byType: {}, total: 0 };
  return base;
}


// 다른 카드가 바로 다시 읽도록 거래에 동기화 시각 기록 (hd_card_sync)
async function touch(dealId, tag) {
  try { await api(`/crm/v3/objects/deals/${dealId}`, { method: 'PATCH', body: { properties: { hd_card_sync: `${tag}:${Date.now()}` } } }); } catch (e) { /* 동기화 실패는 무시 */ }
}

// ---------- 전환 ----------
async function copyActivities(fromId, toId) {
  const result = { linked: 0, failed: 0, errors: [] };
  for (const t of ACTIVITY_TYPES) {
    let rows = [];
    try { rows = await assocAll('deals', fromId, t); } catch (e) { result.errors.push(`${t}: ${e.message}`); continue; }
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      try {
        await api(`/crm/v4/associations/deals/${t}/batch/associate/default`, { method: 'POST', body: { inputs: chunk.map((r) => ({ from: { id: String(toId) }, to: { id: r.id } })) } });
        result.linked += chunk.length;
      } catch (e) { result.failed += chunk.length; result.errors.push(`${t}: ${e.message}`); }
    }
  }
  return result;
}

async function copyAssociations(fromId, toId) {
  const result = { linked: 0, failed: 0, errors: [] };
  for (const to of ASSOC_TYPES) {
    let rows = [];
    try { rows = await assocAll('deals', fromId, to); } catch (e) { result.errors.push(`${to}: ${e.message}`); continue; }
    const map = LABEL_MAP[to] || {};
    const inputs = rows.map((r) => {
      const types = [];
      const seen = new Set();
      for (const x of r.types) {
        const id = map[x.typeId] || x.typeId;
        const k = `${x.category}:${id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        types.push({ associationCategory: x.category, associationTypeId: Number(id) });
      }
      return { from: { id: String(toId) }, to: { id: r.id }, types };
    });
    for (let i = 0; i < inputs.length; i += 100) {
      const chunk = inputs.slice(i, i + 100);
      try {
        await api(`/crm/v4/associations/deals/${to}/batch/create`, { method: 'POST', body: { inputs: chunk } });
        result.linked += chunk.length;
      } catch (e) { result.failed += chunk.length; result.errors.push(`${to}: ${e.message}`); }
    }
  }
  return result;
}

async function copyLineItems(fromId, toId) {
  const result = { created: 0, failed: 0, errors: [] };
  const ids = (await assocAll('deals', fromId, 'line_items')).map((r) => r.id);
  for (let i = 0; i < ids.length; i += 100) {
    const data = await api('/crm/v3/objects/line_items/batch/read', { method: 'POST', body: { properties: LINE_PROPS, inputs: ids.slice(i, i + 100).map((id) => ({ id })) } });
    const inputs = (data.results || []).map((r) => {
      const props = {};
      for (const k of LINE_PROPS) { const v = (r.properties || {})[k]; if (v !== null && v !== undefined && v !== '') props[k] = v; }
      return { properties: props, associations: [{ to: { id: String(toId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 20 }] }] };
    });
    if (!inputs.length) continue;
    try {
      await api('/crm/v3/objects/line_items/batch/create', { method: 'POST', body: { inputs } });
      result.created += inputs.length;
    } catch (e) { result.failed += inputs.length; result.errors.push(e.message); }
  }
  return result;
}

async function convert(p, lang) {
  const s = await getSettings();
  const head = await api(`/crm/v3/objects/deals/${p.dealId}?properties=pipeline,dealstage,dealname,hubspot_owner_id,${s.copyProps.join(',')}`);
  const d = head.properties || {};
  if (d.pipeline !== s.sourcePipeline) throw new Error(M(lang, 'This card can be used only for deals in the lead pipeline.', '이 카드는 Lead 파이프라인 거래에서만 사용할 수 있습니다.'));
  if (!s.triggerStages.includes(String(d.dealstage))) throw new Error(M(lang, 'The deal is not in the conversion stage. Creating an opportunity is not possible.', '전환 단계가 아닙니다. Opportunity 생성이 불가합니다.'));
  if (!d.hubspot_owner_id) throw new Error(M(lang, 'There is no deal owner. Action required: set the owner and try again.', 'Deal owner가 없습니다. 필요한 조치 : Owner를 지정한 뒤 다시 시도하세요.'));
  if (await existingOpp(p.dealId, lang)) throw new Error(M(lang, 'An opportunity was already created from this lead. Creating it again is not possible.', '이미 이 Lead에서 만든 Opportunity가 있습니다. 다시 만들기는 불가합니다.'));

  const props = {};
  for (const k of s.copyProps) { const v = d[k]; if (v !== null && v !== undefined && v !== '') props[k] = v; }
  props.dealname = String(p.dealname || d.dealname || '').trim() || d.dealname;
  if (p.closedate) props.closedate = p.closedate;
  props.pipeline = s.targetPipeline;
  props.dealstage = s.targetStage;
  const oppT = await oppLabel(lang);
  const created = await api('/crm/v3/objects/deals', { method: 'POST', body: { properties: props } });
  const newId = String(created.id);
  // 원본 Lead ↔ 새 Opportunity (중복 방지 기준이므로 가장 먼저)
  await api('/crm/v4/associations/deals/deals/batch/create', { method: 'POST', body: { inputs: [{ from: { id: String(p.dealId) }, to: { id: newId }, types: [oppT] }] } });

  const assoc = await copyAssociations(p.dealId, newId);
  const lines = s.copyLineItems ? await copyLineItems(p.dealId, newId) : { created: 0, failed: 0, errors: [] };
  const acts = s.copyActivities ? await copyActivities(p.dealId, newId) : { linked: 0, failed: 0, errors: [] };
  await touch(p.dealId, 'cv');
  return {
    ok: true, id: newId, dealname: props.dealname,
    result: { props: Object.keys(props).length - 2, assoc, lines, acts },
  };
}

// 실패한 연결 · 활동만 다시 (이미 있는 연결은 그대로 유지됨)
async function relink(p, lang) {
  const ex = await existingOpp(p.dealId, lang);
  if (!ex) throw new Error(M(lang, 'There is no opportunity created from this lead.', '이 Lead에서 만든 Opportunity가 없습니다.'));
  const s = await getSettings();
  const assoc = await copyAssociations(p.dealId, ex.id);
  const acts = s.copyActivities ? await copyActivities(p.dealId, ex.id) : { linked: 0, failed: 0, errors: [] };
  return { ok: true, id: ex.id, result: { assoc, acts } };
}

exports.main = async (context) => {
  const p = context.parameters || {};
  const lang = p.lang === 'ko' ? 'ko' : 'en';
  try {
    if (Number(context.portalId) !== PORTAL_ID) throw new Error(M(lang, 'This account is not allowed.', '허용되지 않은 계정입니다.'));
    switch (p.action) {
      case 'settings_get': return { ok: true, settings: await getSettings(), defaults: DEFAULTS, always: ALWAYS, pipelines: await pipelines(), properties: await dealProps() };
      case 'settings_save': {
        const s = p.settings || {};
        const clean = {
          sourcePipeline: String(s.sourcePipeline || DEFAULTS.sourcePipeline),
          triggerStages: (Array.isArray(s.triggerStages) ? s.triggerStages : []).map(String),
          targetPipeline: String(s.targetPipeline || DEFAULTS.targetPipeline),
          targetStage: String(s.targetStage || DEFAULTS.targetStage),
          copyProps: [...new Set([...ALWAYS, ...(Array.isArray(s.copyProps) ? s.copyProps.map(String) : [])])].filter((x) => !EXCLUDE.has(x)),
          copyLineItems: s.copyLineItems !== false,
          copyActivities: s.copyActivities !== false,
        };
        if (!clean.triggerStages.length) throw new Error(M(lang, 'Select at least one activation stage.', '활성 단계를 1개 이상 선택하세요.'));
        if (clean.sourcePipeline === clean.targetPipeline) throw new Error(M(lang, 'The lead pipeline and the opportunity pipeline must be different.', 'Lead 파이프라인과 Opportunity 파이프라인은 달라야 합니다.'));
        await saveSettings(clean);
        return { ok: true, settings: await getSettings() };
      }
    }
    if (!p.dealId) throw new Error(M(lang, 'There is no deal. Action required: open a deal record.', '거래가 없습니다. 필요한 조치 : 거래 레코드에서 여세요.'));
    switch (p.action) {
      case 'load': return await load(p, lang);
      case 'convert': return await convert(p, lang);
      case 'relink': return await relink(p, lang);
      default: throw new Error(M(lang, `Unknown action: ${p.action}`, `알 수 없는 동작입니다 : ${p.action}`));
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
