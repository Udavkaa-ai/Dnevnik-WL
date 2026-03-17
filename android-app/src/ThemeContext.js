import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_COLORS, DARK_COLORS } from './theme';

const ThemeContext = createContext({
  colors: LIGHT_COLORS,
  themePref: 'auto',
  setThemePref: () => {},
  isDark: false,
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themePref, setThemePrefState] = useState('auto');

  useEffect(() => {
    AsyncStorage.getItem('theme_pref').then(v => {
      if (v) setThemePrefState(v);
    });
  }, []);

  const setThemePref = async (pref) => {
    setThemePrefState(pref);
    await AsyncStorage.setItem('theme_pref', pref);
  };

  const isDark = themePref === 'auto' ? systemScheme === 'dark' : themePref === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeContext.Provider value={{ colors, themePref, setThemePref, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useColors() {
  return useContext(ThemeContext).colors;
}

export function useTheme() {
  return useContext(ThemeContext);
}
