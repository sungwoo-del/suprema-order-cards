import { useState } from 'react';
import {
  Alert,
  Box,
  DescriptionList,
  DescriptionListItem,
  Flex,
  Link,
  LoadingButton,
  LoadingSpinner,
  StatusTag,
  Text,
  TextArea,
  Tile,
  hubspot,
} from '@hubspot/ui-extensions';
import { CrmActionLink } from '@hubspot/ui-extensions/crm';
import { PORTAL, callOD, editorUrl, getLang, objUrl, odVersion, useOD, userName } from './OrderShared.tsx';
import { CheckList, FooterLine, Progress, StatusRow, TagVariant, joinVals, toast } from './UiKit.tsx';

// Order Progress (주문 진행) — Order 가운데 카드 (Ver.01)
// 단계별 진입 조건 검사 + 동작 : 검토 요청 → 승인/반려 → PI 발행 → 구매자 승인 → (ERP 자동)
hubspot.extend<'crm.record.tab'>(({ context, actions }) => <OrderProgress context={context} actions={actions} />);

const TAG: Record<string, [string, string, TagVariant]> = {
  po: ['Requested', '요청', 'info'],
  review: ['Under review', '검토 대기', 'warning'],
  processing: ['Confirming', '확정 진행', 'info'],
  confirming: ['ERP waiting', 'ERP 대기', 'default'],
  dispatched: ['Dispatched', '출고', 'info'],
  closed: ['Closed', '종료', 'success'],
  lost: ['Closed lost', '취소', 'error'],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OrderProgress = ({ context, actions }: { context: any; actions: any }) => {
  const lang = getLang(context);
  const ko = lang === 'ko';
  const dealId = String(context?.crm?.objectId ?? '');
  const portalId = context?.portal?.id ?? PORTAL;
  const { data, error, load, notify } = useOD('progress_load', dealId, lang, actions);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  if (error) return <Alert title={ko ? '오류' : 'Error'} variant="danger">{error}</Alert>;
  if (!data) return <LoadingSpinner label={ko ? '불러오는 중입니다...' : 'Loading...'} />;
  const footer = (
    <FooterLine version={odVersion()} refreshLabel={ko ? '새로고침' : 'Refresh'} onRefresh={load} href={objUrl(portalId, '0-3', dealId)} />
  );
  if (data.mode !== 'order')
    return (
      <Flex direction="column" gap="small">
        <StatusRow label={ko ? '해당 없음' : 'Not applicable'} text={ko ? 'Order 파이프라인 거래에서만 사용합니다.' : 'Used only for order pipeline deals.'} />
        {footer}
      </Flex>
    );

  const run = async (key: string, params: Record<string, unknown>, done: string) => {
    setBusy(key);
    setErr('');
    try {
      await callOD({ dealId, lang, ...params });
      setNote('');
      toast(actions, done);
      await load();
      notify();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy('');
  };
  const cur = data.current as string;
  const [en, kr, variant] = TAG[cur] || ['--', '--', 'default'];
  const checkList = (
    <CheckList
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items={(data.checks || []).map((c: any) => ({
        ...c,
        action:
          c.key === 'lines' || c.key === 'zero' ? (
            <Link href={{ url: editorUrl(portalId, dealId), external: true }}>{ko ? '라인아이템 편집 ↗' : 'Edit line items ↗'}</Link>
          ) : undefined,
      }))}
    />
  );
  const reviewLine = data.review.status
    ? joinVals(
        data.review.status === 'approved' ? (ko ? '검토 승인' : 'Approved') : data.review.status === 'rejected' ? (ko ? '검토 반려' : 'Rejected') : ko ? '검토 대기' : 'Pending',
        data.review.by,
      )
    : '';

  let body = null;
  let text = '';
  if (cur === 'po') {
    text = data.review.status === 'rejected'
      ? ko ? `반려되었습니다 : ${data.review.note}. 필요한 조치 : 수정 후 다시 검토 요청하세요.` : `Rejected: ${data.review.note}. Action required: fix it and request review again.`
      : ko ? '필요한 조치 : 조건을 확인하고 검토를 요청하세요.' : 'Action required: check the conditions and request review.';
    body = (
      <>
        {checkList}
        <Flex direction="row" gap="small">
          <LoadingButton variant="primary" loading={busy === 'req'} disabled={!data.ready || !!busy} onClick={() => run('req', { action: 'request_review' }, ko ? '검토를 요청했습니다. Under Review로 이동했습니다.' : 'Review requested. Moved to Under Review.')}>
            {ko ? '검토 요청' : 'Request review'}
          </LoadingButton>
        </Flex>
      </>
    );
  } else if (cur === 'review') {
    const approver = !!data.approver?.can;
    text = approver
      ? ko ? '필요한 조치 : 주문을 확인하고 승인 또는 반려하세요.' : 'Action required: approve or reject the order.'
      : ko ? '리전팀 Leader 승인을 기다리고 있습니다.' : 'Waiting for the region team leader approval.';
    body = approver ? (
      <>
        <TextArea name="od_note" label={ko ? '검토 의견 (반려 시 필수)' : 'Review note (required to reject)'} value={note} onChange={(v: string) => setNote(v)} />
        <Flex direction="row" gap="small">
          <LoadingButton variant="primary" loading={busy === 'ok'} disabled={!!busy} onClick={() => run('ok', { action: 'review', decision: 'approve', note, userName: userName(context) }, ko ? '승인했습니다. Order Processing으로 이동했습니다.' : 'Approved. Moved to Order Processing.')}>
            {ko ? '승인' : 'Approve'}
          </LoadingButton>
          <LoadingButton loading={busy === 'no'} disabled={!!busy || !note.trim()} onClick={() => run('no', { action: 'review', decision: 'reject', note, userName: userName(context) }, ko ? '반려했습니다. PO Registration으로 되돌렸습니다.' : 'Rejected. Moved back to PO Registration.')}>
            {ko ? '반려' : 'Reject'}
          </LoadingButton>
        </Flex>
      </>
    ) : (
      <Text variant="microcopy">
        {!data.approver?.hasRule
          ? ko ? '승인 팀이 지정되지 않았습니다. 필요한 조치 : 앱 설정에서 주문 검토 승인 팀을 지정하세요.' : 'No approval team is set. Action required: set the order review teams in the app settings.'
          : ko ? `승인 권한이 없습니다. 필요한 조치 : 승인 팀(${data.approver.teams.join(', ')})에 요청하세요.` : `You do not have approval permission. Action required: ask the approval team (${data.approver.teams.join(', ')}).`}
      </Text>
    );
  } else if (cur === 'processing') {
    const q = data.piQuote;
    const noScope = !!(q && q.error);
    const hasQuote = !!(q && q.id && q.status !== 'REJECTED');
    const issued = data.pi === 'issued' || hasQuote;
    const published = hasQuote && q.status !== 'DRAFT' && q.status !== 'PENDING_APPROVAL';
    text = !issued
      ? ko ? '필요한 조치 : PI 견적서를 만드세요.' : 'Action required: create the PI quote.'
      : hasQuote && !published
        ? ko ? '필요한 조치 : 견적서를 열어 내용을 확인하고 게시하세요.' : 'Action required: open the quote, review it, and publish it.'
        : ko ? '필요한 조치 : 구매자가 PI를 승인하면 [구매자 승인 처리]를 누르세요.' : 'Action required: when the buyer approves the PI, click "Buyer approved".';
    body = (
      <>
        <CheckList
          items={[
            { key: 'pi', ok: issued, text: ko ? 'PI 견적서 생성' : 'PI quote created' },
            { key: 'pub', ok: published || (issued && !hasQuote), text: ko ? '견적서 게시 (구매자에게 전달)' : 'Quote published (sent to buyer)' },
            { key: 'buyer', ok: false, text: ko ? '구매자 PI 승인' : 'Buyer approved PI' },
          ]}
        />
        {noScope ? <Alert title={ko ? '견적 권한 없음' : 'No quote permission'} variant="warning">{q.message}</Alert> : null}
        {hasQuote ? (
          <Tile compact>
            <Flex direction="row" gap="small" align="center" wrap="wrap">
              <Box flex={1}>
                <Flex direction="column" gap="extra-small">
                  <Link href={{ url: objUrl(PORTAL, '0-14', q.id), external: true }}>{q.title || 'PI'}</Link>
                  <Text variant="microcopy">{joinVals(q.amount, q.expires ? (ko ? `유효기간 ${q.expires}` : `Expires ${q.expires}`) : '')}</Text>
                </Flex>
              </Box>
              <Box flex="none">
                <Flex direction="row" gap="small" align="center">
                  <StatusTag variant={q.variant as 'default' | 'success' | 'warning' | 'danger' | 'info'}>{q.statusLabel}</StatusTag>
                  {q.pdf ? <Link href={{ url: q.pdf, external: true }}>PDF</Link> : null}
                  {q.link ? <Link href={{ url: q.link, external: true }}>{ko ? '구매자 링크' : 'Buyer link'}</Link> : null}
                </Flex>
              </Box>
            </Flex>
          </Tile>
        ) : null}
        <Flex direction="row" gap="small" align="center" wrap="wrap">
          {issued ? (
            <LoadingButton variant="primary" loading={busy === 'pa'} disabled={!!busy} onClick={() => run('pa', { action: 'pi', step: 'approve' }, ko ? '구매자 승인을 기록했습니다. Order Confirming으로 이동했습니다.' : 'Buyer approval recorded. Moved to Order Confirming.')}>
              {ko ? '구매자 승인 처리' : 'Buyer approved'}
            </LoadingButton>
          ) : noScope ? (
            <LoadingButton variant="primary" loading={busy === 'pi'} disabled={!!busy} onClick={() => run('pi', { action: 'pi', step: 'issue' }, ko ? 'PI 발행을 기록했습니다.' : 'PI issue recorded.')}>
              {ko ? 'PI 발행 처리 (수동)' : 'Mark PI issued (manual)'}
            </LoadingButton>
          ) : (
            <LoadingButton variant="primary" loading={busy === 'pq'} disabled={!!busy} onClick={() => run('pq', { action: 'pi', step: 'quote' }, ko ? 'PI 견적서를 만들었습니다. 견적서를 열어 확인 후 게시하세요.' : 'PI quote created. Open it, review, and publish.')}>
              {ko ? 'PI 견적서 만들기' : 'Create PI quote'}
            </LoadingButton>
          )}
          {!issued && !noScope ? (
            <Text variant="microcopy">{ko ? 'ⓘ 라인아이템 · 담당자 · 회사를 복사한 견적서 초안을 PI 템플릿으로 만듭니다.' : 'ⓘ Creates a draft quote from the PI template with line items, contact, and company.'}</Text>
          ) : null}
        </Flex>
      </>
    );
  } else if (cur === 'confirming' || cur === 'dispatched') {
    text = ko ? 'ERP 연동 대기 중입니다. I/F 개발 후 자동으로 진행됩니다.' : 'Waiting for ERP. It moves automatically after the interface is built.';
    body = (
      <DescriptionList direction="row">
        <DescriptionListItem label="UniERP I/F">
          <Text>{data.erp.unierp || '--'}</Text>
        </DescriptionListItem>
        <DescriptionListItem label="D365 I/F">
          <Text>{data.erp.d365 || '--'}</Text>
        </DescriptionListItem>
        <DescriptionListItem label="SO No.">
          <Text>{data.erp.so || '--'}</Text>
        </DescriptionListItem>
        <DescriptionListItem label={ko ? '출고 상태' : 'Shipment'}>
          <Text>{data.erp.shipment || '--'}</Text>
        </DescriptionListItem>
      </DescriptionList>
    );
  } else {
    text = cur === 'lost' ? (ko ? '취소된 주문입니다.' : 'This order is cancelled.') : ko ? '주문이 완료되었습니다.' : 'The order is complete.';
  }

  return (
    <Flex direction="column" gap="medium">
      <StatusRow label={ko ? kr : en} variant={variant} text={`${ko ? '현재 단계' : 'Stage'} : ${data.stageLabel}`} />
      {cur !== 'lost' ? (
        <Progress
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          steps={data.stages.map((x: any) => x.label)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current={data.stages.findIndex((x: any) => x.key === cur)}
        />
      ) : null}
      {err ? <Alert title={ko ? '오류' : 'Error'} variant="danger">{err}</Alert> : null}
      <Text variant="microcopy">{text}</Text>
      {body}
      <DescriptionList direction="row">
        <DescriptionListItem label={ko ? '금액' : 'Amount'}>
          <Text>{data.amount}</Text>
        </DescriptionListItem>
        <DescriptionListItem label={ko ? '검토' : 'Review'}>
          <Text>{reviewLine || '--'}</Text>
        </DescriptionListItem>
        <DescriptionListItem label={ko ? 'PI 확정 금액' : 'PI confirmed'}>
          <Text>{data.confirmed || '--'}</Text>
        </DescriptionListItem>
        <DescriptionListItem label={ko ? '원본 Opportunity' : 'Source opportunity'}>
          {data.source ? (
            <CrmActionLink actionType="PREVIEW_OBJECT" actionContext={{ objectTypeId: '0-3', objectId: Number(data.source.id) }}>
              {data.source.dealname}
            </CrmActionLink>
          ) : (
            <Text>--</Text>
          )}
        </DescriptionListItem>
      </DescriptionList>
      {footer}
    </Flex>
  );
};
