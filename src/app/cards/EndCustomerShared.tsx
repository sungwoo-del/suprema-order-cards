import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  DescriptionList,
  DescriptionListItem,
  Divider,
  Flex,
  Input,
  Link,
  LoadingSpinner,
  SearchInput,
  Select,
  Tag,
  Text,
  Tile,
  hubspot,
} from '@hubspot/ui-extensions';
import { SectionHead, joinVals } from './UiKit.tsx';
import { CrmActionButton } from '@hubspot/ui-extensions/crm';

// End Customer(최종 고객사) 카드 공용 — 가운데 컬럼 카드 · 오른쪽 사이드바 카드가 함께 씀
// 규칙 : 회사 1개 · 담당자 여러 명 · 둘 다 "End Customer" 연결 라벨
// deploy.sh가 배포할 때 EC_VERSION / EC_UPDATED 를 자동으로 올립니다.
export const EC_VERSION = '04';
export const EC_UPDATED = '2026-11-27';
// 정식 오픈 전까지 Beta 표기 — 정식 버전이 되면 '' 로 바꾸면 표기가 사라짐
export const EC_STAGE = 'Beta';
export const PORTAL = 245822501;
export const ecVersion = () =>
  `Update : ${EC_UPDATED} / Ver.${EC_VERSION}${EC_STAGE ? ' ' + EC_STAGE : ''}`;

export type Lang = 'en' | 'ko';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getLang = (context: any): Lang =>
  String(context?.user?.locale || context?.user?.language || 'en')
    .toLowerCase()
    .startsWith('ko')
    ? 'ko'
    : 'en';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const callEC = async (parameters: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await hubspot.serverless('end_customer', { parameters });
  if (!res) throw new Error('Serverless function error');
  if (res.ok === false) throw new Error(res.error || 'Serverless function error');
  return res;
};

export const objUrl = (portalId: number | string, type: string, id: string) =>
  `https://app-na2.hubspot.com/contacts/${portalId}/record/${type}/${id}`;

export interface Company {
  id: string;
  name: string;
  domain?: string;
  website?: string;
  country?: string;
  industry?: string;
  lifecycle?: string;
  team?: string;
  owner?: string;
}
export interface Contact {
  id: string;
  name: string;
  email?: string;
  jobtitle?: string;
  jobfunction?: string;
  phone?: string;
}
export interface Opt { label: string; value: string }
export interface EcData {
  region: string;
  teamName: string;
  company: Company | null;
  extraCompanies: { id: string; name: string }[];
  contacts: Contact[];
  options: { country: Opt[]; industry: Opt[] };
}

