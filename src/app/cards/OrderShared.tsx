import { useCallback, useEffect, useState } from 'react';
import { hubspot } from '@hubspot/ui-extensions';

// Create Order · Order Progress 카드 공용 (docs/06_Order_프로세스.md)
// bump.sh가 OD_VERSION / OD_UPDATED 를 올립니다.
export const OD_VERSION = '08';
export const OD_UPDATED = '2026-11-27';
export const OD_STAGE = 'Beta';
export const PORTAL = 245822501;
export const odVersion = () => `Update : ${OD_UPDATED} / Ver.${OD_VERSION}${OD_STAGE ? ' ' + OD_STAGE : ''}`;

export type Lang = 'en' | 'ko';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getLang = (context: any): Lang =>
  String(context?.user?.locale || context?.user?.language || 'en').toLowerCase().startsWith('ko') ? 'ko' : 'en';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const userName = (context: any) =>
  [context?.user?.firstName, context?.user?.lastName].filter(Boolean).join(' ') || context?.user?.email || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const callOD = async (parameters: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await hubspot.serverless('order_cards', { parameters });
  if (!res) throw new Error('Serverless function error');
  if (res.ok === false) throw new Error(res.error || 'Serverless function error');
  return res;
};
export const objUrl = (portalId: number | string, type: string, id: string) =>
  `https://app-na2.hubspot.com/contacts/${portalId}/record/${type}/${id}`;
export const editorUrl = (portalId: number | string, dealId: string) =>
  `https://app-na2.hubspot.com/line-items/${portalId}/deal/${dealId}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useOD = (action: string, dealId: string, lang: Lang, actions: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setData(await callOD({ action, dealId, lang }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [action, dealId, lang]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    actions.onCrmPropertiesUpdate(
      ['dealstage', 'pipeline', 'hubspot_owner_id', 'buyer_type', 'pricebook_select', 'hs_num_of_associated_line_items', 'order_review_status', 'pi_status', 'hd_card_sync'],
      () => load(),
    );
  }, [actions, load]);
  const notify = useCallback(() => {
    try {
      actions.refreshObjectProperties();
    } catch (e) {
      /* 무시 */
    }
  }, [actions]);
  return { data, error, load, notify };
};
