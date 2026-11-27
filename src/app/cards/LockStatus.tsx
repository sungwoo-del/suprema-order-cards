import React from 'react';
import { Alert, Flex, Link, Text } from '@hubspot/ui-extensions';

// 라인 아이템 등록 이후 두 카드(Buyer Picker · Order Route Info)가 함께 쓰는 잠금 안내
export type Lang = 'en' | 'ko';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getLang = (context: any): Lang =>
  String(context?.user?.locale || context?.user?.language || 'en')
    .toLowerCase()
    .startsWith('ko')
    ? 'ko'
    : 'en';

const TEXT = {
  en: {
    status: 'Status: Locked',
    detail: (n: number) =>
      `[${n} line item${n === 1 ? '' : 's'} added / Order route confirmed / Price book confirmed]`,
    reset: 'Reset line items',
    hint: 'Action required: delete all line items in the editor.',
  },
  ko: {
    status: '상태 : 변경 불가',
    detail: (n: number) => `[등록한 라인아이템 ${n}개 / 거래경로 확정 / 가격표 확정]`,
    reset: '라인아이템 초기화',
    hint: '필요한 조치 : 편집기에서 라인아이템을 모두 삭제하세요.',
  },
};

// Suprema 계정은 na2 데이터센터
const editorUrl = (portalId: string | number, dealId: string) =>
  `https://app-na2.hubspot.com/line-items/${portalId}/deal/${dealId}`;

export const LockStatus = ({
  lang,
  count,
  portalId,
  dealId,
}: {
  lang: Lang;
  count: number;
  portalId: string | number;
  dealId: string;
}) => {
  const t = TEXT[lang];
  return (
    <Alert title={t.status} variant="warning">
      <Flex direction="column" gap="extra-small">
        <Text>{t.detail(count)}</Text>
        <Text>
          <Link href={{ url: editorUrl(portalId, dealId), external: false }}>{t.reset}</Link>
        </Text>
        <Text variant="microcopy">{t.hint}</Text>
      </Flex>
    </Alert>
  );
};
