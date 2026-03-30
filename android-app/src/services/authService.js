import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const PIN_KEY = 'diary_pin';
const BIOMETRIC_KEY = 'diary_biometric_enabled';

export async function getStoredPIN() {
  try { return await SecureStore.getItemAsync(PIN_KEY); }
  catch { return null; }
}

export async function storePIN(pin) {
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

export async function deletePIN() {
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
}

export async function getBiometricEnabled() {
  try {
    const val = await SecureStore.getItemAsync(BIOMETRIC_KEY);
    return val === 'true';
  } catch { return false; }
}

export async function setBiometricEnabled(enabled) {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? 'true' : 'false');
}

export async function isBiometricAvailable() {
  try {
    const has = await LocalAuthentication.hasHardwareAsync();
    if (!has) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch { return false; }
}

export async function promptBiometric() {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Войти в Дневник',
      cancelLabel: 'Ввести PIN',
      disableDeviceFallback: true,
    });
    return result.success;
  } catch { return false; }
}
