import { useState } from 'react';
import {
  Alert,
  Button,
  DateInput,
  DescriptionList,
  DescriptionListItem,
  Divider,
  Flex,
  Input,
  Link,
  LoadingSpinner,
  Modal,
  ModalBody,
  ModalFooter,
  StepIndicator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Text,
  hubspot,
} from '@hubspot/ui-extensions';
import { CrmActionButton } from '@hubspot/ui-extensions/crm';
import { PORTAL, T, callCV, cvVersion, getLang, objUrl, useCV } from './ConvertShared.tsx';

// Lead(Partner) → Opportunity 전환 — 가운데 컬럼 카드
hubspot.extend<'crm.record.tab'>(({ context, actions }) => (
  <ConvertOpp context={context} actions={actions} />
));

const MODAL = 'convert-opp-modal';
const toDateObj = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1, date: Number(m[3]) } : undefined;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromDateObj = (d: any) =>
  d ? `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.date).padStart(2, '0')}` : '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConvertOpp = ({ context, actions }: { context: any; actions: any }) => {
  const lang = getLang(context);
  const t = T[lang];
  const dealId = String(context?.crm?.objectId ?? '');
  const portalId = context?.portal?.id ?? PORTAL;
  const { data, error, load } = useCV(dealId, lang, actions);
  const [name, setName] = useState<string | null>(null);
  const [close, setClose] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);

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
        <Text variant="microcopy">Suprema Order - HelloDigital</Text>
        <Link href={{ url: objUrl(portalId, '0-3', dealId), external: false }} preventDefault onClick={load}>
          {t.refresh}
        </Link>
      </Flex>
    </>
  );
  const head = (
    <Text variant="microcopy">
      {t.desc} ({cvVersion()})
    </Text>
  );
  if (!data.inSource)
    return (
      <Flex direction="column" gap="small">
        {head}
        <Alert title={lang === 'ko' ? '알림' : 'Notice'} variant="info">
          {t.notSource}
        </Alert>
        {footer}
      </Flex>
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageNames = data.stages.map((s: any) => s.label);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cur = Math.max(0, data.stages.findIndex((s: any) => s.id === data.current));
  const tracker = <StepIndicator stepNames={stageNames} currentStep={cur} variant={stageNames.length > 5 ? 'compact' : 'default'} />;
  const trig = data.triggerLabels.join(' / ') || 'Converted';

  const ex = data.existing;
  const resultTable = (r: any) => {
    const rows: [string, string][] = [];
    if (r.props) rows.push([t.rProps, `${r.props}`]);
    rows.push([t.rAssoc, `${r.assoc.linked}${r.assoc.failed ? ` · ${t.failed(r.assoc.failed)}` : ''}`]);
    if (r.lines) rows.push([t.rLines, `${r.lines.created}${r.lines.failed ? ` · ${t.failed(r.lines.failed)}` : ''}`]);
    rows.push([t.rActs, `${r.acts.linked}${r.acts.failed ? ` · ${t.failed(r.acts.failed)}` : ''}`]);
    return (
      <DescriptionList direction="row">
        {rows.map(([k, v]) => (
          <DescriptionListItem key={k} label={k}>
            <Text>{v}</Text>
          </DescriptionListItem>
        ))}
      </DescriptionList>
    );
  };

  const relink = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await callCV({ action: 'relink', dealId, lang });
      setResult({ ...(result || {}), ...r.result, props: result?.props ?? 0 });
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  if (ex) {
    const failed = result && (result.assoc.failed || result.acts.failed || (result.lines && result.lines.failed));
    return (
      <Flex direction="column" gap="medium">
        {head}
        {tracker}
        <Alert title={lang === 'ko' ? '완료' : 'Done'} variant="success">
          {result ? t.done(ex.dealname) : t.already}
        </Alert>
        {err ? <Alert title={t.error} variant="danger">{err}</Alert> : null}
        <Flex direction="row" justify="between" align="center" wrap="wrap" gap="small">
          <Flex direction="column" gap="flush">
            <Flex direction="row" gap="small" align="center">
              <Text format={{ fontWeight: 'bold' }}>{ex.dealname}</Text>
              <Tag variant="success">Opportunity</Tag>
            </Flex>
            <Text variant="microcopy">
              {[ex.pipelineLabel, ex.stageLabel, ex.ownerName, String(ex.createdate || '').slice(0, 10)].filter(Boolean).join(' · ')}
            </Text>
          </Flex>
          <Flex direction="row" gap="extra-small">
            <CrmActionButton actionType="PREVIEW_OBJECT" actionContext={{ objectTypeId: '0-3', objectId: Number(ex.id) }} variant="secondary" size="xs">
              {t.preview}
            </CrmActionButton>
            <Button size="xs" href={{ url: objUrl(portalId, '0-3', ex.id), external: true }}>
              {t.newTab}
            </Button>
          </Flex>
        </Flex>
        {result ? (
          <>
            <Text format={{ fontWeight: 'bold' }}>{t.result}</Text>
            {resultTable(result)}
          </>
        ) : null}
        {failed ? (
          <Alert title={lang === 'ko' ? '확인 필요' : 'Check'} variant="warning">
            {t.partial}
          </Alert>
        ) : null}
        <Flex direction="row" justify="end">
          <Button size="xs" disabled={busy} onClick={relink}>
            {t.relink}
          </Button>
        </Flex>
        {footer}
      </Flex>
    );
  }

  if (!data.active)
    return (
      <Flex direction="column" gap="medium">
        {head}
        {tracker}
        <Alert title={lang === 'ko' ? '알림' : 'Notice'} variant="info">
          {t.notStage(trig)}
        </Alert>
        {footer}
      </Flex>
    );

  const create = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await callCV({
        action: 'convert',
        dealId,
        lang,
        dealname: name ?? data.dealname,
        closedate: close ?? data.closeDefault ?? String(data.closedate || '').slice(0, 10),
      });
      setResult(r.result);
      actions.closeOverlay(MODAL);
      await load();
      try {
        actions.refreshObjectProperties();
      } catch (e) {
        /* 무시 */
      }
    } catch (e) {
      setErr((e as Error).message);
      actions.closeOverlay(MODAL);
    }
    setBusy(false);
  };

  const modal = (
    <Modal id={MODAL} title={t.confirmTitle} width="md">
      <ModalBody>
        <Flex direction="column" gap="small">
          <Input name="cv_name" label={t.dealname} value={name ?? data.dealname} onChange={(v: string) => setName(v)} />
          <DateInput
            name="cv_close"
            label={t.closedate}
            format="YYYY-MM-DD"
            value={toDateObj(close ?? data.closeDefault ?? String(data.closedate || '').slice(0, 10))}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(v: any) => setClose(fromDateObj(v))}
          />
          <Text variant="microcopy">
            {t.stage} : {data.target.pipeline} · {data.target.stage}
          </Text>
          <Text variant="microcopy">
            ⓘ {lang === 'ko' ? 'Lead 마감일이 지났거나 없으면 오늘부터 90일 뒤로 제안합니다.' : 'If the lead close date has passed or is empty, today + 90 days is suggested.'}
          </Text>
          <Text variant="microcopy">ⓘ {t.confirmText}</Text>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button onClick={() => actions.closeOverlay(MODAL)}>{t.cancel}</Button>
        <Button variant="primary" disabled={busy || !(name ?? data.dealname)} onClick={create}>
          {busy ? t.creating : t.create}
        </Button>
      </ModalFooter>
    </Modal>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assoc = (data.assoc || []).filter((a: any) => !a.error);
  return (
    <Flex direction="column" gap="medium">
      {head}
      {tracker}
      {err ? <Alert title={t.error} variant="danger">{err}</Alert> : null}
      {data.hasOwner ? (
        <Alert title={lang === 'ko' ? '권장 안내' : 'Recommended'} variant="tip">
          {t.ready}
        </Alert>
      ) : (
        <Alert title={lang === 'ko' ? '확인 필요' : 'Check'} variant="warning">
          {t.noOwner}
        </Alert>
      )}

      <Flex direction="row" gap="small" align="baseline">
        <Text format={{ fontWeight: 'bold' }}>{t.props}</Text>
        <Text variant="microcopy">{t.propsSub}</Text>
      </Flex>
      <Table bordered density="condensed">
        <TableHead>
          <TableRow>
            <TableHeader>{lang === 'ko' ? '속성' : 'Property'}</TableHeader>
            <TableHeader>{t.value}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(data.props || []).map((p: any) => (
            <TableRow key={p.name}>
              <TableCell>{p.label}</TableCell>
              <TableCell>{p.value || t.empty}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.copyLineItems ? <Text variant="microcopy">{t.lines(data.lineItems || 0)}</Text> : null}

      <Flex direction="row" gap="small" align="baseline">
        <Text format={{ fontWeight: 'bold' }}>{t.assoc}</Text>
        <Text variant="microcopy">{t.assocSub}</Text>
      </Flex>
      {assoc.length ? (
        <Table bordered density="condensed">
          <TableHead>
            <TableRow>
              <TableHeader>{lang === 'ko' ? '연결 대상' : 'Object'}</TableHeader>
              <TableHeader>{lang === 'ko' ? '레코드' : 'Record'}</TableHeader>
              <TableHeader>{lang === 'ko' ? '라벨' : 'Labels'}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {assoc.map((a: any) => (
              <TableRow key={`${a.type}-${a.id}`}>
                <TableCell>{t.type[a.type] || a.type}</TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell>{a.labels.join(', ') || (lang === 'ko' ? '일반 연결 (라벨 없음)' : 'Association (no label)')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Text variant="microcopy">ⓘ {t.noAssoc}</Text>
      )}

      {data.copyActivities ? (
        <>
          <Flex direction="row" gap="small" align="baseline">
            <Text format={{ fontWeight: 'bold' }}>{t.acts}</Text>
            <Text variant="microcopy">{t.actsSub}</Text>
          </Flex>
          <Text>{t.actsText(data.activities?.total || 0)}</Text>
        </>
      ) : null}
      <Divider />
      <Flex direction="row" justify="end">
        <Button variant="primary" disabled={!data.hasOwner} overlay={modal}>
          {t.create}
        </Button>
      </Flex>
      {footer}
    </Flex>
  );
};
