import React from 'react';
import { Box, Divider, Flex, Icon, Link, StatusTag, StepIndicator, Text } from '@hubspot/ui-extensions';

// 앱카드 공통 UI — docs/05_UI_UX_지침.md
// G1 구조 : 맨 위 상태 줄(StatusTag + 한 줄 + 오른쪽 끝 새로고침) · 하단 버전은 HubSpot '구동됨' 표기
// G4 상태 : HubSpot 기본 상태 표시(StatusTag) · 진행은 기본 StepIndicator

export type TagVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
const STATUS: Record<TagVariant, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  default: 'default',
  success: 'success',
  warning: 'warning',
  error: 'danger',
  info: 'info',
};

export const StatusRow = ({
  label,
  variant = 'default',
  text,
  action,
  refresh,
}: {
  label: string;
  variant?: TagVariant;
  text?: React.ReactNode;
  action?: React.ReactNode;
  refresh?: React.ReactNode;
}) => (
  <Flex direction="row" justify="between" align="center" gap="small">
    <Box flex={1}>
      <Flex direction="row" gap="small" align="center" wrap="wrap">
        <StatusTag variant={STATUS[variant]}>{label}</StatusTag>
        {text ? <Text variant="microcopy">{text}</Text> : null}
      </Flex>
    </Box>
    {action ? <Box flex="none">{action}</Box> : null}
    {refresh ? <Box flex="none">{refresh}</Box> : null}
  </Flex>
);

// 카드 맨 위 줄 — 내용 + 오른쪽 끝 새로고침 아이콘
export const TopRow = ({
  refresh,
  children,
  align = 'start',
}: {
  refresh: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'center';
}) => (
  <Flex direction="row" justify="between" align={align} gap="small">
    <Box flex={1}>{children}</Box>
    <Box flex="none">{refresh}</Box>
  </Flex>
);

// 단계 진행 — HubSpot 기본 StepIndicator (가운데 컬럼 전용, 단계 이름 모두 표시)
export const Progress = ({ steps, current }: { steps: string[]; current: number }) => (
  <StepIndicator stepNames={steps} currentStep={Math.max(0, current)} variant="default" />
);

// 조건 목록 — 충족(초록 체크) / 미충족(빈 원 + 굵게 + 조치)
export interface CheckItem {
  key: string;
  ok: boolean;
  text: string;
  action?: React.ReactNode;
}
export const CheckList = ({ items }: { items: CheckItem[] }) => (
  <Flex direction="column" gap="extra-small">
    {items.map((c) => (
      <Flex key={c.key} direction="row" gap="small" align="center" justify="between">
        <Flex direction="row" gap="small" align="center">
          <Icon name={c.ok ? 'checkCircle' : 'circleHollow'} color={c.ok ? 'success' : 'inherit'} size="sm" />
          <Text format={c.ok ? undefined : { fontWeight: 'demibold' }}>{c.text}</Text>
        </Flex>
        {!c.ok && c.action ? <Box flex="none">{c.action}</Box> : null}
      </Flex>
    ))}
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
    {/* 앱 버전은 HubSpot 하단 '…에 의해 구동됨' 앱 이름에 표기 (bump.sh) */}
    <Flex direction="row" justify="end" align="center" gap="small">
      <RefreshLink label={refreshLabel} href={href} onRefresh={onRefresh} />
    </Flex>
  </>
);

// 소제목 + (오른쪽) 동작
// action 여러 개는 배열로 — 각각 줄바꿈 없는 칸에 둠
export const SectionHead = ({ title, action }: { title: string; action?: React.ReactNode | React.ReactNode[] }) => (
  <Flex direction="row" justify="between" align="center" gap="small">
    <Box flex={1}>
      <Text format={{ fontWeight: 'demibold' }}>{title}</Text>
    </Box>
    {Array.isArray(action)
      ? action.map((a, i) => (
          <Box key={i} flex="none">
            {a}
          </Box>
        ))
      : action
        ? <Box flex="none">{action}</Box>
        : null}
  </Flex>
);

// 값 있는 것만 " · "로 이음 (G2 빈 값 숨김)
export const joinVals = (...v: (string | undefined | null | false)[]) =>
  v.filter((x) => x && String(x).trim()).join(' · ');

// 저장·생성 결과 알림 (상단 토스트, G4)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toast = (actions: any, message: string, type: 'success' | 'warning' | 'danger' = 'success') => {
  try {
    actions?.addAlert?.({ type, message });
  } catch (e) {
    /* 무시 */
  }
};

// 새로고침 — 아이콘만 (스크린리더용 문구 포함)
export const RefreshLink = ({ label, href, onRefresh }: { label: string; href: string; onRefresh: () => void }) => (
  <Link href={{ url: href, external: false }} preventDefault onClick={onRefresh}>
    <Icon name="refresh" screenReaderText={label} />
  </Link>
);

// 버튼 · 링크 앞 아이콘 + 글자
type IconName = React.ComponentProps<typeof Icon>['name'];
export const IconText = ({ name, children }: { name: IconName; children: React.ReactNode }) => (
  <>
    <Icon name={name} size="sm" /> {children}
  </>
);
