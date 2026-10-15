import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { registerForPushNotificationsAsync } from '../../lib/notifications';
import { formatCurrency } from '../../lib/format';
import { Bell, Trash2 } from 'lucide-react-native';

const KARAT_OPTIONS = [24, 22, 21, 18];

interface PriceAlertRow {
  id: string;
  karat: number;
  target_price: number;
  condition: 'above' | 'below';
  is_active: boolean;
  created_at: string;
}

/**
 * Alerts Screen Component.
 */
export default function Alerts() {
  const queryClient = useQueryClient();
  const [targetPrice, setTargetPrice] = useState('');
  const [karat, setKarat] = useState(24);
  const [condition, setCondition] = useState<'above' | 'below'>('below');
  const [isSettingUp, setIsSettingUp] = useState(false);

  const alertsQuery = useQuery({
    queryKey: ['price-alerts'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('price_alerts')
        .select('id, karat, target_price, condition, is_active, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PriceAlertRow[];
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) return;
      const { error } = await supabase.from('price_alerts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
    },
  });

  const handleSaveAlert = async () => {
    if (!supabase) {
      Alert.alert('Configuration Missing', 'Supabase URL/Key not found. Cloud features are disabled.');
      return;
    }

    const parsedTarget = parseFloat(targetPrice);
    if (!targetPrice || !Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      Alert.alert('Error', 'Please enter a valid target price greater than 0.');
      return;
    }

    setIsSettingUp(true);
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        Alert.alert('Permission Required', 'Please enable notifications to use this feature.');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('price_alerts').insert({
        user_id: user?.id,
        karat,
        target_price: parsedTarget,
        condition,
        expo_push_token: token,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
      Alert.alert('Success', `Alert set for ${karat}K gold ${condition} ${formatCurrency(parsedTarget)} QAR.`);
      setTargetPrice('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleDeleteAlert = (item: PriceAlertRow) => {
    Alert.alert(
      'Delete Alert',
      `Remove alert for ${item.karat}K gold ${item.condition} ${formatCurrency(Number(item.target_price))} QAR?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteAlertMutation.mutate(item.id),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}
        >
          <Text style={{ color: '#A0A0A0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 4, marginBottom: 4, fontWeight: '600' }}>
            Price Monitor
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', marginBottom: 32 }}>Alerts</Text>

          {/* Setup Card */}
          <View style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderRadius: 24, padding: 24, marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <View style={{ backgroundColor: 'rgba(212,175,55,0.2)', padding: 8, borderRadius: 8, marginRight: 12 }}>
                <Bell size={20} color="#D4AF37" />
              </View>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 }}>Create New Alert</Text>
            </View>

            {!supabase && (
              <View style={{ padding: 12, backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 8, marginBottom: 20 }}>
                <Text style={{ color: '#F87171', fontSize: 12, fontWeight: 'bold' }}>Offline Mode: Cloud alerts are disabled due to missing configuration.</Text>
              </View>
            )}

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12 }}>Notify me when price is</Text>
              <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <TouchableOpacity 
                  onPress={() => setCondition('below')}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: condition === 'below' ? '#D4AF37' : 'transparent' }}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 12, color: condition === 'below' ? '#000000' : '#A0A0A0' }}>BELOW</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setCondition('above')}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: condition === 'above' ? '#D4AF37' : 'transparent' }}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 12, color: condition === 'above' ? '#000000' : '#A0A0A0' }}>ABOVE</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12 }}>Select Karat</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {KARAT_OPTIONS.map((k) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setKarat(k)}
                    style={{
                      flex: 1,
                      marginHorizontal: 4,
                      paddingVertical: 14,
                      borderRadius: 14,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: karat === k ? '#D4AF37' : 'rgba(255,255,255,0.08)',
                      backgroundColor: karat === k ? '#D4AF37' : 'rgba(0,0,0,0.3)',
                    }}
                  >
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: karat === k ? '#000000' : '#FFFFFF' }}>
                      {k}K
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12 }}>Target Price (QAR / g)</Text>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16 }}>
                <TextInput 
                  style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 }}
                  placeholder="0.00"
                  placeholderTextColor="#444"
                  keyboardType="numeric"
                  value={targetPrice}
                  onChangeText={setTargetPrice}
                />
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleSaveAlert}
              disabled={isSettingUp || !supabase}
              style={{ backgroundColor: !supabase ? '#444' : '#D4AF37', paddingVertical: 20, borderRadius: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#000000', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                {isSettingUp ? 'SETTING UP...' : 'ACTIVATE ALERT'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Active Alerts Section */}
          {supabase && (
            <View style={{ marginBottom: 28 }}>
              <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, marginLeft: 4 }}>
                Active Alerts
              </Text>
              {alertsQuery.isLoading ? (
                <ActivityIndicator color="#D4AF37" style={{ marginVertical: 16 }} />
              ) : (alertsQuery.data || []).length === 0 ? (
                <View style={{ backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#262626', alignItems: 'center' }}>
                  <Text style={{ color: '#666', fontSize: 13 }}>No active price alerts yet.</Text>
                </View>
              ) : (
                (alertsQuery.data || []).map((item) => (
                  <View
                    key={item.id}
                    style={{
                      backgroundColor: '#1A1A1A',
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: '#2A2A2A',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View>
                      <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
                        {item.karat}K Gold • {item.condition.toUpperCase()} {formatCurrency(Number(item.target_price))} QAR
                      </Text>
                      <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                        Active Push Notification
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteAlert(item)}
                      style={{ padding: 8 }}
                    >
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Info Section */}
          <View style={{ padding: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 20, fontStyle: 'italic', textAlign: 'center' }}>
              Alerts are sent via Push Notifications when the scheduled market scan detects your target price.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
