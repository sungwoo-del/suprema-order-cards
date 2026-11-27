import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  DescriptionList,
  DescriptionListItem,
  Divider,
  Flex,
  Icon,
  Link,
  LoadingSpinner,
  Select,
  Text,
  hubspot,
} from '@hubspot/ui-extensions';
import { LockStatus, getLang } from './LockStatus.tsx';

type Option = { label: string; value: string; type?: string; contactCount?: number | null };

const REGIONS = ['hq', 'eu', 'uk', 'us', 'jp', 'in', 'me', 'latam'];
const REGION_LABEL: Record<string, string> = {
  hq: 'HQ', eu: 'EU', uk: 'UK', us: 'US', jp: 'JP', in: 'IN', me: 'ME', latam: 'LATAM',
};
const BASE_PROPS = ['owning_entity', 'buyer_type', 'hs_num_of_associated_line_items'];
const ALL_PROPS = [...BASE_PROPS, ...REGIONS.flatMap((r) => [`partner_${r}`, `partner_owner_${r}`])];

const MSG = {
  en: {
    loading: 'Loading partners...',
    loadingContacts: 'Loading contacts...',
    error: 'Error',
    noBranchTitle: 'No Owner Branch',
    noBranch: 'Assign a deal owner to set the Owner Branch. Partners of that branch will appear here.',
    internalTitle: 'No partner selection needed',
    internal: 'Buyer Type is HQ/Branch, so the buyer company is set to the branch entity automatically.',
    count: (r: string, n: number) => `${n} partner companies in Owner Branch ${r}`,
    company: 'Buyer Company',
    contact: 'Buyer Contact',
    pickCompany: 'Select a partner company',
    pickContact: 'Select a contact',
    noContacts: 'No contacts linked to this company',
    companyFirst: 'Select a buyer company first',
    save: 'Save',
    saving: 'Saving...',
    refresh: 'Refresh',
    saved: 'Buyer company and contact saved. Associations will be updated by workflow.',
  },
  ko: {
    loading: '파트너 정보를 불러오는 중...',
    loadingContacts: '담당자를 불러오는 중...',
    error: '오류',
    noBranchTitle: 'Owner Branch가 없습니다.',
    noBranch: '필요한 조치 : 거래 소유자를 지정하세요.',
    internalTitle: '파트너 선택이 필요하지 않습니다.',
    internal: 'Buyer Type이 HQ/Branch이므로 구매 회사는 지사 법인으로 자동 지정됩니다.',
    count: (r: string, n: number) => `Owner Branch ${r} 소속 파트너사 ${n}곳`,
    company: '구매 회사 (Buyer Company)',
    contact: '구매 담당자 (Buyer Contact)',
    pickCompany: '파트너사를 선택하세요',
    pickContact: '담당자를 선택하세요',
    noContacts: '연결된 담당자가 없습니다.',
    companyFirst: '먼저 구매 회사를 선택하세요',
    save: '저장',
    saving: '저장 중...',
    refresh: '새로고침',
    saved: '구매 회사·담당자를 저장했습니다. 연결은 워크플로가 처리합니다.',
  },
};

hubspot.extend<'crm.record.tab'>(({ context, actions }) => (
  <BuyerPicker context={context} actions={actions} />
));

