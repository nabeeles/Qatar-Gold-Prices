import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dbService, VaultEntry } from '../lib/db';
import { useLatestPrices } from './useGoldPrices';
import { useSQLiteContext } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

/**
 * Custom hook to manage the Digital Vault state and business logic.
 * 
 * Capability:
 * - Synchronizes with the local SQLite database via context.
 * - Computes real-time portfolio valuation using market averages.
 * - Provides CRUD operations with automatic UI updates (via React Query).
 */
export function useVault() {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const { data: latestPrices } = useLatestPrices();

  // Fetch all entries from the local database
  const entriesQuery = useQuery({
    queryKey: ['vault-entries'],
    queryFn: async () => {
      try {
        return await dbService.getEntries(db);
      } catch (err) {
        console.error('useVault entries fetch failed:', err);
        return [];
      }
    },
  });

  // Calculate market averages per karat from the latest scraped prices
  const marketAverages = (latestPrices || []).reduce((acc, curr) => {
    if (!acc[curr.karat]) {
      acc[curr.karat] = { total: 0, count: 0 };
    }
    acc[curr.karat].total += curr.price;
    acc[curr.karat].count += 1;
    return acc;
  }, {} as Record<number, { total: number; count: number }>);

  const getAveragePrice = (karat: number) => {
    const data = marketAverages[karat];
    return data ? data.total / data.count : 0;
  };

  // Compute portfolio metrics
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

  // Mutations for CRUD
  const addMutation = useMutation({
    mutationFn: async (entry: Omit<VaultEntry, 'id' | 'created_at'>) => {
      return await dbService.addEntry(db, {
        ...entry,
        id: Crypto.randomUUID(),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vault-entries'] }),
  });

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
