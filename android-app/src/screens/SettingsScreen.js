import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getUser, updateUser, exportDiary } from '../db/database';
import { scheduleMorningReminder, scheduleEveningReminder, cancelAllReminders, requestPermissions } from '../services/notifications';
import { COLORS } from '../theme';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

const FAMILY_OPTIONS = [
  { value: 'single', label: 'Один/Одна' },
  { value: 'partner', label: 'В отношениях' },
  { value: 'married', label: 'В браке, детей нет' },
  { value: 'children', label: 'Семья с детьми' },
];

function TimeInput({ value, onChange, label }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  const handleBlur = () => {
    const match = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (match) {
      onChange(text);
    } else {
      setText(value);
      Alert.alert('Неверный формат', 'Введи время в формате ЧЧ:ММ, например 09:00');
    }
    setEditing(false);
  };

  return (
    <View style={timeStyles.row}>
      <Text style={timeStyles.label}>{label}</Text>
      <TouchableOpacity onPress={() => setEditing(true)} style={timeStyles.timeBtn}>
        {editing ? (
          <TextInput
            style={timeStyles.input}
            value={text}
            onChangeText={setText}
            onBlur={handleBlur}
            autoFocus
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        ) : (
          <Text style={timeStyles.timeText}>{value}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const timeStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  label: { fontSize: 15, color: COLORS.text },
  timeBtn: {
    backgroundColor: COLORS.primaryLight, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    minWidth: 70, alignItems: 'center',
  },
  timeText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  input: { fontSize: 16, fontWeight: '700', color: COLORS.primary, minWidth: 50, textAlign: 'center' },
});

export default function SettingsScreen() {
  const [user, setUser] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(useCallback(() => {
    loadUser();
  }, []));

  const loadUser = async () => {
    try {
      const u = await getUser();
      setUser(u);
      setApiKey(u?.openrouter_key || '');
      const stored = await AsyncStorage.getItem('notifications_enabled');
      if (stored === 'true') setNotificationsEnabled(true);
    } catch (e) {
      console.log('Settings load error:', e.message);
    }
  };

  const save = async (fields) => {
    await updateUser(fields);
    await loadUser();
  };

  const saveTime = async (field, value) => {
    await save({ [field]: value });
    if (notificationsEnabled) {
      if (field === 'morning_time') await scheduleMorningReminder(value);
      if (field === 'evening_time') await scheduleEveningReminder(value);
    }
    Alert.alert('Сохранено', `${field === 'morning_time' ? 'Утреннее' : 'Вечернее'} время обновлено`);
  };

  const toggleNotifications = async (enabled) => {
    try {
      if (enabled) {
        const granted = await requestPermissions();
        if (!granted) {
          Alert.alert('Нет разрешения', 'Разреши уведомления в настройках системы');
          return;
        }
        await scheduleMorningReminder(user.morning_time);
        await scheduleEveningReminder(user.evening_time);
      } else {
        await cancelAllReminders();
      }
      setNotificationsEnabled(enabled);
      await AsyncStorage.setItem('notifications_enabled', String(enabled));
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    }
  };

  const saveApiKey = async () => {
    await save({ openrouter_key: apiKey.trim() });
    Alert.alert('Сохранено', 'API ключ сохранён');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const text = await exportDiary();
      const fileName = `diary_${new Date().toISOString().split('T')[0]}.txt`;
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, text, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Экспорт дневника',
        });
      } else {
        Alert.alert('Файл сохранён', `Путь: ${fileUri}`);
      }
    } catch (e) {
      Alert.alert('Ошибка экспорта', e.message);
    } finally {
      setExporting(false);
    }
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Уведомления</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Напоминания</Text>
              <Text style={styles.settingHint}>Утром и вечером</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ true: COLORS.primary }}
            />
          </View>
          <View style={styles.divider} />
          <TimeInput
            label="Утреннее уведомление"
            value={user.morning_time}
            onChange={v => saveTime('morning_time', v)}
          />
          <View style={styles.divider} />
          <TimeInput
            label="Вечернее уведомление"
            value={user.evening_time}
            onChange={v => saveTime('evening_time', v)}
          />
        </View>
      </View>

      {/* Profile */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Профиль</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Пол</Text>
          <View style={styles.optionGroup}>
            {GENDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionBtn, user.gender === opt.value && styles.optionBtnActive]}
                onPress={() => save({ gender: opt.value })}
              >
                <Text style={[styles.optionText, user.gender === opt.value && styles.optionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>Семейное положение</Text>
          <View style={styles.optionGroup}>
            {FAMILY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionBtn, user.family_status === opt.value && styles.optionBtnActive]}
                onPress={() => save({ family_status: opt.value })}
              >
                <Text style={[styles.optionText, user.family_status === opt.value && styles.optionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldHint}>Используется для персонализации AI анализа</Text>
        </View>
      </View>

      {/* AI */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI анализ</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>OpenRouter API ключ</Text>
          <View style={styles.apiKeyRow}>
            <TextInput
              style={styles.apiKeyInput}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-or-..."
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowApiKey(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showApiKey ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, !apiKey.trim() && { opacity: 0.5 }]}
            onPress={saveApiKey}
            disabled={!apiKey.trim()}
          >
            <Text style={styles.saveBtnText}>Сохранить ключ</Text>
          </TouchableOpacity>
          <Text style={styles.fieldHint}>
            Получи бесплатный ключ на openrouter.ai{'\n'}
            Используются модели Gemini 2.5 Flash и 2.0 Flash Lite
          </Text>
        </View>
      </View>

      {/* Export */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Данные</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <Ionicons name="download-outline" size={20} color={COLORS.primary} />
            )}
            <Text style={styles.exportBtnText}>
              {exporting ? 'Экспортирую...' : 'Экспортировать дневник (.txt)'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.fieldHint}>
            Все записи будут сохранены как текстовый файл
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, paddingHorizontal: 2,
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, elevation: 2,
  },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6,
  },
  settingLabel: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  settingHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  fieldLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  fieldHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 10, lineHeight: 16 },
  optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  optionBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { fontSize: 13, color: COLORS.text },
  optionTextActive: { color: '#fff', fontWeight: '500' },
  apiKeyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  apiKeyInput: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: 10,
    padding: 12, fontSize: 14, color: COLORS.text,
  },
  eyeBtn: { padding: 8 },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 10,
  },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.primaryLight, borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  exportBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '500' },
});
