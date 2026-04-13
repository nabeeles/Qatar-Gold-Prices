import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLatestPrices } from '../../hooks/useGoldPrices';
import { Calculator as CalcIcon } from 'lucide-react-native';

const PURITIES = [
  { label: '24K', value: 24 },
  { label: '22K', value: 22 },
  { label: '21K', value: 21 },
  { label: '18K', value: 18 },
];

export default function Calculator() {
  const { data } = useLatestPrices();
  const [weight, setWeight] = useState('10');
  const [selectedPurity, setSelectedPurity] = useState(24);

  const currentRate = useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    
    const today = new Date().toISOString().split('T')[0];
    const rates = data.filter(i => {
      const itemDate = i.scraped_at.split('T')[0];
      return i.karat === selectedPurity && itemDate === today;
    });

    // Fallback: If no data for today, use the latest available records for that karat
    if (rates.length === 0) {
      const latestRates = data.filter(i => i.karat === selectedPurity);
      if (latestRates.length === 0) return 0;
      
      // Take only the most recent timestamp available
      const latestTimestamp = latestRates[0].scraped_at;
      const recentRates = latestRates.filter(i => i.scraped_at === latestTimestamp);
      return recentRates.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0) / recentRates.length;
    }

    return rates.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0) / rates.length;
  }, [data, selectedPurity]);

  const totalValue = useMemo(() => {
    const w = parseFloat(weight) || 0;
    return (w * currentRate).toFixed(2);
  }, [weight, currentRate]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}>
        <Text style={{ color: '#A0A0A0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 4, marginBottom: 4, fontWeight: '600' }}>
          Estimation Tool
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', marginBottom: 32 }}>Calculator</Text>

        {/* Display Card */}
        <View style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderRadius: 24, padding: 32, marginBottom: 32, alignItems: 'center' }}>
          <Text style={{ color: '#A0A0A0', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 }}>
            Estimated Value
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 }}>
            <Text style={{ color: '#D4AF37', fontSize: 48, fontWeight: '900' }}>{totalValue}</Text>
            <Text style={{ color: '#D4AF37', fontSize: 18, fontWeight: 'bold', marginLeft: 8 }}>QAR</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Based on current market average</Text>
        </View>

        {/* Input Section */}
        <View>
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 'bold', uppercase: 'true', marginBottom: 12, marginLeft: 4 }}>
              Gold Weight (Grams)
            </Text>
            <View style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={{ flex: 1, color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' }}
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
                placeholder="0.00"
                placeholderTextColor="#444"
              />
              <Text style={{ color: '#D4AF37', fontWeight: 'bold', marginLeft: 8 }}>g</Text>
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 'bold', uppercase: 'true', marginBottom: 12, marginLeft: 4 }}>
              Select Purity
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {PURITIES.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  onPress={() => setSelectedPurity(p.value)}
                  style={{
                    flex: 1,
                    marginHorizontal: 4,
                    paddingVertical: 16,
                    borderRadius: 16,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: selectedPurity === p.value ? '#D4AF37' : '#333',
                    backgroundColor: selectedPurity === p.value ? '#D4AF37' : '#1A1A1A'
                  }}
                >
                  <Text style={{ 
                    fontWeight: 'bold', 
                    fontSize: 18,
                    color: selectedPurity === p.value ? '#000000' : '#FFFFFF'
                  }}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Info Box */}
        <View style={{ marginTop: 40, padding: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(212,175,55,0.2)', padding: 8, borderRadius: 8, marginRight: 16 }}>
            <CalcIcon size={20} color="#D4AF37" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 20 }}>
              Current rate used: <Text style={{ color: '#D4AF37', fontWeight: 'bold' }}>{currentRate.toFixed(2)} QAR/g</Text> for {selectedPurity}K gold.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
