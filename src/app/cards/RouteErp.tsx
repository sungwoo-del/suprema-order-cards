import React, { useCallback, useEffect, useState } from 'react';
import {
  DescriptionList,
  DescriptionListItem,
  Divider,
  Flex,
  Icon,
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

// ④ 주문 경로 · ERP 상태 — 경로 · ERP 대상 · 매출 구분 + 파이프라인 단계(세로) (읽기 전용)
const MSG = {
  en: {
    route: 'Order route',
    erp: 'ERP target · ERP - Order Branch',
    revenue: 'Revenue type',
    stages: (p: string) => `Pipeline stages${p ? ' · ' + p : ''}`,
    undecided:
      'Not decided yet — the workflow sets it after the Order Branch and Order Type are saved.',
    current: 'Current',
  },
  ko: {
    route: '주문 경로',
    erp: 'ERP 대상 · ERP - Order Branch',
    revenue: '매출 구분',
    stages: (p: string) => `파이프라인 단계${p ? ' · ' + p : ''}`,
    undecided:
      '아직 판정되지 않았습니다 — Order Branch · 주문 형태를 저장하면 워크플로가 지정합니다.',
    current: '현재',
  },
};

hubspot.extend<'crm.record.sidebar'>(({ context, actions }) => (
  <RouteErp context={context} actions={actions} />
));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RouteErp = ({ context, actions }: { context: any; actions: any }) => {
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
      setData(await callSidebar({ action: 'route', dealId, lang }));
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
        'order_route',
        'erp_target',
        'revenue_type',
        'selling_entity',
        'order_type',
        'dealstage',
        'pipeline',
      ],
      () => load(),
    );
  }, [actions, load]);

  if (error) return <ErrorNote lang={lang} message={error} />;
  if (!data) return <LoadingSpinner label={c.loading} />;
  return (
    <Flex direction="column" gap="small">
      {data.routeCode ? (
        <StatusTag variant="info">{data.route}</StatusTag>
      ) : (
        <Flex direction="row" gap="extra-small" align="center">
          <Icon name="info" size="sm" color="warning" />
          <Text variant="microcopy">{t.undecided}</Text>
        </Flex>
      )}
      <DescriptionList direction="column">
        <DescriptionListItem label={t.erp}>
          <Text>
            {[data.erpTarget, data.erpBranch].filter(Boolean).join(' · ') ||
              '-'}
          </Text>
        </DescriptionListItem>
        <DescriptionListItem label={t.revenue}>
          <Text>{data.revenue || '-'}</Text>
        </DescriptionListItem>
      </DescriptionList>
      {data.stages && data.stages.length ? (
        <>
          <Divider />
          <Text variant="microcopy" format={{ fontWeight: 'bold' }}>
            {t.stages(data.pipeline)}
          </Text>
          <Flex direction="column" gap="extra-small">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {data.stages.map((s: any, i: number) => {
              const done = i < data.current;
              const cur = i === data.current;
              return (
                <Flex
                  key={s.id}
                  direction="row"
                  gap="extra-small"
                  align="center"
                >
                  <Icon
                    name={
                      done
                        ? 'checkCircle'
                        : cur
                          ? 'circleFilled'
                          : 'circleHollow'
                    }
                    size="sm"
                    color={done ? 'success' : cur ? 'warning' : 'inherit'}
                  />
                  <Text
                    variant="microcopy"
                    format={cur ? { fontWeight: 'bold' } : undefined}
                  >
                    {s.label}
                    {cur ? ` · ${t.current}` : ''}
                  </Text>
                </Flex>
              );
            })}
          </Flex>
        </>
      ) : null}
      <Divider />
      <CardFooter
        lang={lang}
        onRefresh={load}
        href={recordUrl(portalId, dealId)}
      />
    </Flex>
  );
};
