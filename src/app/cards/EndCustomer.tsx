import { useState } from 'react';
import {
  Alert,
  Button,
  Divider,
  Flex,
  Icon,
  Link,
  LoadingSpinner,
  Modal,
  ModalBody,
  ModalFooter,
  Tag,
  Text,
  hubspot,
} from '@hubspot/ui-extensions';
import {
  CompanySummary,
  ContactSummary,
  Editor,
  PORTAL,
  RecordLinks,
  T,
  callEC,
  ecVersion,
  getLang,
  objUrl,
  useEC,
} from './EndCustomerShared.tsx';

// End Customer(최종 고객사) — 가운데 컬럼 카드
// 연결이 없으면 선택 화면, 있으면 요약 화면([변경] · [+ 담당자 추가]로 선택 화면 열기)
hubspot.extend<'crm.record.tab'>(({ context, actions }) => (
  <EndCustomer context={context} actions={actions} />
));

const UNLINK_MODAL = 'ec-unlink-modal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EndCustomer = ({ context, actions }: { context: any; actions: any }) => {
  const lang = getLang(context);
  const t = T[lang];
  const dealId = String(context?.crm?.objectId ?? '');
  const portalId = context?.portal?.id ?? PORTAL;
  const { data, setData, error, load, notify } = useEC(dealId, lang, actions);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const header = (
    <Flex direction="column" gap="extra-small">
      <Text variant="microcopy">
        {t.desc} ({ecVersion()})
      </Text>
    </Flex>
  );
  const footer = (
    <Flex direction="row" justify="between" align="center">
      <Text variant="microcopy">Suprema Order - HelloDigital</Text>
      <Link href={{ url: objUrl(portalId, '0-3', dealId), external: false }} preventDefault onClick={load}>
        {t.refresh}
      </Link>
    </Flex>
  );
  if (error)
    return (
      <Alert title={t.error} variant="danger">
        {error}
      </Alert>
    );
  if (!data) return <LoadingSpinner label={t.loading} />;

  const empty = !data.company && !data.contacts.length;
  if (empty || editing)
    return (
      <Flex direction="column" gap="medium">
        {header}
        {empty && !editing ? (
          <Alert title={lang === 'ko' ? '권장 안내' : 'Recommended'} variant="tip">
            {lang === 'ko'
              ? '최종 고객사가 없습니다. 필요한 조치 : 최종 고객사를 선택하거나 새로 만드세요.'
              : 'There is no end customer. Action required: select or create the end customer.'}
          </Alert>
        ) : null}
        <Editor
          lang={lang}
          dealId={dealId}
          data={data}
          onSaved={(d) => {
            setData(d);
            setEditing(false);
            notify();
          }}
          onCancel={editing ? () => setEditing(false) : undefined}
        />
        <Divider />
        {footer}
      </Flex>
    );

  const unlink = async (kind: 'company' | 'contact', id: string) => {
    setBusy(`${kind}-${id}`);
    setErr('');
    try {
      setData(await callEC({ action: 'unlink', dealId, lang, kind, id }));
      notify();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy('');
    actions.closeOverlay(`${UNLINK_MODAL}-${id}`);
  };
  const unlinkModal = (kind: 'company' | 'contact', id: string, name: string) => (
    <Modal id={`${UNLINK_MODAL}-${id}`} title={t.unlink} width="sm">
      <ModalBody>
        <Text>
          {lang === 'ko'
            ? `${name}의 End Customer 연결을 해제합니다. 레코드는 삭제되지 않고 이 거래와의 다른 연결도 그대로 유지됩니다.`
            : `This removes the End Customer link for ${name}. The record is not deleted and its other links to this deal stay.`}
        </Text>
      </ModalBody>
      <ModalFooter>
        <Button onClick={() => actions.closeOverlay(`${UNLINK_MODAL}-${id}`)}>{t.cancel}</Button>
        <Button variant="destructive" disabled={!!busy} onClick={() => unlink(kind, id)}>
          {t.unlink}
        </Button>
      </ModalFooter>
    </Modal>
  );

  const co = data.company;
  return (
    <Flex direction="column" gap="medium">
      {header}
      {err ? (
        <Alert title={t.error} variant="danger">
          {err}
        </Alert>
      ) : null}
      {data.extraCompanies.length ? (
        <Alert title={lang === 'ko' ? '확인 필요' : 'Check'} variant="warning">
          {t.extra(data.extraCompanies.map((c) => c.name).join(', '))}
        </Alert>
      ) : null}

      {/* 회사 */}
      <Flex direction="row" gap="small" align="center">
        <Icon name={co ? 'success' : 'circleHollow'} size="sm" color={co ? 'success' : 'inherit'} />
        <Text format={{ fontWeight: 'bold' }}>{t.company}</Text>
        <Text variant="microcopy">[ {co ? co.name : t.notSet} ]</Text>
      </Flex>
      {co ? (
        <Flex direction="column" gap="small">
          <Flex direction="row" justify="between" align="center" wrap="wrap" gap="small">
            <Flex direction="row" gap="small" align="center">
              <Text format={{ fontWeight: 'bold' }}>{co.name}</Text>
              <Tag variant="success">End Customer</Tag>
            </Flex>
            <Flex direction="row" gap="extra-small" align="center">
              <RecordLinks lang={lang} portalId={portalId} type="0-2" id={co.id} />
              <Button size="xs" onClick={() => setEditing(true)}>
                {t.change}
              </Button>
            </Flex>
          </Flex>
          <CompanySummary lang={lang} c={co} />
        </Flex>
      ) : (
        <Flex direction="row" justify="between" align="center">
          <Text variant="microcopy">ⓘ {t.noCompanyLinked}</Text>
          <Button size="xs" onClick={() => setEditing(true)}>
            {t.select}
          </Button>
        </Flex>
      )}
      <Divider />

      {/* 담당자 */}
      <Flex direction="row" gap="small" align="center" justify="between">
        <Flex direction="row" gap="small" align="center">
          <Icon name={data.contacts.length ? 'success' : 'circleHollow'} size="sm" color={data.contacts.length ? 'success' : 'inherit'} />
          <Text format={{ fontWeight: 'bold' }}>{t.contact}</Text>
          <Text variant="microcopy">
            [ {data.contacts.length ? `${data.contacts[0].name}${data.contacts.length > 1 ? (lang === 'ko' ? ` 외 ${data.contacts.length - 1}명` : ` +${data.contacts.length - 1}`) : ''}` : t.notSet} ]
          </Text>
        </Flex>
        <Button size="xs" onClick={() => setEditing(true)}>
          {t.addContact}
        </Button>
      </Flex>
      {data.contacts.length ? (
        data.contacts.map((c) => (
          <Flex key={c.id} direction="column" gap="small">
            <Flex direction="row" justify="between" align="center" wrap="wrap" gap="small">
              <Flex direction="row" gap="small" align="center">
                <Text format={{ fontWeight: 'bold' }}>{c.name}</Text>
                <Tag variant="success">End Customer</Tag>
              </Flex>
              <Flex direction="row" gap="extra-small" align="center">
                <RecordLinks lang={lang} portalId={portalId} type="0-1" id={c.id} />
                <Button size="xs" overlay={unlinkModal('contact', c.id, c.name)}>
                  {t.unlink}
                </Button>
              </Flex>
            </Flex>
            <ContactSummary lang={lang} c={c} />
          </Flex>
        ))
      ) : (
        <Text variant="microcopy">ⓘ {t.noContactLinked}</Text>
      )}
      <Divider />
      {footer}
    </Flex>
  );
};
