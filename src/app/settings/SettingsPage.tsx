import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Divider, Flex, Heading, LoadingSpinner, MultiSelect, Select, Text, Toggle, hubspot } from '@hubspot/ui-extensions';

type Team = { id: string; name: string; members: number };
type Lang = 'en' | 'ko';
type Rules = Record<string, string>;

// 한국어 UI일 때만 한국어, 그 외는 영어
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLang = (context: any): Lang =>
  String(context?.user?.locale || context?.user?.language || 'en').toLowerCase().startsWith('ko') ? 'ko' : 'en';

const FIELD_NAMES: Record<string, [string, string]> = {
  owning_entity: ['Owner Branch', 'Owner Branch (거래 소유자의 지사)'],
  buyer_type: ['Buyer Type', 'Buyer Type (구매자 유형)'],
  partner_region_select: ['Order Branch', 'Order Branch (판매 지사)'],
  buying_branch: ['Order Branch Company', 'Order Branch Company (판매 지사 법인)'],
  buyer_company: ['Buyer Company', 'Buyer Company (구매 회사)'],
  buyer_contact: ['Buyer Contact', 'Buyer Contact (구매 담당자)'],
  order_type: ['Order Type', 'Order Type (주문 형태)'],
  erp_sales_type: ['Sales Type', 'Sales Type (판매 유형)'],
  pricebook_select: ['PriceBook Select', 'PriceBook Select (가격표)'],
  deal_currency_code: ['Currency', 'Currency (통화)'],
  order_route: ['Order Route', 'Order Route (주문 경로)'],
  selling_entity: ['ERP - Order Branch', 'ERP - Order Branch'],
  revenue_type: ['Revenue Type', 'Revenue Type (매출 구분)'],
  erp_target: ['ERP Target', 'ERP Target (ERP 대상)'],
  ship_to_address: ['Ship-to Address', 'Ship-to Address (배송지)'],
  requested_delivery_date: ['Requested Delivery Date', 'Requested Delivery Date (희망 납기)'],
};

const MSG = {
  en: {
    error: 'Error',
    loading: 'Loading settings...',
    teamTitle: 'Edit permission for order route fields',
    teamDesc:
      'Choose the HubSpot teams that can edit Order Route, ERP - Order Branch, Revenue Type and ERP Target in the Order Setup and Order Route Info cards. Members of these teams (primary or secondary) can edit; everyone else sees them as read-only.',
    teamLabel: 'Allowed teams',
    teamPh: 'Select teams',
    members: (n: number) => `${n} members`,
    current: 'Saved allowed teams: ',
    none: 'None (read-only for everyone)',
    teamSaved: 'Allowed teams saved.',
    ownerTitle: 'Edit permission for Owner Branch',
    ownerDesc: 'Choose the HubSpot teams that can change Owner Branch in the Order Setup card. Changing it clears the buyer company and contact and sets Order Branch again.',
    rulesTitle: 'Order Setup card · field rules',
    rulesDesc: 'Set how each field behaves after line items are added. Fields that reset line items delete them when changed.',
    rules: { edit: 'Editable', lock: 'Resets line items', team: 'Allowed teams only · resets line items', auto: 'Automatic (read-only)' } as Record<string, string>,
    rulesSaved: 'Field rules saved.',
    save: 'Save',
    saving: 'Saving...',
    revert: 'Revert',
    defaults: 'Restore defaults',
  },
  ko: {
    error: '오류',
    loading: '설정을 불러오는 중입니다...',
    teamTitle: '주문 경로 속성 수정 권한',
    teamDesc:
      '주문 설정 카드와 Order Route Info 카드에서 Order Route, ERP - Order Branch, Revenue Type, ERP Target을 수정할 수 있는 HubSpot 팀을 지정합니다. 지정한 팀(주 팀 · 보조 팀 포함) 소속 사용자만 수정할 수 있으며, 그 외 사용자는 읽기 전용입니다.',
    teamLabel: '수정 허용 팀',
    teamPh: '팀을 선택하세요',
    members: (n: number) => `${n}명`,
    current: '저장된 허용 팀 : ',
    none: '없습니다 (모두 읽기 전용)',
    teamSaved: '수정 허용 팀을 저장했습니다.',
    ownerTitle: 'Owner Branch 수정 권한',
    ownerDesc: '주문 설정 카드에서 Owner Branch(거래 소유자의 지사)를 변경할 수 있는 HubSpot 팀을 지정합니다. 변경하면 구매 회사 · 구매 담당자가 초기화되고 Order Branch가 다시 지정됩니다.',
    rulesTitle: '주문 설정 카드 · 속성 분류',
    rulesDesc: '라인아이템 등록 후 속성별 동작을 지정합니다. "변경 시 라인아이템 초기화" 속성을 변경하면 라인아이템이 삭제됩니다.',
    rules: { edit: '편집 가능', lock: '변경 시 라인아이템 초기화', team: '허용 팀만 · 변경 시 초기화', auto: '자동 계산 (읽기 전용)' } as Record<string, string>,
    rulesSaved: '속성 분류를 저장했습니다.',
    save: '저장',
    saving: '저장 중입니다...',
    revert: '되돌리기',
    defaults: '기본값으로',
  },
};

