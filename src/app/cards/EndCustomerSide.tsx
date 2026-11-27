import {
  Alert,
  Button,
  Divider,
  Flex,
  LoadingSpinner,
  Panel,
  PanelBody,
  PanelSection,
  Text,
  hubspot,
} from '@hubspot/ui-extensions';
import { CrmActionLink } from '@hubspot/ui-extensions/crm';
import { Editor, PORTAL, T, ecVersion, getLang, objUrl, useEC } from './EndCustomerShared.tsx';
import { FooterLine, StatusRow, joinVals, toast } from './UiKit.tsx';

// End Customer(최종 고객사) — 오른쪽 사이드바 (Ver.04 개편)
// 1열 · 표 없음 · 편집/연결은 Panel (G7)
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
    <Panel id={PANEL} title={t.title} width="md">
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
              toast(actions, lang === 'ko' ? '최종 고객사를 저장했습니다.' : 'The end customer was saved.');
            }}
            onCancel={() => actions.closeOverlay(PANEL)}
          />
        </PanelSection>
      </PanelBody>
    </Panel>
  );
  const footer = (
    <FooterLine version={ecVersion()} refreshLabel={t.refresh} onRefresh={load} href={objUrl(portalId, '0-3', dealId)} />
  );

  const co = data.company;
  const n = data.contacts.length;
  if (!co && !n)
    return (
      <Flex direction="column" gap="small">
        <StatusRow label={t.notLinked} variant="warning" />
        <Text variant="microcopy">
          {lang === 'ko' ? '최종 고객사가 없습니다. 필요한 조치 : [연결]을 누르세요.' : 'There is no end customer. Action required: click "Link".'}
        </Text>
        <Flex direction="row">
          <Button variant="primary" size="sm" overlay={panel}>
            {lang === 'ko' ? '연결' : 'Link'}
          </Button>
        </Flex>
        {footer}
      </Flex>
    );

  return (
    <Flex direction="column" gap="small">
      <StatusRow
        label={t.linked}
        variant="success"
        action={<Button size="xs" overlay={panel}>{t.edit}</Button>}
      />
      {data.extraCompanies.length ? (
        <Alert title={lang === 'ko' ? '확인 필요' : 'Check'} variant="warning">
          {t.extra(data.extraCompanies.map((c) => c.name).join(', '))}
        </Alert>
      ) : null}
      {co ? (
        <Flex direction="column" gap="flush">
          <CrmActionLink actionType="PREVIEW_OBJECT" actionContext={{ objectTypeId: '0-2', objectId: Number(co.id) }}>
            {co.name}
          </CrmActionLink>
          <Text variant="microcopy">{joinVals(co.country, co.lifecycle, co.team) || co.domain || ''}</Text>
        </Flex>
      ) : (
        <Text variant="microcopy">ⓘ {t.noCompanyLinked}</Text>
      )}
      <Divider />
      <Text variant="microcopy" format={{ fontWeight: 'bold' }}>
        {lang === 'ko' ? `담당자 ${n}` : `Contacts ${n}`}
      </Text>
      {n ? (
        data.contacts.map((c) => (
          <Flex key={c.id} direction="column" gap="flush">
            <CrmActionLink actionType="PREVIEW_OBJECT" actionContext={{ objectTypeId: '0-1', objectId: Number(c.id) }}>
              {c.name}
            </CrmActionLink>
            <Text variant="microcopy">{joinVals(c.jobtitle || c.jobfunction, c.email !== c.name ? c.email : '')}</Text>
          </Flex>
        ))
      ) : (
        <Text variant="microcopy">ⓘ {t.noContactLinked}</Text>
      )}
      {footer}
    </Flex>
  );
};
