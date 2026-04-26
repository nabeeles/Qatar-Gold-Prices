import React from 'react';
import { createMaterialTopTabNavigator, MaterialTopTabNavigationOptions, MaterialTopTabNavigationEventMap } from '@react-navigation/material-top-tabs';
import { withLayoutContext } from 'expo-router';
import { LayoutDashboard, Calculator, LineChart, Bell, Briefcase } from 'lucide-react-native';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';

const { Navigator } = createMaterialTopTabNavigator();

// Create a custom Material Top Tab wrapper for Expo Router
export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

export default function TabLayout() {
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      screenOptions={{
        tabBarActiveTintColor: '#D4AF37',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#0A0A0A',
          borderTopColor: '#222',
          height: 60,
        },
        tabBarIndicatorStyle: {
          backgroundColor: '#D4AF37',
          top: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
          textTransform: 'none',
          marginBottom: 5,
        },
        tabBarShowIcon: true,
      }}>
      <MaterialTopTabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <LayoutDashboard size={20} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="trends"
        options={{
          title: 'Trends',
          tabBarIcon: ({ color }) => <LineChart size={20} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="calculator"
        options={{
          title: 'Calculator',
          tabBarIcon: ({ color }) => <Calculator size={20} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="vault"
        options={{
          title: 'My Gold',
          tabBarIcon: ({ color }) => <Briefcase size={20} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <Bell size={20} color={color} />,
        }}
      />
    </MaterialTopTabs>
  );
}
