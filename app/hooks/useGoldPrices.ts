import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { deduplicateLatestPrices, getHistoricalCutoffIso } from '../lib/priceUtils';

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
      const { data, error } = await supabase
        .from('gold_prices')
        .select('price, scraped_at, provider:providers!inner(name, is_active)')
        .eq('karat', karat)
        .eq('provider.is_active', true)
        .gte('scraped_at', getHistoricalCutoffIso(35))
        .order('scraped_at', { ascending: false })
        .limit(5000);

      if (error) throw error;

      // Logic: Aggregate by calendar date and compute daily spot average.
      const dailyMap: Record<string, { total: number; count: number; timestamp: number }> = {};
      
      data.forEach(item => {
          const date = item.scraped_at.split('T')[0];
          if (!dailyMap[date]) {
              dailyMap[date] = { total: 0, count: 0, timestamp: new Date(item.scraped_at).getTime() };
          }
          dailyMap[date].total += item.price;
          dailyMap[date].count += 1;
      });

      return Object.values(dailyMap)
        .map(day => ({
            value: day.total / day.count,
            timestamp: day.timestamp
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    },
  });
}
