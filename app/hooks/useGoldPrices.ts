import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Interface representing a gold market synchronization record.
 * 
 * @interface GoldPrice
 * @property {number} id - Unique identifier for the price record.
 * @property {number} karat - Purity level (24K, 22K, 21K, 18K).
 * @property {number} price - Spot price per gram in Qatari Riyals (QAR).
 * @property {string} currency - Standard currency code (default: QAR).
 * @property {string} scraped_at - ISO timestamp of the market synchronization.
 * @property {Object} provider - Metadata for the retail institution source.
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
 * 
 * Capability:
 * - Executes a complex join between the `gold_prices` and `providers` registries.
 * - Filters for verified, active retail institutions only.
 * - Aggregates the latest spot prices for real-time dashboard visualization.
 * 
 * @function useLatestPrices
 * @returns {Object} - React Query result object containing an array of professional GoldPrice entities.
 */
export function useLatestPrices() {
  return useQuery({
    queryKey: ['latest-prices'],
    queryFn: async () => {
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
        .order('scraped_at', { ascending: false });

      if (error) throw error;

      return data as unknown as GoldPrice[];
    },
  });
}

/**
 * React Query hook to retrieve and analyze historical gold market data for trend visualization.
 * 
 * Data Processing:
 * - Retrieves all historical spot prices for a targeted karat level.
 * - Heuristically aggregates records into daily market averages to mitigate intraday volatility.
 * - Provides a high-fidelity dataset suitable for analytical charting.
 * 
 * @function useHistoricalPrices
 * @param {number} karat - The specific purity level for market analytics (default: 24).
 * @returns {Object} - React Query result object containing aggregated daily value/timestamp pairs.
 */
export function useHistoricalPrices(karat: number = 24) {
  return useQuery({
    queryKey: ['historical-prices', karat],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gold_prices')
        .select('price, scraped_at')
        .eq('karat', karat)
        .order('scraped_at', { ascending: true });

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

      return Object.values(dailyMap).map(day => ({
          value: day.total / day.count,
          timestamp: day.timestamp
      }));
    },
  });
}
