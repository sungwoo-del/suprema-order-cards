import React, { useCallback, useEffect, useState } from 'react';
import {
  DescriptionList,
  DescriptionListItem,
  Divider,
  Flex,
  Icon,
  LoadingSpinner,
  Statistics,
  StatisticsItem,
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

// ① 주문 요약 — Order Setup 카드의 설정 결과를 오른쪽 컬럼에서 한눈에 (읽기 전용)
const MSG = {
  en: {
    route: 'Order route',
    progress: 'Progress',
    keys: {
      branch: 'Owner Branch · Order Branch',
      buyer: 'Buyer',
      type: 'Order Type · Sales Type',
      price: 'Price book · Currency',
    } as Record<string, string>,
    steps: ['Basics', 'Buyer', 'Order Type', 'Price Book', 'Line items'],
    next: (s: string) =>
      `Next step: ${s}. Action required: complete it in the Order Setup card (Order Info tab).`,
    allDone: 'All steps are complete.',
    undecided: 'Not decided',
  },
  ko: {
    route: '주문 경로',
    progress: '진행',
    keys: {
      branch: 'Owner Branch · Order Branch',
      buyer: '구매자',
      type: '주문 형태 · 판매 유형',
      price: '가격표 · 통화',
    } as Record<string, string>,
    steps: ['기본 정보', '구매자', '주문 형태', '가격표', '라인아이템'],
    next: (s: string) =>
      `다음 단계 : ${s}. 필요한 조치 : Order Info 탭의 주문 설정 카드에서 입력하세요.`,
    allDone: '모든 단계를 완료했습니다.',
    undecided: '미정',
  },
};

hubspot.extend<'crm.record.sidebar'>(({ context, actions }) => (
  <OrderSummary context={context} actions={actions} />
));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OrderSummary = ({ context, actions }: { context: any; actions: any }) => {
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
      setData(await callSidebar({ action: 'summary', dealId, lang }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [dealId, lang]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    actions.onCrmPropertiesUpdate(
      [
        'owning_entity',
        'buyer_type',
        'partner_region_select',
        'order_type',
        'erp_sales_type',
        'pricebook_select',
        'order_route',
        'hs_num_of_associated_line_items',
      ],
      () => load(),
    );
  }, [actions, load]);

  if (error) return <ErrorNote lang={lang} message={error} />;
  if (!data) return <LoadingSpinner label={c.loading} />;
  const code =
    String(data.routeCode || '')
      .match(/case\d/i)?.[0]
      ?.toUpperCase() || t.undecided;
  return (
    <Flex direction="column" gap="small">
      <Statistics>
        <StatisticsItem label={t.route} number={code}>
          <Text variant="microcopy">
            {String(data.route || '').replace(/^CASE\d\s*/i, '')}
          </Text>
        </StatisticsItem>
        <StatisticsItem label={t.progress} number={`${data.doneCount} / 5`}>
          <Text variant="microcopy">
            {data.next >= 0 ? t.steps[data.next] : '✓'}
          </Text>
        </StatisticsItem>
      </Statistics>
      <Divider />
      <DescriptionList direction="column">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {data.rows.map((r: any) => (
          <DescriptionListItem key={r.k} label={t.keys[r.k]}>
            <Text>{r.v || c.notSet}</Text>
          </DescriptionListItem>
        ))}
      </DescriptionList>
      <Flex direction="row" gap="extra-small" align="center">
        <Icon
          name={data.next >= 0 ? 'info' : 'checkCircle'}
          size="sm"
          color={data.next >= 0 ? 'warning' : 'success'}
        />
        <Text variant="microcopy">
          {data.next >= 0 ? t.next(t.steps[data.next]) : t.allDone}
        </Text>
      </Flex>
      <Divider />
      <CardFooter
        lang={lang}
        onRefresh={load}
        href={recordUrl(portalId, dealId)}
      />
    </Flex>
  );
};
