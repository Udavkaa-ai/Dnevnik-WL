import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import {
  getStoredPIN, storePIN, deletePIN,
  getBiometricEnabled, isBiometricAvailable, promptBiometric,
} from '../services/authService';

// mode: 'unlock' | 'setup' | 'change' | 'disable'
// onSuccess(pin?) — called when action completed
// onCancel — called on cancel (not available in 'unlock' mode)
export default function LockScreen({ mode = 'unlock', onSuccess, onCancel }) {
  const { isDark } = useTheme();

  // Internal step for multi-stage flows
  // unlock:  'enter'
  // setup:   'new' → 'confirm'
  // change:  'verify' → 'new' → 'confirm'
  // disable: 'verify'
  const [step, setStep] = useState(() => {
    if (mode === 'unlock' || mode === 'disable') return 'verify';
    if (mode === 'setup') return 'new';
    if (mode === 'change') return 'verify';
    return 'verify';
  });
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState(''); // stores first entry during confirm step
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mode === 'unlock') {
      checkBiometric();
    }
  }, [mode]);

  const checkBiometric = async () => {
    const available = await isBiometricAvailable();
    const enabled = await getBiometricEnabled();
    setBiometricAvailable(available);
    setBiometricEnabled(enabled);
    if (available && enabled) {
      triggerBiometric();
    }
  };

  const triggerBiometric = async () => {
    const success = await promptBiometric();
    if (success) onSuccess?.();
  };

  const shake = () => {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleDigit = useCallback(async (digit) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');
    if (newPin.length < 4) return;

    // PIN is complete — evaluate
    setTimeout(async () => {
      if (mode === 'unlock' || mode === 'disable') {
        // Verify against stored PIN
        const stored = await getStoredPIN();
        if (newPin === stored) {
          if (mode === 'disable') {
            await deletePIN();
          }
          onSuccess?.(newPin);
        } else {
          shake();
          setError('Неверный PIN');
          setPin('');
        }
      } else if (mode === 'setup') {
        if (step === 'new') {
          setFirstPin(newPin);
          setPin('');
          setStep('confirm');
        } else if (step === 'confirm') {
          if (newPin === firstPin) {
            await storePIN(newPin);
            onSuccess?.(newPin);
          } else {
            shake();
            setError('PIN не совпадает. Попробуй снова');
            setPin('');
            setFirstPin('');
            setStep('new');
          }
        }
      } else if (mode === 'change') {
        if (step === 'verify') {
          const stored = await getStoredPIN();
          if (newPin === stored) {
            setPin('');
            setStep('new');
          } else {
            shake();
            setError('Неверный PIN');
            setPin('');
          }
        } else if (step === 'new') {
          setFirstPin(newPin);
          setPin('');
          setStep('confirm');
        } else if (step === 'confirm') {
          if (newPin === firstPin) {
            await storePIN(newPin);
            onSuccess?.(newPin);
          } else {
            shake();
            setError('PIN не совпадает. Попробуй снова');
            setPin('');
            setFirstPin('');
            setStep('new');
          }
        }
      }
    }, 80);
  }, [pin, step, firstPin, mode]);

  const handleBackspace = () => {
    setPin(p => p.slice(0, -1));
    setError('');
  };

  const getTitle = () => {
    if (mode === 'unlock') return 'Дневник';
    if (mode === 'setup') return 'Установить PIN';
    if (mode === 'disable') return 'Отключить PIN';
    if (mode === 'change') return 'Изменить PIN';
    return '';
  };

  const getSubtitle = () => {
    if (mode === 'unlock') return 'Введи PIN для входа';
    if (mode === 'setup') {
      return step === 'new' ? 'Введи новый PIN' : 'Повтори PIN';
    }
    if (mode === 'disable') return 'Введи текущий PIN';
    if (mode === 'change') {
      if (step === 'verify') return 'Введи текущий PIN';
      if (step === 'new') return 'Введи новый PIN';
      return 'Повтори новый PIN';
    }
    return '';
  };

  const gradientColors = isDark
    ? ['#0f1a26', '#161520']
    : ['#2d5070', '#3d6b8e'];

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {mode !== 'unlock' && onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
            <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}
        <Ionicons
          name={mode === 'unlock' ? 'lock-closed' : 'keypad-outline'}
          size={48}
          color="rgba(255,255,255,0.9)"
          style={styles.lockIcon}
        />
        <Text style={styles.title}>{getTitle()}</Text>
        <Text style={styles.subtitle}>{getSubtitle()}</Text>
      </View>

      {/* PIN dots */}
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
            ]}
          />
        ))}
      </Animated.View>

      {/* Error */}
      <Text style={styles.errorText}>{error}</Text>

      {/* Numpad */}
      <View style={styles.numpad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row, ri) => (
          <View key={ri} style={styles.numRow}>
            {row.map(d => (
              <TouchableOpacity
                key={d}
                style={styles.numBtn}
                onPress={() => handleDigit(d)}
                activeOpacity={0.7}
              >
                <Text style={styles.numText}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Bottom row: biometric | 0 | backspace */}
        <View style={styles.numRow}>
          {mode === 'unlock' && biometricAvailable && biometricEnabled ? (
            <TouchableOpacity style={styles.numBtn} onPress={triggerBiometric} activeOpacity={0.7}>
              <Ionicons name="finger-print-outline" size={30} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          ) : (
            <View style={styles.numBtn} />
          )}
          <TouchableOpacity style={styles.numBtn} onPress={() => handleDigit('0')} activeOpacity={0.7}>
            <Text style={styles.numText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.numBtn}
            onPress={handleBackspace}
            onLongPress={() => setPin('')}
            activeOpacity={0.7}
          >
            <Ionicons name="backspace-outline" size={26} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  cancelBtn: {
    position: 'absolute',
    top: -60,
    right: -140,
    padding: 8,
  },
  lockIcon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  errorText: {
    fontSize: 13,
    color: '#ff8a8a',
    height: 20,
    marginBottom: 24,
  },
  numpad: {
    gap: 12,
  },
  numRow: {
    flexDirection: 'row',
    gap: 20,
  },
  numBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numText: {
    fontSize: 28,
    fontWeight: '400',
    color: '#fff',
  },
});
