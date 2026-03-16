import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import { openDatabase } from './src/db/database';
import { COLORS } from './src/theme';

import HomeScreen from './src/screens/HomeScreen';
import EntryScreen from './src/screens/EntryScreen';
import TasksScreen from './src/screens/TasksScreen';
import DiaryScreen from './src/screens/DiaryScreen';
import StatsScreen from './src/screens/StatsScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeTabs() {
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
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11 },
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '700' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Главная', headerTitle: 'Дневник' }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ title: 'Задачи' }} />
      <Tab.Screen name="Diary" component={DiaryScreen} options={{ title: 'Записи' }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ title: 'Статистика' }} />
      <Tab.Screen
        name="MoreTab"
        component={SettingsScreen}
        options={{
          title: 'Ещё',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    // Initialize database on startup
    openDatabase().catch(console.error);

    // Handle notification tap
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // Could navigate to specific screen here
    });

    return () => sub.remove();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.surface },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen
          name="Main"
          component={HomeTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Entry"
          component={EntryScreen}
          options={({ route }) => ({
            title: route.params?.editMode ? 'Редактировать запись' : 'Итог дня',
            presentation: 'modal',
          })}
        />
        <Stack.Screen
          name="Analysis"
          component={AnalysisScreen}
          options={{ title: 'AI Анализ' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Настройки' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
