import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Accordion,
  Alert,
  Spacer,
  Heading,
  StepIndicator,
  AutoGrid,
  Box,
  Button,
  DateInput,
  Divider,
  Flex,
  Icon,
  Input,
  Link,
  LoadingSpinner,
  Modal,
  ModalBody,
  ModalFooter,
  Panel,
  PanelBody,
  PanelSection,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  TextArea,
  Tag,
  Tile,
  hubspot,
} from '@hubspot/ui-extensions';
import { getLang } from './LockStatus.tsx';
import { RefreshLink } from './UiKit.tsx';

type Lang = 'en' | 'ko';
type Opt = { label: string; value: string };
type Rule = 'edit' | 'lock' | 'team' | 'auto' | 'owner';
type Field = {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  rule: Rule;
  options: Opt[];
};
type Group = { key: string; fields: Field[] };
type LineItem = {
  id: string;
  name?: string;
  quantity?: string;
  price?: string;
  amount?: string;
  hs_line_item_currency_code?: string;
  hs_discount_percentage?: string;
  pricebook_price_discount?: string;
  remark?: string;
};
type Vals = Record<string, string>;
type GuideItem = {
  section: string;
  topic: string;
  title: string;
  lines: string[];
};

// 카드 설명 옆 버전 표기 — 배포할 때 함께 올림
const CARD_VERSION = '24';
const CARD_UPDATED = '2026-11-27';
// 정식 오픈 전까지 Beta 표기 — 정식 버전이 되면 '' 로 바꾸면 표기가 사라짐
const CARD_STAGE = 'Beta';
const PORTAL = 245822501;
// Order Branch → 따라오는 값 (ERP - Order Branch = Order Branch)
const OB_TO_ERP: Record<string, string> = {
  APAC: 'hq',
  EU: 'eu',
  UK: 'uk',
  US: 'us',
  JP: 'jp',
  IN: 'in',
  ME: 'me',
  LATAM: 'latam',
};
const PB_PREFIX: Record<string, string> = {
  hq: 'HQ_',
  eu: 'EU_',
  uk: 'UK_',
  us: 'US_',
  jp: 'JP_',
  in: 'HQ_', // IN은 HQ 가격표 사용 (2026-11-27 정책)
  me: 'ME_',
  latam: 'LATAM_',
};
const OB_TO_COMPANY: Record<string, string> = {
  APAC: '357681836740',
  EU: '345937632976',
  UK: '349137378015',
  US: '349077939946',
  JP: '349116873465',
  IN: '349133792993',
  ME: '349123272425',
  LATAM: '345946381010',
};
const OWNER_TO_OB: Record<string, string> = {
  hq: 'APAC',
  eu: 'EU',
  uk: 'UK',
  us: 'US',
  jp: 'JP',
  in: 'IN',
  me: 'ME',
  latam: 'LATAM',
};
const RESET_MODAL = 'order-setup-reset-modal';
const CLEAR_MODAL = 'order-setup-clear-modal';
const GUIDE_PANEL = 'order-setup-guide-panel';

