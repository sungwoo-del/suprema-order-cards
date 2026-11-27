import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Flex,
  Link,
  LoadingSpinner,
  Modal,
  ModalBody,
  ModalFooter,
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
import {
  Editor,
  PORTAL,
  T,
  callEC,
  ecVersion,
  getLang,
  objUrl,
  useEC,
  webUrl,
} from './EndCustomerShared.tsx';
import {
  FooterLine,
  SectionHead,
  StatusRow,
  joinVals,
  toast,
} from './UiKit.tsx';

// End Customer(최종 고객사) — 가운데 컬럼 카드 (Ver.04 개편 · docs/05_UI_UX_지침.md)
// 상태 줄 → 회사 타일 → 담당자 표 → 하단 1줄. 편집은 같은 카드 안에서 한 화면.
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
  const [changeCompany, setChangeCompany] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const footer = (
    <FooterLine
      version={ecVersion()}
      refreshLabel={t.refresh}
      onRefresh={load}
      href={objUrl(portalId, '0-3', dealId)}
    />
  );
  if (error)
    return (
      <Alert title={t.error} variant="danger">
        {error}
      </Alert>
    );
  if (!data) return <LoadingSpinner label={t.loading} />;

  const co = data.company;
  const n = data.contacts.length;
  const empty = !co && !n;
  const status = (
    <StatusRow
      label={empty ? t.notLinked : t.linked}
      variant={empty ? 'warning' : 'success'}
      text={empty ? t.emptyLine : t.counts(co ? 1 : 0, n)}
      action={
        !empty && !editing ? (
          <Button size="xs" onClick={() => setEditing(true)}>
            {t.edit}
          </Button>
        ) : undefined
      }
    />
  );

  if (empty || editing)
    return (
      <Flex direction="column" gap="medium">
        {status}
        <Editor
          lang={lang}
          dealId={dealId}
          data={data}
          onSaved={(d) => {
            setData(d);
            setEditing(false);
            setChangeCompany(false);
            notify();
            toast(
              actions,
              lang === 'ko'
                ? '최종 고객사를 저장했습니다.'
                : 'The end customer was saved.',
            );
          }}
          openSearch={changeCompany}
          onCancel={
            editing
              ? () => {
                  setEditing(false);
                  setChangeCompany(false);
                }
              : undefined
          }
        />
        {footer}
      </Flex>
    );

  const unlink = async (kind: 'company' | 'contact', id: string) => {
    setBusy(`${kind}-${id}`);
    setErr('');
    try {
      setData(await callEC({ action: 'unlink', dealId, lang, kind, id }));
      notify();
      toast(
        actions,
        lang === 'ko' ? '연결을 해제했습니다.' : 'The link was removed.',
      );
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy('');
    actions.closeOverlay(`${UNLINK_MODAL}-${id}`);
  };
  const unlinkModal = (
    kind: 'company' | 'contact',
    id: string,
    name: string,
  ) => (
    <Modal id={`${UNLINK_MODAL}-${id}`} title={t.unlink} width="sm">
      <ModalBody>
        <Text>
          {lang === 'ko'
            ? `${name}과(와) 이 거래의 연결을 해제합니다. 레코드는 삭제되지 않습니다.`
            : `This removes the association between ${name} and this deal. The record is not deleted.`}
        </Text>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="destructive"
          disabled={!!busy}
          onClick={() => unlink(kind, id)}
        >
          {t.unlink}
        </Button>
        <Button onClick={() => actions.closeOverlay(`${UNLINK_MODAL}-${id}`)}>
          {t.cancel}
        </Button>
      </ModalFooter>
    </Modal>
  );
  const newTab = (type: string, id: string) => (
    <Link href={{ url: objUrl(portalId, type, id), external: true }}>
      {t.newTab}
    </Link>
  );

  return (
    <Flex direction="column" gap="medium">
      {status}
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

      {/* 회사 — 기본 연결 카드와 같은 타일 (라벨과 붙여서) */}
      <Flex direction="column" gap="extra-small">
        <SectionHead title={lang === 'ko' ? '회사' : 'Company'} />
        {co ? (
          <Tile compact>
            <Flex direction="row" align="start" gap="small">
              <Box flex={1}>
                <Flex direction="column" gap="extra-small">
                  <Flex direction="row" gap="small" align="center">
                    <CrmActionLink
                      actionType="PREVIEW_OBJECT"
                      actionContext={{
                        objectTypeId: '0-2',
                        objectId: Number(co.id),
                      }}
                    >
                      {co.name}
                    </CrmActionLink>
                    {newTab('0-2', co.id)}
                  </Flex>
                  <Text variant="microcopy">
                    {joinVals(co.country, co.industry, co.lifecycle, co.team)}
                  </Text>
                  {co.website ? (
                    <Link href={{ url: webUrl(co.website), external: true }}>
                      {co.website}
                    </Link>
                  ) : null}
                </Flex>
              </Box>
              <Box flex="none">
                <Flex direction="row" gap="extra-small" align="center">
                  <Button
                    size="xs"
                    onClick={() => {
                      setChangeCompany(true);
                      setEditing(true);
                    }}
                  >
                    {t.changeCompany}
                  </Button>
                  <Button
                    size="xs"
                    overlay={unlinkModal('company', co.id, co.name)}
                  >
                    {t.unlink}
                  </Button>
                </Flex>
              </Box>
            </Flex>
          </Tile>
        ) : (
          <Text variant="microcopy">ⓘ {t.noCompanyLinked}</Text>
        )}
      </Flex>

      {/* 담당자 — 표 (행 동작 : 오른쪽 텍스트 링크 [해제]) */}
      <Flex direction="column" gap="extra-small">
        <SectionHead
          title={`${lang === 'ko' ? '담당자' : 'Contacts'} (${n})`}
          action={
            <Button size="xs" onClick={() => setEditing(true)}>
              {t.addContact}
            </Button>
          }
        />
        {n ? (
          <Table bordered density="condensed">
            <TableHead>
              <TableRow>
                <TableHeader>{t.lName}</TableHeader>
                <TableHeader>{t.lEmail}</TableHeader>
                <TableHeader>{t.lJob}</TableHeader>
                <TableHeader>{t.lFunction}</TableHeader>
                <TableHeader>{t.lPhone}</TableHeader>
                <TableHeader> </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Flex direction="row" gap="extra-small" align="center">
                      <CrmActionLink
                        actionType="PREVIEW_OBJECT"
                        actionContext={{
                          objectTypeId: '0-1',
                          objectId: Number(c.id),
                        }}
                      >
                        {c.name}
                      </CrmActionLink>
                      {newTab('0-1', c.id)}
                    </Flex>
                  </TableCell>
                  <TableCell>
                    {c.email && c.email !== c.name ? c.email : '--'}
                  </TableCell>
                  <TableCell>{c.jobtitle || '--'}</TableCell>
                  <TableCell>{c.jobfunction || '--'}</TableCell>
                  <TableCell>{c.phone || '--'}</TableCell>
                  <TableCell align="right">
                    <Link
                      href={{
                        url: objUrl(portalId, '0-1', c.id),
                        external: false,
                      }}
                      preventDefault
                      overlay={unlinkModal('contact', c.id, c.name)}
                    >
                      {lang === 'ko' ? '해제' : 'Unlink'}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Text variant="microcopy">ⓘ {t.noContactLinked}</Text>
        )}
      </Flex>
      {footer}
    </Flex>
  );
};
