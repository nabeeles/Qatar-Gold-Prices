import React, { useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHistoricalPrices } from '../../hooks/useGoldPrices';
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
  const { data, isLoading, error } = useHistoricalPrices(selectedPurity);

  // Filter and format data based on selected timeframe for the chart
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    
    try {
      const now = Date.now();
      let cutoff = 0;
      
      if (selectedTimeframe === '7d') cutoff = now - (7 * 24 * 60 * 60 * 1000);
      else if (selectedTimeframe === '30d') cutoff = now - (30 * 24 * 60 * 60 * 1000);
      else if (selectedTimeframe === '365d') cutoff = now - (365 * 24 * 60 * 60 * 1000);
      
      return data
        .filter(d => d && d.timestamp >= cutoff)
        .map(d => ({
          timestamp: d.timestamp,
          value: Number(d.value) || 0
        }));
    } catch (err) {
      console.error('Error processing chart data:', err);
      return [];
    }
  }, [data, selectedTimeframe]);

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
        <Text style={{ color: 'red' }}>Error loading data: {(error as Error).message}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
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
              <LineChart.Provider data={chartData}>
                <View style={{ marginBottom: 20 }}>
                  <LineChart.PriceText 
                    format={({ value }) => {
                      'worklet';
                      return value ? `QAR ${parseFloat(value).toFixed(2)}` : '--';
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
              <View style={{ height: 280, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color="#D4AF37" />
                <Text style={{ color: '#A0A0A0', marginTop: 12 }}>Optimizing market data...</Text>
              </View>
            )}
          </View>

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
