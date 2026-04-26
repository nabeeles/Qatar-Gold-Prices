import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Briefcase, TrendingUp, TrendingDown, Trash2, Calendar, Info } from 'lucide-react-native';
import { useVault } from '../../hooks/useVault';
import { format } from 'date-fns';

/**
 * My Gold Screen Component
 * 
 * Capability:
 * - Displays the user's gold portfolio summary (Total Value, Gain/Loss).
 * - Lists individual gold holdings with detailed performance metrics.
 * - Allows adding new assets via a structured modal form.
 * 
 * Security: Local-only data processing.
 */
export default function VaultScreen() {
  const { entries, portfolioSummary, isLoading, addEntry, deleteEntry, getAveragePrice } = useVault();
  const [isModalVisible, setIsModalVisible] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading Portfolio...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Gold</Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => setIsModalVisible(true)}
          >
            <Plus size={24} color="#0A0A0A" />
          </TouchableOpacity>
        </View>

        {/* Portfolio Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
              <Text style={styles.totalValue}>{portfolioSummary.totalValue.toLocaleString()} QAR</Text>
            </View>
            <View style={styles.iconCircle}>
              <Briefcase size={24} color="#D4AF37" />
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.summaryLabel}>Total Gain/Loss</Text>
              <View style={styles.priceRow}>
                {portfolioSummary.totalGainLoss >= 0 ? (
                  <TrendingUp size={16} color="#4ADE80" />
                ) : (
                  <TrendingDown size={16} color="#F87171" />
                )}
                <Text style={[
                  styles.gainText, 
                  { color: portfolioSummary.totalGainLoss >= 0 ? '#4ADE80' : '#F87171' }
                ]}>
                  {Math.abs(portfolioSummary.totalGainLoss).toLocaleString()} QAR ({portfolioSummary.totalGainLossPercentage.toFixed(2)}%)
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.disclaimerRow}>
            <Info size={12} color="#666" />
            <Text style={styles.disclaimerText}>Valuation based on market average across all providers.</Text>
          </View>
        </View>

        {/* Entries List */}
        <Text style={styles.sectionTitle}>Your Holdings</Text>
        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Briefcase size={48} color="#222" />
            <Text style={styles.emptyText}>You haven't added any gold yet.</Text>
            <Text style={styles.emptySubtext}>Add your gold purchases to track their value.</Text>
          </View>
        ) : (
          entries.map((entry) => (
            <AssetCard 
              key={entry.id} 
              entry={entry} 
              currentPrice={getAveragePrice(entry.karat)} 
              onDelete={() => deleteEntry(entry.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Add Asset Modal */}
      <AddAssetModal 
        visible={isModalVisible} 
        onClose={() => setIsModalVisible(false)} 
        onSave={(data) => {
          addEntry(data);
          setIsModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

function AssetCard({ entry, currentPrice, onDelete }: { entry: any, currentPrice: number, onDelete: () => void }) {
  const currentValue = currentPrice * entry.weight;
  const costBasis = entry.price_per_gram * entry.weight;
  const gainLoss = currentValue - costBasis;

  return (
    <View style={styles.assetCard}>
      <View style={styles.assetHeader}>
        <View>
          <Text style={styles.assetLabel}>{entry.label || `${entry.karat}K Gold`}</Text>
          <Text style={styles.assetSubtext}>{entry.weight}g • {entry.karat}K</Text>
        </View>
        <TouchableOpacity onPress={onDelete}>
          <Trash2 size={18} color="#666" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.assetBody}>
        <View>
          <Text style={styles.assetPriceLabel}>Current Value</Text>
          <Text style={styles.assetPrice}>{currentValue.toLocaleString()} QAR</Text>
        </View>
        <View style={styles.assetPerformance}>
          <Text style={styles.assetPriceLabel}>Profit/Loss</Text>
          <Text style={[
            styles.assetGain, 
            { color: gainLoss >= 0 ? '#4ADE80' : '#F87171' }
          ]}>
            {gainLoss >= 0 ? '+' : ''}{gainLoss.toLocaleString()} QAR
          </Text>
        </View>
      </View>
      
      <View style={styles.assetFooter}>
        <Calendar size={12} color="#444" />
        <Text style={styles.footerText}>Bought on {format(new Date(entry.purchase_date), 'MMM dd, yyyy')}</Text>
      </View>
    </View>
  );
}

function AddAssetModal({ visible, onClose, onSave }: { visible: boolean, onClose: () => void, onSave: (data: any) => void }) {
  const [label, setLabel] = useState('');
  const [karat, setKarat] = useState(22);
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSave = () => {
    if (!weight || !price) return;
    onSave({
      label,
      karat,
      weight: parseFloat(weight),
      price_per_gram: parseFloat(price),
      purchase_date: date,
    });
    // Reset form
    setLabel('');
    setWeight('');
    setPrice('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Gold Asset</Text>
          
          <Text style={styles.inputLabel}>Label (Optional)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. Wedding Ring" 
            placeholderTextColor="#444"
            value={label}
            onChangeText={setLabel}
          />

          <View style={styles.inputRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.inputLabel}>Karat</Text>
              <View style={styles.karatPicker}>
                {[18, 21, 22, 24].map((k) => (
                  <TouchableOpacity 
                    key={k} 
                    style={[styles.karatOption, karat === k && styles.karatSelected]}
                    onPress={() => setKarat(k)}
                  >
                    <Text style={[styles.karatText, karat === k && styles.karatTextSelected]}>{k}K</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.inputLabel}>Weight (grams)</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                placeholder="0.00" 
                placeholderTextColor="#444"
                value={weight}
                onChangeText={setWeight}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Price per Gram (QAR)</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                placeholder="0.00" 
                placeholderTextColor="#444"
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Purchase Date</Text>
          <TextInput 
            style={styles.input} 
            placeholder="YYYY-MM-DD" 
            placeholderTextColor="#444"
            value={date}
            onChangeText={setDate}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save to Vault</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  addButton: {
    backgroundColor: '#D4AF37',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    textAlign: 'center',
    marginTop: 50,
  },
  summaryCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 30,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#AAA',
    fontSize: 14,
    marginBottom: 5,
  },
  totalValue: {
    color: '#D4AF37',
    fontSize: 32,
    fontWeight: 'bold',
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gainText: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 5,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  disclaimerText: {
    color: '#666',
    fontSize: 10,
    marginLeft: 5,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  assetCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#222',
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  assetLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  assetSubtext: {
    color: '#666',
    fontSize: 12,
  },
  assetBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  assetPriceLabel: {
    color: '#AAA',
    fontSize: 12,
    marginBottom: 2,
  },
  assetPrice: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  assetPerformance: {
    alignItems: 'flex-end',
  },
  assetGain: {
    fontSize: 16,
    fontWeight: '600',
  },
  assetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  footerText: {
    color: '#444',
    fontSize: 11,
    marginLeft: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 25,
    paddingBottom: 40,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputLabel: {
    color: '#AAA',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#222',
  },
  inputRow: {
    flexDirection: 'row',
  },
  karatPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  karatOption: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 5,
    borderWidth: 1,
    borderColor: '#222',
  },
  karatSelected: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  karatText: {
    color: '#AAA',
    fontWeight: 'bold',
  },
  karatTextSelected: {
    color: '#0A0A0A',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 30,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#0A0A0A',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
