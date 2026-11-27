import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  DescriptionList,
  DescriptionListItem,
  Divider,
  Flex,
  LoadingSpinner,
  MultiSelect,
  Select,
  Tag,
  Text,
  hubspot,
} from '@hubspot/ui-extensions';
import { LockStatus, getLang } from './LockStatus.tsx';

type Opt = { label: string; value: string };
type Field = { name: string; label: string; fieldType: string; options: Opt[] };

const FIELDS = ['order_route', 'selling_entity', 'buyer_type', 'revenue_type', 'erp_target'];

// UI 언어별 문구 (기본 영어, 한국어 UI면 한국어)
const MSG = {
  en: {
    loading: 'Loading order route info...',
    error: 'Error',
    editable: 'Editable',
    readOnly: 'Read-only',
    editableWhy: (teams: string) => `You can edit as a member of an allowed team (${teams}).`,
    readOnlyWhy: 'Only teams allowed in the app settings can edit.',
    noRule: 'No editing team has been set yet. Choose teams in the app settings.',
    lockedTitle: 'Locked: line items are attached',
    lockedBody: (n: number) =>
      `This deal has ${n} line item${n === 1 ? '' : 's'}, so the order route can’t be changed. To change it, delete the line items, update the order route, and then add the line items again.`,
    lineItems: 'Line items',
    pricebook: 'Applied PriceBook',
    save: 'Save',
    saving: 'Saving...',
    revert: 'Revert',
    saved: 'Order route info saved.',
    summaryTitle: 'Order Route Summary',
    summaryPending: 'The order route summary is being generated. Refresh in a moment.',
  },
  ko: {
    loading: '주문 경로 정보를 불러오는 중...',
    error: '오류',
    editable: '수정 가능',
    readOnly: '읽기 전용',
    editableWhy: (teams: string) => `허용 팀(${teams}) 소속으로 수정할 수 있습니다.`,
    readOnlyWhy: '수정 권한이 없습니다. 필요한 조치 : 앱 설정에서 허용된 팀에 포함되어야 합니다.',
    noRule: '수정 허용 팀이 없습니다. 필요한 조치 : 앱 설정에서 팀을 지정하세요.',
    lockedTitle: '잠김: 라인 아이템이 연결된 거래',
    lockedBody: (n: number) =>
      `라인아이템 ${n}개가 등록되어 변경 불가합니다. 필요한 조치 : 라인아이템을 초기화하세요.`,
    lineItems: '라인 아이템',
    pricebook: '적용된 PriceBook',
    save: '저장',
    saving: '저장 중...',
    revert: '되돌리기',
    saved: '주문 경로 정보를 저장했습니다.',
    summaryTitle: '주문 경로 요약',
    summaryPending: '주문 경로 요약을 생성 중입니다. 필요한 조치 : 잠시 후 새로고침하세요.',
  },
};

hubspot.extend<'crm.record.tab'>(({ context, actions }) => (
  <RouteInfo context={context} actions={actions} />
));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = async (parameters: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await hubspot.serverless('route_editor', { parameters });
  if (!res || res.ok === false) throw new Error(res?.error || 'Serverless function error');
  return res;
};

