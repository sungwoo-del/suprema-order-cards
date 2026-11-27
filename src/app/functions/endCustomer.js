// End Customer(최종 고객사) 카드 — 가운데 컬럼 카드 · 오른쪽 사이드바 카드 공용 서버 함수
// 규칙 : 회사는 거래당 1개 · 담당자는 여러 명 · 둘 다 "End Customer" 연결 라벨 사용
// actions: load · search · contacts · save · unlink · createCompany · createContact
// 메시지는 사용자 UI 언어(lang)로 반환 — 한국어 UI일 때만 한국어, 그 외 영어

const BASE = 'https://api.hubapi.com';
const PORTAL_ID = 245822501;
const LABEL = 'End Customer';
const TEAMS = ['APAC', 'ME', 'LATAM', 'UK', 'US', 'IN', 'JP', 'EU', 'KBS'];
// Owner Branch → Recommended Team (거래 소유자 팀으로 리전을 못 찾을 때만 사용, HQ는 필터 없음)
const BRANCH_TEAM = { eu: 'EU', uk: 'UK', us: 'US', jp: 'JP', in: 'IN', me: 'ME', latam: 'LATAM' };
const CO_PROPS = ['name', 'domain', 'website', 'account_country', 'industry', 'lifecyclestage', 'recommended_team', 'hubspot_owner_id'];
const CT_PROPS = ['firstname', 'lastname', 'email', 'jobtitle', 'job_function', 'phone', 'mobilephone'];
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
  if (!res.ok) throw new Error(`HubSpot API ${res.status}: ${data.message || text}`);
  return data;
}

// 거래 → 회사 / 담당자 "End Customer" 라벨 ID (포털에서 이름으로 찾음)
const labelCache = {};
async function labelType(to, lang) {
  if (labelCache[to]) return labelCache[to];
  const data = await api(`/crm/v4/associations/deals/${to}/labels`);
  const hit = (data.results || []).find((l) => String(l.label || '').trim().toLowerCase() === LABEL.toLowerCase());
  if (!hit) throw new Error(M(lang, `There is no "${LABEL}" association label for deal → ${to}. Action required: create it in the association settings.`,
    `거래 → ${to === 'companies' ? '회사' : '담당자'} "${LABEL}" 연결 라벨이 없습니다. 필요한 조치 : 연결 설정에서 라벨을 만드세요.`));
  labelCache[to] = { associationCategory: hit.category, associationTypeId: hit.typeId };
  return labelCache[to];
}

// 거래에 연결된 레코드 중 End Customer 라벨이 붙은 ID
async function labeled(dealId, to, lang) {
  const t = await labelType(to, lang);
  const out = [];
  let after = '';
  do {
    const data = await api(`/crm/v4/objects/deals/${dealId}/associations/${to}?limit=500${after ? `&after=${after}` : ''}`);
    for (const r of data.results || []) {
      if ((r.associationTypes || []).some((a) => Number(a.typeId) === Number(t.associationTypeId))) out.push(String(r.toObjectId));
    }
    after = data.paging && data.paging.next ? data.paging.next.after : '';
  } while (after);
  return out;
}

async function batchRead(type, ids, props) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const data = await api(`/crm/v3/objects/${type}/batch/read`, { method: 'POST', body: { properties: props, inputs: ids.slice(i, i + 100).map((id) => ({ id })) } });
    for (const r of data.results || []) out.push({ id: String(r.id), ...r.properties });
  }
  return out;
}

// 드롭다운 값 → 표시 라벨
async function optionMap(type, names) {
  const data = await api(`/crm/v3/properties/${type}/batch/read`, { method: 'POST', body: { inputs: names.map((name) => ({ name })) } });
  const map = {};
  for (const p of data.results || []) map[p.name] = (p.options || []).filter((o) => !o.hidden).map((o) => ({ label: o.label, value: String(o.value) }));
  return map;
}
const lab = (map, name, v) => { if (!v) return ''; const o = (map[name] || []).find((x) => x.value === String(v)); return o ? o.label : String(v); };

async function ownerName(id, lang) {
  if (!id) return '';
  try {
    const o = await api(`/crm/v3/owners/${id}`);
    // 한국어 UI는 HubSpot 표기와 같은 "성 이름" 순서
    const parts = lang === 'ko' ? [o.lastName, o.firstName] : [o.firstName, o.lastName];
    return parts.filter(Boolean).join(' ') || o.email || '';
  } catch (e) { return ''; }
}

// 거래 소유자 팀 → Recommended Team 리전
async function regionOf(dealId) {
  const d = await api(`/crm/v3/objects/deals/${dealId}?properties=hubspot_team_id,owning_entity,hubspot_owner_id`);
  const p = d.properties || {};
  let team = '';
  let teamName = '';
  if (p.hubspot_team_id) {
    try {
      const teams = await api('/settings/v3/users/teams');
      const t = (teams.results || []).find((x) => String(x.id) === String(p.hubspot_team_id));
      teamName = t ? t.name : '';
      const head = String(teamName).split('-')[0].trim().toUpperCase();
      if (TEAMS.includes(head)) team = head;
    } catch (e) { /* 팀 정보를 못 읽으면 Owner Branch로 */ }
  }
  if (!team) team = BRANCH_TEAM[String(p.owning_entity || '').toLowerCase()] || '';
  return { team, teamName, owner: p.hubspot_owner_id || '' };
}

