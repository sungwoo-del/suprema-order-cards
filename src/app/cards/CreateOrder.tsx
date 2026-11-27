import { useState } from 'react';
import {
  Alert,
  Button,
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
  Text,
  Tile,
  hubspot,
} from '@hubspot/ui-extensions';
import { CrmActionLink } from '@hubspot/ui-extensions/crm';
import { PORTAL, callOD, editorUrl, getLang, objUrl, odVersion, useOD } from './OrderShared.tsx';
import { CheckList, FooterLine, StatusRow, joinVals, toast } from './UiKit.tsx';

// Create Order (주문 생성) — Opportunity 가운데 카드 (Ver.01)
// Order Confirm 단계 + 주문 조건 충족 → Order 파이프라인(PO Registration) 거래 생성
// Order 레코드에서는 원본 Opportunity 표시
hubspot.extend<'crm.record.tab'>(({ context, actions }) => <CreateOrder context={context} actions={actions} />);

const MODAL = 'create-order-modal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CreateOrder = ({ context, actions }: { context: any; actions: any }) => {
  const lang = getLang(context);
  const ko = lang === 'ko';
  const dealId = String(context?.crm?.objectId ?? '');
  const portalId = context?.portal?.id ?? PORTAL;
  const { data, error, load, notify } = useOD('create_load', dealId, lang, actions);
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (error) return <Alert title={ko ? '오류' : 'Error'} variant="danger">{error}</Alert>;
  if (!data) return <LoadingSpinner label={ko ? '불러오는 중입니다...' : 'Loading...'} />;
  const footer = (
    <FooterLine version={odVersion()} refreshLabel={ko ? '새로고침' : 'Refresh'} onRefresh={load} href={objUrl(portalId, '0-3', dealId)} />
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tile = (d: any) => (
    <Tile compact>
      <Flex direction="column" gap="extra-small">
        <Flex direction="row" gap="small" align="center">
          <CrmActionLink actionType="PREVIEW_OBJECT" actionContext={{ objectTypeId: '0-3', objectId: Number(d.id) }}>
            {d.dealname}
          </CrmActionLink>
          <Link href={{ url: objUrl(portalId, '0-3', d.id), external: true }}>{ko ? '새 탭' : 'New tab'}</Link>
        </Flex>
        <Text variant="microcopy">{joinVals(d.pipelineLabel, d.stageLabel, d.ownerName, String(d.createdate || '').slice(0, 10))}</Text>
      </Flex>
    </Tile>
  );

  if (data.mode === 'order')
    return (
      <Flex direction="column" gap="medium">
        <StatusRow
          label={ko ? '원본 Opportunity' : 'Source opportunity'}
          variant="info"
          text={data.source ? (ko ? '이 Order는 영업기회에서 생성되었습니다.' : 'This order was created from an opportunity.') : (ko ? '원본 Opportunity가 없습니다 (직접 만든 Order).' : 'There is no source opportunity (created directly).')}
        />
        {data.source ? tile(data.source) : null}
        {footer}
      </Flex>
    );
  if (data.mode !== 'opp')
    return (
      <Flex direction="column" gap="small">
        <StatusRow label={ko ? '해당 없음' : 'Not applicable'} text={ko ? 'Opportunity 거래에서만 사용합니다.' : 'Used only for opportunity deals.'} />
        {footer}
      </Flex>
    );

  if (data.existing)
    return (
      <Flex direction="column" gap="medium">
        <StatusRow label={ko ? '주문 생성됨' : 'Order created'} variant="success" text={ko ? '이 영업기회에서 만든 Order' : 'Order created from this opportunity'} />
        {tile(data.existing)}
        {footer}
      </Flex>
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const done = (data.checks || []).filter((c: any) => c.ok).length;
  const total = (data.checks || []).length;
  const create = async () => {
    setBusy(true);
    setErr('');
    try {
      await callOD({ action: 'create_order', dealId, lang, dealname: name ?? `${data.dealname} - Order` });
      actions.closeOverlay(MODAL);
      toast(actions, ko ? 'Order를 만들고 Opportunity를 Closed Won으로 변경했습니다. 필요한 조치 : Order 레코드에서 검토를 요청하세요.' : 'The order was created and the opportunity was set to Closed Won. Action required: request review on the order record.');
      await load();
      notify();
    } catch (e) {
      setErr((e as Error).message);
      actions.closeOverlay(MODAL);
    }
    setBusy(false);
  };
  const modal = (
    <Modal id={MODAL} title={ko ? 'Order 만들기' : 'Create order'} width="md">
      <ModalBody>
        <Flex direction="column" gap="small">
          <Input name="od_name" label={ko ? 'Deal name (거래명) *' : 'Deal name *'} value={name ?? `${data.dealname} - Order`} onChange={(v: string) => setName(v)} />
          <Text variant="microcopy">
            {ko ? '파이프라인 · 단계' : 'Pipeline · stage'} : {data.target.pipeline} · {data.target.stage}
          </Text>
          <Text variant="microcopy">
            ⓘ{' '}
            {ko
              ? '주문 속성 · 라인아이템 · 연결(구매자 · End Customer 등)을 복사하고 활동 기록을 함께 봅니다. 만들면 이 Opportunity는 Closed Won으로 바뀌고, 다시 만들 수 없습니다.'
              : 'Order properties, line items and associations (buyer, end customer, etc.) are copied and activities are shared. This opportunity is set to Closed Won and the order cannot be created again.'}
          </Text>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <LoadingButton variant="primary" loading={busy} disabled={!(name ?? data.dealname)} onClick={create}>
          {ko ? 'Order 만들기' : 'Create order'}
        </LoadingButton>
        <Button onClick={() => actions.closeOverlay(MODAL)}>{ko ? '취소' : 'Cancel'}</Button>
      </ModalFooter>
    </Modal>
  );

  return (
    <Flex direction="column" gap="medium">
      <StatusRow
        label={data.ready ? (ko ? '생성 가능' : 'Ready') : ko ? '확인 필요' : 'Check'}
        variant={data.ready ? 'info' : 'warning'}
        text={
          data.ready
            ? ko ? '이 영업기회로 Order 거래를 만듭니다.' : 'Creates an order deal from this opportunity.'
            : ko ? `주문 조건 ${done}/${total} 충족 · 필요한 조치 : 아래 항목을 완료하세요.` : `${done}/${total} order conditions met. Action required: complete the items below.`
        }
      />
      {err ? <Alert title={ko ? '오류' : 'Error'} variant="danger">{err}</Alert> : null}
      {data.ready ? (
        <Statistics>
          <StatisticsItem label={ko ? '주문 속성' : 'Properties'} number={String(data.props)} />
          <StatisticsItem label={ko ? '연결 레코드' : 'Associations'} number={String(data.assoc)} />
          <StatisticsItem label={ko ? '라인아이템' : 'Line items'} number={String(data.lines)} />
          <StatisticsItem label={ko ? '금액' : 'Amount'} number={data.amount} />
        </Statistics>
      ) : (
        <CheckList
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items={data.checks.map((c: any) => ({
            ...c,
            action:
              c.key === 'lines' || c.key === 'zero' ? (
                <Link href={{ url: editorUrl(portalId, dealId), external: true }}>{ko ? '라인아이템 편집' : 'Edit line items'}</Link>
              ) : c.key === 'buyer' || c.key === 'price' ? (
                <Text variant="microcopy">{ko ? 'Order Info 탭에서 입력' : 'Set in Order Info tab'}</Text>
              ) : undefined,
          }))}
        />
      )}
      <Flex direction="row" gap="small" align="center" wrap="wrap">
        <Button variant="primary" disabled={!data.ready} overlay={modal}>
          {ko ? 'Order 만들기' : 'Create order'}
        </Button>
        <Text variant="microcopy">{joinVals(data.stage && `${ko ? '현재 단계' : 'Stage'} : ${data.stage}`, data.owner && `Owner : ${data.owner}`)}</Text>
      </Flex>
      {footer}
    </Flex>
  );
};
