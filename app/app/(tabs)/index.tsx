import React from 'react';
import { FlatList, View, Text, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLatestPrices } from '../../hooks/useGoldPrices';
import { PriceCard } from '../../components/PriceCard';
import { TrendingUp } from 'lucide-react-native';

/**
 * Dashboard Screen Component.
 * 
 * Orchestrates the real-time visualization of the Qatari gold market.
 */
export default function Dashboard() {
  const { data, isLoading, refetch, isRefetching } = useLatestPrices();

  // Group by provider to show one card per provider with multiple carats
  const groupedData = React.useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    try {
      const providerMap = new Map<string, {
        id: string;
        name: string;
        scraped_at: string;
        prices: { karat: number; price: number }[]
      }>();
      
      data.forEach(item => {
        if (!item || !item.provider || !item.provider.name) return;
        const providerName = item.provider.name;
        
        if (!providerMap.has(providerName)) {
          providerMap.set(providerName, {
            id: providerName,
            name: providerName,
            scraped_at: item.scraped_at || new Date().toISOString(),
            prices: []
          });
        }
        
        const providerData = providerMap.get(providerName)!;
        // Only keep the latest for each karat
        if (!providerData.prices.some(p => p.karat === item.karat)) {
          providerData.prices.push({ karat: item.karat, price: Number(item.price) || 0 });
        }
      });

      const sortedData = Array.from(providerMap.values()).sort((a, b) => {
        const order = ['Malabar', 'Joyalukkas', 'LivePriceOfGold', 'GoodReturns', 'Fardan'];
        const indexA = order.findIndex(name => a.name.includes(name));
        const indexB = order.findIndex(name => b.name.includes(name));
        const posA = indexA === -1 ? 999 : indexA;
        const posB = indexB === -1 ? 999 : indexB;
        return posA - posB;
      });

      return sortedData;
    } catch (err) {
      console.error('Error grouping dashboard data:', err);
      return [];
    }
  }, [data]);

  const average24k = React.useMemo(() => {
    try {
      const prices24k = groupedData
        .flatMap(p => p.prices)
        .filter(p => p.karat === 24);
        
      if (prices24k.length === 0) return "0.00";
      const sum = prices24k.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
      return (sum / prices24k.length).toFixed(2);
    } catch (err) {
      console.error('Error calculating 24k average:', err);
      return "0.00";
    }
  }, [groupedData]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 }}>
        <Text style={{ color: '#A0A0A0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 4, marginBottom: 4, fontWeight: '600' }}>
          Market Overview
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', marginBottom: 24 }}>Qatar Gold</Text>
        
        {/* Hero Average Card */}
        <View style={{ backgroundColor: '#D4AF37', borderRadius: 24, padding: 24, marginBottom: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: 'rgba(0,0,0,0.6)', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 }}>
              Market Average (24K)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ color: '#000000', fontSize: 40, fontWeight: '900' }}>{average24k}</Text>
              <Text style={{ color: '#000000', fontSize: 14, fontWeight: 'bold', marginLeft: 4 }}>QAR</Text>
            </View>
          </View>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: 12, borderRadius: 99 }}>
            <TrendingUp size={32} color="rgba(0,0,0,0.5)" />
          </View>
        </View>

        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Retailer Rates</Text>
      </View>

      <FlatList
        data={groupedData}
        renderItem={({ item }) => <PriceCard provider={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl 
            refreshing={isRefetching} 
            onRefresh={refetch} 
            tintColor="#D4AF37"
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 80 }}>
            <Text style={{ color: '#A0A0A0', fontStyle: 'italic' }}>No price data available.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
