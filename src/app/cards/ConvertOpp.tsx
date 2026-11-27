import React, { useState } from 'react';
import {
  Accordion,
  Alert,
  Button,
  DateInput,
  Dropdown,
  Flex,
  Input,
  Link,
  LoadingButton,
  LoadingSpinner,
  Modal,
  ModalBody,
  ModalFooter,
  Statistics,
  StatisticsItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Tile,
  hubspot,
} from '@hubspot/ui-extensions';
import { CrmActionLink } from '@hubspot/ui-extensions/crm';
import { PORTAL, T, callCV, getLang, objUrl, useCV } from './ConvertShared.tsx';
import { IconText, Progress, StatusRow, joinVals, toast, RefreshLink } from './UiKit.tsx';

// Lead(Partner) → Opportunity 전환 — 가운데 컬럼 카드 (Ver.04 개편 · docs/05_UI_UX_지침.md)
// 상태 : 대기 → 가능 → 완료 / Opportunity 화면에서는 원본 Lead
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
  const ko = lang === 'ko';
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

  const rf = <RefreshLink label={t.refresh} href={objUrl(portalId, '0-3', dealId)} onRefresh={load} />;
  const stepLabels = ['Lead', data.triggerLabels[0] || 'Converted', data.target?.pipeline || 'Opportunity'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dealTile = (d: any, menu?: React.ReactNode) => (
    <Tile compact>
      <Flex direction="row" justify="between" align="start" gap="small">
        <Flex direction="column" gap="extra-small">
          <Flex direction="row" gap="small" align="center">
            <CrmActionLink actionType="PREVIEW_OBJECT" actionContext={{ objectTypeId: '0-3', objectId: Number(d.id) }}>
              {d.dealname}
            </CrmActionLink>
            <Link href={{ url: objUrl(portalId, '0-3', d.id), external: true }}>{lang === 'ko' ? '새 탭' : 'New tab'}</Link>
          </Flex>
          <Text variant="microcopy">
            {joinVals(d.pipelineLabel, d.stageLabel, d.ownerName, String(d.createdate || '').slice(0, 10))}
          </Text>
        </Flex>
        {menu || null}
      </Flex>
    </Tile>
  );

  // ── Lead 파이프라인이 아닌 거래
  if (!data.inSource) {
    if (data.inTarget && data.origin)
      return (
        <Flex direction="column" gap="medium">
          <StatusRow refresh={rf} label={ko ? '원본 Lead' : 'Source lead'} variant="info" text={ko ? '이 거래는 Lead에서 전환되었습니다.' : 'This deal was converted from a lead.'} />
          {dealTile(data.origin)}
        </Flex>
      );
    return (
      <Flex direction="column" gap="small">
        <StatusRow refresh={rf}
          label={ko ? '해당 없음' : 'Not applicable'}
          text={data.inTarget ? (ko ? '원본 Lead가 없습니다 (직접 만든 거래).' : 'There is no source lead (created directly).') : t.notSource}
        />
      </Flex>
    );
  }

  const ex = data.existing;
  const relink = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await callCV({ action: 'relink', dealId, lang });
      setResult({ ...(result || {}), ...r.result, props: result?.props ?? 0 });
      toast(actions, ko ? '활동 기록과 연결을 다시 연결했습니다.' : 'Activities and associations were linked again.');
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  // ── 전환 완료
  if (ex) {
    const failed = result && (result.assoc.failed || result.acts.failed || (result.lines && result.lines.failed));
    return (
      <Flex direction="column" gap="medium">
        <StatusRow refresh={rf} label={ko ? '전환 완료' : 'Converted'} variant="success" text={result ? t.done(ex.dealname) : t.already} />
        <Progress steps={stepLabels} current={2} />
        {err ? <Alert title={t.error} variant="danger">{err}</Alert> : null}
        {dealTile(
          ex,
          <Dropdown buttonText={ko ? '더보기' : 'More'} buttonSize="xs" variant="secondary">
            <Dropdown.ButtonItem onClick={relink}>{busy ? t.creating : t.relink}</Dropdown.ButtonItem>
          </Dropdown>,
        )}
        {result ? (
          <Statistics>
            {result.props ? <StatisticsItem label={t.rProps} number={String(result.props)} /> : null}
            <StatisticsItem label={t.rAssoc} number={String(result.assoc.linked)} />
            {result.lines ? <StatisticsItem label={t.rLines} number={String(result.lines.created)} /> : null}
            <StatisticsItem label={t.rActs} number={String(result.acts.linked)} />
          </Statistics>
        ) : null}
        {failed ? (
          <Alert title={ko ? '확인 필요' : 'Check'} variant="warning">
            {t.partial}
          </Alert>
        ) : null}
      </Flex>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stage = (data.stages.find((s: any) => s.id === data.current) || {}).label || '';
  const trig = data.triggerLabels.join(' / ') || 'Converted';

  // ── 전환 대기
  if (!data.active)
    return (
      <Flex direction="column" gap="small">
        <StatusRow refresh={rf} label={ko ? '전환 대기' : 'Waiting'} text={`${ko ? '현재 단계' : 'Current stage'} : ${stage || '--'}`} />
        <Progress steps={stepLabels} current={0} />
        <Text variant="microcopy">{t.notStage(trig)}</Text>
      </Flex>
    );

  // ── 전환 가능
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
      toast(actions, t.done(r.dealname || name || data.dealname));
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
  const closeVal = close ?? data.closeDefault ?? String(data.closedate || '').slice(0, 10);
  const modal = (
    <Modal id={MODAL} title={t.confirmTitle} width="md">
      <ModalBody>
        <Flex direction="column" gap="small">
          <Input name="cv_name" label={t.dealname} value={name ?? data.dealname} onChange={(v: string) => setName(v)} />
          <DateInput
            name="cv_close"
            label={t.closedate}
            format="YYYY-MM-DD"
            value={toDateObj(closeVal)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(v: any) => setClose(fromDateObj(v))}
          />
          <Text variant="microcopy">
            {t.stage} : {data.target.pipeline} · {data.target.stage}
          </Text>
          <Text variant="microcopy">
            ⓘ {ko ? 'Lead 마감일이 지났거나 없으면 오늘부터 90일 뒤로 제안합니다.' : 'If the lead close date has passed or is empty, today + 90 days is suggested.'} {t.confirmText}
          </Text>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <LoadingButton variant="primary" loading={busy} disabled={!(name ?? data.dealname)} onClick={create}>
          {t.create}
        </LoadingButton>
        <Button onClick={() => actions.closeOverlay(MODAL)}>{t.cancel}</Button>
      </ModalFooter>
    </Modal>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assoc = (data.assoc || []).filter((a: any) => !a.error);
  return (
    <Flex direction="column" gap="medium">
      <StatusRow refresh={rf}
        label={data.hasOwner ? (ko ? '전환 가능' : 'Ready') : (ko ? '확인 필요' : 'Check')}
        variant={data.hasOwner ? 'info' : 'warning'}
        text={data.hasOwner ? (ko ? 'Lead 정보로 Opportunity 거래를 만듭니다.' : 'Creates an opportunity deal from this lead.') : t.noOwner}
      />
      <Progress steps={stepLabels} current={1} />
      {err ? <Alert title={t.error} variant="danger">{err}</Alert> : null}
      <Statistics>
        <StatisticsItem label={ko ? '복사 속성' : 'Properties'} number={String((data.props || []).length)} />
        <StatisticsItem label={ko ? '연결 레코드' : 'Associations'} number={String(assoc.length)} />
        {data.copyLineItems ? <StatisticsItem label={t.rLines} number={String(data.lineItems || 0)} /> : null}
        {data.copyActivities ? <StatisticsItem label={ko ? '활동 공유' : 'Activities'} number={String(data.activities?.total || 0)} /> : null}
      </Statistics>
      <Accordion title={ko ? '복사될 내용 자세히 보기' : 'What will be copied'} size="sm" defaultOpen={false}>
        <Flex direction="column" gap="small">
          <Table bordered density="condensed">
            <TableHead>
              <TableRow>
                <TableHeader>{ko ? '속성' : 'Property'}</TableHeader>
                <TableHeader>{t.value}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(data.props || []).map((p: any) => (
                <TableRow key={p.name}>
                  <TableCell>{p.label}</TableCell>
                  <TableCell>{p.value || '--'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {assoc.length ? (
            <Table bordered density="condensed">
              <TableHead>
                <TableRow>
                  <TableHeader>{ko ? '연결 대상' : 'Object'}</TableHeader>
                  <TableHeader>{ko ? '레코드' : 'Record'}</TableHeader>
                  <TableHeader>{ko ? '라벨' : 'Labels'}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {assoc.map((a: any) => (
                  <TableRow key={`${a.type}-${a.id}`}>
                    <TableCell>{t.type[a.type] || a.type}</TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.labels.join(', ') || '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Text variant="microcopy">ⓘ {t.noAssoc}</Text>
          )}
          {data.copyActivities ? <Text variant="microcopy">ⓘ {t.actsText(data.activities?.total || 0)}</Text> : null}
        </Flex>
      </Accordion>
      <Flex direction="row" gap="small" align="center" wrap="wrap">
        <Button variant="primary" disabled={!data.hasOwner} overlay={modal}>
          <IconText name="add">{t.create}</IconText>
        </Button>
        <Text variant="microcopy">{joinVals(data.owner && `Owner : ${data.owner}`, closeVal && `${ko ? '마감일' : 'Close date'} ${closeVal}`)}</Text>
      </Flex>
    </Flex>
  );
};
