import { Alert, Flex, LoadingSpinner, Text, hubspot } from '@hubspot/ui-extensions';
import { CrmActionLink } from '@hubspot/ui-extensions/crm';
import { PORTAL, getLang, objUrl, odVersion, useOD } from './OrderShared.tsx';
import { FooterLine, StatusRow, TagVariant } from './UiKit.tsx';

// Order Progress (주문 진행) — 오른쪽 사이드바 (Ver.01)
// 상태 태그 + 단계 n/6 + 다음 조치 + 원본 Opportunity
hubspot.extend<'crm.record.sidebar'>(({ context, actions }) => <OrderProgressSide context={context} actions={actions} />);

const TAG: Record<string, [string, string, TagVariant, string, string]> = {
  po: ['Requested', '요청', 'info', 'Request review in the middle card.', '가운데 카드에서 검토를 요청하세요.'],
  review: ['Under review', '검토 대기', 'warning', 'Region team leader approval', '리전팀 Leader 승인'],
  processing: ['Confirming', '확정 진행', 'info', 'Issue the PI and record buyer approval.', 'PI 발행 후 구매자 승인을 기록하세요.'],
  confirming: ['ERP waiting', 'ERP 대기', 'default', 'Moves automatically after ERP.', 'ERP 연동 후 자동 진행'],
  dispatched: ['Dispatched', '출고', 'info', 'Waiting for shipment completion.', '출고 완료 대기'],
  closed: ['Closed', '종료', 'success', '', ''],
  lost: ['Closed lost', '취소', 'error', '', ''],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OrderProgressSide = ({ context, actions }: { context: any; actions: any }) => {
  const lang = getLang(context);
  const ko = lang === 'ko';
  const dealId = String(context?.crm?.objectId ?? '');
  const portalId = context?.portal?.id ?? PORTAL;
  const { data, error, load } = useOD('progress_load', dealId, lang, actions);
  if (error) return <Alert title={ko ? '오류' : 'Error'} variant="danger">{error}</Alert>;
  if (!data) return <LoadingSpinner label={ko ? '불러오는 중입니다...' : 'Loading...'} />;
  const footer = (
    <FooterLine version={odVersion()} refreshLabel={ko ? '새로고침' : 'Refresh'} onRefresh={load} href={objUrl(portalId, '0-3', dealId)} />
  );
  if (data.mode !== 'order')
    return (
      <Flex direction="column" gap="small">
        <StatusRow label={ko ? '해당 없음' : 'Not applicable'} />
        {footer}
      </Flex>
    );
  const cur = data.current as string;
  const [en, kr, variant, nextEn, nextKo] = TAG[cur] || ['--', '--', 'default', '', ''];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idx = data.stages.findIndex((s: any) => s.key === cur);
  return (
    <Flex direction="column" gap="small">
      <StatusRow label={ko ? kr : en} variant={variant} />
      <Text format={{ fontWeight: 'demibold' }}>{`${data.stageLabel} · ${idx + 1}/${data.stages.length}`}</Text>
      {nextKo ? <Text variant="microcopy">{ko ? `필요한 조치 : ${nextKo}` : `Next: ${nextEn}`}</Text> : null}
      {data.source ? (
        <Flex direction="column" gap="flush">
          <CrmActionLink actionType="PREVIEW_OBJECT" actionContext={{ objectTypeId: '0-3', objectId: Number(data.source.id) }}>
            {data.source.dealname}
          </CrmActionLink>
          <Text variant="microcopy">{ko ? '원본 Opportunity' : 'Source opportunity'}</Text>
        </Flex>
      ) : null}
      {footer}
    </Flex>
  );
};
