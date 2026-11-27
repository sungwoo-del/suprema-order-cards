import React from 'react';
import { Divider, Flex, Link, Tag, Text } from '@hubspot/ui-extensions';

// 앱카드 공통 UI — docs/05_UI_UX_지침.md (G1 구조 · G4 상태)
// 맨 위 상태 줄 : 상태 태그 1개 + 한 줄 설명 + (오른쪽) 머리글 동작
// 맨 아래 한 줄 : 버전 · 새로고침

export type TagVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export const StatusRow = ({
  label,
  variant = 'default',
  text,
  action,
}: {
  label: string;
  variant?: TagVariant;
  text?: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <Flex direction="row" justify="between" align="center" gap="small" wrap="wrap">
    <Flex direction="row" gap="small" align="center" wrap="wrap">
      <Tag variant={variant}>{label}</Tag>
      {text ? <Text variant="microcopy">{text}</Text> : null}
    </Flex>
    {action || null}
  </Flex>
);

export const FooterLine = ({
  version,
  refreshLabel,
  onRefresh,
  href,
}: {
  version: string;
  refreshLabel: string;
  onRefresh: () => void;
  href: string;
}) => (
  <>
    <Divider />
    <Flex direction="row" justify="between" align="center">
      <Text variant="microcopy">{version}</Text>
      <Link href={{ url: href, external: false }} preventDefault onClick={onRefresh}>
        {refreshLabel}
      </Link>
    </Flex>
  </>
);

// 소제목 + (오른쪽) 동작
export const SectionHead = ({ title, action }: { title: string; action?: React.ReactNode }) => (
  <Flex direction="row" justify="between" align="center">
    <Text format={{ fontWeight: 'demibold' }}>{title}</Text>
    {action || null}
  </Flex>
);

// 값 있는 것만 " · "로 이음 (G2 빈 값 숨김)
export const joinVals = (...v: (string | undefined | null | false)[]) =>
  v.filter((x) => x && String(x).trim()).join(' · ');
