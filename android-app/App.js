import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, AppState, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationState } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';

import { openDatabase } from './src/db/database';
import { getStoredPIN } from './src/services/authService';
import LockScreen from './src/screens/LockScreen';
import { ThemeProvider, useColors, useTheme } from './src/ThemeContext';
import { OnboardingProvider } from './src/context/OnboardingContext';
import OnboardingOverlay from './src/components/OnboardingOverlay';

import HomeScreen from './src/screens/HomeScreen';
import EntryScreen from './src/screens/EntryScreen';
import TasksScreen from './src/screens/TasksScreen';
import DiaryScreen from './src/screens/DiaryScreen';
import StatsScreen from './src/screens/StatsScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_TITLES = {
  Home: 'Главная', Tasks: 'Задачи', Diary: 'Записи',
  Stats: 'Статистика', MoreTab: 'Настройки',
};

const TAB_ICONS = {
  Home:    { default: 'home-outline',       active: 'home' },
  Tasks:   { default: 'list-outline',        active: 'list' },
  Diary:   { default: 'book-outline',        active: 'book' },
  Stats:   { default: 'stats-chart-outline', active: 'stats-chart' },
  MoreTab: { default: 'settings-outline',    active: 'settings' },
};

function SharedHeader() {
  const { isDark } = useTheme();
  const state = useNavigationState(s => s);

  const mainRoute = state?.routes?.find(r => r.name === 'Main');
  const tabState = mainRoute?.state;
  const currentTab = tabState?.routes?.[tabState?.index ?? 0]?.name ?? 'Home';
  const title = TAB_TITLES[currentTab] ?? 'Дневник';

  return (
    <LinearGradient
      colors={isDark ? ['#1e2e3d', '#0f1a26'] : ['#3d6b8e', '#2d5070']}
      style={{ paddingTop: 12, paddingBottom: 12, paddingHorizontal: 16 }}
    >
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>{title}</Text>
    </LinearGradient>
  );
}

function HomeTabs() {
  const COLORS = useColors();
  const { isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: isDark ? '#666' : '#999',
        tabBarStyle: {
          backgroundColor: isDark ? '#1a1c2a' : '#fff',
          borderTopColor: isDark ? '#2a2c3a' : '#e8e8e8',
          paddingBottom: 4,
          height: 58,
        },
        tabBarLabelStyle: { fontSize: 11, marginTop: -2 },
        tabBarIcon: ({ focused, color }) => {
          const icon = TAB_ICONS[route.name];
          return <Ionicons name={focused ? icon.active : icon.default} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen}     options={{ tabBarLabel: 'Главная' }} />
      <Tab.Screen name="Tasks"   component={TasksScreen}    options={{ tabBarLabel: 'Задачи' }} />
      <Tab.Screen name="Diary"   component={DiaryScreen}    options={{ tabBarLabel: 'Записи' }} />
      <Tab.Screen name="Stats"   component={StatsScreen}    options={{ tabBarLabel: 'Статистика' }} />
      <Tab.Screen name="MoreTab" component={SettingsScreen} options={{ tabBarLabel: 'Настройки' }} />
    </Tab.Navigator>
  );
}

function MainContent() {
  return (
    <View style={{ flex: 1 }}>
      <SharedHeader />
      <HomeTabs />
    </View>
  );
}

function AppNavigator({ navigationRef }) {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style="light" backgroundColor={isDark ? '#1e2e3d' : '#3d6b8e'} translucent={false} />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            statusBarTranslucent: false,
            headerBackground: () => (
              <LinearGradient
                colors={isDark ? ['#1e2e3d', '#0f1a26'] : ['#3d6b8e', '#2d5070']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              />
            ),
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          }}
        >
          <Stack.Screen name="Main" component={MainContent} options={{ headerShown: false, contentStyle: { paddingTop: 0 } }} />
          <Stack.Screen
            name="Entry"
            component={EntryScreen}
            options={({ route }) => ({
              title: route.params?.editMode ? 'Редактировать запись' : 'Итог дня',
              presentation: 'modal',
            })}
          />
          <Stack.Screen name="Analysis" component={AnalysisScreen} options={{ title: 'AI Анализ' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Настройки' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [isLocked, setIsLocked] = useState(null);
  const navigationRef = useRef(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const init = async () => {
      try { await openDatabase(); } catch (e) { console.error(e); }
      const pin = await getStoredPIN();
      setIsLocked(!!pin);
      setIsReady(true);
    };
    init();
    const sub = Notifications.addNotificationResponseReceivedListener(() => {});
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const wasBackground = appState.current.match(/inactive|background/);
      if (wasBackground && nextState === 'active') {
        const pin = await getStoredPIN();
        if (pin) setIsLocked(true);
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  if (!isReady || isLocked === null) {
    return (
      <LinearGradient
        colors={['#2d5070', '#3d6b8e']}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  return (
    <ThemeProvider>
      <OnboardingProvider navigationRef={navigationRef}>
        <AppNavigator navigationRef={navigationRef} />
        <OnboardingOverlay />
        {isLocked && (
          <View style={StyleSheet.absoluteFill}>
            <LockScreen mode="unlock" onSuccess={() => setIsLocked(false)} />
          </View>
        )}
      </OnboardingProvider>
    </ThemeProvider>
  );
}
