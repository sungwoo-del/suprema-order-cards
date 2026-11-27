import {
  Alert,
  Button,
  Divider,
  EmptyState,
  Flex,
  Link,
  LoadingSpinner,
  Panel,
  PanelBody,
  PanelSection,
  Tag,
  Text,
  hubspot,
} from '@hubspot/ui-extensions';
import { CrmActionLink } from '@hubspot/ui-extensions/crm';
import {
  CompanySummary,
  ContactLine,
  Editor,
  PORTAL,
  T,
  ecVersion,
  getLang,
  objUrl,
  useEC,
} from './EndCustomerShared.tsx';

// End Customer(최종 고객사) — 오른쪽 사이드바 간략버전
// 보기 위주 : 회사 요약 + 담당자 목록 · 선택 / 변경 / 추가 / 신규 생성은 Panel에서 처리
hubspot.extend<'crm.record.sidebar'>(({ context, actions }) => (
  <EndCustomerSide context={context} actions={actions} />
));

const PANEL = 'ec-side-panel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EndCustomerSide = ({ context, actions }: { context: any; actions: any }) => {
  const lang = getLang(context);
  const t = T[lang];
  const dealId = String(context?.crm?.objectId ?? '');
  const portalId = context?.portal?.id ?? PORTAL;
  const { data, setData, error, load, notify } = useEC(dealId, lang, actions);

  if (error)
    return (
      <Alert title={t.error} variant="danger">
        {error}
      </Alert>
    );
  if (!data) return <LoadingSpinner label={t.loading} />;

  const panel = (
    <Panel id={PANEL} title={t.select} width="md">
      <PanelBody>
        <PanelSection>
          <Editor
            lang={lang}
            dealId={dealId}
            data={data}
            compact
            onSaved={(d) => {
              setData(d);
              actions.closeOverlay(PANEL);
              notify();
            }}
            onCancel={() => actions.closeOverlay(PANEL)}
          />
        </PanelSection>
      </PanelBody>
    </Panel>
  );
  const footer = (
    <>
      <Divider />
      <Flex direction="row" justify="between" align="center">
        <Text variant="microcopy">{ecVersion()}</Text>
        <Link href={{ url: objUrl(portalId, '0-3', dealId), external: false }} preventDefault onClick={load}>
          {t.refresh}
        </Link>
      </Flex>
    </>
  );

  const co = data.company;
  if (!co && !data.contacts.length)
    return (
      <Flex direction="column" gap="small">
        <EmptyState title={t.emptyTitle} layout="vertical" imageWidth={80}>
          <Text variant="microcopy">{t.emptyAction}</Text>
          <Button variant="primary" size="sm" overlay={panel}>
            {t.select}
          </Button>
        </EmptyState>
        {footer}
      </Flex>
    );

  const head = (label: string, action: string) => (
    <Flex direction="row" justify="between" align="center">
      <Text variant="microcopy" format={{ fontWeight: 'bold' }}>
        {label}
      </Text>
      <Button size="xs" variant="secondary" overlay={panel}>
        {action}
      </Button>
    </Flex>
  );

  return (
    <Flex direction="column" gap="small">
      {data.extraCompanies.length ? (
        <Alert title={lang === 'ko' ? '확인 필요' : 'Check'} variant="warning">
          {t.extra(data.extraCompanies.map((c) => c.name).join(', '))}
        </Alert>
      ) : null}
      {head(lang === 'ko' ? '회사' : 'Company', co ? t.change : t.select)}
      {co ? (
        <Flex direction="column" gap="extra-small">
          <CrmActionLink actionType="PREVIEW_OBJECT" actionContext={{ objectTypeId: '0-2', objectId: Number(co.id) }}>
            {co.name}
          </CrmActionLink>
          <Tag variant="success">End Customer</Tag>
          <CompanySummary lang={lang} c={co} compact />
          <Link href={{ url: objUrl(portalId, '0-2', co.id), external: true }}>{t.newTab}</Link>
        </Flex>
      ) : (
        <Text variant="microcopy">ⓘ {t.noCompanyLinked}</Text>
      )}
      <Divider />
      {head(`${lang === 'ko' ? '담당자' : 'Contacts'} (${data.contacts.length})`, t.addContact)}
      {data.contacts.length ? (
        data.contacts.map((c) => (
          <Flex key={c.id} direction="column" gap="flush">
            <Flex direction="row" justify="between" align="center">
              <CrmActionLink actionType="PREVIEW_OBJECT" actionContext={{ objectTypeId: '0-1', objectId: Number(c.id) }}>
                {c.name}
              </CrmActionLink>
              <Link href={{ url: objUrl(portalId, '0-1', c.id), external: true }}>↗</Link>
            </Flex>
            <Text variant="microcopy">{ContactLine(c) || '—'}</Text>
          </Flex>
        ))
      ) : (
        <Text variant="microcopy">ⓘ {t.noContactLinked}</Text>
      )}
      {footer}
    </Flex>
  );
};