export const T = {
  en: {
    title: 'End Customer',
    desc: 'Links the end customer company and contacts to this deal.',
    loading: 'Loading...',
    error: 'Error',
    refresh: 'Refresh',
    company: 'End Customer',
    contact: 'End Customer Contact',
    companyField: 'Company',
    contactField: 'Contacts',
    notSet: 'Not selected',
    searchPh: 'Search by company name or domain',
    filter: (r: string) => `Recommended Team = ${r}`,
    filterHint: (r: string) => `Only ${r} companies are shown (deal owner team).`,
    noFilter:
      'The deal owner team has no region. All companies are shown.',
    noResults: (r: string) =>
      r
        ? `There are no ${r} companies. Action required: create one with "+ New company".`
        : 'There are no matching companies. Action required: create one with "+ New company".',
    newCompany: '+ New company',
    newContact: '+ New contact',
    pickCompanyFirst: 'Select a company first.',
    contactsOf: (n: number) => `${n} contacts linked to this company · select one or more`,
    noContacts:
      'There are no contacts linked to this company. Action required: create one with "+ New contact".',
    otherLinked: 'Linked from another company',
    saveHint:
      'You can save with only the company or only contacts. Both are linked with the "End Customer" label.',
    companyChange:
      'Changing the company replaces the current End Customer link when you save.',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    create: 'Create',
    name: 'Company name *',
    domain: 'Website / domain',
    country: '#Country *',
    industry: 'Industry',
    first: 'First name *',
    last: 'Last name',
    email: 'Email *',
    jobtitle: 'Job title',
    jobfunction: 'Job function',
    teamAuto: 'Recommended Team is set from #Country automatically.',
    dupCompany: (n: string) => `A company with the same domain already exists: ${n}. It has been selected.`,
    dupContact: (n: string) => `A contact with the same email already exists: ${n}. It has been selected.`,
    preview: 'Preview',
    newTab: 'New tab ↗',
    change: 'Change',
    unlink: 'Unlink',
    addContact: '+ Add contact',
    select: 'Select end customer',
    emptyTitle: 'There is no end customer.',
    emptyAction: 'Action required: select the end customer.',
    noContactLinked: 'There are no linked contacts. Action required: add one with "+ Add contact".',
    noCompanyLinked: 'There is no end customer company.',
    extra: (n: string) => `More than one company has the End Customer label (${n}). Action required: keep one with "Change".`,
    lCountry: '#Country',
    lIndustry: 'Industry',
    lLifecycle: 'Lifecycle Stage',
    lWebsite: 'Website',
    lTeam: 'Recommended Team',
    lOwner: 'Owner',
    lEmail: 'Email',
    lJob: 'Job title',
    lFunction: 'Job function',
    lPhone: 'Phone',
    selectedN: (n: number) => `${n} selected`,
    stepCompany: '1. Company',
    stepContacts: '2. Contacts (select one or more)',
    saveN: (c: number, n: number) => `Save (company ${c} · contacts ${n})`,
    linked: 'Linked',
    notLinked: 'Not linked',
    counts: (c: number, n: number) => `Company ${c} · Contacts ${n}`,
    edit: 'Edit',
    more: 'More',
    openTab: 'Open in new tab',
    changeCompany: 'Change company',
    lName: 'Name',
    emptyLine: 'There is no end customer. Action required: search for the company and link it.',
    pending: 'Applied on save',
  },
  ko: {
    title: 'End Customer (최종 고객사)',
    desc: '이 거래의 최종 고객사와 담당자를 연결합니다.',
    loading: '불러오는 중입니다...',
    error: '오류',
    refresh: '새로고침',
    company: '최종 고객사 (End Customer)',
    contact: '최종 고객사 담당자 (End Customer Contact)',
    companyField: 'Company (회사)',
    contactField: 'Contacts (담당자)',
    notSet: '미선택',
    searchPh: '회사명 · 도메인으로 검색하세요',
    filter: (r: string) => `Recommended Team = ${r}`,
    filterHint: (r: string) => `${r} 회사만 표시됩니다 (거래 소유자 팀 기준).`,
    noFilter: '거래 소유자 팀의 리전을 확인할 수 없습니다. 전체 회사를 표시합니다.',
    noResults: (r: string) =>
      r
        ? `${r} 리전 회사가 없습니다. 필요한 조치 : "+ 새 회사"로 최종 고객사를 만드세요.`
        : '검색 결과가 없습니다. 필요한 조치 : "+ 새 회사"로 최종 고객사를 만드세요.',
    newCompany: '+ 새 회사',
    newContact: '+ 새 담당자',
    pickCompanyFirst: '회사를 먼저 선택하세요.',
    contactsOf: (n: number) => `연결된 담당자 ${n}명 · 여러 명 선택 가능`,
    noContacts: '이 회사에 연결된 담당자가 없습니다. 필요한 조치 : "+ 새 담당자"로 만드세요.',
    otherLinked: '다른 회사에서 연결됨',
    saveHint:
      '회사나 담당자 중 하나만 골라도 저장할 수 있습니다. 둘 다 "End Customer" 라벨로 연결됩니다.',
    companyChange: '회사를 바꾸면 저장할 때 기존 End Customer 연결이 교체됩니다.',
    cancel: '취소',
    save: '저장',
    saving: '저장 중입니다...',
    create: '만들기',
    name: 'Company name (회사명) *',
    domain: 'Website URL (웹사이트)',
    country: '#Country (국가) *',
    industry: 'Industry (산업)',
    first: 'First name (이름) *',
    last: 'Last name (성)',
    email: 'Email (이메일) *',
    jobtitle: 'Job title (직책)',
    jobfunction: 'Job function (직무)',
    teamAuto: 'Recommended Team은 #Country로 자동 지정됩니다.',
    dupCompany: (n: string) => `같은 도메인의 회사가 이미 있습니다 : ${n}. 기존 회사를 선택했습니다.`,
    dupContact: (n: string) => `같은 이메일의 담당자가 이미 있습니다 : ${n}. 기존 담당자를 선택했습니다.`,
    preview: '미리보기',
    newTab: '새 탭 ↗',
    change: '변경',
    unlink: '연결 해제',
    addContact: '+ 담당자 추가',
    select: '최종 고객사 선택',
    emptyTitle: '최종 고객사가 없습니다.',
    emptyAction: '필요한 조치 : 최종 고객사를 선택하세요.',
    noContactLinked: '연결된 담당자가 없습니다. 필요한 조치 : [+ 담당자 추가]로 선택하세요.',
    noCompanyLinked: '최종 고객사 회사가 없습니다.',
    extra: (n: string) => `End Customer 라벨이 붙은 회사가 2개 이상입니다(${n}). 필요한 조치 : [변경]으로 1개만 남기세요.`,
    lCountry: '#Country',
    lIndustry: 'Industry (산업)',
    lLifecycle: 'Lifecycle Stage',
    lWebsite: 'Website',
    lTeam: 'Recommended Team',
    lOwner: 'Owner',
    lEmail: 'Email (이메일)',
    lJob: 'Job title (직책)',
    lFunction: 'Job function (직무)',
    lPhone: 'Phone (전화)',
    selectedN: (n: number) => `${n}명 선택`,
    stepCompany: '1. 회사',
    stepContacts: '2. 담당자 선택 (여러 명 가능)',
    saveN: (c: number, n: number) => `저장 (회사 ${c} · 담당자 ${n}명)`,
    linked: '연결됨',
    notLinked: '미연결',
    counts: (c: number, n: number) => `회사 ${c} · 담당자 ${n}명`,
    edit: '편집',
    more: '더보기',
    openTab: '새 탭에서 열기',
    changeCompany: '회사 변경',
    lName: '이름',
    emptyLine: '최종 고객사가 없습니다. 필요한 조치 : 회사를 검색해 연결하세요.',
    pending: '저장 시 반영',
  },
};