const call = async (parameters: Record<string, string>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await hubspot.serverless('buyer_picker', { parameters });
  if (!res || res.ok === false) throw new Error(res?.error || 'Serverless function error');
  return res;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BuyerPicker = ({ context, actions }: any) => {
  const lang = getLang(context);
  const t = MSG[lang];
  const dealId = String(context?.crm?.objectId ?? '');
  const [props, setProps] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<Option[]>([]);
  const [contacts, setContacts] = useState<Option[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [contactId, setContactId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const region = (props.owning_entity || '').toLowerCase();
  const lineItemCount = Number(props.hs_num_of_associated_line_items || 0);
  const locked = lineItemCount > 0;
  const isInternal = props.buyer_type === 'internal_entity';

  const loadProps = useCallback(async () => {
    const p = await actions.fetchCrmObjectProperties(ALL_PROPS);
    setProps(p || {});
    return p || {};
  }, [actions]);

  const loadContacts = useCallback(async (cid: string) => {
    setContacts([]);
    if (!cid) return;
    setLoadingContacts(true);
    try {
      const res = await call({ action: 'contacts', companyId: cid, lang });
      setContacts(res.contacts || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = await loadProps();
      const r = (p.owning_entity || '').toLowerCase();
      if (!REGIONS.includes(r)) {
        setCompanies([]);
        return;
      }
      const res = await call({ action: 'companies', region: r, lang });
      setCompanies(res.companies || []);
      const cur = p[`partner_${r}`] || '';
      setCompanyId(cur);
      setContactId(p[`partner_owner_${r}`] || '');
      if (cur) await loadContacts(cur);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loadProps, loadContacts]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    actions.onCrmPropertiesUpdate(BASE_PROPS, () => {
      loadAll();
    });
  }, [actions, loadAll]);

  const companyLabel = useMemo(() => companies.find((c) => c.value === companyId)?.label || '', [companies, companyId]);
  const contactLabel = useMemo(() => contacts.find((c) => c.value === contactId)?.label || '', [contacts, contactId]);

  const onCompanyChange = async (v: string | number | boolean) => {
    const cid = String(v);
    setCompanyId(cid);
    setContactId('');
    await loadContacts(cid);
  };

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      await call({ action: 'save', dealId, region, companyId, companyLabel, contactId, contactLabel, lang });
      actions.addAlert({ type: 'success', message: t.saved });
      actions.refreshObjectProperties();
      await loadProps();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner label={t.loading} />;

  const savedCompany = props[`partner_${region}`] || '';
  const savedContact = props[`partner_owner_${region}`] || '';
  const dirty = companyId !== savedCompany || contactId !== savedContact;
  const hasBranch = REGIONS.includes(region);

  return (
    <Flex direction="column" gap="small">
      {error && (
        <Alert title={t.error} variant="danger">
          {error}
        </Alert>
      )}

      {locked && (
        <LockStatus lang={lang} count={lineItemCount} portalId={context?.portal?.id ?? 245822501} dealId={dealId} />
      )}

      {!hasBranch && (
        <Alert title={t.noBranchTitle} variant="warning">
          {t.noBranch}
        </Alert>
      )}

      {hasBranch && isInternal && !locked && (
        <Alert title={t.internalTitle} variant="info">
          {t.internal}
        </Alert>
      )}

      {hasBranch && !isInternal && locked && (
        <DescriptionList direction="row">
          <DescriptionListItem label={t.company}>
            <Text>{companyLabel || '-'}</Text>
          </DescriptionListItem>
          <DescriptionListItem label={t.contact}>
            <Text>{contactLabel || '-'}</Text>
          </DescriptionListItem>
        </DescriptionList>
      )}

      {hasBranch && !isInternal && !locked && (
        <>
          <Flex direction="row" justify="between" align="center" gap="small">
            <Box flex={1}>
              <Text>{t.count(REGION_LABEL[region], companies.length)}</Text>
            </Box>
            <Box flex="none">
              <Link href={{ url: `https://app-na2.hubspot.com/contacts/${context?.portal?.id ?? 245822501}/record/0-3/${dealId}`, external: false }} preventDefault onClick={() => { if (!saving) loadAll(); }}>
                <Icon name="refresh" screenReaderText={t.refresh} />
              </Link>
            </Box>
          </Flex>
          <Flex direction="row" gap="medium">
            <Box flex={1}>
              <Select
                label={t.company}
                placeholder={t.pickCompany}
                options={companies.map((c) => ({
                  label: typeof c.contactCount === 'number' ? `${c.label} (${c.contactCount})` : c.label,
                  value: c.value,
                }))}
                value={companyId}
                onChange={onCompanyChange}
              />
            </Box>
            <Box flex={1}>
              {loadingContacts ? (
                <LoadingSpinner label={t.loadingContacts} />
              ) : (
                <Select
                  label={t.contact}
                  placeholder={companyId ? (contacts.length ? t.pickContact : t.noContacts) : t.companyFirst}
                  options={contacts}
                  value={contactId}
                  readOnly={!companyId || !contacts.length}
                  onChange={(v) => setContactId(String(v))}
                />
              )}
            </Box>
          </Flex>
          <Divider />
          <Flex direction="row" gap="small">
            <Button variant="primary" onClick={onSave} disabled={!companyId || !dirty || saving}>
              {saving ? t.saving : t.save}
            </Button>
          </Flex>
        </>
      )}
    </Flex>
  );
};
