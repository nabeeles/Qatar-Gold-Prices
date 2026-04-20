import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { registerForPushNotificationsAsync } from '../../lib/notifications';
import { Bell } from 'lucide-react-native';

/**
 * Alerts Screen Component.
 * 
 * Provides a specialized interface for users to establish price thresholds for automated notifications.
 * 
 * Functional Capabilities:
 * 1. Notification Registration: Synchronizes the device with the Expo Push Notification service.
 * 2. Persistence Logic: Securely stores price alert configurations (karat, target price, condition) in the remote Supabase database.
 * 3. Identity Verification: Links alert configurations to the user's secure anonymous session identifier.
 * 4. Validation: Enforces data integrity checks for price inputs and notification permissions.
 * 
 * @component Alerts
 * @returns {JSX.Element} - The rendered price alert configuration interface.
 */
export default function Alerts() {
  const [targetPrice, setTargetPrice] = useState('');
  const [karat, setKarat] = useState(24);
  const [condition, setCondition] = useState<'above' | 'below'>('below');
  const [isSettingUp, setIsSettingUp] = useState(false);

  const handleSaveAlert = async () => {
    if (!targetPrice) {
      Alert.alert('Error', 'Please enter a target price.');
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
        target_price: parseFloat(targetPrice),
        condition,
        expo_push_token: token,
      });

      if (error) throw error;

      Alert.alert('Success', `Alert set for ${karat}K gold ${condition} ${targetPrice} QAR.`);
      setTargetPrice('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSettingUp(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}>
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

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12 }}>Notify me when price is</Text>
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
              <TouchableOpacity 
                onPress={() => setCondition('below')}
                style={{ flex: 1, py: 12, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: condition === 'below' ? '#D4AF37' : 'transparent' }}
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

          <View style={{ marginBottom: 24, flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12 }}>Karat</Text>
                <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16 }}>
                    <TextInput 
                        style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 }}
                        keyboardType="numeric"
                        value={karat.toString()}
                        onChangeText={(v) => setKarat(parseInt(v) || 24)}
                    />
                </View>
            </View>
            <View style={{ flex: 2, marginLeft: 8 }}>
                <Text style={{ color: '#A0A0A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12 }}>Price (QAR)</Text>
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
          </View>

          <TouchableOpacity 
            onPress={handleSaveAlert}
            disabled={isSettingUp}
            style={{ backgroundColor: '#D4AF37', paddingVertical: 20, borderRadius: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#000000', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              {isSettingUp ? 'SETTING UP...' : 'ACTIVATE ALERT'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={{ padding: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
           <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 20, fontStyle: 'italic', textAlign: 'center' }}>
             Alerts are sent via Push Notifications when the hourly market scan detects your target price.
           </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
