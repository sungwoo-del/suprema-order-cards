import React, { useState } from 'react';
import {
  Alert,
  AutoGrid,
  Box,
  Button,
  Flex,
  Icon,
  Image,
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
  Tag,
  Text,
  Tile,
  hubspot,
} from '@hubspot/ui-extensions';

import {
  Editor,
  PORTAL,
  T,
  callEC,
  getLang,
  objUrl,
  useEC,
  webUrl,
} from './EndCustomerShared.tsx';
import { CrmActionLink } from '@hubspot/ui-extensions/crm';
import {
  SectionHead,
  StatusRow,
  joinVals,
  toast,
  IconText,
  RefreshLink,
} from './UiKit.tsx';

// End Customer(최종 고객사) — 가운데 컬럼 카드 (Ver.04 개편 · docs/05_UI_UX_지침.md)
// 상태 줄 → 회사 타일 → 담당자 표 → 하단 1줄. 편집은 같은 카드 안에서 한 화면.
hubspot.extend<'crm.record.tab'>(({ context, actions }) => (
  <EndCustomer context={context} actions={actions} />
));

// 이름 머리글자 (로고 · 사진이 없을 때)
const initials = (v?: string) => {
  const w = String(v || '?')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return ((w[0]?.[0] || '?') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase();
};

// 회사 · 담당자 공통 칸 : 왼쪽 이미지 · 이름(클릭 = 미리보기 패널) · 옆 아이콘(새 탭 CRM) · 정보 줄 · 아래 동작 버튼
const RecordTile = ({
  typeId,
  id,
  name,
  portalId,
  avatar,
  lines,
  extra,
  actions,
}: {
  typeId: string;
  id: string;
  name: string;
  portalId: number | string;
  avatar: React.ReactNode;
  lines: string[];
  extra?: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <Tile compact>
    <Flex direction="column" gap="small">
      <Flex direction="row" align="start" gap="small">
        <Box flex="none">{avatar}</Box>
        <Box flex={1}>
          <Flex direction="column" gap="extra-small">
            <Flex direction="row" gap="extra-small" align="center">
              <CrmActionLink
                actionType="PREVIEW_OBJECT"
                actionContext={{ objectTypeId: typeId, objectId: Number(id) }}
              >
                {name}
              </CrmActionLink>
              <Link
                href={{ url: objUrl(portalId, typeId, id), external: true }}
              >
                {'\u00a0'}
              </Link>
            </Flex>
            {lines.map((l, i) => (
              <Text key={i} variant="microcopy">
                {l}
              </Text>
            ))}
            {extra}
          </Flex>
        </Box>
      </Flex>
      {actions ? (
        <Flex direction="row" justify="end" gap="extra-small">
          {actions}
        </Flex>
      ) : null}
    </Flex>
  </Tile>
);

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

  const rf = <RefreshLink label={t.refresh} href={objUrl(portalId, '0-3', dealId)} onRefresh={load} />;
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
    <StatusRow refresh={rf}
      label={empty ? t.notLinked : t.linked}
      variant={empty ? 'warning' : 'success'}
      text={empty ? t.emptyLine : t.counts(co ? 1 : 0, n)}
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
        <SectionHead
          title={lang === 'ko' ? '회사' : 'Company'}
          action={
            co ? undefined : (
              <Button
                size="xs"
                onClick={() => {
                  setChangeCompany(true);
                  setEditing(true);
                }}
              >
                <Icon
                  name="add"
                  screenReaderText={
                    co
                      ? t.changeCompany
                      : lang === 'ko'
                        ? '회사 추가'
                        : 'Add company'
                  }
                />
              </Button>
            )
          }
        />
        {co ? (
          <RecordTile
            typeId="0-2"
            id={co.id}
            name={co.name}
            portalId={portalId}
            avatar={
              co.logo ? (
                <Image src={co.logo} alt={co.name} width={40} height={40} />
              ) : (
                <Tag variant="default">{initials(co.name)}</Tag>
              )
            }
            lines={[
              joinVals(co.country, co.industry, co.lifecycle, co.team) || '--',
            ]}
            extra={
              co.website ? (
                <Link href={{ url: webUrl(co.website), external: true }}>
                  {co.website}
                </Link>
              ) : null
            }
            actions={
              <>
                <Button
                  variant="transparent"
                  size="xs"
                  onClick={() => {
                    setChangeCompany(true);
                    setEditing(true);
                  }}
                >
                  <IconText name="replace">{t.changeCompany}</IconText>
                </Button>
                <Button
                  variant="transparent"
                  size="xs"
                  overlay={unlinkModal('company', co.id, co.name)}
                >
                  <IconText name="remove">{t.unlinkBtn}</IconText>
                </Button>
              </>
            }
          />
        ) : (
          <Text variant="microcopy">ⓘ {t.noCompanyLinked}</Text>
        )}
      </Flex>

      {/* 담당자 — 회사와 같은 테두리 칸 · 이름 클릭 시 새 탭으로 레코드 */}
      <Flex direction="column" gap="extra-small">
        <SectionHead
          title={`${lang === 'ko' ? '담당자' : 'Contacts'} (${n})`}
          action={
            <Button size="xs" onClick={() => setEditing(true)}>
              <Icon name="add" screenReaderText={t.addContact} />
            </Button>
          }
        />
        {n ? (
          // HubSpot 기본 연결 목록 (End Customer 라벨만) — 해제는 [편집]에서
          // 담당자별 테두리 칸 · 최대 3열 (카드 폭에 따라 1~3열 자동)
          <AutoGrid columnWidth={280} flexible gap="small">
            {data.contacts.map((c) => (
              <RecordTile
                key={c.id}
                typeId="0-1"
                id={c.id}
                name={c.name || t.noName}
                portalId={portalId}
                avatar={
                  <Tag variant="default">{initials(c.name || c.email)}</Tag>
                }
                lines={[
                  `${lang === 'ko' ? '직급' : 'Title'} : ${c.jobtitle || '--'} · ${lang === 'ko' ? '직무' : 'Function'} : ${c.jobfunction || '--'}`,
                  `${lang === 'ko' ? '전화' : 'Phone'} : ${c.phone || '--'}`,
                  `${lang === 'ko' ? '이메일' : 'Email'} : ${c.email || '--'}`,
                ]}
                actions={
                  <Button
                    variant="transparent"
                    size="xs"
                    overlay={unlinkModal(
                      'contact',
                      c.id,
                      c.name || c.email || t.noName,
                    )}
                  >
                    <IconText name="remove">{t.unlinkBtn}</IconText>
                  </Button>
                }
              />
            ))}
          </AutoGrid>
        ) : (
          <Text variant="microcopy">ⓘ {t.noContactLinked}</Text>
        )}
      </Flex>
    </Flex>
  );
};
