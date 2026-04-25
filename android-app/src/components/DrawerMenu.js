import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  Dimensions, Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDrawer } from '../context/DrawerContext';
import { useColors, useTheme } from '../ThemeContext';

const DRAWER_WIDTH = 285;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MENU_ITEMS = [
  { key: 'Home',     label: 'Главная',              icon: 'home-outline',         iconActive: 'home' },
  { key: 'Tasks',    label: 'Задачи',               icon: 'list-outline',         iconActive: 'list' },
  { key: 'Diary',    label: 'Записи',               icon: 'book-outline',         iconActive: 'book' },
  { key: 'Stats',    label: 'Статистика',            icon: 'stats-chart-outline',  iconActive: 'stats-chart' },
  { key: 'Analysis', label: 'AI Анализ',             icon: 'analytics-outline',    iconActive: 'analytics' },
  { key: 'MoreTab',  label: 'Настройки',             icon: 'settings-outline',     iconActive: 'settings' },
];

export default function DrawerMenu() {
  const { drawerOpen, setDrawerOpen } = useDrawer();
  const COLORS = useColors();
  const { isDark } = useTheme();
  const navigation = useNavigation();

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const pointerEvents = useRef('none');

  useEffect(() => {
    if (drawerOpen) {
      pointerEvents.current = 'auto';
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0, duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1, duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH, duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0, duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => { pointerEvents.current = 'none'; });
    }
  }, [drawerOpen]);

  const close = () => setDrawerOpen(false);

  const navigate = (screenKey) => {
    close();
    // Small delay so the animation closes first
    setTimeout(() => {
      if (screenKey === 'Analysis') {
        navigation.navigate('Analysis');
      } else {
        navigation.navigate('Main', { screen: screenKey });
      }
    }, 180);
  };

  if (!drawerOpen && translateX._value === -DRAWER_WIDTH) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={drawerOpen ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={isDark ? ['#1e2e3d', '#0f1a26'] : ['#3d6b8e', '#2d5070']}
          style={styles.panelHeader}
        >
          <Text style={styles.appName}>Дневник</Text>
          <Text style={styles.appSub}>Личный органайзер</Text>
        </LinearGradient>

        <View style={[styles.panelBody, { backgroundColor: isDark ? '#1a1c2a' : '#fff' }]}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.menuItem}
              onPress={() => navigate(item.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: COLORS.primaryLight }]}>
                <Ionicons name={item.icon} size={20} color={COLORS.primary} />
              </View>
              <Text style={[styles.menuLabel, { color: isDark ? '#e8eaf0' : '#222' }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={[styles.divider, { backgroundColor: COLORS.border }]} />

          <TouchableOpacity style={styles.menuItem} onPress={close} activeOpacity={0.7}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#f0f0f0' }]}>
              <Ionicons name="close-outline" size={20} color="#888" />
            </View>
            <Text style={[styles.menuLabel, { color: '#888' }]}>Закрыть меню</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  panel: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  panelHeader: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  appName: {
    fontSize: 22, fontWeight: '700', color: '#fff',
    letterSpacing: 0.3,
  },
  appSub: {
    fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2,
  },
  panelBody: {
    flex: 1, paddingTop: 8, paddingBottom: 24,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    gap: 14,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: {
    fontSize: 15, fontWeight: '500',
  },
  divider: {
    height: 1, marginHorizontal: 16, marginVertical: 8,
  },
});
