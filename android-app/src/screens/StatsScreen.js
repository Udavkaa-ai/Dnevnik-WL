import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { getMoodData, getTaskStats } from '../db/database';
import { useColors, useTheme } from '../ThemeContext';
import { useOnboarding } from '../context/OnboardingContext';

const screenWidth = Dimensions.get('window').width;

function avg(arr) {
  if (!arr.length) return 0;
  return (arr.reduce((s, n) => s + n, 0) / arr.length).toFixed(1);
}

function StatBox({ label, value, suffix = '', color, textColor }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: color || textColor }}>{value}{suffix}</Text>
      <Text style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const COLORS = useColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { registerRef } = useOnboarding();

  const [moodData, setMoodData] = useState([]);
  const [taskStats, setTaskStats] = useState(null);
  const [taskStats30, setTaskStats30] = useState(null);
  const [period, setPeriod] = useState(14);

  useFocusEffect(useCallback(() => { loadData(); }, [period]));

  const loadData = async () => {
    try {
      const [md, ts7, ts30] = await Promise.all([
        getMoodData(period),
        getTaskStats(7),
        getTaskStats(30),
      ]);
      setMoodData(md.reverse());
      setTaskStats(ts7);
      setTaskStats30(ts30);
    } catch (e) {
      console.log('Stats load error:', e.message);
    }
  };

  const chartData = moodData.filter(d => d.mood_score != null);
  const hasChart = chartData.length >= 2;
  const scores = chartData.map(d => d.mood_score);
  const labels = chartData.map(d => {
    const parts = d.date.split('-');
    return `${parts[2]}.${parts[1]}`;
  });
  const labelInterval = Math.ceil(labels.length / 6);
  const sparseLabels = labels.map((l, i) => i % labelInterval === 0 ? l : '');

  const completionRate = (stats) => {
    if (!stats || !stats.total) return 0;
    return Math.round((stats.done / stats.total) * 100);
  };

  return (
    <LinearGradient
      colors={isDark ? ['#161520', '#1a1830'] : ['#f9f5eb', '#ede8da']}
      style={{ flex: 1 }}
    >
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <View style={styles.periodSelector}>
        {[7, 14, 30].map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
              {p} дней
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View ref={registerRef('statsChart')} collapsable={false} style={styles.card}>
        <Text style={styles.cardTitle}>График настроения</Text>
        {hasChart ? (
          <>
            <LineChart
              data={{
                labels: sparseLabels,
                datasets: [{ data: scores, color: () => COLORS.primary, strokeWidth: 2 }],
              }}
              width={screenWidth - 64}
              height={180}
              yAxisSuffix=""
              yAxisInterval={1}
              fromZero={false}
              chartConfig={{
                backgroundColor: COLORS.surface,
                backgroundGradientFrom: COLORS.surface,
                backgroundGradientTo: COLORS.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(108, 99, 255, ${opacity})`,
                labelColor: () => COLORS.textSecondary,
                style: { borderRadius: 16 },
                propsForDots: { r: '4', strokeWidth: '2', stroke: COLORS.primary },
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 16 }}
            />
            <View style={styles.statsRow}>
              <StatBox label="Среднее" value={avg(scores)} suffix="/10" textColor={COLORS.text} />
              <StatBox label="Макс" value={Math.max(...scores)} suffix="/10" textColor={COLORS.text} />
              <StatBox label="Мин" value={Math.min(...scores)} suffix="/10" textColor={COLORS.text} />
              <StatBox label="Записей" value={scores.length} textColor={COLORS.text} />
            </View>
          </>
        ) : (
          <Text style={styles.noDataText}>Нужно минимум 2 записи с оценкой дня для графика</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Выполнение задач (7 дней)</Text>
        {taskStats && taskStats.total > 0 ? (
          <>
            <View style={styles.completionBar}>
              <View style={[styles.completionFill, { width: `${completionRate(taskStats)}%` }]} />
            </View>
            <Text style={styles.completionText}>{completionRate(taskStats)}% выполнено</Text>
            <View style={styles.statsRow}>
              <StatBox label="Всего" value={taskStats.total} textColor={COLORS.text} />
              <StatBox label="Выполнено" value={taskStats.done} color="#4caf50" textColor={COLORS.text} />
              <StatBox label="Перенесено" value={taskStats.moved} color="#ff9800" textColor={COLORS.text} />
              <StatBox label="Отменено" value={taskStats.cancelled} color="#f44336" textColor={COLORS.text} />
            </View>
          </>
        ) : (
          <Text style={styles.noDataText}>Нет данных за 7 дней</Text>
        )}
      </View>

      {taskStats30 && taskStats30.total > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Выполнение задач (30 дней)</Text>
          <View style={styles.completionBar}>
            <View style={[styles.completionFill, { width: `${completionRate(taskStats30)}%` }]} />
          </View>
          <Text style={styles.completionText}>{completionRate(taskStats30)}% выполнено</Text>
          <View style={styles.statsRow}>
            <StatBox label="Всего" value={taskStats30.total} textColor={COLORS.text} />
            <StatBox label="Выполнено" value={taskStats30.done} color="#4caf50" textColor={COLORS.text} />
            <StatBox label="Перенесено" value={taskStats30.moved} color="#ff9800" textColor={COLORS.text} />
            <StatBox label="Отменено" value={taskStats30.cancelled} color="#f44336" textColor={COLORS.text} />
          </View>
        </View>
      )}
    </ScrollView>
    </LinearGradient>
  );
}

function createStyles(C) {
  return StyleSheet.create({
    periodSelector: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    periodBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 10,
      borderWidth: 1, borderColor: C.border, alignItems: 'center',
    },
    periodBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    periodBtnText: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
    periodBtnTextActive: { color: '#fff' },
    card: {
      backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12,
      elevation: 3,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 6,
    },
    cardTitle: {
      fontSize: 20, fontWeight: '600', color: C.text, marginBottom: 12,
      
    },
    statsRow: { flexDirection: 'row', marginTop: 12 },
    noDataText: { fontSize: 14, color: C.textSecondary, textAlign: 'center', paddingVertical: 20 },
    completionBar: { height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden' },
    completionFill: { height: '100%', backgroundColor: C.primary, borderRadius: 4 },
    completionText: { fontSize: 13, color: C.textSecondary, marginTop: 6 },
  });
}
