import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Animated, AppState, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
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
import { DrawerProvider, useDrawer } from './src/context/DrawerContext';
import DrawerMenu from './src/components/DrawerMenu';

import HomeScreen from './src/screens/HomeScreen';
import EntryScreen from './src/screens/EntryScreen';
import TasksScreen from './src/screens/TasksScreen';
import DiaryScreen from './src/screens/DiaryScreen';
import StatsScreen from './src/screens/StatsScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AnimatedTabButton({ children, onPress, onLongPress, style }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    onPress && onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} onLongPress={onLongPress} style={style} activeOpacity={1}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

function HomeTabs() {
  const COLORS = useColors();
  const { isDark } = useTheme();
  const { setDrawerOpen } = useDrawer();

  const gradientColors = isDark ? ['#1e2e3d', '#0f1a26'] : ['#3d6b8e', '#2d5070'];

  const HamburgerBtn = () => (
    <TouchableOpacity
      onPress={() => setDrawerOpen(true)}
      style={{ paddingLeft: 16, paddingRight: 8 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="menu" size={26} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Tasks: focused ? 'list' : 'list-outline',
            Diary: focused ? 'book' : 'book-outline',
            Stats: focused ? 'stats-chart' : 'stats-chart-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: isDark ? '#1a1c2a' : '#fff',
          borderTopColor: isDark ? '#2a2d40' : '#e8e8e8',
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 4,
          height: 64,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarButton: (props) => <AnimatedTabButton {...props} />,
        headerShown: true,
        headerBackground: () => (
          <LinearGradient colors={gradientColors} style={{ flex: 1 }} />
        ),
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerLeft: () => <HamburgerBtn />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Главная' }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ title: 'Задачи' }} />
      <Tab.Screen name="Diary" component={DiaryScreen} options={{ title: 'Записи' }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ title: 'Статистика' }} />
      <Tab.Screen
        name="MoreTab"
        component={SettingsScreen}
        options={{
          title: 'Настройки',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Wraps HomeTabs + DrawerMenu so DrawerMenu can use useNavigation()
function MainWithDrawer() {
  return (
    <DrawerProvider>
      <View style={{ flex: 1 }}>
        <HomeTabs />
        <DrawerMenu />
      </View>
    </DrawerProvider>
  );
}

function AppNavigator({ navigationRef }) {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
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
          <Stack.Screen name="Main" component={MainWithDrawer} options={{ headerShown: false }} />
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
