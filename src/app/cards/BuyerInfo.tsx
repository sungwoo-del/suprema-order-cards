import React, { useCallback, useEffect, useState } from 'react';
import {
  DescriptionList,
  DescriptionListItem,
  Divider,
  Flex,
  Icon,
  Link,
  LoadingSpinner,
  StatusTag,
  Text,
  hubspot,
} from '@hubspot/ui-extensions';
import {
  CardFooter,
  COMMON,
  ErrorNote,
  PORTAL,
  callSidebar,
  getLang,
  recordUrl,
} from './SidebarShared.tsx';

// ③ 구매자 정보 — Buyer Company · Contact 요약과 레코드 바로가기 (읽기 전용)
const MSG = {
  en: {
    company: 'Buyer Company',
    vat: 'VAT ID',
    contact: 'Buyer Contact',
    team: 'Recommended Team · Country',
    orderable: 'Orderable',
    notOrderable: 'Not orderable',
    openCompany: 'Open company record ↗',
    openContact: 'Open contact record ↗',
    internal:
      'HQ/Branch purchase — the buyer is the branch entity of the Owner Branch.',
    none: 'There is no buyer company. Action required: select it in the Order Setup card (Order Info tab).',
    noContact: 'There is no buyer contact.',
    missing: 'The record could not be found.',
  },
  ko: {
    company: '구매 회사 (Buyer Company)',
    vat: 'VAT ID',
    contact: '구매 담당자 (Buyer Contact)',
    team: 'Recommended Team · 국가',
    orderable: '주문 가능',
    notOrderable: '주문 불가',
    openCompany: '회사 레코드 열기 ↗',
    openContact: '담당자 레코드 열기 ↗',
    internal: 'HQ/Branch 구매 — 구매자는 Owner Branch의 지사 법인입니다.',
    none: '구매 회사가 없습니다. 필요한 조치 : Order Info 탭의 주문 설정 카드에서 선택하세요.',
    noContact: '구매 담당자가 없습니다.',
    missing: '레코드를 찾을 수 없습니다.',
  },
};

hubspot.extend<'crm.record.sidebar'>(({ context, actions }) => (
  <BuyerInfo context={context} actions={actions} />
));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BuyerInfo = ({ context, actions }: { context: any; actions: any }) => {
  const lang = getLang(context);
  const t = MSG[lang];
  const c = COMMON[lang];
  const dealId = String(context?.crm?.objectId ?? '');
  const portalId = context?.portal?.id ?? PORTAL;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setData(await callSidebar({ action: 'buyer', dealId, lang }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [dealId, lang]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const r = ['hq', 'eu', 'uk', 'us', 'jp', 'in', 'me', 'latam'];
    actions.onCrmPropertiesUpdate(
      [
        'owning_entity',
        'buyer_type',
        ...r.flatMap((x) => [`partner_${x}`, `partner_owner_${x}`]),
      ],
      () => load(),
    );
  }, [actions, load]);

  if (error) return <ErrorNote lang={lang} message={error} />;
  if (!data) return <LoadingSpinner label={c.loading} />;
  const footer = (
    <>
      <Divider />
      <CardFooter
        lang={lang}
        onRefresh={load}
        href={recordUrl(portalId, dealId)}
      />
    </>
  );
  const info = (text: string, color: 'inherit' | 'warning' = 'inherit') => (
    <Flex direction="row" gap="extra-small" align="center">
      <Icon name="info" size="sm" color={color} />
      <Text variant="microcopy">{text}</Text>
    </Flex>
  );
  if (data.internal)
    return (
      <Flex direction="column" gap="small">
        {info(t.internal)}
        {data.branchCompanyId ? (
          <Link
            href={{
              url: `https://app-na2.hubspot.com/contacts/${portalId}/record/0-2/${data.branchCompanyId}`,
              external: false,
            }}
          >
            {t.openCompany}
          </Link>
        ) : null}
        {footer}
      </Flex>
    );
  const co = data.company;
  const ct = data.contact;
  if (!co)
    return (
      <Flex direction="column" gap="small">
        {info(t.none, 'warning')}
        {footer}
      </Flex>
    );
  const objUrl = (type: string, id: string) =>
    `https://app-na2.hubspot.com/contacts/${portalId}/record/${type}/${id}`;
  return (
    <Flex direction="column" gap="small">
      <DescriptionList direction="column">
        <DescriptionListItem label={t.company}>
          <Text format={{ fontWeight: 'bold' }}>
            {co.missing ? t.missing : co.partner_company_name || '-'}
          </Text>
        </DescriptionListItem>
        <DescriptionListItem label={t.vat}>
          <Text>{co.vat_id || '-'}</Text>
        </DescriptionListItem>
        <DescriptionListItem label={t.team}>
          <Text>
            {[co.recommended_team, co.country].filter(Boolean).join(' · ') ||
              '-'}
          </Text>
        </DescriptionListItem>
        <DescriptionListItem label={t.contact}>
          <Text>
            {ct
              ? ct.missing
                ? t.missing
                : [ct.partner_name, ct.email].filter(Boolean).join(' · ')
              : t.noContact}
          </Text>
        </DescriptionListItem>
      </DescriptionList>
      {!co.missing ? (
        <StatusTag
          variant={String(co.is_orderable) === 'true' ? 'success' : 'danger'}
        >
          {String(co.is_orderable) === 'true' ? t.orderable : t.notOrderable}
        </StatusTag>
      ) : null}
      <Flex direction="column" gap="extra-small">
        <Link
          href={{
            url: objUrl(data.partnerCompanyType, co.id),
            external: false,
          }}
        >
          {t.openCompany}
        </Link>
        {ct && !ct.missing ? (
          <Link
            href={{ url: objUrl(data.partnerType, ct.id), external: false }}
          >
            {t.openContact}
          </Link>
        ) : null}
      </Flex>
      {footer}
    </Flex>
  );
};
