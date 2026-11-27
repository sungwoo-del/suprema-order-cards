import React from 'react';
import { Alert, Flex, Icon, Link, Text, hubspot } from '@hubspot/ui-extensions';

// 오른쪽 컬럼 카드 4종 공용 — 버전 표기 · 서버 호출 · 공통 문구
// deploy.sh가 배포할 때 SIDEBAR_VERSION / SIDEBAR_UPDATED 를 자동으로 올립니다.
export const SIDEBAR_VERSION = '14';
export const SIDEBAR_UPDATED = '2026-11-27';
// 정식 오픈 전까지 Beta 표기 — 정식 버전이 되면 '' 로 바꾸면 표기가 사라짐
export const SIDEBAR_STAGE = 'Beta';
export const PORTAL = 245822501;

export type Lang = 'en' | 'ko';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getLang = (context: any): Lang =>
  String(context?.user?.locale || context?.user?.language || 'en')
    .toLowerCase()
    .startsWith('ko')
    ? 'ko'
    : 'en';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const callSidebar = async (parameters: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await hubspot.serverless('sidebar_cards', { parameters });
  if (!res) throw new Error('Serverless function error');
  if (res.ok === false)
    throw new Error(res.error || 'Serverless function error');
  return res;
};

export const recordUrl = (portalId: number | string, dealId: string) =>
  `https://app-na2.hubspot.com/contacts/${portalId}/record/0-3/${dealId}`;
export const editorUrl = (portalId: number | string, dealId: string) =>
  `https://app-na2.hubspot.com/line-items/${portalId}/deal/${dealId}`;

export const money = (v: number | string, cur: string) => {
  const n = Number(v || 0);
  return `${cur ? cur + ' ' : ''}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

export const COMMON = {
  en: {
    loading: 'Loading...',
    error: 'Error',
    refresh: 'Refresh',
    notSet: 'Not set',
    version: () =>
      `V.${SIDEBAR_VERSION}${SIDEBAR_STAGE ? ' ' + SIDEBAR_STAGE.charAt(0) : ''}`,
  },
  ko: {
    loading: '불러오는 중입니다...',
    error: '오류',
    refresh: '새로고침',
    notSet: '미선택',
    version: () =>
      `V.${SIDEBAR_VERSION}${SIDEBAR_STAGE ? ' ' + SIDEBAR_STAGE.charAt(0) : ''}`,
  },
};

// 카드 하단 — 버전 표기 + 새로고침 링크
export const CardFooter = ({
  lang,
  onRefresh,
  href,
}: {
  lang: Lang;
  onRefresh: () => void;
  href: string;
}) => (
  <Flex direction="row" justify="end" align="center" gap="small">
    <Link
      href={{ url: href, external: false }}
      preventDefault
      onClick={onRefresh}
    >
      <Icon name="refresh" screenReaderText={COMMON[lang].refresh} />
    </Link>
  </Flex>
);

export const ErrorNote = ({
  lang,
  message,
}: {
  lang: Lang;
  message: string;
}) => (
  <Alert title={COMMON[lang].error} variant="danger">
    <Text variant="microcopy">{message}</Text>
  </Alert>
);
