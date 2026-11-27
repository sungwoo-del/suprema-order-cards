// Order Route Info 카드 + 앱 설정 화면용 서버 함수
// 편집 권한은 HubDB 표(suprema_order_card_settings)에 저장된 "허용 팀" 기준으로 서버에서 다시 확인해요.

const BASE = 'https://api.hubapi.com';
const PORTAL_ID = 245822501;
const TABLE = 'suprema_order_card_settings';
const KEY_EDIT_TEAMS = 'route_editor_team_ids';
// 한국어 UI일 때만 한국어, 그 외는 영어
const M = (lang, en, ko) => (lang === 'ko' ? ko : en);
const loc = (lang, s) => {
  if (lang === 'ko' || !s) return s;
  const out = String(s).replace(/\s*\([^)]*[\uac00-\ud7a3][^)]*\)/g, '').trim();
  return out || s;
};
const FIELDS = ['order_route', 'selling_entity', 'buyer_type', 'revenue_type', 'erp_target'];

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
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { message: text }; }
  if (!res.ok) {
    const err = new Error(`HubSpot API ${res.status}: ${data.message || text}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------- 설정 저장소 (HubDB) ----------
async function ensureTable() {
  try {
    return await api(`/cms/v3/hubdb/tables/${TABLE}/draft`);
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  await api('/cms/v3/hubdb/tables', {
    method: 'POST',
    body: {
      name: TABLE,
      label: 'Suprema Order Cards - 설정',
      useForPages: false,
      allowPublicApiAccess: false,
      columns: [
        { name: 'setting_key', label: 'Setting Key', type: 'TEXT' },
        { name: 'setting_value', label: 'Setting Value', type: 'TEXT' },
      ],
    },
  });
  await api(`/cms/v3/hubdb/tables/${TABLE}/draft/publish`, { method: 'POST' });
  return null;
}

async function readSetting(key) {
  try {
    const data = await api(`/cms/v3/hubdb/tables/${TABLE}/rows/draft?limit=100`);
    const row = (data.results || []).find((r) => r.values && r.values.setting_key === key);
    return row ? { id: row.id, value: row.values.setting_value } : null;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function writeSetting(key, value) {
  await ensureTable();
  const cur = await readSetting(key);
  const values = { setting_key: key, setting_value: value };
  if (cur) {
    await api(`/cms/v3/hubdb/tables/${TABLE}/rows/${cur.id}/draft`, { method: 'PATCH', body: { values } });
  } else {
    await api(`/cms/v3/hubdb/tables/${TABLE}/rows`, { method: 'POST', body: { values } });
  }
  await api(`/cms/v3/hubdb/tables/${TABLE}/draft/publish`, { method: 'POST' });
}

async function getEditTeamIds() {
  const s = await readSetting(KEY_EDIT_TEAMS);
  if (!s || !s.value) return [];
  try { return JSON.parse(s.value).map(String); } catch (e) { return []; }
}

// ---------- 팀 / 권한 ----------
async function listTeams() {
  const data = await api('/settings/v3/users/teams');
  return (data.results || []).map((t) => ({
    id: String(t.id),
    name: t.name,
    userIds: [...(t.userIds || []), ...(t.secondaryUserIds || [])].map(String),
  }));
}

async function canUserEdit(userId) {
  const allowed = await getEditTeamIds();
  if (!allowed.length) return { canEdit: false, allowed, myTeams: [] };
  const teams = await listTeams();
  const myTeams = teams.filter((t) => t.userIds.includes(String(userId)));
  const canEdit = myTeams.some((t) => allowed.includes(t.id));
  return { canEdit, allowed, myTeams: myTeams.map((t) => t.name) };
}

// ---------- 거래 필드 ----------
async function fieldDefs(lang) {
  const defs = [];
  for (const name of FIELDS) {
    const p = await api(`/crm/v3/properties/deals/${name}`);
    defs.push({
      name,
      label: loc(lang, p.label),
      fieldType: p.fieldType, // select | checkbox | radio ...
      options: (p.options || []).filter((o) => !o.hidden).map((o) => ({ label: loc(lang, o.label), value: o.value })),
    });
  }
  return defs;
}

exports.main = async (context) => {
  const p = context.parameters || {};
  const lang = p.lang === 'ko' ? 'ko' : 'en';
  try {
    if (Number(context.portalId) !== PORTAL_ID) throw new Error(M(lang, 'This account is not allowed.', '허용되지 않은 계정입니다.'));
    const userId = context.user && context.user.userId;

    switch (p.action) {
      case 'load': {
        const [defs, perm, deal] = await Promise.all([
          fieldDefs(lang),
          canUserEdit(userId),
          api(`/crm/v3/objects/deals/${p.dealId}?properties=${FIELDS.join(',')},order_route_summary,pricebook_select,hs_num_of_associated_line_items`),
        ]);
        const vals = deal.properties || {};
        let pricebookLabel = vals.pricebook_select || '';
        if (pricebookLabel) {
          try {
            const pb = await api('/crm/v3/properties/deals/pricebook_select');
            const o = (pb.options || []).find((x) => x.value === pricebookLabel);
            if (o) pricebookLabel = o.label;
          } catch (e) { /* 라벨 조회 실패 시 값 그대로 */ }
        }
        return {
          ok: true,
          fields: defs,
          values: vals,
          lineItemCount: Number(vals.hs_num_of_associated_line_items || 0),
          pricebookLabel,
          canEdit: perm.canEdit,
          myTeams: perm.myTeams,
          hasRule: perm.allowed.length > 0,
        };
      }
      case 'save': {
        const perm = await canUserEdit(userId);
        if (!perm.canEdit) throw new Error(M(lang, 'No edit permission. Action required: ask an admin to add your team in the app settings.', '수정 권한이 없습니다. 필요한 조치 : 앱 설정에서 허용된 팀에 포함되어야 합니다.'));
        const cur = await api(`/crm/v3/objects/deals/${p.dealId}?properties=hs_num_of_associated_line_items`);
        if (Number((cur.properties || {}).hs_num_of_associated_line_items || 0) > 0) {
          throw new Error(M(lang, 'Not allowed: line items are attached. Action required: reset the line items.', '변경 불가합니다. 필요한 조치 : 라인아이템을 초기화하세요.'));
        }
        const props = {};
        for (const name of FIELDS) {
          if (p.values && Object.prototype.hasOwnProperty.call(p.values, name)) props[name] = String(p.values[name] ?? '');
        }
        await api(`/crm/v3/objects/deals/${p.dealId}`, { method: 'PATCH', body: { properties: props } });
        return { ok: true, saved: props };
      }
      case 'settings_get': {
        const [teams, allowed] = await Promise.all([listTeams(), getEditTeamIds()]);
        return { ok: true, teams: teams.map((t) => ({ id: t.id, name: t.name, members: t.userIds.length })), allowed };
      }
      case 'settings_save': {
        const ids = (p.teamIds || []).map(String);
        await writeSetting(KEY_EDIT_TEAMS, JSON.stringify(ids));
        return { ok: true, allowed: ids };
      }
      default:
        throw new Error(M(lang, `Unknown action: ${p.action}`, `알 수 없는 작업입니다 : ${p.action}`));
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