const isMulti = (f: Field) => f.fieldType === 'checkbox';
const pairs = <T,>(arr: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
};
const split = (v: string) => (v ? v.split(';').filter(Boolean) : []);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RouteInfo = ({ context, actions }: any) => {
  const lang = getLang(context);
  const t = MSG[lang];
  const dealId = String(context?.crm?.objectId ?? '');
  const [fields, setFields] = useState<Field[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [hasRule, setHasRule] = useState(true);
  const [myTeams, setMyTeams] = useState<string[]>([]);
  const [lineItemCount, setLineItemCount] = useState(0);
  const [pricebook, setPricebook] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await call({ action: 'load', dealId, lang });
      setFields(res.fields || []);
      setSaved(res.values || {});
      setDraft(res.values || {});
      setCanEdit(!!res.canEdit);
      setHasRule(!!res.hasRule);
      setMyTeams(res.myTeams || []);
      setLineItemCount(Number(res.lineItemCount || 0));
      setPricebook(res.pricebookLabel || '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    load();
  }, [load]);

  // 워크플로·라인 아이템 변경 시 다시 불러오기
  useEffect(() => {
    actions.onCrmPropertiesUpdate(
      [...FIELDS, 'order_route_summary', 'pricebook_select', 'hs_num_of_associated_line_items'],
      () => {
        load();
      },
    );
  }, [actions, load]);

  const label = (f: Field, v: string) => {
    const vals = isMulti(f) ? split(v) : v ? [v] : [];
    if (!vals.length) return '-';
    return vals.map((x) => f.options.find((o) => o.value === x)?.label || x).join(' + ');
  };

  const locked = lineItemCount > 0;
  const editable = canEdit && !locked;
  const dirty = FIELDS.some((n) => (draft[n] || '') !== (saved[n] || ''));

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      const values: Record<string, string> = {};
      for (const n of FIELDS) if ((draft[n] || '') !== (saved[n] || '')) values[n] = draft[n] || '';
      await call({ action: 'save', dealId, values, lang });
      actions.addAlert({ type: 'success', message: t.saved });
      actions.refreshObjectProperties();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner label={t.loading} />;

  return (
    <Flex direction="column" gap="small">
      {error && (
        <Alert title={t.error} variant="danger">
          {error}
        </Alert>
      )}

      {locked ? (
        <LockStatus lang={lang} count={lineItemCount} portalId={context?.portal?.id ?? 245822501} dealId={dealId} />
      ) : (
        <Flex direction="row" gap="extra-small" align="center">
          {canEdit ? <Tag variant="success">{t.editable}</Tag> : <Tag variant="default">{t.readOnly}</Tag>}
          <Text variant="microcopy">
            {canEdit ? t.editableWhy(myTeams.join(', ')) : hasRule ? t.readOnlyWhy : t.noRule}
          </Text>
        </Flex>
      )}

      {locked ? (
        <Flex direction="column" gap="extra-small">
          <Text format={{ fontWeight: 'bold' }}>{t.summaryTitle}</Text>
          {saved.order_route_summary ? (
            saved.order_route_summary
              .split('\n')
              .map((line, i) => <Text key={i}>{line.trim() ? line : ' '}</Text>)
          ) : (
            <Text variant="microcopy">{t.summaryPending}</Text>
          )}
        </Flex>
      ) : !editable ? (
        <DescriptionList direction="row">
          {fields.map((f) => (
            <DescriptionListItem key={f.name} label={f.label}>
              <Text>{label(f, saved[f.name] || '')}</Text>
            </DescriptionListItem>
          ))}
        </DescriptionList>
      ) : (
        <>
          {pairs(fields).map((row) => (
            <Flex key={row.map((f) => f.name).join('-')} direction="row" gap="medium">
              {row.map((f) => (
                <Box key={f.name} flex={1}>
                  {isMulti(f) ? (
                    <MultiSelect
                      label={f.label}
                      options={f.options}
                      value={split(draft[f.name] || '')}
                      onChange={(v) => setDraft({ ...draft, [f.name]: (v as string[]).join(';') })}
                    />
                  ) : (
                    <Select
                      label={f.label}
                      options={f.options}
                      value={draft[f.name] || ''}
                      onChange={(v) => setDraft({ ...draft, [f.name]: String(v) })}
                    />
                  )}
                </Box>
              ))}
              {row.length === 1 && (
                <Box flex={1}>
                  <Text> </Text>
                </Box>
              )}
            </Flex>
          ))}
          <Divider />
          <Flex direction="row" gap="small">
            <Button variant="primary" onClick={onSave} disabled={!dirty || saving}>
              {saving ? t.saving : t.save}
            </Button>
            <Button variant="secondary" onClick={() => setDraft(saved)} disabled={!dirty || saving}>
              {t.revert}
            </Button>
          </Flex>
        </>
      )}
    </Flex>
  );
};
