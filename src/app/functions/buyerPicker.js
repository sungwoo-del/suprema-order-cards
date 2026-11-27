// Buyer Picker 서버 함수
// - companies : Owner Branch 리전의 Partner Company 목록
// - contacts  : 선택한 Partner Company에 연결된 Partner(담당자) 목록
// - save      : 거래의 Buyer Company/Contact - {리전} 값 저장
//               (드롭다운 옵션에 없으면 옵션을 먼저 추가 → 기존 W6/W6c 워크플로가 연결 처리)

const BASE = 'https://api.hubapi.com';
// 한국어 UI일 때만 한국어, 그 외는 영어
const M = (lang, en, ko) => (lang === 'ko' ? ko : en);
const PORTAL_ID = 245822501;
const PARTNER_COMPANY = '2-268293662';
const PARTNER = '2-267605328';

// owning_entity 값 → Partner Company.recommended_team 값
const REGION_TEAM = { hq: 'APAC', eu: 'EU', uk: 'UK', us: 'US', jp: 'JP', in: 'IN', me: 'ME', latam: 'LATAM' };

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.PRIVATE_APP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data && data.message ? data.message : text;
    throw new Error(`HubSpot API ${res.status}: ${msg}`);
  }
  return data;
}

async function listCompanies(region, lang) {
  const team = REGION_TEAM[region];
  if (!team) throw new Error(M(lang, `Unknown region: ${region}`, `알 수 없는 리전입니다 : ${region}`));
  const out = [];
  let after;
  for (let i = 0; i < 10; i++) {
    const data = await api(`/crm/v3/objects/${PARTNER_COMPANY}/search`, {
      method: 'POST',
      body: {
        filterGroups: [{ filters: [{ propertyName: 'recommended_team', operator: 'EQ', value: team }] }],
        properties: ['partner_company_name', 'partner_type'],
        sorts: [{ propertyName: 'partner_company_name', direction: 'ASCENDING' }],
        limit: 200,
        after,
      },
    });
    for (const r of data.results || []) {
      out.push({
        value: String(r.id),
        label: r.properties.partner_company_name || M(lang, `(No name) ${r.id}`, `(이름 없음) ${r.id}`),
        type: r.properties.partner_type || '',
      });
    }
    after = data.paging && data.paging.next ? data.paging.next.after : undefined;
    if (!after) break;
  }
  // 회사별 연결된 Partner(담당자) 수
  for (let i = 0; i < out.length; i += 1000) {
    const chunk = out.slice(i, i + 1000);
    try {
      const data = await api(`/crm/v4/associations/${PARTNER_COMPANY}/${PARTNER}/batch/read`, {
        method: 'POST',
        body: { inputs: chunk.map((c) => ({ id: c.value })) },
      });
      const counts = {};
      for (const r of data.results || []) counts[String(r.from.id)] = (r.to || []).length;
      for (const c of chunk) c.contactCount = counts[c.value] || 0;
    } catch (e) {
      for (const c of chunk) c.contactCount = null;
    }
  }
  return out;
}

async function listContacts(companyId, lang) {
  const assoc = await api(`/crm/v4/objects/${PARTNER_COMPANY}/${companyId}/associations/${PARTNER}?limit=500`);
  const ids = [...new Set((assoc.results || []).map((r) => String(r.toObjectId)))];
  if (!ids.length) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const data = await api(`/crm/v3/objects/${PARTNER}/batch/read`, {
      method: 'POST',
      body: { properties: ['partner_name', 'email'], inputs: ids.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const r of data.results || []) {
      out.push({ value: String(r.id), label: r.properties.partner_name || r.properties.email || M(lang, `(No name) ${r.id}`, `(이름 없음) ${r.id}`) });
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

// 드롭다운 속성에 옵션이 없으면 추가 (기존 옵션은 그대로 유지)
async function ensureOption(propName, value, label) {
  const prop = await api(`/crm/v3/properties/deals/${propName}`);
  const options = prop.options || [];
  if (options.some((o) => String(o.value) === String(value))) return false;
  options.push({ value: String(value), label, hidden: false, displayOrder: options.length });
  await api(`/crm/v3/properties/deals/${propName}`, { method: 'PATCH', body: { options } });
  return true;
}

async function save({ dealId, region, companyId, companyLabel, contactId, contactLabel }, lang) {
  if (!REGION_TEAM[region]) throw new Error(M(lang, `Unknown region: ${region}`, `알 수 없는 리전입니다 : ${region}`));
  if (!dealId || !companyId) throw new Error(M(lang, 'There is no deal or buyer company. Action required: select a buyer company.', '거래 또는 구매 회사가 없습니다. 필요한 조치 : 구매 회사를 선택하세요.'));

  // 잠긴 거래는 수정하지 않음
  const deal = await api(`/crm/v3/objects/deals/${dealId}?properties=hs_num_of_associated_line_items`);
  if (Number((deal.properties || {}).hs_num_of_associated_line_items || 0) > 0) {
    throw new Error(M(lang, 'Not allowed: line items are attached. Action required: reset the line items.', '변경 불가합니다. 필요한 조치 : 라인아이템을 초기화하세요.'));
  }

  const companyProp = `partner_${region}`;
  const contactProp = `partner_owner_${region}`;
  const added = [];
  if (await ensureOption(companyProp, companyId, companyLabel)) added.push(companyProp);
  if (contactId && (await ensureOption(contactProp, contactId, `${contactLabel} [${companyLabel}]`))) added.push(contactProp);

  const properties = { [companyProp]: String(companyId), [contactProp]: contactId ? String(contactId) : '' };
  await api(`/crm/v3/objects/deals/${dealId}`, { method: 'PATCH', body: { properties } });
  return { saved: properties, addedOptions: added };
}

exports.main = async (context) => {
  const p = context.parameters || {};
  const lang = p.lang === 'ko' ? 'ko' : 'en';
  try {
    if (Number(context.portalId) !== PORTAL_ID) throw new Error(M(lang, 'This account is not allowed.', '허용되지 않은 계정입니다.'));
    switch (p.action) {
      case 'companies':
        return { ok: true, companies: await listCompanies(p.region, lang) };
      case 'contacts':
        return { ok: true, contacts: await listContacts(p.companyId, lang) };
      case 'save':
        return { ok: true, ...(await save(p, lang)) };
      default:
        throw new Error(M(lang, `Unknown action: ${p.action}`, `알 수 없는 작업입니다 : ${p.action}`));
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