export const webUrl = (w: string) => (/^https?:\/\//i.test(w) ? w : `https://${w}`);

// 레코드 바로가기 — 미리보기(HubSpot 미리보기 패널) · 새 탭
export const RecordLinks = ({
  lang,
  portalId,
  type,
  id,
}: {
  lang: Lang;
  portalId: number | string;
  type: '0-1' | '0-2';
  id: string;
}) => (
  <Flex direction="row" gap="extra-small" align="center" wrap="wrap">
    <CrmActionButton
      actionType="PREVIEW_OBJECT"
      actionContext={{ objectTypeId: type, objectId: Number(id) }}
      variant="secondary"
      size="xs"
    >
      {T[lang].preview}
    </CrmActionButton>
    <Button variant="secondary" size="xs" href={{ url: objUrl(portalId, type, id), external: true }}>
      {T[lang].newTab}
    </Button>
  </Flex>
);

// ── 선택 편집기 : 가운데 카드에서는 카드 안에, 사이드바에서는 Panel 안에 그대로 씀
export const Editor = ({
  lang,
  dealId,
  data,
  onSaved,
  onCancel,
  compact,
}: {
  lang: Lang;
  dealId: string;
  data: EcData;
  onSaved: (d: EcData) => void;
  onCancel?: () => void;
  compact?: boolean;
}) => {
  const t = T[lang];
  const [company, setCompany] = useState<Company | null>(data.company);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Company[] | null>(null);
  // 회사 검색 목록은 회사가 없을 때나 [변경]을 눌렀을 때만 펼침
  const [searchOpen, setSearchOpen] = useState(!data.company);
  const [searching, setSearching] = useState(false);
  const [list, setList] = useState<Contact[] | null>(null);
  const [checked, setChecked] = useState<string[]>(data.contacts.map((c) => c.id));
  const [mode, setMode] = useState<'' | 'company' | 'contact'>('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  const runSearch = useCallback(
    async (q: string) => {
      setSearching(true);
      setErr('');
      try {
        const r = await callEC({ action: 'search', dealId, lang, query: q, region: data.region });
        setResults(r.results);
      } catch (e) {
        setErr((e as Error).message);
      }
      setSearching(false);
    },
    [dealId, lang, data.region],
  );
  useEffect(() => {
    if (!searchOpen || query.length === 1) return;
    const h = setTimeout(() => runSearch(query), query ? 400 : 0);
    return () => clearTimeout(h);
  }, [query, runSearch, searchOpen]);

  const loadContacts = useCallback(
    async (id: string) => {
      setList(null);
      try {
        const r = await callEC({ action: 'contacts', dealId, lang, companyId: id });
        setList(r.results);
      } catch (e) {
        setErr((e as Error).message);
        setList([]);
      }
    },
    [dealId, lang],
  );
  useEffect(() => {
    if (company) loadContacts(company.id);
    else setList(null);
  }, [company, loadContacts]);

  const pickCompany = (c: Company) => {
    setCompany(c);
    setResults(null);
    setSearchOpen(false);
    setQuery('');
    setMode('');
    // 다른 회사로 바꾸면 그 회사에 속하지 않은 담당자 선택은 풀림(목록을 받은 뒤 정리)
    if (!data.company || data.company.id !== c.id) setChecked([]);
  };
  const toggle = (id: string, on: boolean) =>
    setChecked((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));

  const changedCompany = (company?.id || '') !== (data.company?.id || '') || data.extraCompanies.length > 0;
  const before = data.contacts.map((c) => c.id).sort().join(',');
  const changedContacts = [...checked].sort().join(',') !== before;
  const dirty = changedCompany || changedContacts;

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await callEC({
        action: 'save',
        dealId,
        lang,
        companyId: changedCompany ? company?.id || '' : undefined,
        contactIds: changedContacts ? checked : undefined,
      });
      onSaved(r);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const create = async () => {
    setBusy(true);
    setErr('');
    setNote('');
    try {
      if (mode === 'company') {
        const r = await callEC({ action: 'createCompany', dealId, lang, values: form });
        if (r.duplicate) setNote(t.dupCompany(r.company.name));
        pickCompany(r.company);
      } else if (mode === 'contact' && company) {
        const r = await callEC({ action: 'createContact', dealId, lang, companyId: company.id, values: form });
        if (r.duplicate) setNote(t.dupContact(r.contact.name));
        await loadContacts(company.id);
        toggle(r.contact.id, true);
      }
      setMode('');
      setForm({});
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const f = (k: string) => form[k] || '';
  const setF = (k: string) => (v: string | number | boolean) => setForm((p) => ({ ...p, [k]: String(v) }));
  const row = compact ? 'column' : 'row';

  const companyForm = (
    <Flex direction="column" gap="small">
      <Text format={{ fontWeight: 'bold' }}>{t.newCompany.replace('+ ', '')}</Text>
      <Input name="name" label={t.name} value={f('name')} onChange={setF('name')} />
      <Input name="domain" label={t.domain} placeholder="example.com" value={f('domain')} onChange={setF('domain')} />
      <Flex direction={row} gap="small">
        <Box1>
          <Select name="account_country" label={t.country} options={data.options.country} value={f('account_country')} onChange={setF('account_country')} />
        </Box1>
        <Box1>
          <Select name="industry" label={t.industry} options={data.options.industry} value={f('industry')} onChange={setF('industry')} />
        </Box1>
      </Flex>
      <Text variant="microcopy">ⓘ {t.teamAuto}</Text>
      <Flex direction="row" gap="small">
        <Button size="sm" variant="primary" disabled={busy || !f('name') || !f('account_country')} onClick={create}>{t.create}</Button>
        <Button size="sm" onClick={() => { setMode(''); setForm({}); }}>{t.cancel}</Button>
      </Flex>
    </Flex>
  );
  const contactForm = (
    <Flex direction="column" gap="small">
      <Text format={{ fontWeight: 'bold' }}>{t.newContact.replace('+ ', '')}</Text>
      <Flex direction={row} gap="small">
        <Box1><Input name="firstname" label={t.first} value={f('firstname')} onChange={setF('firstname')} /></Box1>
        <Box1><Input name="lastname" label={t.last} value={f('lastname')} onChange={setF('lastname')} /></Box1>
      </Flex>
      <Input name="email" label={t.email} placeholder="name@company.com" value={f('email')} onChange={setF('email')} />
      <Flex direction={row} gap="small">
        <Box1><Input name="jobtitle" label={t.jobtitle} value={f('jobtitle')} onChange={setF('jobtitle')} /></Box1>
        <Box1><Input name="job_function" label={t.jobfunction} value={f('job_function')} onChange={setF('job_function')} /></Box1>
      </Flex>
      <Text variant="microcopy">ⓘ {company?.name}</Text>
      <Flex direction="row" gap="small">
        <Button size="sm" variant="primary" disabled={busy || !f('firstname') || !f('email')} onClick={create}>{t.create}</Button>
        <Button size="sm" onClick={() => { setMode(''); setForm({}); }}>{t.cancel}</Button>
      </Flex>
    </Flex>
  );

  // 다른 회사에서 이미 연결된 담당자도 목록에 함께 보여줌(체크 해제하면 저장 시 연결 해제)
  const listIds = new Set((list || []).map((c) => c.id));
  const outside = data.contacts.filter((c) => !listIds.has(c.id) && checked.includes(c.id));

  return (
    <Flex direction="column" gap="medium">
      {err ? (
        <Alert title={t.error} variant="danger">{err}</Alert>
      ) : null}
      {note ? (
        <Alert title={lang === 'ko' ? '알림' : 'Notice'} variant="info">{note}</Alert>
      ) : null}

      {/* ① 회사 */}
      <SectionHead
        title={t.stepCompany}
        action={company && !searchOpen ? (
          <Link href={{ url: objUrl(PORTAL, '0-2', company.id), external: false }} preventDefault onClick={() => { setResults(null); setSearchOpen(true); }}>
            {t.change}
          </Link>
        ) : undefined}
      />
      {company && !searchOpen ? (
        <Tile compact>
          <Flex direction="row" gap="small" align="center" wrap="wrap">
            <Text format={{ fontWeight: 'demibold' }}>{company.name}</Text>
            <Text variant="microcopy">{joinVals(company.country, company.lifecycle, company.domain)}</Text>
            {changedCompany ? <Text variant="microcopy">· {t.pending}</Text> : null}
          </Flex>
        </Tile>
      ) : (
        <Flex direction="column" gap="extra-small">
          <Flex direction="row" gap="small" align="end">
            <Box1>
              <SearchInput name="ec_search" label={t.companyField} placeholder={t.searchPh} value={query} onInput={(v: string) => setQuery(v)} onChange={(v: string) => setQuery(v)} />
            </Box1>
            <Button size="sm" onClick={() => { setMode('company'); setForm({ name: query }); }}>{t.newCompany}</Button>
          </Flex>
          <Flex direction="row" gap="extra-small" align="center">
            {data.region ? <Tag variant="info">{t.filter(data.region)}</Tag> : null}
            <Text variant="microcopy">{data.region ? t.filterHint(data.region) : t.noFilter}</Text>
          </Flex>
          {searching ? <LoadingSpinner size="xs" label={t.loading} /> : null}
          {!searching && results && results.length === 0 ? (
            <Text variant="microcopy">ⓘ {t.noResults(data.region)}</Text>
          ) : null}
          {!searching && results && results.length ? (
            <Flex direction="column" gap="flush">
              {results.map((r) => (
                <Flex key={r.id} direction="row" justify="between" align="center" gap="small">
                  <Link href={{ url: objUrl(PORTAL, '0-2', r.id), external: false }} preventDefault onClick={() => pickCompany(r)}>
                    {r.name}
                  </Link>
                  <Text variant="microcopy">
                    {[r.domain, r.country, r.lifecycle].filter(Boolean).join(' · ')}
                  </Text>
                </Flex>
              ))}
            </Flex>
          ) : null}
          {company ? (
            <Flex direction="row" justify="end">
              <Button size="xs" onClick={() => { setResults(null); setQuery(''); setSearchOpen(false); }}>{t.cancel}</Button>
            </Flex>
          ) : null}
        </Flex>
      )}
      {mode === 'company' ? companyForm : null}
      {changedCompany && data.company ? <Text variant="microcopy">ⓘ {t.companyChange}</Text> : null}

      {/* ② 담당자 */}
      <SectionHead
        title={t.stepContacts}
        action={company && list !== null ? (
          <Link href={{ url: objUrl(PORTAL, '0-2', company.id), external: false }} preventDefault onClick={() => { setMode('contact'); setForm({}); }}>
            {t.newContact}
          </Link>
        ) : undefined}
      />
      {!company ? (
        <Text variant="microcopy">ⓘ {t.pickCompanyFirst}</Text>
      ) : list === null ? (
        <LoadingSpinner size="xs" label={t.loading} />
      ) : (
        <Flex direction="column" gap="extra-small">
          <Text variant="microcopy">{list.length ? t.contactsOf(list.length) : t.noContacts}</Text>
          {[...list, ...outside].map((c) => (
            <Checkbox
              key={c.id}
              name={`ec_${c.id}`}
              checked={checked.includes(c.id)}
              onChange={(on: boolean) => toggle(c.id, on)}
              description={[c.jobtitle || c.jobfunction, c.email !== c.name ? c.email : '', listIds.has(c.id) ? '' : t.otherLinked].filter(Boolean).join(' · ')}
            >
              {c.name}
            </Checkbox>
          ))}
        </Flex>
      )}
      {mode === 'contact' ? contactForm : null}
      <Divider />
      <Flex direction="row" gap="small" align="center" wrap="wrap">
        <Button variant="primary" disabled={busy || !dirty} onClick={save}>
          {busy ? t.saving : t.saveN(company ? 1 : 0, checked.length)}
        </Button>
        {onCancel ? <Button onClick={onCancel}>{t.cancel}</Button> : null}
      </Flex>
      <Text variant="microcopy">ⓘ {t.saveHint}</Text>
    </Flex>
  );
};

// Flex 안에서 남은 폭을 채우는 칸
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Box1 = ({ children }: { children: any }) => (
  <Box flex={1}>
    {children}
  </Box>
);

// 회사 요약
export const CompanySummary = ({ lang, c, compact }: { lang: Lang; c: Company; compact?: boolean }) => {
  const t = T[lang];
  const items: [string, React.ReactNode][] = [
    [t.lCountry, c.country || '—'],
    [t.lIndustry, c.industry || '—'],
    [t.lLifecycle, c.lifecycle || '—'],
    [
      t.lWebsite,
      c.website ? <Link href={{ url: webUrl(c.website), external: true }}>{c.website}</Link> : '—',
    ],
  ];
  if (!compact) items.push([t.lTeam, c.team || '—'], [t.lOwner, c.owner || '—']);
  return (
    <DescriptionList direction={compact ? 'column' : 'row'}>
      {items.map(([k, v]) => (
        <DescriptionListItem key={k} label={k}>
          {typeof v === 'string' ? <Text>{v}</Text> : v}
        </DescriptionListItem>
      ))}
    </DescriptionList>
  );
};

export const ContactLine = (c: Contact) =>
  [c.jobtitle || c.jobfunction, c.email !== c.name ? c.email : ''].filter(Boolean).join(' · ');

export const ContactSummary = ({ lang, c }: { lang: Lang; c: Contact }) => {
  const t = T[lang];
  return (
    <DescriptionList direction="row">
      <DescriptionListItem label={t.lEmail}>
        {c.email ? <Link href={{ url: `mailto:${c.email}`, external: true }}>{c.email}</Link> : <Text>—</Text>}
      </DescriptionListItem>
      <DescriptionListItem label={t.lJob}><Text>{c.jobtitle || '—'}</Text></DescriptionListItem>
      <DescriptionListItem label={t.lFunction}><Text>{c.jobfunction || '—'}</Text></DescriptionListItem>
      <DescriptionListItem label={t.lPhone}><Text>{c.phone || '—'}</Text></DescriptionListItem>
    </DescriptionList>
  );
};

// 데이터 읽기 훅 — 두 카드 공용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useEC = (dealId: string, lang: Lang, actions?: any) => {
  const [data, setData] = useState<EcData | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setData(await callEC({ action: 'load', dealId, lang }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [dealId, lang]);
  useEffect(() => {
    load();
  }, [load]);
  // 다른 카드(가운데 · 사이드바 · 전환 카드)에서 저장하면 hd_card_sync가 바뀌어 바로 다시 읽음
  useEffect(() => {
    actions?.onCrmPropertiesUpdate?.(['hd_card_sync'], () => load());
  }, [actions, load]);
  // 저장 후 호출 : 화면 속성을 새로 받아 다른 카드에 알림
  const notify = useCallback(() => {
    try {
      actions?.refreshObjectProperties?.();
    } catch (e) {
      /* 무시 */
    }
  }, [actions]);
  return { data, setData, error, load, notify };
};
