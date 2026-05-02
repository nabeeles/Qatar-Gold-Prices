import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dbService, VaultEntry } from '../lib/db';
import { useLatestPrices } from './useGoldPrices';
import { useSQLiteContext } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

/**
 * useVault Hook
 * 
 * Centralized business logic engine for the "My Gold" feature.
 * 
 * Responsibilities:
 * 1. Data Sync: Bridges the local SQLite vault with the global React Query state.
 * 2. Market Analysis: Calculates real-time spot averages per karat from Supabase data.
 * 3. Valuation: Maps local holdings to current market rates to derive ROI and Total Value.
 * 4. CRUD: Provides reactive methods to manage asset lifecycle.
 */
export function useVault() {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const { data: latestPrices } = useLatestPrices();

  /**
   * entriesQuery
   * Retrieves the current user portfolio from the device-local SQLite database.
   */
  const entriesQuery = useQuery({
    queryKey: ['vault-entries'],
    queryFn: async () => {
      try {
        return await dbService.getEntries(db);
      } catch (err) {
        console.error('[VaultHook] Local entries fetch failed:', err);
        return [];
      }
    },
  });

  /**
   * marketAverages (Computed)
   * Aggregates the latest market data into a lookup map for instant valuation.
   * Format: { [karat]: { total, count } }
   */
  const marketAverages = (latestPrices || []).reduce((acc, curr) => {
    if (!acc[curr.karat]) {
      acc[curr.karat] = { total: 0, count: 0 };
    }
    acc[curr.karat].total += curr.price;
    acc[curr.karat].count += 1;
    return acc;
  }, {} as Record<number, { total: number; count: number }>);

  /**
   * getAveragePrice
   * Utility to retrieve the mathematical mean for a specific gold purity.
   */
  const getAveragePrice = (karat: number) => {
    const data = marketAverages[karat];
    return data ? data.total / data.count : 0;
  };

  /**
   * portfolioSummary (Computed)
   * Iterates through local holdings and applies current market averages 
   * to calculate global ROI and cost-basis metrics.
   */
  const portfolioSummary = (entriesQuery.data || []).reduce(
    (acc, entry) => {
      const currentPrice = getAveragePrice(entry.karat);
      const currentValue = currentPrice * entry.weight;
      const costBasis = (entry.price_per_gram || 0) * entry.weight;
      
      acc.totalValue += currentValue;
      acc.totalCostBasis += costBasis;
      return acc;
    },
    { totalValue: 0, totalCostBasis: 0 }
  );

  const totalGainLoss = portfolioSummary.totalValue - portfolioSummary.totalCostBasis;
  const totalGainLossPercentage = portfolioSummary.totalCostBasis > 0 
    ? (totalGainLoss / portfolioSummary.totalCostBasis) * 100 
    : 0;

  // --- Mutations ---

  /**
   * addEntry
   * Persists a new gold asset to the local database with a secure random UUID.
   */
  const addMutation = useMutation({
    mutationFn: async (entry: Omit<VaultEntry, 'id' | 'created_at'>) => {
      return await dbService.addEntry(db, {
        ...entry,
        id: Crypto.randomUUID(),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vault-entries'] }),
  });

  /**
   * deleteEntry
   * Removes an asset and triggers a reactive UI refresh.
   */
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await dbService.deleteEntry(db, id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vault-entries'] }),
  });

  return {
    entries: entriesQuery.data || [],
    isLoading: entriesQuery.isLoading,
    isError: entriesQuery.isError,
    error: entriesQuery.error,
    portfolioSummary: {
      ...portfolioSummary,
      totalGainLoss,
      totalGainLossPercentage,
    },
    getAveragePrice,
    addEntry: addMutation.mutate,
    deleteEntry: deleteMutation.mutate,
    isAdding: addMutation.isPending,
  };
}