function companyView(c, maps, owner) {
  return {
    id: c.id, name: c.name || '', domain: c.domain || '', website: c.website || c.domain || '',
    country: lab(maps, 'account_country', c.account_country), industry: lab(maps, 'industry', c.industry),
    lifecycle: lab(maps, 'lifecyclestage', c.lifecyclestage), team: c.recommended_team || '', owner: owner || '',
  };
}
// 마스킹된 이름(* 만 있는 값)은 이름으로 쓰지 않음 → 이메일로 표시
const realName = (s) => (s && /[^*\s]/.test(String(s)) ? String(s).trim() : '');
function contactView(c, maps) {
  return {
    id: c.id, name: [realName(c.firstname), realName(c.lastname)].filter(Boolean).join(' ') || c.email || `#${c.id}`, email: c.email || '',
    jobtitle: c.jobtitle || '', jobfunction: c.job_function || '', phone: c.phone || c.mobilephone || '',
  };
}

async function maps() {
  return optionMap('companies', ['account_country', 'industry', 'lifecyclestage']);
}

async function load(p, lang) {
  const [region, mp, coIds, ctIds] = await Promise.all([regionOf(p.dealId), maps(), labeled(p.dealId, 'companies', lang), labeled(p.dealId, 'contacts', lang)]);
  let company = null;
  const extraCompanies = [];
  if (coIds.length) {
    const rows = await batchRead('companies', coIds, CO_PROPS);
    const first = rows[0];
    if (first) company = companyView(first, mp, await ownerName(first.hubspot_owner_id, lang));
    for (const r of rows.slice(1)) extraCompanies.push({ id: r.id, name: r.name || '' });
  }
  const contacts = ctIds.length ? (await batchRead('contacts', ctIds, CT_PROPS)).map((c) => contactView(c, mp)) : [];
  return {
    ok: true, region: region.team, teamName: region.teamName, company, extraCompanies, contacts,
    options: { country: mp.account_country || [], industry: mp.industry || [] },
  };
}

async function search(p, lang) {
  const q = String(p.query || '').trim();
  const filters = [];
  if (p.region) filters.push({ propertyName: 'recommended_team', operator: 'EQ', value: p.region });
  // 검색어가 없으면 최근 수정된 회사부터, 있으면 검색 관련도 순
  const body = { properties: CO_PROPS, limit: 20, filterGroups: filters.length ? [{ filters }] : [] };
  if (q) body.query = q;
  else body.sorts = [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }];
  const [data, mp] = await Promise.all([api('/crm/v3/objects/companies/search', { method: 'POST', body }), optionMap('companies', ['account_country', 'lifecyclestage'])]);
  const results = (data.results || []).map((r) => {
    const c = { id: String(r.id), ...r.properties };
    return { id: c.id, name: c.name || c.domain || `#${c.id}`, domain: c.domain || '', country: lab(mp, 'account_country', c.account_country), lifecycle: lab(mp, 'lifecyclestage', c.lifecyclestage) };
  });
  return { ok: true, results, total: data.total || results.length };
}

async function contacts(p, lang) {
  if (!p.companyId) return { ok: true, results: [] };
  const ids = [];
  let after = '';
  do {
    const data = await api(`/crm/v4/objects/companies/${p.companyId}/associations/contacts?limit=500${after ? `&after=${after}` : ''}`);
    for (const r of data.results || []) ids.push(String(r.toObjectId));
    after = data.paging && data.paging.next ? data.paging.next.after : '';
  } while (after && ids.length < 1000);
  const rows = ids.length ? (await batchRead('contacts', [...new Set(ids)], CT_PROPS)).map((c) => contactView(c, {})) : [];
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, results: rows };
}


// 다른 카드가 바로 다시 읽도록 거래에 동기화 시각 기록 (hd_card_sync)
async function touch(dealId, tag) {
  try { await api(`/crm/v3/objects/deals/${dealId}`, { method: 'PATCH', body: { properties: { hd_card_sync: `${tag}:${Date.now()}` } } }); } catch (e) { /* 동기화 실패는 무시 */ }
}

async function addLabel(dealId, to, toId, t) {
  await api(`/crm/v4/associations/deals/${to}/batch/create`, { method: 'POST', body: { inputs: [{ from: { id: String(dealId) }, to: { id: String(toId) }, types: [t] }] } });
}
async function removeLabel(dealId, to, ids, t) {
  if (!ids.length) return;
  // 라벨만 떼고 거래와의 다른 연결은 그대로 둠
  await api(`/crm/v4/associations/deals/${to}/batch/labels/archive`, { method: 'POST', body: { inputs: ids.map((id) => ({ from: { id: String(dealId) }, to: { id: String(id) }, types: [t] })) } });
}