// 한국어 UI일 때만 한국어, 그 외는 영어
const MSG = {
  en: {
    changed: 'Changed',
    pendingSave: 'Applied on save',
    resetOnSave: 'Reset on save',
    edit: 'Edit',
    close: 'Close',
    willChange: 'Changes together when you save Order Branch.',
    ownerHint:
      'Allowed teams only · changing it clears the buyer company and contact.',
    ownerHintItems:
      'Allowed teams only · changing it clears the buyer and resets line items.',
    ownerWarn:
      'Saving clears the buyer company and contact, and sets Order Branch again (Partner = new Owner Branch, HQ/Branch = HQ).',
    savedMark: 'Saved',
    expandToEdit: 'Expand to edit',
    notSet: 'Not set',
    notDecided: 'Not decided',
    notEntered: 'Not entered',
    optionalEmpty: 'Optional',
    orderTypeRule:
      'Dropship: Partner buyers only · BSO: Order Branch JP · ME only',
    shipNeeded: 'Ship-to needed',
    shipHint: 'Required for Dropship — customer ship-to address.',
    clearDate: 'Clear',
    noContact: 'No contact',
    optional: ' (optional)',
    branchEntity: 'Branch entity',
    stepHint: 'Click a step to open it · Line items open the editor',
    tagEditNow: 'Editable · saved right away',
    unsaved: (g: string) => `Unsaved changes in: ${g}`,
    groupSaved: (g: string) => `${g} saved.`,
    resetNote: (n: number) => `Saving resets ${n} line item(s).`,
    crossWarn:
      'Changing Order Branch clears the unsaved buyer changes. Save or cancel the Buyer group first.',
    autoSaveNote: 'Saved automatically after you enter the information.',
    title: 'Order Setup',
    desc: `Set the buyer, order type, price book and order route for this deal.`,
    guideBtn: 'Order Guide',
    loading: 'Loading order setup...',
    error: 'Error',
    groups: {
      basics: 'Basics',
      buyer: 'Buyer',
      order_type: 'Order Type',
      price: 'Price Book',
      route: 'Route & ERP',
      delivery: 'Delivery (optional)',
    } as Record<string, string>,
    steps: ['Basics', 'Buyer', 'Order Type', 'Price Book', 'Line Items'],
    progress: 'Progress',
    progressBody: (n: number) => `${n} of 5 steps completed.`,
    recommend: 'Recommended',
    caution: 'Caution',
    notice: 'Notice',
    next: {
      owner: 'There is no Owner Branch. Action required: assign a deal owner.',
      basics:
        'Basics are not complete. Action required: select Buyer Type and Order Branch.',
      company:
        'There is no buyer company. Action required: select a Buyer Company.',
      contact:
        'There is no buyer contact. Action required: select a Buyer Contact.',
      orderType:
        'There is no order type. Action required: select Order Type and Sales Type.',
      price: 'There is no price book. Action required: select a price book.',
      lineItems: 'There are no line items. Action required: add line items.',
      delivery:
        'Dropship needs the customer ship-to address. Action required: enter the Ship-to Address in Delivery.',
    },
    liCaution: (n: number) =>
      `${n} line item(s) added. Changing a field marked "Resets line items" deletes them. Other fields can be saved right away.`,
    resetDone: (n: number) =>
      `${n} line item(s) were deleted and your changes were saved.`,
    resetDoneTitle: 'Line items reset',
    resetNext: 'Action required: add the line items again.',
    noticeBody: (b: string, p: string, teams: string) =>
      `Owner Branch ${b || '-'} · Pipeline ${p || '-'} · Route editing: ${teams}`,
    routeTeamsYes: 'allowed',
    routeTeamsNo: 'not allowed',
    lineItems: 'Line Items',
    openEditor: 'Open line item editor',
    colName: 'Product',
    colQty: 'Qty',
    colPrice: 'Unit price',
    colAmount: 'Amount',
    colDiscount: 'Discount',
    colRemark: 'Remark',
    tagEdit: 'Editable',
    tagLock: 'Resets line items',
    tagTeam: 'Allowed teams · resets line items',
    tagTeamOnly: 'Allowed teams only',
    tagAuto: 'Automatic',
    lockHint: 'Changing this resets the line items.',
    teamHint: 'Only teams allowed in the app settings can edit.',
    selectCompany: 'Select a company',
    selectContact: 'Select a contact',
    selectFirst: 'Select a company first',
    save: 'Save',
    saveReset: 'Save (resets line items)',
    saving: 'Saving...',
    refresh: 'Refresh',
    resetBtn: 'Reset line items',
    saved: 'Order setup saved.',
    modalTitle: 'Line items will be reset',
    modalChanged: 'Changed fields',
    modalBody: (n: number) =>
      `Saving deletes the ${n} line item(s) on this deal and releases the order route summary.`,
    modalAction: 'Action required: add the line items again after saving.',
    modalConfirm: 'Reset and save',
    cancel: 'Cancel',
    clearTitle: 'Reset line items',
    clearBody: (n: number) =>
      `Delete all ${n} line item(s) on this deal? This can't be undone.`,
    clearConfirm: 'Delete line items',
    clearDone: (n: number) => `${n} line item(s) were deleted.`,
    guideTitle: 'Order Guide',
    guideIntro:
      'How to set up the order on this deal. Admins can edit this guide in HubDB.',
    guideNow: 'This deal now',
    guideRoute: 'Order route',
    guideErp: 'ERP target',
    guideItems: 'Line items',
    guideNext: 'Next step',
    guideDone: 'All steps are complete.',
    guideRouteNone: 'Not decided yet. It is decided after you save the basics.',
    guideRouteDetail: 'About this route',
    guideLoading: 'Loading the guide...',
  },
  ko: {
    changed: '변경됨',
    pendingSave: '저장 시 반영',
    resetOnSave: '저장 시 초기화',
    edit: 'Edit',
    close: '닫기',
    willChange: 'Order Branch를 저장하면 함께 변경됩니다.',
    ownerHint: '허용 팀만 · 변경하면 구매 회사 · 담당자가 초기화됩니다.',
    ownerHintItems: '허용 팀만 · 변경하면 구매자와 라인아이템이 초기화됩니다.',
    ownerWarn:
      '저장하면 구매 회사 · 담당자가 초기화되고 Order Branch가 다시 지정됩니다(Partner = 새 Owner Branch, HQ/Branch = HQ).',
    savedMark: '저장됨',
    expandToEdit: '펼쳐서 수정',
    notSet: '미선택',
    notDecided: '미판정',
    notEntered: '미입력',
    optionalEmpty: '선택 입력',
    orderTypeRule:
      'Dropship은 Partner 구매자만 · BSO는 Order Branch JP · ME만 선택할 수 있습니다.',
    shipNeeded: '배송지 필요',
    shipHint: '3자거래(Dropship)는 필수 — 고객사 배송지를 입력하세요.',
    clearDate: '지우기',
    noContact: '담당자 없음',
    optional: ' (선택)',
    branchEntity: '지사 법인',
    stepHint: '단계를 누르면 해당 설정이 열립니다 · 라인아이템은 편집기로 이동',
    tagEditNow: '편집 가능 · 바로 저장',
    unsaved: (g: string) => `저장하지 않은 그룹이 있습니다 : ${g}`,
    groupSaved: (g: string) => `${g}을(를) 저장했습니다.`,
    resetNote: (n: number) => `저장하면 라인아이템 ${n}개가 초기화됩니다.`,
    crossWarn:
      'Order Branch를 저장하면 구매자 그룹의 변경 내용이 사라집니다. 먼저 저장하거나 취소하세요.',
    autoSaveNote: '정보 입력 후 자동 저장됩니다.',
    title: '주문 설정',
    desc: `이 거래의 구매자 · 주문 형태 · 가격표 · 주문 경로를 설정합니다.`,
    guideBtn: '주문 가이드 보기',
    loading: '주문 설정을 불러오는 중입니다...',
    error: '오류',
    groups: {
      basics: '기본 정보',
      buyer: '구매자',
      order_type: '주문 형태',
      price: '가격표',
      route: '주문 경로 · ERP',
      delivery: '배송 (선택)',
    } as Record<string, string>,
    steps: ['기본 정보', '구매자', '주문 형태', '가격표', '라인아이템'],
    progress: '진행 상태',
    progressBody: (n: number) => `5단계 중 ${n}단계를 완료했습니다.`,
    recommend: '권장 안내',
    caution: '주의 알림',
    notice: '알림',
    next: {
      owner: 'Owner Branch가 없습니다. 필요한 조치 : 거래 소유자를 지정하세요.',
      basics:
        '기본 정보가 없습니다. 필요한 조치 : Buyer Type과 Order Branch를 선택하세요.',
      company: '구매 회사가 없습니다. 필요한 조치 : 구매 회사를 선택하세요.',
      contact:
        '구매 담당자가 없습니다. 필요한 조치 : 구매 담당자를 선택하세요.',
      orderType:
        '주문 형태가 없습니다. 필요한 조치 : 주문 형태와 판매 유형을 선택하세요.',
      price: '가격표가 없습니다. 필요한 조치 : 가격표를 선택하세요.',
      lineItems:
        '라인아이템이 없습니다. 필요한 조치 : 라인아이템을 등록하세요.',
      delivery:
        '3자거래(Dropship)는 고객사 배송지가 필요합니다. 필요한 조치 : 배송 그룹에서 배송지를 입력하세요.',
    },
    liCaution: (n: number) =>
      `라인아이템 ${n}개가 등록되어 있습니다. "변경 시 라인아이템 초기화" 표시 속성을 변경하면 라인아이템이 삭제됩니다. 그 외 속성은 바로 저장할 수 있습니다.`,
    resetDone: (n: number) =>
      `라인아이템 ${n}개를 삭제하고 변경 사항을 저장했습니다.`,
    resetDoneTitle: '라인아이템 초기화 완료',
    resetNext: '필요한 조치 : 라인아이템을 다시 등록하세요.',
    noticeBody: (b: string, p: string, teams: string) =>
      `Owner Branch ${b || '-'} · 파이프라인 ${p || '-'} · 주문 경로 수정 ${teams}`,
    routeTeamsYes: '가능',
    routeTeamsNo: '불가',
    lineItems: '등록한 라인아이템',
    openEditor: '라인아이템 편집기 열기',
    colName: '상품',
    colQty: '수량',
    colPrice: '단가',
    colAmount: '금액',
    colDiscount: '할인율',
    colRemark: '비고',
    tagEdit: '편집 가능',
    tagLock: '변경 시 라인아이템 초기화',
    tagTeam: '허용 팀만 · 변경 시 초기화',
    tagTeamOnly: '허용 팀만',
    tagAuto: '자동 계산',
    lockHint: '변경하면 라인아이템이 초기화됩니다.',
    teamHint: '앱 설정에서 허용된 팀만 수정할 수 있습니다.',
    selectCompany: '회사를 선택하세요',
    selectContact: '담당자를 선택하세요',
    selectFirst: '구매 회사를 먼저 선택하세요',
    save: '저장',
    saveReset: '저장 (라인아이템 초기화)',
    saving: '저장 중입니다...',
    refresh: '새로고침',
    resetBtn: '라인아이템 초기화',
    saved: '주문 설정을 저장했습니다.',
    modalTitle: '라인아이템이 초기화됩니다',
    modalChanged: '변경한 속성',
    modalBody: (n: number) =>
      `저장하면 이 거래의 라인아이템 ${n}개가 삭제되고 주문 경로 요약이 해제됩니다.`,
    modalAction: '필요한 조치 : 저장 후 라인아이템을 다시 등록하세요.',
    modalConfirm: '초기화 후 저장',
    cancel: '취소',
    clearTitle: '라인아이템 초기화',
    clearBody: (n: number) =>
      `이 거래의 라인아이템 ${n}개를 모두 삭제합니다. 되돌릴 수 없습니다.`,
    clearConfirm: '라인아이템 삭제',
    clearDone: (n: number) => `라인아이템 ${n}개를 삭제했습니다.`,
    guideTitle: '주문 가이드',
    guideIntro:
      '이 거래의 주문 설정 방법입니다. 가이드 내용은 관리자가 HubDB에서 수정할 수 있습니다.',
    guideNow: '이 거래의 현재 상태',
    guideRoute: '주문 경로',
    guideErp: 'ERP 대상',
    guideItems: '라인아이템',
    guideNext: '다음 할 일',
    guideDone: '모든 단계를 완료했습니다.',
    guideRouteNone:
      '아직 판정되지 않았습니다. 기본 정보를 저장하면 판정됩니다.',
    guideRouteDetail: '이 경로의 진행 방식',
    guideLoading: '가이드를 불러오는 중입니다...',
  },
};

