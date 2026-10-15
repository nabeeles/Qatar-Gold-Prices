import React from 'react';
import { View, Text } from 'react-native';
import { GoldPrice } from '../hooks/useGoldPrices';
import { formatCurrency } from '../lib/format';

/**
 * Props for the PriceCard component.
 * 
 * @property {Object} provider - Data for the gold price provider.
 * @property {string} provider.name - Name of the provider (e.g., Al Fardan Exchange).
 * @property {string} provider.scraped_at - Timestamp of the most recent scrape.
 * @property {Array<Object>} provider.prices - List of karat/price objects.
 */
interface PriceCardProps {
  provider: {
    name: string;
    scraped_at: string;
    prices: { karat: number; price: number }[];
  };
}

/**
 * A reusable React Native component to display current gold prices for a provider.
 * 
 * Layout Features:
 * - Card-based design with a dark theme (#1A1A1A).
 * - Displays the provider's name and the last update time.
 * - Shows multiple gold karats (e.g., 24K, 22K) in a row.
 * - Highlights prices in a gold-themed color (#D4AF37).
 * - Automatically sorts prices by karat descending.
 * 
 * @param {PriceCardProps} props - Component properties.
 * @returns {JSX.Element} - Rendered card UI.
 */
export function PriceCard({ provider }: PriceCardProps) {
  const formattedDate = provider.scraped_at ? new Date(provider.scraped_at).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  }) : '--:--';

  // Sort prices by karat descending (24, 22, 21, 18)
  const sortedPrices = [...provider.prices].sort((a, b) => b.karat - a.karat);

  return (
    <View style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: '#A0A0A0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '500' }}>
          {provider.name}
        </Text>
        <Text style={{ color: '#A0A0A0', fontSize: 10 }}>
          {formattedDate}
        </Text>
      </View>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {sortedPrices.map((p, index) => (
          <View key={p.karat} style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ color: '#F1E5AC', fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>
              {p.karat}K
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ color: '#D4AF37', fontSize: 22, fontWeight: 'bold' }}>
                {formatCurrency(p.price)}
              </Text>
            </View>
            {index === 0 && (
              <Text style={{ color: '#FFFFFF', opacity: 0.4, fontSize: 8, marginTop: 4 }}>QAR / GRAM</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
