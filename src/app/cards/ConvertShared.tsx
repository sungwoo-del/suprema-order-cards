import { useCallback, useEffect, useState } from 'react';
import { hubspot } from '@hubspot/ui-extensions';

// Lead → Opportunity 전환 카드 공용 (가운데 컬럼 · 사이드바)
// deploy.sh가 배포할 때 CV_VERSION / CV_UPDATED 를 자동으로 올립니다.
export const CV_VERSION = '03';
export const CV_UPDATED = '2026-11-27';
export const CV_STAGE = 'Beta';
export const PORTAL = 245822501;
export const cvVersion = () =>
  `Update : ${CV_UPDATED} / Ver.${CV_VERSION}${CV_STAGE ? ' ' + CV_STAGE : ''}`;

export type Lang = 'en' | 'ko';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getLang = (context: any): Lang =>
  String(context?.user?.locale || context?.user?.language || 'en')
    .toLowerCase()
    .startsWith('ko')
    ? 'ko'
    : 'en';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const callCV = async (parameters: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await hubspot.serverless('convert_opp', { parameters });
  if (!res) throw new Error('Serverless function error');
  if (res.ok === false) throw new Error(res.error || 'Serverless function error');
  return res;
};
export const objUrl = (portalId: number | string, type: string, id: string) =>
  `https://app-na2.hubspot.com/contacts/${portalId}/record/${type}/${id}`;

export const T = {
  en: {
    title: 'Convert to Opportunity',
    desc: 'When the lead reaches the conversion stage, creates an opportunity deal with the lead information.',
    loading: 'Loading...',
    error: 'Error',
    refresh: 'Refresh',
    notSource: 'This card can be used only for deals in the lead pipeline.',
    notStage: (s: string) => `The deal is not in the ${s} stage. Action required: move it to ${s} to show the create button.`,
    ready: 'There is no opportunity yet. Action required: click "Create opportunity".',
    noOwner: 'There is no deal owner. Action required: set the owner and refresh.',
    props: '① Properties to copy',
    propsSub: 'Lead value → new opportunity',
    assoc: '② Associations to copy',
    assocSub: 'Same labels · Lead-only labels are changed to Opportunity labels',
    acts: '③ Activities',
    actsSub: 'All time',
    actsText: (n: number) => `${n} emails, calls, meetings, notes and tasks linked to this lead are also linked to the new opportunity (shared, not duplicated).`,
    lines: (n: number) => `Line items : ${n} (copied as new line items)`,
    create: 'Create opportunity',
    creating: 'Creating...',
    confirmTitle: 'Create opportunity',
    dealname: 'Deal name *',
    closedate: 'Close date',
    stage: 'Pipeline · stage',
    confirmText: 'After it is created, it cannot be created again from this card.',
    cancel: 'Cancel',
    done: (n: string) => `The opportunity was created: ${n}.`,
    already: 'An opportunity was already created from this lead.',
    preview: 'Preview',
    newTab: 'New tab ↗',
    result: 'Copy result',
    rProps: 'Properties',
    rAssoc: 'Associations',
    rLines: 'Line items',
    rActs: 'Activities',
    failed: (n: number) => `${n} failed`,
    relink: 'Link again',
    partial: 'Some associations or activities failed. Action required: click "Link again".',
    empty: '—',
    value: 'Lead value',
    type: { companies: 'Company', contacts: 'Contact', '2-267605328': 'Partner', '2-268293662': 'Partner Company' } as Record<string, string>,
    noAssoc: 'There are no associations to copy.',
  },
  ko: {
    title: 'Convert to Opportunity (영업기회 전환)',
    desc: 'Lead가 전환 단계가 되면 Lead 정보로 Opportunity 거래를 만듭니다.',
    loading: '불러오는 중입니다...',
    error: '오류',
    refresh: '새로고침',
    notSource: '이 카드는 Lead 파이프라인 거래에서만 사용할 수 있습니다.',
    notStage: (s: string) => `${s} 단계가 아닙니다. 필요한 조치 : 단계를 ${s}로 옮기면 Opportunity 생성 버튼이 나타납니다.`,
    ready: 'Opportunity가 아직 없습니다. 필요한 조치 : [Opportunity 생성]을 누르세요.',
    noOwner: 'Deal owner가 없습니다. 필요한 조치 : Owner를 지정한 뒤 새로고침하세요.',
    props: '① 복사할 속성',
    propsSub: 'Lead 값 → 새 Opportunity',
    assoc: '② 연결 복사',
    assocSub: '같은 라벨로 연결 · Lead 전용 라벨은 Opportunity 라벨로 변환',
    acts: '③ 활동 기록 공유',
    actsSub: '전체 기간',
    actsText: (n: number) => `이 Lead에 연결된 이메일 · 통화 · 미팅 · 노트 · 작업 ${n}건을 새 Opportunity에도 연결합니다(복제가 아니라 같은 기록을 함께 봄).`,
    lines: (n: number) => `라인아이템 : ${n}개 (새 라인아이템으로 복사)`,
    create: 'Opportunity 생성',
    creating: '생성 중입니다...',
    confirmTitle: 'Opportunity 생성',
    dealname: 'Deal name (거래명) *',
    closedate: 'Close date (마감일)',
    stage: '파이프라인 · 단계',
    confirmText: '만든 뒤에는 이 카드에서 다시 만들 수 없습니다(중복 방지).',
    cancel: '취소',
    done: (n: string) => `Opportunity를 만들었습니다 : ${n}.`,
    already: '이 Lead에서 만든 Opportunity가 있습니다.',
    preview: '미리보기',
    newTab: '새 탭 ↗',
    result: '복사 결과',
    rProps: '속성',
    rAssoc: '연결',
    rLines: '라인아이템',
    rActs: '활동 기록',
    failed: (n: number) => `${n}건 실패`,
    relink: '활동 다시 연결',
    partial: '일부 연결 · 활동 기록 연결이 실패했습니다. 필요한 조치 : [활동 다시 연결]을 누르세요.',
    empty: '—',
    value: 'Lead 값',
    type: { companies: '회사', contacts: '담당자', '2-267605328': 'Partner', '2-268293662': 'Partner Company' } as Record<string, string>,
    noAssoc: '복사할 연결이 없습니다.',
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useCV = (dealId: string, lang: Lang, actions: any, light = false) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setData(await callCV({ action: 'load', dealId, lang, light }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [dealId, lang, light]);
  useEffect(() => {
    load();
  }, [load]);
  // 단계 · 파이프라인 · 소유자가 바뀌면 바로 다시 읽음 → Converted가 되는 순간 버튼 표시
  useEffect(() => {
    actions.onCrmPropertiesUpdate(['dealstage', 'pipeline', 'hubspot_owner_id', 'dealname', 'closedate', 'hd_card_sync'], () => load());
  }, [actions, load]);
  return { data, setData, error, load };
};