hubspot.extend<'settings'>(({ context, actions }) => <SettingsPage context={context} actions={actions} />);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = async (fn: string, parameters: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await hubspot.serverless(fn, { parameters });
  if (!res || res.ok === false) throw new Error(res?.error || 'Serverless function error');
  return res;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SettingsPage = ({ context, actions }: any) => {
  const lang = getLang(context);
  const t = MSG[lang];
  const [teams, setTeams] = useState<Team[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [ownerSaved, setOwnerSaved] = useState<string[]>([]);
  const [ownerSel, setOwnerSel] = useState<string[]>([]);
  const [rules, setRules] = useState<Rules>({});
  const [rulesDraft, setRulesDraft] = useState<Rules>({});
  const [defaults, setDefaults] = useState<Rules>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [res, r, o] = await Promise.all([
        call('route_editor', { action: 'settings_get', lang }),
        call('order_setup', { action: 'rules_get', lang }),
        call('order_setup', { action: 'owner_teams_get', lang }),
      ]);
      setOwnerSaved(o.allowed || []);
      setOwnerSel(o.allowed || []);
      setTeams(res.teams || []);
      setSaved(res.allowed || []);
      setSelected(res.allowed || []);
      setRules(r.rules || {});
      setRulesDraft(r.rules || {});
      setDefaults(r.defaults || {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  const teamDirty = [...selected].sort().join(',') !== [...saved].sort().join(',');
  const rulesDirty = Object.keys(FIELD_NAMES).some((k) => rulesDraft[k] !== rules[k]);

  const saveTeams = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await call('route_editor', { action: 'settings_save', teamIds: selected, lang });
      setSaved(res.allowed || []);
      actions?.addAlert?.({ type: 'success', message: t.teamSaved });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const ownerDirty = [...ownerSel].sort().join(',') !== [...ownerSaved].sort().join(',');
  const saveOwner = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await call('order_setup', { action: 'owner_teams_save', teamIds: ownerSel, lang });
      setOwnerSaved(res.allowed || []);
      actions?.addAlert?.({ type: 'success', message: t.teamSaved });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveRules = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await call('order_setup', { action: 'rules_save', rules: rulesDraft, lang });
      setRules(res.rules || {});
      setRulesDraft(res.rules || {});
      actions?.addAlert?.({ type: 'success', message: t.rulesSaved });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner label={t.loading} />;

  const ruleOptions = ['edit', 'lock', 'team', 'auto'].map((v) => ({ value: v, label: t.rules[v] }));
  const keys = Object.keys(FIELD_NAMES);
  const rows: string[][] = [];
  for (let i = 0; i < keys.length; i += 2) rows.push(keys.slice(i, i + 2));

  return (
    <Flex direction="column" gap="medium">
      {error && (
        <Alert title={t.error} variant="danger">
          {error}
        </Alert>
      )}

      <Heading>{t.teamTitle}</Heading>
      <Text>{t.teamDesc}</Text>
      <MultiSelect
        label={t.teamLabel}
        placeholder={t.teamPh}
        options={teams.map((x) => ({ label: `${x.name} (${t.members(x.members)})`, value: x.id }))}
        value={selected}
        onChange={(v) => setSelected((v as string[]).map(String))}
      />
      <Text variant="microcopy">
        {t.current}
        {saved.length ? saved.map((id) => teams.find((x) => x.id === id)?.name || id).join(', ') : t.none}
      </Text>
      <Flex direction="row" gap="small">
        <Button variant="primary" onClick={saveTeams} disabled={!teamDirty || saving}>
          {saving ? t.saving : t.save}
        </Button>
        <Button variant="secondary" onClick={() => setSelected(saved)} disabled={!teamDirty || saving}>
          {t.revert}
        </Button>
      </Flex>

      <Divider />

      <Heading>{t.ownerTitle}</Heading>
      <Text>{t.ownerDesc}</Text>
      <MultiSelect
        label={t.teamLabel}
        placeholder={t.teamPh}
        options={teams.map((x) => ({ label: `${x.name} (${t.members(x.members)})`, value: x.id }))}
        value={ownerSel}
        onChange={(v) => setOwnerSel((v as string[]).map(String))}
      />
      <Text variant="microcopy">
        {t.current}
        {ownerSaved.length ? ownerSaved.map((id) => teams.find((x) => x.id === id)?.name || id).join(', ') : t.none}
      </Text>
      <Flex direction="row" gap="small">
        <Button variant="primary" onClick={saveOwner} disabled={!ownerDirty || saving}>
          {saving ? t.saving : t.save}
        </Button>
        <Button variant="secondary" onClick={() => setOwnerSel(ownerSaved)} disabled={!ownerDirty || saving}>
          {t.revert}
        </Button>
      </Flex>

      <Divider />

      <Heading>{t.rulesTitle}</Heading>
      <Text>{t.rulesDesc}</Text>
      {rows.map((row) => (
        <Flex key={row.join('-')} direction="row" gap="medium">
          {row.map((k) => (
            <Flex key={k} direction="column" gap="flush">
              <Select
                label={lang === 'ko' ? FIELD_NAMES[k][1] : FIELD_NAMES[k][0]}
                options={ruleOptions}
                value={rulesDraft[k] || ''}
                onChange={(v) => setRulesDraft({ ...rulesDraft, [k]: String(v) })}
              />
            </Flex>
          ))}
        </Flex>
      ))}
      <Flex direction="row" gap="small">
        <Button variant="primary" onClick={saveRules} disabled={!rulesDirty || saving}>
          {saving ? t.saving : t.save}
        </Button>
        <Button variant="secondary" onClick={() => setRulesDraft(rules)} disabled={!rulesDirty || saving}>
          {t.revert}
        </Button>
        <Button variant="secondary" onClick={() => setRulesDraft(defaults)} disabled={saving}>
          {t.defaults}
        </Button>
      </Flex>

      <Divider />
      <ConvertSettings lang={lang} actions={actions} />
    </Flex>
  );
};

// ── 영업기회 전환 카드 설정 : 활성 단계 · 생성 위치 · 복사 속성 · 라인아이템 / 활동 복사
const CV_MSG = {
  en: {
    title: 'Convert to Opportunity card',
    desc: 'The create button appears only when a deal in the lead pipeline is in an activation stage. Deal owner is always copied.',
    source: 'Lead pipeline',
    stages: 'Activation stages',
    target: 'Opportunity pipeline',
    targetStage: 'Stage of the new opportunity',
    props: 'Properties to copy',
    propsPh: 'Select properties',
    always: 'Always copied: Deal owner. Deal name and close date are confirmed when creating.',
    lines: 'Copy line items',
    acts: 'Share all activities (all time)',
    saved: 'Conversion settings saved.',
  },
  ko: {
    title: '영업기회 전환 카드',
    desc: 'Lead 파이프라인 거래가 활성 단계에 있을 때만 생성 버튼이 나타납니다. Deal owner는 항상 복사됩니다.',
    source: 'Lead 파이프라인',
    stages: '활성 단계 (버튼이 나타나는 단계)',
    target: 'Opportunity 파이프라인',
    targetStage: '새 Opportunity 단계',
    props: '복사할 속성',
    propsPh: '속성을 선택하세요',
    always: '항상 복사 : Deal owner. Deal name · Close date는 생성할 때 확인 창에서 정합니다.',
    lines: '라인아이템 복사',
    acts: '활동 기록 공유 (전체 기간)',
    saved: '영업기회 전환 설정을 저장했습니다.',
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConvertSettings = ({ lang, actions }: { lang: Lang; actions: any }) => {
  const t = MSG[lang];
  const c = CV_MSG[lang];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [info, setInfo] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [draft, setDraft] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const r = await call('convert_opp', { action: 'settings_get', lang });
      setInfo(r);
      setDraft(r.settings);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [lang]);
  useEffect(() => {
    load();
  }, [load]);
  if (error && !info)
    return (
      <Alert title={t.error} variant="danger">
        {error}
      </Alert>
    );
  if (!info || !draft) return <LoadingSpinner label={t.loading} />;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pl = (id: string) => info.pipelines.find((p: any) => p.id === id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plOpts = info.pipelines.map((p: any) => ({ label: p.label, value: p.id }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stOpts = (id: string) => (pl(id)?.stages || []).map((s: any) => ({ label: s.label, value: s.id }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propOpts = info.properties.map((p: any) => ({ label: `${p.label} (${p.name})`, value: p.name }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(info.settings);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await call('convert_opp', { action: 'settings_save', settings: draft, lang });
      setInfo({ ...info, settings: r.settings });
      setDraft(r.settings);
      actions?.addAlert?.({ type: 'success', message: c.saved });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k: string) => (v: unknown) => setDraft({ ...draft, [k]: v });
  return (
    <Flex direction="column" gap="medium">
      <Heading>{c.title}</Heading>
      <Text>{c.desc}</Text>
      {error ? (
        <Alert title={t.error} variant="danger">
          {error}
        </Alert>
      ) : null}
      <Flex direction="row" gap="medium">
        <Select
          label={c.source}
          options={plOpts}
          value={draft.sourcePipeline}
          onChange={(v) => setDraft({ ...draft, sourcePipeline: String(v), triggerStages: [] })}
        />
        <MultiSelect
          label={c.stages}
          options={stOpts(draft.sourcePipeline)}
          value={draft.triggerStages}
          onChange={(v) => set('triggerStages')((v as string[]).map(String))}
        />
      </Flex>
      <Flex direction="row" gap="medium">
        <Select
          label={c.target}
          options={plOpts}
          value={draft.targetPipeline}
          onChange={(v) => setDraft({ ...draft, targetPipeline: String(v), targetStage: (pl(String(v))?.stages || [])[0]?.id || '' })}
        />
        <Select label={c.targetStage} options={stOpts(draft.targetPipeline)} value={draft.targetStage} onChange={(v) => set('targetStage')(String(v))} />
      </Flex>
      <MultiSelect
        label={c.props}
        placeholder={c.propsPh}
        options={propOpts}
        value={draft.copyProps}
        onChange={(v) => set('copyProps')([...new Set([...(info.always || []), ...(v as string[]).map(String)])])}
      />
      <Text variant="microcopy">ⓘ {c.always}</Text>
      <Toggle label={c.lines} labelDisplay="inline" checked={!!draft.copyLineItems} onChange={(v) => set('copyLineItems')(v)} />
      <Toggle label={c.acts} labelDisplay="inline" checked={!!draft.copyActivities} onChange={(v) => set('copyActivities')(v)} />
      <Flex direction="row" gap="small">
        <Button variant="primary" onClick={save} disabled={!dirty || busy}>
          {busy ? t.saving : t.save}
        </Button>
        <Button variant="secondary" onClick={() => setDraft(info.settings)} disabled={!dirty || busy}>
          {t.revert}
        </Button>
        <Button variant="secondary" onClick={() => setDraft({ ...info.defaults })} disabled={busy}>
          {t.defaults}
        </Button>
      </Flex>
    </Flex>
  );
};
