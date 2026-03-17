import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getRecentEntries, getUser } from '../db/database';
import { analyzeGeneral, analyzePsych, analyzeBalance } from '../services/ai';
import { useColors } from '../ThemeContext';
import MarkdownText from '../components/MarkdownText';

const ANALYSES = [
  { id: 'general7', title: 'Общий анализ (7 дней)', icon: 'analytics-outline', days: 7, type: 'general' },
  { id: 'general30', title: 'Общий анализ (30 дней)', icon: 'analytics-outline', days: 30, type: 'general' },
  { id: 'psych', title: 'Психологический анализ', icon: 'heart-outline', days: 14, type: 'psych' },
  { id: 'balance', title: 'Work-life баланс', icon: 'scale-outline', days: 30, type: 'balance' },
];

export default function AnalysisScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(null);

  const runAnalysis = async (analysis) => {
    const user = await getUser();
    if (!user?.openrouter_key) {
      Alert.alert('Нужен API ключ', 'Для AI анализа укажи OpenRouter API ключ в настройках.', [
        { text: 'Отмена' },
        { text: 'Настройки', onPress: () => navigation.navigate('Settings') },
      ]);
      return;
    }
    setLoading(analysis.id);
    try {
      const entries = await getRecentEntries(analysis.days);
      if (entries.length < 2) {
        Alert.alert('Мало данных', `Нужно минимум 2 записи. У тебя: ${entries.length}.`);
        setLoading(null);
        return;
      }
      let result;
      if (analysis.type === 'general') result = await analyzeGeneral(entries, analysis.days, user, user.openrouter_key);
      else if (analysis.type === 'psych') result = await analyzePsych(entries, analysis.days, user, user.openrouter_key);
      else if (analysis.type === 'balance') result = await analyzeBalance(entries, user, user.openrouter_key);
      setResults(prev => ({ ...prev, [analysis.id]: result }));
    } catch (e) {
      Alert.alert('Ошибка AI', e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={styles.headerNote}>
        AI анализирует твои записи дневника и даёт конкретные выводы.
        Требует OpenRouter API ключ.
      </Text>

      {ANALYSES.map(analysis => (
        <View key={analysis.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name={analysis.icon} size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.cardTitle}>{analysis.title}</Text>
            <TouchableOpacity
              style={[styles.runBtn, loading === analysis.id && styles.runBtnDisabled]}
              onPress={() => runAnalysis(analysis)}
              disabled={!!loading}
            >
              {loading === analysis.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.runBtnText}>{results[analysis.id] ? 'Обновить' : 'Запустить'}</Text>
              )}
            </TouchableOpacity>
          </View>
          {results[analysis.id] && (
            <View style={styles.resultBox}>
              <MarkdownText text={results[analysis.id]} style={styles.resultText} />
            </View>
          )}
        </View>
      ))}

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
        <Text style={styles.infoText}>
          Используется модель Gemini 2.5 Flash через OpenRouter.
          Получи бесплатный ключ на openrouter.ai
        </Text>
      </View>
    </ScrollView>
  );
}

function createStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    headerNote: { fontSize: 13, color: C.textSecondary, lineHeight: 18, marginBottom: 16 },
    card: { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardIcon: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center',
    },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
    runBtn: {
      backgroundColor: C.primary, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 8, minWidth: 90, alignItems: 'center',
    },
    runBtnDisabled: { opacity: 0.6 },
    runBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
    resultBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
    resultText: { fontSize: 14, color: C.text, lineHeight: 22 },
    infoCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: C.primaryLight, borderRadius: 12, padding: 14, marginTop: 4,
    },
    infoText: { flex: 1, fontSize: 13, color: C.text, lineHeight: 18 },
  });
}
