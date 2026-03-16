import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { getMoodData, getTaskStats } from '../db/database';
import { COLORS } from '../theme';

const screenWidth = Dimensions.get('window').width;

function avg(arr) {
  if (!arr.length) return 0;
  return (arr.reduce((s, n) => s + n, 0) / arr.length).toFixed(1);
}

export default function StatsScreen() {
  const [moodData, setMoodData] = useState([]);
  const [taskStats, setTaskStats] = useState(null);
  const [taskStats30, setTaskStats30] = useState(null);
  const [period, setPeriod] = useState(14);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [period]));

  const loadData = async () => {
    try {
      const [md, ts7, ts30] = await Promise.all([
        getMoodData(period),
        getTaskStats(7),
        getTaskStats(30),
      ]);
      setMoodData(md.reverse()); // chronological order
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

  // Show only every Nth label to avoid crowding
  const labelInterval = Math.ceil(labels.length / 6);
  const sparseLabels = labels.map((l, i) => i % labelInterval === 0 ? l : '');

  const completionRate = (stats) => {
    if (!stats || !stats.total) return 0;
    return Math.round((stats.done / stats.total) * 100);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>

      {/* Period selector */}
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

      {/* Mood chart */}
      <View style={styles.card}>
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
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: COLORS.primary,
                },
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 16 }}
            />
            <View style={styles.statsRow}>
              <StatBox label="Среднее" value={avg(scores)} suffix="/10" />
              <StatBox label="Макс" value={Math.max(...scores)} suffix="/10" />
              <StatBox label="Мин" value={Math.min(...scores)} suffix="/10" />
              <StatBox label="Записей" value={scores.length} />
            </View>
          </>
        ) : (
          <Text style={styles.noDataText}>
            Нужно минимум 2 записи с оценкой дня для графика
          </Text>
        )}
      </View>

      {/* Task completion */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Выполнение задач (7 дней)</Text>
        {taskStats && taskStats.total > 0 ? (
          <>
            <View style={styles.completionBar}>
              <View style={[styles.completionFill, { width: `${completionRate(taskStats)}%` }]} />
            </View>
            <Text style={styles.completionText}>{completionRate(taskStats)}% выполнено</Text>
            <View style={styles.statsRow}>
              <StatBox label="Всего" value={taskStats.total} color={COLORS.text} />
              <StatBox label="Выполнено" value={taskStats.done} color="#4caf50" />
              <StatBox label="Перенесено" value={taskStats.moved} color="#ff9800" />
              <StatBox label="Отменено" value={taskStats.cancelled} color="#f44336" />
            </View>
          </>
        ) : (
          <Text style={styles.noDataText}>Нет данных за 7 дней</Text>
        )}
      </View>

      {/* 30 day task stats */}
      {taskStats30 && taskStats30.total > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Выполнение задач (30 дней)</Text>
          <View style={styles.completionBar}>
            <View style={[styles.completionFill, { width: `${completionRate(taskStats30)}%` }]} />
          </View>
          <Text style={styles.completionText}>{completionRate(taskStats30)}% выполнено</Text>
          <View style={styles.statsRow}>
            <StatBox label="Всего" value={taskStats30.total} color={COLORS.text} />
            <StatBox label="Выполнено" value={taskStats30.done} color="#4caf50" />
            <StatBox label="Перенесено" value={taskStats30.moved} color="#ff9800" />
            <StatBox label="Отменено" value={taskStats30.cancelled} color="#f44336" />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function StatBox({ label, value, suffix = '', color }) {
  return (
    <View style={statStyles.box}>
      <Text style={[statStyles.value, color && { color }]}>{value}{suffix}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center' },
  value: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  label: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  periodSelector: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  periodBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  periodBtnTextActive: { color: '#fff' },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, marginBottom: 12, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  statsRow: { flexDirection: 'row', marginTop: 12 },
  noDataText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 20 },
  completionBar: {
    height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden',
  },
  completionFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  completionText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
});
