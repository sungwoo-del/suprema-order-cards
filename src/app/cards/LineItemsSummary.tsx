import React, { useCallback, useEffect, useState } from 'react';
import {
  Divider,
  EmptyState,
  Flex,
  Link,
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
  editorUrl,
  getLang,
  money,
  recordUrl,
} from './SidebarShared.tsx';

// ② 라인아이템 요약 — 품목 수 · 합계 · 할인 · 편집기 바로가기 (읽기 전용)
const MAX_ROWS = 5;
const MSG = {
  en: {
    items: 'Items',
    total: 'Total',
    discount: (v: string) => `Discount ${v}`,
    more: (n: number) => `+${n} more`,
    open: 'Open line item editor',
    emptyTitle: 'There are no line items',
    emptyBody: 'Action required: set the price book, then add line items.',
  },
  ko: {
    items: '품목',
    total: '합계',
    discount: (v: string) => `할인 ${v}`,
    more: (n: number) => `외 ${n}건`,
    open: '라인아이템 편집기 열기',
    emptyTitle: '라인아이템이 없습니다',
    emptyBody: '필요한 조치 : 가격표를 지정한 뒤 라인아이템을 등록하세요.',
  },
};

hubspot.extend<'crm.record.sidebar'>(({ context, actions }) => (
  <LineItemsSummary context={context} actions={actions} />
));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pct = (i: any) => {
  const v = i.hs_discount_percentage || i.pricebook_price_discount || '';
  if (v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? `${+n.toFixed(2)}%` : String(v);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LineItemsSummary = ({
  context,
  actions,
}: {
  context: any;
  actions: any;
}) => {
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
      setData(await callSidebar({ action: 'lineitems', dealId, lang }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [dealId, lang]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    actions.onCrmPropertiesUpdate(
      ['hs_num_of_associated_line_items', 'amount'],
      () => load(),
    );
  }, [actions, load]);

  if (error) return <ErrorNote lang={lang} message={error} />;
  if (!data) return <LoadingSpinner label={c.loading} />;
  const items = data.items || [];
  const editor = (
    <Link href={{ url: editorUrl(portalId, dealId), external: false }}>
      {t.open}
    </Link>
  );
  if (!items.length)
    return (
      <Flex direction="column" gap="small">
        <EmptyState
          title={t.emptyTitle}
          layout="vertical"
          imageWidth={80}
          flush
        >
          <Text variant="microcopy">{t.emptyBody}</Text>
          {editor}
        </EmptyState>
        <Divider />
        <CardFooter
          lang={lang}
          onRefresh={load}
          href={recordUrl(portalId, dealId)}
        />
      </Flex>
    );
  return (
    <Flex direction="column" gap="small">
      <Statistics>
        <StatisticsItem label={t.items} number={String(items.length)} />
        <StatisticsItem
          label={t.total}
          number={money(data.total, data.currency)}
        >
          {data.discount > 0 ? (
            <Text variant="microcopy">
              {t.discount(money(data.discount, data.currency))}
            </Text>
          ) : null}
        </StatisticsItem>
      </Statistics>
      <Divider />
      <Flex direction="column" gap="extra-small">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {items.slice(0, MAX_ROWS).map((i: any) => (
          <Flex key={i.id} direction="row" justify="between" gap="small">
            <Text variant="microcopy">
              {i.name || '-'} ×{i.quantity || 0}
              {pct(i) ? ` · ${pct(i)}` : ''}
            </Text>
            <Text variant="microcopy" format={{ fontWeight: 'bold' }}>
              {money(i.amount, i.hs_line_item_currency_code || data.currency)}
            </Text>
          </Flex>
        ))}
        {items.length > MAX_ROWS ? (
          <Text variant="microcopy">{t.more(items.length - MAX_ROWS)}</Text>
        ) : null}
      </Flex>
      {editor}
      <Divider />
      <CardFooter
        lang={lang}
        onRefresh={load}
        href={recordUrl(portalId, dealId)}
      />
    </Flex>
  );
};
