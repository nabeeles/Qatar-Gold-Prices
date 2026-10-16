import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  aggregateHistoricalPrices,
  deduplicateLatestPrices,
  getHistoricalCutoffIso,
  PriceRowLike,
} from '../lib/priceUtils';

/**
 * Interface representing a gold market synchronization record.
 */
export interface GoldPrice {
  id: number;
  karat: number;
  price: number;
  currency: string;
  scraped_at: string;
  provider: {
    name: string;
  };
}

/**
 * React Query hook to synchronize and retrieve the most recent gold market rates across all active providers.
 */
export function useLatestPrices() {
  return useQuery({
    queryKey: ['latest-prices'],
    queryFn: async () => {
      if (!supabase) {
        console.warn('Supabase not initialized, returning mock/empty data');
        return [];
      }
      const { data, error } = await supabase
        .from('gold_prices')
        .select(`
          id,
          karat,
          price,
          currency,
          scraped_at,
          provider:providers!inner(name, is_active)
        `)
        .eq('provider.is_active', true)
        .order('scraped_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return deduplicateLatestPrices((data as unknown as GoldPrice[]) || []);
    },
  });
}

/**
 * React Query hook to retrieve and analyze historical gold market data for trend visualization.
 */
export function useHistoricalPrices(karat: number = 24) {
  return useQuery({
    queryKey: ['historical-prices', karat],
    queryFn: async () => {
      if (!supabase) {
        console.warn('Supabase not initialized, returning mock/empty data');
        return [];
      }

      const cutoffIso = getHistoricalCutoffIso(365);
      const pageSize = 1000;
      const maxPages = 5;
      const allRows: PriceRowLike[] = [];

      for (let page = 0; page < maxPages; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('gold_prices')
          .select('price, scraped_at, provider:providers!inner(name, is_active)')
          .eq('karat', karat)
          .eq('provider.is_active', true)
          .gte('scraped_at', cutoffIso)
          .order('scraped_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allRows.push(...(data as unknown as PriceRowLike[]));
        if (data.length < pageSize) break;
      }

      return aggregateHistoricalPrices(allRows);
    },
  });
}

