import React, { useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Dimensions, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHistoricalPrices } from '../../hooks/useGoldPrices';
import { formatCurrency } from '../../lib/format';
import { filterHistoricalByTimeframe } from '../../lib/priceUtils';
import { LineChart } from 'react-native-wagmi-charts';
import { LineChart as ChartIcon, Calendar } from 'lucide-react-native';

const TIMEFRAMES = [
  { label: '1W', value: '7d' },
  { label: '1M', value: '30d' },
  { label: '1Y', value: '365d' },
];

const PURITIES = [
  { label: '24K', value: 24 },
  { label: '22K', value: 22 },
  { label: '21K', value: 21 },
  { label: '18K', value: 18 },
];

/**
 * Trends Screen Component.
 * 
 * Displays historical gold price movements using interactive charts.
 * Features:
 * 1. Timeframe selection (1 Week, 1 Month, 1 Year).
 * 2. Purity selection (18K, 21K, 22K, 24K).
 * 3. Interactive line chart with price and date tooltips on scrub.
 * 4. Dynamic market insights based on current trend data.
 */
export default function Trends() {
  const [selectedPurity, setSelectedPurity] = useState(24);
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const { data, isLoading, error, refetch, isRefetching } = useHistoricalPrices(selectedPurity);

  // Filter and format data based on selected timeframe for the chart
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    
    try {
      return filterHistoricalByTimeframe(data, selectedTimeframe);
    } catch (err) {
      console.error('Error processing chart data:', err);
      return [];
    }
  }, [data, selectedTimeframe]);

  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { current: 0, high: 0, low: 0, change: 0, percent: 0, latestTimestamp: 0 };
    }
    const values = chartData.map(d => d.value);
    const first = values[0];
    const current = values[values.length - 1];
    const high = Math.max(...values);
    const low = Math.min(...values);
    const change = current - first;
    const percent = first > 0 ? (change / first) * 100 : 0;
    const latestTimestamp = chartData[chartData.length - 1]?.timestamp || 0;
    return { current, high, low, change, percent, latestTimestamp };
  }, [chartData]);

  const defaultPriceText = `QAR ${formatCurrency(stats.current)}`;
  const defaultDateText = stats.latestTimestamp
    ? new Date(stats.latestTimestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const yRange = useMemo(() => {
    if (chartData.length > 1 && stats.high === stats.low) {
      return {
        min: Math.max(0, stats.low - 1),
        max: stats.high + 1,
      };
    }
    return undefined;
  }, [chartData.length, stats.high, stats.low]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#F87171', marginBottom: 16, textAlign: 'center' }}>
          Error loading data: {(error as Error).message}
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          style={{ backgroundColor: '#D4AF37', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}
        >
          <Text style={{ color: '#000000', fontWeight: 'bold' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#D4AF37"
          />
        }
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
          <Text style={{ color: '#A0A0A0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 4, marginBottom: 4, fontWeight: '600' }}>
            Market Analytics
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', marginBottom: 32 }}>Trends</Text>

          {/* Timeframe & Purity Selectors */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', backgroundColor: '#1A1A1A', padding: 4, borderRadius: 12, borderWidth: 1, borderColor: '#333' }}>
              {PURITIES.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  onPress={() => setSelectedPurity(p.value)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: selectedPurity === p.value ? '#D4AF37' : 'transparent'
                  }}
                >
                  <Text style={{ 
                    fontSize: 10, 
                    fontWeight: 'bold', 
                    color: selectedPurity === p.value ? '#000000' : '#A0A0A0'
                  }}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', backgroundColor: '#1A1A1A', padding: 4, borderRadius: 12, borderWidth: 1, borderColor: '#333' }}>
              {TIMEFRAMES.map((tf) => (
                <TouchableOpacity
                  key={tf.value}
                  onPress={() => setSelectedTimeframe(tf.value)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: selectedTimeframe === tf.value ? '#D4AF37' : 'transparent'
                  }}
                >
                  <Text style={{ 
                    fontSize: 10, 
                    fontWeight: 'bold', 
                    color: selectedTimeframe === tf.value ? '#000000' : '#A0A0A0'
                  }}>
                    {tf.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Interactive Chart Container */}
          <View style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderRadius: 24, padding: 20, marginBottom: 24 }}>
            {chartData.length > 1 ? (
              <LineChart.Provider
                key={`${selectedPurity}-${selectedTimeframe}-${chartData.length}`}
                data={chartData}
                yRange={yRange}
              >
                <View style={{ marginBottom: 20 }}>
                  <LineChart.PriceText 
                    format={({ value }) => {
                      'worklet';
                      return value ? `QAR ${parseFloat(value).toFixed(2)}` : defaultPriceText;
                    }}
                    style={{ color: '#D4AF37', fontSize: 28, fontWeight: 'bold' }} 
                  />
                  <LineChart.DatetimeText 
                    style={{ color: '#A0A0A0', fontSize: 14, marginTop: 4 }}
                    options={{
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }}
                    format={({ value, formatted }) => {
                      'worklet';
                      return value > 0 && formatted ? formatted : defaultDateText;
                    }}
                  />
                </View>

                <LineChart height={220} width={Dimensions.get('window').width - 88}>
                  <LineChart.Path color="#D4AF37" width={3}>
                    <LineChart.Gradient color="#D4AF37" opacity={0.2} />
                  </LineChart.Path>
                  <LineChart.CursorCrosshair color="#D4AF37">
                    <LineChart.Tooltip />
                  </LineChart.CursorCrosshair>
                </LineChart>
              </LineChart.Provider>
            ) : (
              <View style={{ height: 280, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
                <ChartIcon size={32} color="#666666" />
                <Text style={{ color: '#A0A0A0', marginTop: 12, textAlign: 'center' }}>
                  No historical price data available for {selectedPurity}K gold yet.
                </Text>
                <TouchableOpacity
                  onPress={() => refetch()}
                  style={{ marginTop: 16, backgroundColor: '#262626', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#404040' }}
                >
                  <Text style={{ color: '#D4AF37', fontSize: 12, fontWeight: '600' }}>Refresh Data</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Period Summary Stats */}
          {chartData.length > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
              <View style={{ flex: 1, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderRadius: 16, padding: 12, marginRight: 8 }}>
                <Text style={{ color: '#A0A0A0', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>Latest</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>{formatCurrency(stats.current)} QAR</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderRadius: 16, padding: 12, marginHorizontal: 4 }}>
                <Text style={{ color: '#A0A0A0', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>High</Text>
                <Text style={{ color: '#4ADE80', fontSize: 14, fontWeight: 'bold' }}>{formatCurrency(stats.high)} QAR</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderRadius: 16, padding: 12, marginLeft: 8 }}>
                <Text style={{ color: '#A0A0A0', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>Low</Text>
                <Text style={{ color: '#F87171', fontSize: 14, fontWeight: 'bold' }}>{formatCurrency(stats.low)} QAR</Text>
              </View>
            </View>
          )}

          {/* Market Context Info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 32 }}>
            <ChartIcon size={16} color="#D4AF37" />
            <Text style={{ color: '#F1E5AC', fontSize: 13, fontWeight: '600', marginLeft: 10 }}>{selectedPurity}K Gold Price per Gram (QAR)</Text>
          </View>

          {/* Insight Box */}
          <View style={{ padding: 24, backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Calendar size={18} color="#D4AF37" />
              <Text style={{ color: '#D4AF37', fontWeight: 'bold', marginLeft: 8 }}>Market Insight</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 20 }}>
              Viewing historical data for the last {TIMEFRAMES.find(t => t.value === selectedTimeframe)?.label.toLowerCase()}. 
              Tap and drag your finger across the chart to see specific prices and dates.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
