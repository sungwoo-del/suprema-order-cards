import {
  Alert,
  Divider,
  Flex,
  Link,
  LoadingSpinner,
  Tag,
  Text,
  hubspot,
} from '@hubspot/ui-extensions';
import { CrmActionLink } from '@hubspot/ui-extensions/crm';
import { PORTAL, T, cvVersion, getLang, objUrl, useCV } from './ConvertShared.tsx';

// Lead(Partner) → Opportunity 전환 — 오른쪽 사이드바 간략버전
// 상태만 보여주고, 생성은 가운데 컬럼 카드에서(복사 미리보기 확인 후 생성)
hubspot.extend<'crm.record.sidebar'>(({ context, actions }) => (
  <ConvertOppSide context={context} actions={actions} />
));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConvertOppSide = ({ context, actions }: { context: any; actions: any }) => {
  const lang = getLang(context);
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
    <>
      <Divider />
      <Flex direction="row" justify="between" align="center">
        <Text variant="microcopy">{cvVersion()}</Text>
        <Link href={{ url: objUrl(portalId, '0-3', dealId), external: false }} preventDefault onClick={load}>
          {t.refresh}
        </Link>
      </Flex>
    </>
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stage = (data.stages.find((s: any) => s.id === data.current) || {}).label || '';
  const trig = data.triggerLabels.join(' / ') || 'Converted';
  const ex = data.existing;
  const goTab =
    lang === 'ko'
      ? '가운데 컬럼의 영업기회 전환 카드에서 복사 내용을 확인하고 생성하세요.'
      : 'Check what will be copied and create it in the Convert to Opportunity card in the middle column.';

  return (
    <Flex direction="column" gap="small">
      {!data.inSource ? (
        <Text variant="microcopy">ⓘ {t.notSource}</Text>
      ) : ex ? (
        <>
          <Flex direction="row" gap="small" align="center">
            <Tag variant="success">Opportunity</Tag>
            <Text variant="microcopy">{lang === 'ko' ? '생성됨' : 'Created'}</Text>
          </Flex>
          <CrmActionLink actionType="PREVIEW_OBJECT" actionContext={{ objectTypeId: '0-3', objectId: Number(ex.id) }}>
            {ex.dealname}
          </CrmActionLink>
          <Text variant="microcopy">{[ex.pipelineLabel, ex.stageLabel, ex.ownerName].filter(Boolean).join(' · ')}</Text>
          <Link href={{ url: objUrl(portalId, '0-3', ex.id), external: true }}>{t.newTab}</Link>
        </>
      ) : data.active ? (
        <>
          <Flex direction="row" gap="small" align="center">
            <Tag variant="warning">{stage}</Tag>
            <Text variant="microcopy">{lang === 'ko' ? '전환 가능' : 'Ready to convert'}</Text>
          </Flex>
          <Text variant="microcopy">{data.hasOwner ? t.ready : t.noOwner}</Text>
          <Text variant="microcopy">ⓘ {goTab}</Text>
        </>
      ) : (
        <>
          <Flex direction="row" gap="small" align="center">
            <Tag>{stage || '—'}</Tag>
          </Flex>
          <Text variant="microcopy">{t.notStage(trig)}</Text>
        </>
      )}
      {footer}
    </Flex>
  );
};