hubspot.extend<'crm.record.tab'>(({ context, actions }) => (
  <OrderSetup context={context} actions={actions} />
));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = async (fn: string, parameters: any, allowFail = false) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await hubspot.serverless(fn, { parameters });
  if (!res) throw new Error('Serverless function error');
  if (res.ok === false && !allowFail)
    throw new Error(res.error || 'Serverless function error');
  return res;
};

const pairs = <T,>(arr: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
};
const toDate = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
  if (m)
    return { year: Number(m[1]), month: Number(m[2]) - 1, date: Number(m[3]) };
  if (/^\d{10,}$/.test(v || '')) {
    const d = new Date(Number(v));
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      date: d.getUTCDate(),
    };
  }
  return undefined;
};
const fromDate = (
  d: { year: number; month: number; date: number } | null | undefined,
) =>
  d
    ? `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.date).padStart(2, '0')}`
    : '';
const money = (v?: string, cur?: string) =>
  v
    ? `${cur ? cur + ' ' : ''}${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : '-';

// 진행 단계 ↔ 그룹
const STEP_GROUPS = ['basics', 'buyer', 'order_type', 'price'];
const stepDone = (v: Vals, count: number) => [
  !!(v.buyer_type && v.partner_region_select),
  v.buyer_type === 'internal_entity' || !!v.buyer_company, // 구매 담당자(Buyer Contact)는 선택값
  !!(v.order_type && v.erp_sales_type),
  !!v.pricebook_select,
  count > 0,
];
const nextGroupOf = (v: Vals, count: number): string => {
  const d = stepDone(v, count);
  const i = d.findIndex((x) => !x);
  if (i >= 0 && i < STEP_GROUPS.length) return STEP_GROUPS[i];
  // 배송은 선택 입력 — 3자거래(Dropship)일 때만 배송지 필요
  if (i === -1 && v.order_type === 'dropship' && !v.ship_to_address)
    return 'delivery';
  return '';
};
// 처음 열 때 펼쳐 둘 그룹 — 아직 입력이 끝나지 않은 그룹 전부
const incompleteGroupsOf = (v: Vals): string[] => {
  const d = stepDone(v, 1); // 라인아이템 단계는 그룹이 아니므로 제외
  const out = STEP_GROUPS.filter(
    (g, i) => !d[i] && !(g === 'buyer' && v.buyer_type === 'internal_entity'),
  );
  if (!v.order_route) out.push('route');
  if (v.order_type === 'dropship' && !v.ship_to_address) out.push('delivery');
  return out;
};
// 할인율 — 표준 Discount percentage 우선, 없으면 PriceBook Price Discount(%)
const pct = (i: {
  hs_discount_percentage?: string;
  pricebook_price_discount?: string;
}) => {
  const v = i.hs_discount_percentage || i.pricebook_price_discount || '';
  if (v === '' || v === null || v === undefined) return '-';
  const n = Number(v);
  return Number.isFinite(n) ? `${+n.toFixed(2)}%` : String(v);
};
const stripCount = (s: string) => s.replace(/\s\(\d+\)$/, '');
const short = (s: string, n = 24) =>
  s.length > n ? s.slice(0, n - 1) + '…' : s;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OrderSetup = ({ context, actions }: any) => {
  const lang: Lang = getLang(context);
  const t = MSG[lang];
  const dealId = String(context?.crm?.objectId ?? '');
  const portalId = context?.portal?.id ?? PORTAL;
  const recordUrl = `https://app-na2.hubspot.com/contacts/${portalId}/record/0-3/${dealId}`;

  const [groups, setGroups] = useState<Group[]>([]);
  const [saved, setSaved] = useState<Vals>({});
  const [draft, setDraft] = useState<Vals>({});
  const [region, setRegion] = useState('');
  const [hasRegion, setHasRegion] = useState(false);
  const [pipeline, setPipeline] = useState('');
  // ERP - Order Branch별 가격표 기본값(리전 최상단 옵션)과 전체 가격표 라벨
  const [pbDefaults, setPbDefaults] = useState<
    Record<string, { value: string; currency: string }>
  >({});
  const [pbAll, setPbAll] = useState<{ value: string; label: string }[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [companies, setCompanies] = useState<Opt[]>([]);
  const [contacts, setContacts] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState('');
  const [error, setError] = useState('');
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [savedMark, setSavedMark] = useState('');
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [guide, setGuide] = useState<{
    sections: GuideItem[];
    routes: GuideItem[];
  } | null>(null);

  // keep : 다른 그룹에서 아직 저장하지 않은 값 (저장 후 다시 불러와도 유지)
  const load = useCallback(
    // keepOpen 을 넘기지 않은 첫 로드에는 미입력 그룹을 모두 펼침
    async (keep: Vals = {}, keepOpen?: string[]) => {
      setError('');
      try {
        const res = await call('order_setup', { action: 'load', dealId, lang });
        const vals: Vals = res.values || {};
        const li: LineItem[] = res.lineItems || [];
        setGroups(res.groups || []);
        setSaved(vals);
        setDraft({ ...vals, ...keep });
        setRegion(res.region || '');
        setHasRegion(!!res.hasRegion);
        setPipeline(res.pipeline || '');
        setPbDefaults(res.pbDefaults || {});
        setPbAll(res.pbAll || []);
        setItems(li);
        setCanEdit(!!res.canEdit);
        if (keepOpen === undefined) {
          setOpenGroups(incompleteGroupsOf(vals));
        } else {
          const next = nextGroupOf(vals, li.length);
          setOpenGroups([...new Set([...keepOpen, ...(next ? [next] : [])])]);
        }
        if (res.hasRegion) {
          const c = await call('buyer_picker', {
            action: 'companies',
            region: res.region,
            lang,
          });
          setCompanies(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c.companies || []).map((x: any) => ({
              value: x.value,
              label:
                x.contactCount === null || x.contactCount === undefined
                  ? x.label
                  : `${x.label} (${x.contactCount})`,
            })),
          );
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [dealId, lang],
  );

  useEffect(() => {
    load();
  }, [load]);

  // 다른 카드 · 사이드바 · 워크플로에서 값이 바뀌면 입력 중인 값과 펼친 그룹은 유지한 채 다시 읽기
  const live = useRef({ draft, saved, openGroups });
  live.current = { draft, saved, openGroups };
  const softReload = useCallback(() => {
    const { draft: d, saved: sv, openGroups: og } = live.current;
    const keep: Vals = {};
    for (const k of Object.keys(d))
      if ((d[k] || '') !== (sv[k] || '')) keep[k] = d[k];
    return load(keep, og);
  }, [load]);

  useEffect(() => {
    const regions = ['hq', 'eu', 'uk', 'us', 'jp', 'in', 'me', 'latam'];
    actions.onCrmPropertiesUpdate(
      [
        'owning_entity',
        'buyer_type',
        'partner_region_select',
        'buying_branch',
        'order_type',
        'erp_sales_type',
        'pricebook_select',
        'deal_currency_code',
        'order_route',
        'selling_entity',
        'revenue_type',
        'erp_target',
        'ship_to_address',
        'requested_delivery_date',
        'hs_num_of_associated_line_items',
        ...regions.flatMap((r) => [`partner_${r}`, `partner_owner_${r}`]),
      ],
      () => {
        softReload();
      },
    );
  }, [actions, softReload]);

  // 구매 회사가 바뀌면 담당자 목록 다시 조회
  const companyId = draft.buyer_company || '';
  useEffect(() => {
    if (!companyId) {
      setContacts([]);
      return;
    }
    call('buyer_picker', { action: 'contacts', companyId, lang })
      .then((r) => setContacts(r.contacts || []))
      .catch((e) => setError((e as Error).message));
  }, [companyId, lang]);

  const allFields = useMemo(() => groups.flatMap((g) => g.fields), [groups]);
  const fieldOf = (n: string) => allFields.find((f) => f.name === n);
  const hasItems = items.length > 0;
  const isInternal =
    (draft.buyer_type || saved.buyer_type) === 'internal_entity';
  const visibleGroups = groups.filter(
    (g) => !(g.key === 'buyer' && isInternal),
  );
  const changedIn = (g: Group) =>
    g.fields
      .map((f) => f.name)
      .filter((n) => (draft[n] || '') !== (saved[n] || ''));
  const resetFieldsIn = (g: Group) =>
    changedIn(g).filter((n) =>
      ['lock', 'team', 'owner'].includes(fieldOf(n)?.rule || ''),
    );
  const dirtyGroups = visibleGroups.filter(
    (g) => g.key !== 'delivery' && changedIn(g).length > 0,
  );
  const groupName = (k: string) => t.groups[k] || k;

  const optLabel = (f: Field | undefined, v: string) => {
    if (!v) return '';
    if (f?.name === 'pricebook_select' && !f.options.some((o) => o.value === v))
      return pbAll.find((o) => o.value === v)?.label || v;
    if (!f) return v;
    const opts =
      f.name === 'buyer_company'
        ? companies
        : f.name === 'buyer_contact'
          ? contacts
          : f.options;
    return opts.find((o) => o.value === v)?.label || v;
  };
  const valLabel = (n: string, v = saved[n] || '') => optLabel(fieldOf(n), v);

  // 요약용 현재 값 — 저장 전 입력값 + 저장 시 함께 바뀌는 값(미리보기)까지 반영
  const obDraftChanged =
    (draft.partner_region_select || '') !== (saved.partner_region_select || '');
  const ownerDraftChanged =
    (draft.owning_entity || '') !== (saved.owning_entity || '');
  const buyerWillReset =
    ownerDraftChanged ||
    obDraftChanged ||
    (draft.buyer_type === 'internal_entity' &&
      saved.buyer_type !== 'internal_entity');
  // 저장 후 ERP - Order Branch → 가격표 기본값(리전 최상단) · 통화 미리보기 (서버 · W5와 같은 규칙)
  const erpAfter = obDraftChanged
    ? OB_TO_ERP[draft.partner_region_select || ''] || draft.selling_entity || ''
    : draft.selling_entity || '';
  const pbAfter = (() => {
    if ((draft.pricebook_select || '') !== (saved.pricebook_select || ''))
      return null; // 직접 고른 가격표 우선
    const pre = PB_PREFIX[erpAfter];
    if (!pre) return null;
    const curPb = saved.pricebook_select || '';
    const erpChanged = erpAfter !== (saved.selling_entity || '');
    const mismatch = !curPb || !curPb.startsWith(pre);
    if (!erpChanged && !mismatch) return null;
    const d = pbDefaults[erpAfter];
    return d && d.value && d.value !== curPb ? d : null;
  })();
  const curOf = (n: string) => {
    const d = draft[n] || '';
    const untouched = d === (saved[n] || '');
    if (untouched && obDraftChanged) {
      const ob = draft.partner_region_select || '';
      if (n === 'buying_branch') return OB_TO_COMPANY[ob] || d;
      if (n === 'selling_entity') return OB_TO_ERP[ob] || d;
    }
    if (untouched && buyerWillReset && n.startsWith('buyer_c')) return '';
    if (untouched && pbAfter && n === 'pricebook_select') return pbAfter.value;
    // 주문 형태 규칙(W4) — 구매자 · Order Branch가 바뀌어 허용되지 않으면 저장 시 Standard
    if (untouched && n === 'order_type') {
      const bt = draft.buyer_type || '';
      const ob = draft.partner_region_select || '';
      if (
        (d === 'dropship' && bt === 'internal_entity') ||
        (d === 'bso' && !['JP', 'ME'].includes(ob))
      )
        return 'standard';
    }
    if (untouched && pbAfter?.currency && n === 'deal_currency_code')
      return pbAfter.currency;
    return d;
  };
  const curLabel = (n: string) => optLabel(fieldOf(n), curOf(n));
  // 저장하면 값이 바뀌는 그룹 (직접 고치지 않았지만 다른 그룹 변경의 영향)
  const pendingOf = (k: string) => {
    const g = groups.find((x) => x.key === k);
    if (!g) return '';
    if (k === 'buyer' && buyerWillReset) return t.resetOnSave;
    return g.fields.some((f) => curOf(f.name) !== (draft[f.name] || ''))
      ? t.pendingSave
      : '';
  };

  // 진행 상태
  const done = stepDone(saved, items.length);
  const doneCount = done.filter(Boolean).length;
  const firstOpen = done.findIndex((d) => !d);
  const nextMsg = !hasRegion
    ? t.next.owner
    : firstOpen === 0
      ? t.next.basics
      : firstOpen === 1
        ? t.next.company
        : firstOpen === 2
          ? t.next.orderType
          : firstOpen === 3
            ? t.next.price
            : firstOpen === 4
              ? t.next.lineItems
              : saved.order_type === 'dropship' && !saved.ship_to_address
                ? t.next.delivery
                : '';
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const cur =
    items[0]?.hs_line_item_currency_code || saved.deal_currency_code || '';
  const stepInfo = [
    [curLabel('buyer_type'), curOf('partner_region_select')]
      .filter(Boolean)
      .join(' · ') || t.notSet,
    isInternal
      ? t.branchEntity
      : curOf('buyer_company')
        ? `${short(stripCount(curLabel('buyer_company')), 16)} · ${curOf('buyer_contact') ? short(curLabel('buyer_contact'), 14) : t.noContact}`
        : t.notSet,
    [curLabel('order_type'), curLabel('erp_sales_type')]
      .filter(Boolean)
      .join(' · ') || t.notSet,
    curOf('pricebook_select')
      ? `${short(curLabel('pricebook_select').replace('_Pricebook', ''), 18)} · ${curOf('deal_currency_code') || ''}`
      : t.notSet,
    hasItems ? `${items.length} · ${money(String(total), cur)}` : '0',
  ];

  // 그룹 요약 (아코디언 제목)
  const summaryOf = (k: string) => {
    if (k === 'basics') return stepInfo[0];
    if (k === 'buyer') return stepInfo[1];
    if (k === 'order_type') return stepInfo[2];
    if (k === 'price') return stepInfo[3];
    if (k === 'route')
      return (
        [
          curLabel('order_route').split(' ')[0],
          curLabel('selling_entity'),
          curLabel('erp_target'),
          curLabel('revenue_type'),
        ]
          .filter(Boolean)
          .join(' · ') || t.notDecided
      );
    if (k === 'delivery')
      return (
        [
          curOf('ship_to_address') ? short(curOf('ship_to_address'), 22) : '',
          curOf('requested_delivery_date') || '',
        ]
          .filter(Boolean)
          .join(' · ') ||
        (curOf('order_type') === 'dropship' ? t.shipNeeded : t.optionalEmpty)
      );
    return '';
  };
  const groupDone = (k: string) => {
    const i = STEP_GROUPS.indexOf(k);
    if (i >= 0) return done[i];
    if (k === 'route') return !!saved.order_route;
    if (k === 'delivery')
      return saved.order_type === 'dropship'
        ? !!saved.ship_to_address
        : !!(saved.ship_to_address || saved.requested_delivery_date);
    return false;
  };
  const isOpen = (k: string) => openGroups.includes(k);
  const toggle = (k: string) =>
    setOpenGroups(
      isOpen(k) ? openGroups.filter((x) => x !== k) : [...openGroups, k],
    );
  // 그룹 머리 — 그룹명(굵게) · 설정값(태그) · 오른쪽 Edit 버튼
  const groupHeader = (g: Group) => {
    const dirty = g.key !== 'delivery' && changedIn(g).length > 0;
    const isDone = groupDone(g.key);
    const tags = summaryOf(g.key).split(' · ').filter(Boolean);
    return (
      <Flex direction="row" justify="between" align="center" gap="small">
        <Flex direction="row" gap="extra-small" align="center" wrap="wrap">
          <Icon
            name={isDone ? 'checkCircle' : 'circleHollow'}
            color={isDone ? 'success' : 'inherit'}
            size="sm"
          />
          {/* 제목 텍스트를 눌러도 펼침/접힘 — Text 안에 Link를 넣어 아이콘과 같은 줄 높이로 정렬 (요약은 링크 없음) */}
          <Text variant="microcopy" format={{ fontWeight: 'bold' }}>
            <Link
              variant="dark"
              href={{ url: recordUrl, external: false }}
              preventDefault
              onClick={() => toggle(g.key)}
            >
              {groupName(g.key)}
            </Link>
          </Text>
          <Text variant="microcopy">[ {tags.join('  ·  ')} ]</Text>
          {dirty ? (
            <Tag variant="warning">● {t.changed}</Tag>
          ) : savedMark === g.key ? (
            <Tag variant="success">{t.savedMark} ✓</Tag>
          ) : pendingOf(g.key) ? (
            <Tag variant="info">{pendingOf(g.key)}</Tag>
          ) : null}
        </Flex>
        <Button size="xs" variant="secondary" onClick={() => toggle(g.key)}>
          <Icon
            name={isOpen(g.key) ? 'upCarat' : 'downCarat'}
            screenReaderText={isOpen(g.key) ? t.close : t.edit}
          />
        </Button>
      </Flex>
    );
  };

  const saveGroup = async (g: Group, confirmReset: boolean) => {
    const names = changedIn(g);
    if (!names.length) return;
    setSavingGroup(g.key);
    setError('');
    try {
      const values: Vals = {};
      for (const n of names) values[n] = draft[n] || '';
      const labels: Vals = {};
      if (values.buyer_company)
        labels.buyer_company = stripCount(
          companies.find((c) => c.value === values.buyer_company)?.label || '',
        );
      if (values.buyer_contact) {
        const comp = stripCount(
          companies.find((c) => c.value === draft.buyer_company)?.label || '',
        );
        labels.buyer_contact = `${contacts.find((c) => c.value === values.buyer_contact)?.label || ''} [${comp}]`;
      }
      const res = await call(
        'order_setup',
        { action: 'save', dealId, lang, values, labels, confirmReset },
        true,
      );
      if (res.ok === false) throw new Error(res.error);
      if (res.resetCount) {
        actions.addAlert({
          type: 'success',
          message: t.resetDone(res.resetCount),
        });
        // 기본 "라인 항목" 카드까지 갱신되도록 페이지 새로고침
        actions.reloadPage();
        return;
      }
      // 다른 그룹의 저장 안 한 값은 유지 (Order Branch 변경 · HQ/Branch 전환 시 구매자 값은 버림)
      const dropBuyer =
        names.includes('owning_entity') ||
        names.includes('partner_region_select') ||
        values.buyer_type === 'internal_entity';
      const keep: Vals = {};
      const keepOpen: string[] = [];
      for (const og of groups) {
        if (og.key === g.key || (dropBuyer && og.key === 'buyer')) continue;
        const ch = changedIn(og);
        for (const n of ch) keep[n] = draft[n] || '';
        if (ch.length) keepOpen.push(og.key);
      }
      setSavedMark(g.key);
      setTimeout(() => setSavedMark(''), 3000);
      if (g.key !== 'delivery')
        actions.addAlert({
          type: 'success',
          message: t.groupSaved(groupName(g.key)),
        });
      actions.refreshObjectProperties();
      // 저장한 그룹과 지금 펼쳐 둔 그룹은 계속 펼친 상태로 유지
      await load(keep, [...new Set([...openGroups, g.key, ...keepOpen])]);
      // 워크플로(W1~W4 등)가 몇 초 뒤 값을 바꾸는 경우를 위해 한 번 더 읽기
      for (const ms of [4000, 10000, 20000]) setTimeout(() => softReload(), ms);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingGroup('');
    }
  };

  const cancelGroup = (g: Group) => {
    const next = { ...draft };
    for (const f of g.fields) next[f.name] = saved[f.name] || '';
    setDraft(next);
  };

  const doClear = async () => {
    setSavingGroup('*');
    setError('');
    try {
      const res = await call('order_setup', { action: 'reset', dealId, lang });
      actions.addAlert({
        type: 'success',
        message: t.clearDone(res.resetCount || 0),
      });
      actions.reloadPage();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingGroup('');
    }
  };

  const openGuide = async () => {
    if (guide) return;
    try {
      const g = await call('order_setup', {
        action: 'guide',
        lang,
        hasLineItems: hasItems,
      });
      setGuide({ sections: g.sections || [], routes: g.routes || [] });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // 필드 아래 안내 문구 — ⓘ 아이콘 색으로 구분, 가장 작은 글씨(microcopy)
  // Order Branch를 바꾸면 Order Branch Company · ERP - Order Branch 미리 보기 (저장 시 서버가 함께 저장)
  const obChanged =
    (draft.partner_region_select || '') !== (saved.partner_region_select || '');
  const previewOf = (n: string) => {
    if (!obChanged || (draft[n] || '') !== (saved[n] || '')) return '';
    const ob = draft.partner_region_select || '';
    if (n === 'buying_branch') return OB_TO_COMPANY[ob] || '';
    if (n === 'selling_entity') return OB_TO_ERP[ob] || '';
    if (n === 'pricebook_select') return pbAfter?.value || '';
    if (n === 'deal_currency_code') return pbAfter?.currency || '';
    return '';
  };
  const valueOf = (n: string) => previewOf(n) || draft[n] || '';

  const hintFor = (f: Field) => {
    if (
      f.name === 'order_type' &&
      optionsFor(f).length < f.options.length &&
      !previewOf(f.name)
    )
      return (
        <Flex direction="row" gap="extra-small" align="center">
          <Icon name="info" size="sm" color="inherit" />
          <Text variant="microcopy">{t.orderTypeRule}</Text>
        </Flex>
      );
    if (
      f.name === 'ship_to_address' &&
      curOf('order_type') === 'dropship' &&
      !curOf('ship_to_address')
    )
      return (
        <Flex direction="row" gap="extra-small" align="center">
          <Icon name="info" size="sm" color="warning" />
          <Text variant="microcopy">{t.shipHint}</Text>
        </Flex>
      );
    if (previewOf(f.name))
      return (
        <Flex direction="row" gap="extra-small" align="center">
          <Icon name="info" size="sm" color="warning" />
          <Text variant="microcopy">{t.willChange}</Text>
        </Flex>
      );
    let color: 'inherit' | 'success' | 'warning' | 'alert' = 'inherit';
    let text = '';
    if (f.rule === 'auto') text = t.tagAuto;
    else if (f.rule === 'owner') {
      color = hasItems ? 'alert' : 'warning';
      text = hasItems ? t.ownerHintItems : t.ownerHint;
    } else if (f.rule === 'team' && !canEdit) {
      color = 'alert';
      text = t.teamHint;
    } else if (f.rule === 'team') {
      color = hasItems ? 'alert' : 'inherit';
      text = hasItems ? t.tagTeam : t.tagTeamOnly;
    } else if (hasItems && f.rule === 'lock') {
      color = 'warning';
      text = t.lockHint;
    } else if (hasItems && f.rule === 'edit') {
      color = 'success';
      text = t.tagEditNow;
    }
    if (!text) return null;
    return (
      <Flex direction="row" gap="extra-small" align="center">
        <Icon name="info" size="sm" color={color} />
        <Text variant="microcopy">{text}</Text>
      </Flex>
    );
  };

  // 주문 형태 선택지 — 워크플로(W4) 규칙과 동일하게 제한
  // Dropship(3자거래) = Partner 구매자만, BSO = Order Branch JP · ME만
  const optionsFor = (f: Field) => {
    if (f.name !== 'order_type') return f.options;
    const internal = curOf('buyer_type') === 'internal_entity';
    const ob = curOf('partner_region_select');
    return f.options.filter(
      (o) =>
        !(o.value === 'dropship' && internal) &&
        !(o.value === 'bso' && !['JP', 'ME'].includes(ob)),
    );
  };
  const renderField = (f: Field, g: Group) => {
    const busy = !!savingGroup;
    const readOnly =
      f.rule === 'auto' || (f.rule === 'team' && !canEdit) || busy;
    const set = (v: string) => {
      const next = { ...draft, [f.name]: v };
      if (f.name === 'buyer_company') next.buyer_contact = '';
      // Buyer Type → Order Branch 자동 (HQ/Branch = HQ(APAC), Partner = Owner Branch)
      if (f.name === 'buyer_type') {
        const ob =
          v === 'internal_entity'
            ? 'APAC'
            : OWNER_TO_OB[next.owning_entity || region] || '';
        if (ob) next.partner_region_select = ob;
      }
      // Owner Branch → Order Branch 자동 (구매 회사 · 담당자는 저장 시 초기화)
      if (f.name === 'owning_entity') {
        const ob =
          (next.buyer_type || saved.buyer_type) === 'internal_entity'
            ? 'APAC'
            : OWNER_TO_OB[v] || '';
        if (ob) next.partner_region_select = ob;
      }
      setDraft(next);
    };
    const autoSave = g.key === 'delivery';
    let input: React.ReactNode;
    if (f.name === 'buyer_company' || f.name === 'buyer_contact') {
      const isCo = f.name === 'buyer_company';
      input = (
        <Select
          label=""
          readOnly={readOnly}
          placeholder={
            isCo ? t.selectCompany : companyId ? t.selectContact : t.selectFirst
          }
          options={isCo ? companies : contacts}
          value={valueOf(f.name)}
          onChange={(v) => set(String(v))}
        />
      );
    } else if (f.type === 'enumeration') {
      input = (
        <Select
          label=""
          readOnly={readOnly}
          options={
            // 미리보기 값(다른 리전 가격표 등)이 현재 목록에 없으면 함께 표시
            valueOf(f.name) &&
            !optionsFor(f).some((x) => x.value === valueOf(f.name))
              ? [
                  ...optionsFor(f),
                  {
                    value: valueOf(f.name),
                    label: optLabel(f, valueOf(f.name)),
                  },
                ]
              : optionsFor(f)
          }
          value={valueOf(f.name)}
          onChange={(v) => set(String(v))}
        />
      );
    } else if (f.type === 'date') {
      input = (
        <DateInput
          name={f.name}
          label=""
          readOnly={readOnly}
          format="YYYY-MM-DD"
          clearButtonLabel={t.clearDate}
          value={toDate(draft[f.name] || '')}
          onChange={(d) => {
            const v = fromDate(d);
            set(v);
            if (autoSave && v !== (saved[f.name] || '')) {
              // 날짜는 선택 즉시 자동 저장
              setTimeout(() => saveGroupValue(g, f.name, v), 0);
            }
          }}
        />
      );
    } else {
      const common = {
        name: f.name,
        label: '',
        readOnly,
        value: valueOf(f.name),
        onChange: (v: string) => set(String(v)),
        onBlur: (v: string) => {
          if (autoSave && String(v ?? '') !== (saved[f.name] || ''))
            saveGroupValue(g, f.name, String(v ?? ''));
        },
      };
      input =
        f.fieldType === 'textarea' || f.name === 'ship_to_address' ? (
          <TextArea {...common} rows={2} />
        ) : (
          <Input {...common} />
        );
    }
    return (
      <Flex direction="column" gap="extra-small">
        {/* 라벨은 컴포넌트 기본(굵게) 대신 일반 굵기 텍스트로 표시
            라벨 ↔ 입력 필드는 붙이고(flush), 그만큼 라벨 위에 여백 */}
        <Flex direction="column" gap="flush">
          <Spacer size="xs" />
          <Text>
            {f.label}
            {f.name === 'buyer_contact' ? t.optional : ''}
          </Text>
          {input}
        </Flex>
        {hintFor(f)}
      </Flex>
    );
  };

  // 배송 그룹 자동 저장 (한 값)
  const saveGroupValue = async (g: Group, name: string, value: string) => {
    setSavingGroup(g.key);
    try {
      const res = await call(
        'order_setup',
        { action: 'save', dealId, lang, values: { [name]: value } },
        true,
      );
      if (res.ok === false) throw new Error(res.error);
      setSaved((s) => ({ ...s, [name]: value }));
      setSavedMark(g.key);
      setTimeout(() => setSavedMark(''), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingGroup('');
    }
  };

  // 덜 강조된 안내 줄 — 연한 배경(Alert) + 작은 글씨
  // (Tile에는 배경색 옵션이 없어 Alert 사용, 본문은 microcopy)
  // 오른쪽 ✕ 로 닫을 수 있음 — 같은 문구는 이 화면을 다시 열기 전까지 숨김, 문구가 바뀌면 다시 표시
  // Alert 본문은 내용 폭만큼만 늘어나 안쪽 오른쪽 정렬이 안 되므로 ✕ 는 상자 바깥 오른쪽 끝에 둠
  const note = (
    variant: 'warning' | 'success' | 'info',
    title: string,
    text: string,
  ) => {
    const key = `${title}|${text}`;
    if (dismissed.includes(key)) return null;
    return (
      <Flex direction="row" align="center" gap="extra-small">
        <Box flex={1}>
          <Alert title={title} variant={variant}>
            <Text variant="microcopy">{text}</Text>
          </Alert>
        </Box>
        <Link
          variant="dark"
          href={{ url: recordUrl, external: false }}
          preventDefault
          onClick={() => setDismissed((d) => [...d, key])}
        >
          <Icon name="remove" size="sm" screenReaderText={t.close} />
        </Link>
      </Flex>
    );
  };

  if (loading) return <LoadingSpinner label={t.loading} />;

  const routeField = fieldOf('order_route');
  const curRoute = saved.order_route || '';
  const routeGuide = guide?.routes.find((r) => r.topic === curRoute);
  const guidePanel = (
    <Panel id={GUIDE_PANEL} title={t.guideTitle} width="md" onOpen={openGuide}>
      <PanelBody>
        <PanelSection>
          <Text variant="microcopy">{t.guideIntro}</Text>
        </PanelSection>
        <PanelSection>
          <Tile compact>
            <Flex direction="column" gap="extra-small">
              <Text format={{ fontWeight: 'bold' }}>{t.guideNow}</Text>
              <Text>
                {t.guideRoute} :{' '}
                {curRoute && routeField
                  ? optLabel(routeField, curRoute)
                  : t.guideRouteNone}
              </Text>
              {saved.erp_target && (
                <Text>
                  {t.guideErp} : {valLabel('erp_target')}
                </Text>
              )}
              <Text>
                {t.guideItems} : {items.length}
              </Text>
              <Text>
                {t.guideNext} : {nextMsg || t.guideDone}
              </Text>
            </Flex>
          </Tile>
        </PanelSection>
        {!guide ? (
          <PanelSection>
            <LoadingSpinner label={t.guideLoading} />
          </PanelSection>
        ) : (
          <PanelSection>
            <Flex direction="column" gap="small">
              {routeGuide && (
                <Accordion
                  title={`${t.guideRouteDetail} · ${routeGuide.title}`}
                  defaultOpen
                >
                  <Flex direction="column" gap="extra-small">
                    {routeGuide.lines.map((l, i) => (
                      <Text key={i}>• {l}</Text>
                    ))}
                  </Flex>
                </Accordion>
              )}
              {guide.sections.map((s, idx) => (
                <Accordion
                  key={s.section + idx}
                  title={s.title}
                  defaultOpen={idx === 0 && !routeGuide}
                >
                  <Flex direction="column" gap="extra-small">
                    {s.lines.map((l, i) => (
                      <Text key={i}>• {l}</Text>
                    ))}
                    {s.section === 'route' &&
                      guide.routes.map((r) => (
                        <Flex key={r.topic} direction="column" gap="flush">
                          <Text format={{ fontWeight: 'demibold' }}>
                            {r.title}
                            {r.topic === curRoute ? ' ✔' : ''}
                          </Text>
                          {r.lines.map((l, i) => (
                            <Text key={i} variant="microcopy">
                              {l}
                            </Text>
                          ))}
                        </Flex>
                      ))}
                  </Flex>
                </Accordion>
              ))}
            </Flex>
          </PanelSection>
        )}
      </PanelBody>
    </Panel>
  );

  const resetModal = (g: Group) => (
    <Modal
      id={`${RESET_MODAL}-${g.key}`}
      title={t.modalTitle}
      variant="danger"
      width="sm"
    >
      <ModalBody>
        <Flex direction="column" gap="small">
          <Text format={{ fontWeight: 'bold' }}>{t.modalChanged}</Text>
          {resetFieldsIn(g).map((n) => (
            <Text key={n}>
              • {fieldOf(n)?.label || n} : {valLabel(n) || '-'} →{' '}
              {valLabel(n, draft[n] || '') || '-'}
            </Text>
          ))}
          <Text>{t.modalBody(items.length)}</Text>
          <Text format={{ fontWeight: 'bold' }}>{t.modalAction}</Text>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="destructive"
          onClick={async () => {
            actions.closeOverlay(`${RESET_MODAL}-${g.key}`);
            await saveGroup(g, true);
          }}
        >
          {t.modalConfirm}
        </Button>
        <Button
          variant="secondary"
          onClick={() => actions.closeOverlay(`${RESET_MODAL}-${g.key}`)}
        >
          {t.cancel}
        </Button>
      </ModalFooter>
    </Modal>
  );

  const clearModal = (
    <Modal id={CLEAR_MODAL} title={t.clearTitle} variant="danger" width="sm">
      <ModalBody>
        <Text>{t.clearBody(items.length)}</Text>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="destructive"
          onClick={async () => {
            actions.closeOverlay(CLEAR_MODAL);
            await doClear();
          }}
        >
          {t.clearConfirm}
        </Button>
        <Button
          variant="secondary"
          onClick={() => actions.closeOverlay(CLEAR_MODAL)}
        >
          {t.cancel}
        </Button>
      </ModalFooter>
    </Modal>
  );

  // 그룹 하단 버튼
  const groupFooter = (g: Group) => {
    if (g.key === 'delivery') return null;
    const ch = changedIn(g);
    if (!ch.length) return null;
    const needsReset = hasItems && resetFieldsIn(g).length > 0;
    const buyerDirty =
      (groups.find((x) => x.key === 'buyer') &&
        changedIn(groups.find((x) => x.key === 'buyer') as Group).length > 0) ||
      false;
    const warn =
      g.key === 'basics' && ch.includes('owning_entity')
        ? t.ownerWarn + (needsReset ? ' ' + t.resetNote(items.length) : '')
        : g.key === 'basics' &&
            ch.includes('partner_region_select') &&
            buyerDirty
          ? t.crossWarn
          : needsReset
            ? t.resetNote(items.length)
            : '';
    const busy = !!savingGroup;
    return (
      <Flex direction="column" gap="extra-small">
        {warn ? <Text variant="microcopy">{warn}</Text> : null}
        <Flex direction="row" justify="end" gap="extra-small">
          <Button
            size="xs"
            variant="secondary"
            disabled={busy}
            onClick={() => cancelGroup(g)}
          >
            {t.cancel}
          </Button>
          {needsReset ? (
            <Button
              size="xs"
              variant="primary"
              disabled={busy}
              overlay={resetModal(g)}
            >
              {savingGroup === g.key ? t.saving : t.saveReset}
            </Button>
          ) : (
            <Button
              size="xs"
              variant="primary"
              disabled={busy}
              onClick={() => saveGroup(g, false)}
            >
              {savingGroup === g.key ? t.saving : t.save}
            </Button>
          )}
        </Flex>
      </Flex>
    );
  };

  const stepIcon = (
    i: number,
  ): {
    name: 'checkCircle' | 'circleFilled' | 'circleHollow';
    color: 'success' | 'warning' | 'inherit';
  } =>
    done[i]
      ? { name: 'checkCircle', color: 'success' }
      : i === firstOpen
        ? { name: 'circleFilled', color: 'warning' }
        : { name: 'circleHollow', color: 'inherit' };

  return (
    <Flex direction="column" gap="small">
      {/* 설명 · 주문 가이드 */}
      <Flex direction="row" justify="between" align="center" gap="small">
        <Text variant="microcopy">{t.desc}</Text>
        <Button variant="secondary" size="xs" overlay={guidePanel}>
          <Icon name="book" size="sm" /> {t.guideBtn}
        </Button>
      </Flex>

      {/* 안내 영역 — 오류만 기본 Alert, 나머지는 작게 */}
      {error && (
        <Alert title={t.error} variant="danger">
          {error}
        </Alert>
      )}
      <Flex direction="column" gap="extra-small">
        {hasItems && note('warning', t.caution, t.liCaution(items.length))}
        {dirtyGroups.length > 0 &&
          note(
            'warning',
            t.caution,
            t.unsaved(dirtyGroups.map((g) => groupName(g.key)).join(', ')),
          )}
        {nextMsg && note('success', t.recommend, nextMsg)}
        {note(
          'info',
          t.notice,
          t.noticeBody(
            region.toUpperCase(),
            pipeline,
            canEdit ? t.routeTeamsYes : t.routeTeamsNo,
          ),
        )}
      </Flex>

      {/* 진행 상태 — 선으로 이어진 단계 표시, 각 단계 아래 작은 글씨 정보
          단계·정보 링크를 누르면 해당 그룹 펼침, 라인아이템 정보 링크는 편집기 열기 */}
      <Tile>
        <Flex direction="column" gap="flush">
          <Flex direction="row" justify="end">
            <Text variant="microcopy">{t.stepHint}</Text>
          </Flex>
          <Spacer size="sm" />
          {/* 아이콘 아래 기본 라벨은 비우고, 아래 줄에 단계명을 링크로 표시 */}
          <StepIndicator
            stepNames={t.steps.map(() => '\u00a0')}
            currentStep={firstOpen === -1 ? t.steps.length : firstOpen}
            circleSize="md"
            onClick={(i: number) => {
              const gk = STEP_GROUPS[i];
              if (gk) toggle(gk); // 열려 있으면 닫고, 닫혀 있으면 열기
            }}
          />
          <Flex direction="row" gap="flush">
            {t.steps.map((name: string, i: number) => (
              <Box key={i} flex={1}>
                <Flex direction="row" justify="center">
                  {i === 4 ? (
                    <Link
                      href={{
                        url: `https://app-na2.hubspot.com/line-items/${portalId}/deal/${dealId}`,
                        external: false,
                      }}
                    >
                      {name} ↗
                    </Link>
                  ) : (
                    <Link
                      href={{
                        url: `https://app-na2.hubspot.com/contacts/${portalId}/record/0-3/${dealId}`,
                        external: false,
                      }}
                      preventDefault
                      onClick={() => {
                        const gk = STEP_GROUPS[i];
                        if (gk) toggle(gk);
                      }}
                    >
                      {name}
                    </Link>
                  )}
                </Flex>
              </Box>
            ))}
          </Flex>
        </Flex>
      </Tile>

      {/* 라인아이템 요약 */}
      {hasItems && (
        <Tile compact>
          <Flex direction="column" gap="extra-small">
            <Flex direction="row" justify="between" align="center">
              <Text format={{ fontWeight: 'bold' }}>
                {t.lineItems} {items.length} · {money(String(total), cur)}
              </Text>
              <Link
                href={{
                  url: `https://app-na2.hubspot.com/line-items/${portalId}/deal/${dealId}`,
                  external: false,
                }}
              >
                {t.openEditor}
              </Link>
            </Flex>
            <Table bordered={false} flush density="condensed">
              <TableHead>
                <TableRow>
                  <TableHeader>{t.colName}</TableHeader>
                  <TableHeader>{t.colQty}</TableHeader>
                  <TableHeader>{t.colPrice}</TableHeader>
                  <TableHeader>{t.colDiscount}</TableHeader>
                  <TableHeader>{t.colAmount}</TableHeader>
                  <TableHeader>{t.colRemark}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.name || '-'}</TableCell>
                    <TableCell>{i.quantity || '-'}</TableCell>
                    <TableCell>
                      {money(i.price, i.hs_line_item_currency_code)}
                    </TableCell>
                    <TableCell>{pct(i)}</TableCell>
                    <TableCell>
                      {money(i.amount, i.hs_line_item_currency_code)}
                    </TableCell>
                    <TableCell>{short(i.remark || '-', 30)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Flex>
        </Tile>
      )}

      {/* 아코디언 그룹 (최대 2컬럼) */}
      {/* 그룹 — 테두리 없이 머리줄 + 구분선 (펼친 그룹도 동일, 마지막 그룹은 아래 공통 구분선만) */}
      {visibleGroups.map((g, gi) =>
        isOpen(g.key) ? (
          <Flex key={g.key} direction="column" gap="flush">
            <Spacer size="sm" />
            <Flex direction="column" gap="small">
              {groupHeader(g)}
              <Flex direction="column" gap="small">
                {g.key === 'delivery' && (
                  <Text variant="microcopy">{t.autoSaveNote}</Text>
                )}
                {pairs(g.fields).map((row) => (
                  <Flex
                    key={row.map((f) => f.name).join('-')}
                    direction="row"
                    gap="medium"
                  >
                    {row.map((f) => (
                      <Box key={f.name} flex={1}>
                        {renderField(f, g)}
                      </Box>
                    ))}
                    {row.length === 1 && (
                      <Box flex={1}>
                        <Text> </Text>
                      </Box>
                    )}
                  </Flex>
                ))}
                {groupFooter(g)}
              </Flex>
            </Flex>
            <Spacer size="sm" />
            {gi < visibleGroups.length - 1 && <Divider />}
          </Flex>
        ) : (
          <Flex key={g.key} direction="column" gap="flush">
            <Spacer size="sm" />
            {groupHeader(g)}
            <Spacer size="sm" />
            {gi < visibleGroups.length - 1 && <Divider />}
          </Flex>
        ),
      )}

      <Divider />

      {/* 하단 — 왼쪽 라인아이템 초기화 · 오른쪽 새로고침 아이콘 (다른 카드와 같은 하단 줄) */}
      <Flex direction="row" justify="between" align="center">
        <Box flex="none">
          {hasItems ? (
            <Button
              variant="destructive"
              size="xs"
              disabled={!!savingGroup}
              overlay={clearModal}
            >
              {t.resetBtn}
            </Button>
          ) : null}
        </Box>
        <RefreshLink
          label={t.refresh}
          href={`https://app-na2.hubspot.com/contacts/${portalId}/record/0-3/${dealId}`}
          onRefresh={async () => {
            if (savingGroup) return;
            setLoading(true);
            await load();
          }}
        />
      </Flex>
    </Flex>
  );
};