// 저장 : company = 새 회사 ID('' = 회사 연결 해제, undefined = 그대로), contactIds = 최종 담당자 목록(undefined = 그대로)
async function save(p, lang) {
  const coT = await labelType('companies', lang);
  const ctT = await labelType('contacts', lang);
  if (p.companyId !== undefined && p.companyId !== null) {
    const cur = await labeled(p.dealId, 'companies', lang);
    const next = String(p.companyId || '');
    await removeLabel(p.dealId, 'companies', cur.filter((id) => id !== next), coT);
    if (next && !cur.includes(next)) await addLabel(p.dealId, 'companies', next, coT);
  }
  if (Array.isArray(p.contactIds)) {
    const cur = await labeled(p.dealId, 'contacts', lang);
    const next = [...new Set(p.contactIds.map(String))];
    await removeLabel(p.dealId, 'contacts', cur.filter((id) => !next.includes(id)), ctT);
    const add = next.filter((id) => !cur.includes(id));
    if (add.length) {
      await api('/crm/v4/associations/deals/contacts/batch/create', { method: 'POST', body: { inputs: add.map((id) => ({ from: { id: String(p.dealId) }, to: { id }, types: [ctT] })) } });
    }
  }
  await touch(p.dealId, 'ec');
  return load(p, lang);
}

async function unlink(p, lang) {
  const to = p.kind === 'company' ? 'companies' : 'contacts';
  const t = await labelType(to, lang);
  await removeLabel(p.dealId, to, [String(p.id)], t);
  await touch(p.dealId, 'ec');
  return load(p, lang);
}

async function createCompany(p, lang) {
  const v = p.values || {};
  const name = String(v.name || '').trim();
  if (!name) throw new Error(M(lang, 'Company name is required.', '회사명은 비워 둘 수 없습니다.'));
  if (!v.account_country) throw new Error(M(lang, '#Country is required.', '#Country는 비워 둘 수 없습니다.'));
  const domain = String(v.domain || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
  if (domain) {
    const dup = await api('/crm/v3/objects/companies/search', { method: 'POST', body: { properties: ['name', 'domain'], limit: 1, filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: domain }] }] } });
    const hit = (dup.results || [])[0];
    if (hit) return { ok: true, duplicate: true, company: { id: String(hit.id), name: hit.properties.name || domain, domain } };
  }
  const props = { name, account_country: v.account_country };
  if (domain) props.domain = domain;
  if (v.industry) props.industry = v.industry;
  const c = await api('/crm/v3/objects/companies', { method: 'POST', body: { properties: props } });
  return { ok: true, duplicate: false, company: { id: String(c.id), name, domain } };
}

async function createContact(p, lang) {
  const v = p.values || {};
  const email = String(v.email || '').trim().toLowerCase();
  if (!String(v.firstname || '').trim()) throw new Error(M(lang, 'First name is required.', '이름은 비워 둘 수 없습니다.'));
  if (!email) throw new Error(M(lang, 'Email is required.', '이메일은 비워 둘 수 없습니다.'));
  const dup = await api('/crm/v3/objects/contacts/search', { method: 'POST', body: { properties: CT_PROPS, limit: 1, filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }] } });
  const hit = (dup.results || [])[0];
  if (hit) {
    // 이미 있는 담당자 → 선택한 회사와 연결만 추가
    if (p.companyId) await api(`/crm/v4/objects/contacts/${hit.id}/associations/default/companies/${p.companyId}`, { method: 'PUT' });
    return { ok: true, duplicate: true, contact: { id: String(hit.id), name: [hit.properties.firstname, hit.properties.lastname].filter(Boolean).join(' ') || email, email } };
  }
  const props = { firstname: String(v.firstname).trim(), email };
  if (v.lastname) props.lastname = String(v.lastname).trim();
  if (v.jobtitle) props.jobtitle = String(v.jobtitle).trim();
  if (v.job_function) props.job_function = String(v.job_function).trim();
  const body = { properties: props };
  if (p.companyId) body.associations = [{ to: { id: String(p.companyId) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 1 }] }];
  const c = await api('/crm/v3/objects/contacts', { method: 'POST', body });
  return { ok: true, duplicate: false, contact: { id: String(c.id), name: [props.firstname, props.lastname].filter(Boolean).join(' '), email } };
}

exports.main = async (context) => {
  const p = context.parameters || {};
  const lang = p.lang === 'ko' ? 'ko' : 'en';
  try {
    if (Number(context.portalId) !== PORTAL_ID) throw new Error(M(lang, 'This account is not allowed.', '허용되지 않은 계정입니다.'));
    if (!p.dealId) throw new Error(M(lang, 'There is no deal. Action required: open a deal record.', '거래가 없습니다. 필요한 조치 : 거래 레코드에서 여세요.'));
    switch (p.action) {
      case 'load': return await load(p, lang);
      case 'search': return await search(p, lang);
      case 'contacts': return await contacts(p, lang);
      case 'save': return await save(p, lang);
      case 'unlink': return await unlink(p, lang);
      case 'createCompany': return await createCompany(p, lang);
      case 'createContact': return await createContact(p, lang);
      default: throw new Error(M(lang, `Unknown action: ${p.action}`, `알 수 없는 동작입니다 : ${p.action}`));
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
