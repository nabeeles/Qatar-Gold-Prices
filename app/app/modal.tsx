import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ShieldCheck, Database, Bell, Info } from 'lucide-react-native';

/**
 * In-App Privacy, Data Sovereignty & Financial Disclaimer Modal.
 * Provides transparent disclosure required for Google Play Store compliance.
 */
export default function ModalScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <ShieldCheck size={32} color="#D4AF37" />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.heroTitle}>Privacy-First Architecture</Text>
          <Text style={styles.heroSubtitle}>
            Your personal gold portfolio never leaves your device.
          </Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Database size={18} color="#D4AF37" />
          <Text style={styles.sectionTitle}>100% Local Portfolio Storage</Text>
        </View>
        <Text style={styles.bodyText}>
          All gold holdings entered in the "My Gold" vault—including weights, karats, labels, purchase prices, and dates—are stored exclusively in an on-device SQLite database sandbox (vault.db). Android Auto Backup is disabled for this database so your holdings are never uploaded to external cloud servers.
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Bell size={18} color="#D4AF37" />
          <Text style={styles.sectionTitle}>Anonymous Market Feeds & Alerts</Text>
        </View>
        <Text style={styles.bodyText}>
          Live Qatari retail gold rates are fetched using an anonymous session token with Row-Level Security (RLS). If you opt in to price alerts, only your Expo Push Token, selected karat, and target price threshold are stored to deliver the notification. No name, email, phone number, or location data is collected.
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Info size={18} color="#D4AF37" />
          <Text style={styles.sectionTitle}>Market Information Disclaimer</Text>
        </View>
        <Text style={styles.bodyText}>
          Qatar Gold Price Tracker is an informational price comparison and personal portfolio calculation tool. Displayed rates are aggregated from public Qatari jewelry retailers and exchanges for reference only and do not constitute financial, investment, or trading advice. Retail making charges and taxes vary by store.
        </Text>
      </View>

      <StatusBar style="light" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderColor: 'rgba(212, 175, 55, 0.35)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#A0A0A0',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#141414',
    borderColor: '#222222',
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  bodyText: {
    color: '#A0A0A0',
    fontSize: 13,
    lineHeight: 20,
  },
});
