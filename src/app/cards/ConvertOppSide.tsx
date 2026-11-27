import { Alert, Flex, LoadingSpinner, Text, hubspot } from '@hubspot/ui-extensions';
import { CrmActionLink } from '@hubspot/ui-extensions/crm';
import { PORTAL, T, cvVersion, getLang, objUrl, useCV } from './ConvertShared.tsx';
import { FooterLine, StatusRow, joinVals } from './UiKit.tsx';

// Lead(Partner) → Opportunity 전환 — 오른쪽 사이드바 (Ver.04 개편)
// 상태 태그 + 결과 링크 1개. 생성은 가운데 카드에서(복사 내용 확인 후)
hubspot.extend<'crm.record.sidebar'>(({ context, actions }) => (
  <ConvertOppSide context={context} actions={actions} />
));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConvertOppSide = ({ context, actions }: { context: any; actions: any }) => {
  const lang = getLang(context);
  const ko = lang === 'ko';
  const t = T[lang];
  const dealId = String(context?.crm?.objectId ?? '');
  const portalId = context?.portal?.id ?? PORTAL;
  const { data, error, load } = useCV(dealId, lang, actions, true);

  if (error)
    return (
      <Alert title={t.error} variant="danger">
        {error}
      </Alert>
    );
  if (!data) return <LoadingSpinner label={t.loading} />;
  const footer = (
    <FooterLine version={cvVersion()} refreshLabel={t.refresh} onRefresh={load} href={objUrl(portalId, '0-3', dealId)} />
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const link = (d: any) => (
    <Flex direction="column" gap="flush">
      <CrmActionLink actionType="PREVIEW_OBJECT" actionContext={{ objectTypeId: '0-3', objectId: Number(d.id) }}>
        {d.dealname}
      </CrmActionLink>
      <Text variant="microcopy">{joinVals(d.stageLabel, d.ownerName)}</Text>
    </Flex>
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stage = (data.stages.find((s: any) => s.id === data.current) || {}).label || '';
  const trig = data.triggerLabels.join(' / ') || 'Converted';
  const ex = data.existing;

  let body;
  if (!data.inSource)
    body =
      data.inTarget && data.origin ? (
        <>
          <StatusRow label={ko ? '원본 Lead' : 'Source lead'} variant="info" />
          {link(data.origin)}
        </>
      ) : (
        <StatusRow label={ko ? '해당 없음' : 'Not applicable'} />
      );
  else if (ex)
    body = (
      <>
        <StatusRow label={ko ? '전환 완료' : 'Converted'} variant="success" />
        {link(ex)}
      </>
    );
  else if (data.active)
    body = (
      <>
        <StatusRow label={data.hasOwner ? (ko ? '전환 가능' : 'Ready') : (ko ? '확인 필요' : 'Check')} variant={data.hasOwner ? 'info' : 'warning'} />
        <Text variant="microcopy">
          {data.hasOwner
            ? ko
              ? '필요한 조치 : 가운데 영업기회 전환 카드에서 복사 내용을 확인하고 만드세요.'
              : 'Action required: check what will be copied and create it in the middle-column card.'
            : t.noOwner}
        </Text>
      </>
    );
  else
    body = (
      <>
        <StatusRow label={ko ? '전환 대기' : 'Waiting'} text={stage} />
        <Text variant="microcopy">{t.notStage(trig)}</Text>
      </>
    );

  return (
    <Flex direction="column" gap="small">
      {body}
      {footer}
    </Flex>
  );
};
