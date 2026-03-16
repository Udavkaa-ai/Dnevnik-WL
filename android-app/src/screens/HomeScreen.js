import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getEntry, getPlansForDate, getOverduePlans, getPendingPlans, updatePlanStatus } from '../db/database';
import { today, formatDate, moodColor } from '../utils';
import { COLORS } from '../theme';

export default function HomeScreen({ navigation }) {
  const [entry, setEntry] = useState(null);
  const [todayPlans, setTodayPlans] = useState([]);
  const [overduePlans, setOverduePlans] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const todayStr = today();
      const [e, tp, op] = await Promise.all([
        getEntry(todayStr),
        getPlansForDate(todayStr),
        getOverduePlans(),
      ]);
      setEntry(e);
      setTodayPlans(tp);
      setOverduePlans(op.filter(p => p.plan_date !== todayStr));
    } catch (e) {
      console.log('Home load error:', e.message);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleTask = async (plan) => {
    if (plan.status === 'done') {
      Alert.alert('Задача выполнена', 'Отметить как невыполненную?', [
        { text: 'Отмена' },
        {
          text: 'Да', onPress: async () => {
            await updatePlanStatus(plan.id, 'pending');
            load();
          }
        },
      ]);
    } else {
      await updatePlanStatus(plan.id, 'done');
      load();
    }
  };

  const handleOverdueTask = (plan) => {
    Alert.alert(
      plan.task_text,
      `Задача из ${formatDate(plan.plan_date)}`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: '✅ Выполнено', onPress: async () => { await updatePlanStatus(plan.id, 'done'); load(); } },
        {
          text: '📅 Перенести на сегодня', onPress: async () => {
            await updatePlanStatus(plan.id, 'moved', { moved_to: today(), reason: 'перенесено вручную' });
            load();
          }
        },
        { text: '🗑 Отменить', style: 'destructive', onPress: async () => { await updatePlanStatus(plan.id, 'cancelled'); load(); } },
      ]
    );
  };

  const todayStr = today();
  const pendingCount = todayPlans.filter(p => p.status === 'pending').length;
  const doneCount = todayPlans.filter(p => p.status === 'done').length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.dateText}>{formatDate(todayStr)}</Text>
        <Text style={styles.greeting}>Личный дневник</Text>
      </View>

      {/* Today's entry card */}
      {entry ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Запись дня</Text>
            <View style={[styles.moodBadge, { backgroundColor: moodColor(entry.mood_score) + '22' }]}>
              <Text style={[styles.moodScore, { color: moodColor(entry.mood_score) }]}>
                {entry.mood_score ? `${entry.mood_score}/10` : '—'}
              </Text>
            </View>
          </View>
          {entry.done && (
            <Text style={styles.entryText} numberOfLines={3}>✅ {entry.done}</Text>
          )}
          {entry.not_done && (
            <Text style={[styles.entryText, { color: COLORS.textSecondary }]} numberOfLines={2}>
              ❌ {entry.not_done}
            </Text>
          )}
          {entry.ai_tip && (
            <View style={styles.tipBox}>
              <Text style={styles.tipText}>💡 {entry.ai_tip}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('Entry', { date: todayStr, editMode: true })}
          >
            <Text style={styles.editBtnText}>Редактировать</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.card, styles.addEntryCard]}
          onPress={() => navigation.navigate('Entry', { date: todayStr })}
        >
          <Ionicons name="add-circle-outline" size={40} color={COLORS.primary} />
          <Text style={styles.addEntryText}>Добавить запись дня</Text>
          <Text style={styles.addEntrySubtext}>Вечерний итог, настроение, планы</Text>
        </TouchableOpacity>
      )}

      {/* Today's tasks */}
      {todayPlans.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Задачи на сегодня</Text>
            <Text style={styles.taskCount}>{doneCount}/{todayPlans.length}</Text>
          </View>
          {todayPlans.map(plan => (
            <TouchableOpacity
              key={plan.id}
              style={styles.taskRow}
              onPress={() => toggleTask(plan)}
            >
              <Ionicons
                name={plan.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={plan.status === 'done' ? '#4caf50' : COLORS.textSecondary}
              />
              <Text style={[
                styles.taskText,
                plan.status === 'done' && styles.taskDone
              ]}>
                {plan.task_text}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.addTaskBtn}
            onPress={() => navigation.navigate('Tasks')}
          >
            <Text style={styles.addTaskBtnText}>+ Управление задачами</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Overdue tasks */}
      {overduePlans.length > 0 && (
        <View style={[styles.card, styles.overdueCard]}>
          <Text style={styles.cardTitle}>⚠️ Просроченные задачи ({overduePlans.length})</Text>
          {overduePlans.slice(0, 3).map(plan => (
            <TouchableOpacity
              key={plan.id}
              style={styles.taskRow}
              onPress={() => handleOverdueTask(plan)}
            >
              <Ionicons name="alert-circle-outline" size={22} color="#ff9800" />
              <View style={{ flex: 1 }}>
                <Text style={styles.taskText}>{plan.task_text}</Text>
                <Text style={styles.overdueDate}>{formatDate(plan.plan_date)}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {overduePlans.length > 3 && (
            <TouchableOpacity onPress={() => navigation.navigate('Tasks')}>
              <Text style={styles.moreText}>Ещё {overduePlans.length - 3} задач →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('Entry', { date: todayStr })}
        >
          <Ionicons name="create-outline" size={24} color={COLORS.primary} />
          <Text style={styles.quickBtnText}>Итог дня</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('Tasks')}
        >
          <Ionicons name="list-outline" size={24} color={COLORS.primary} />
          <Text style={styles.quickBtnText}>Задачи</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('Stats')}
        >
          <Ionicons name="stats-chart-outline" size={24} color={COLORS.primary} />
          <Text style={styles.quickBtnText}>Статистика</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('Analysis')}
        >
          <Ionicons name="bulb-outline" size={24} color={COLORS.primary} />
          <Text style={styles.quickBtnText}>Анализ</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, paddingTop: 10 },
  dateText: { fontSize: 14, color: COLORS.textSecondary },
  greeting: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  moodBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  moodScore: { fontSize: 14, fontWeight: '700' },
  entryText: { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 6 },
  tipBox: { backgroundColor: COLORS.primaryLight, borderRadius: 10, padding: 10, marginTop: 8 },
  tipText: { fontSize: 13, color: COLORS.primary, lineHeight: 18 },
  editBtn: { marginTop: 12, alignSelf: 'flex-end' },
  editBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
  addEntryCard: { alignItems: 'center', paddingVertical: 30 },
  addEntryText: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 10 },
  addEntrySubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  taskCount: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  taskText: { fontSize: 14, color: COLORS.text, flex: 1 },
  taskDone: { textDecorationLine: 'line-through', color: COLORS.textSecondary },
  addTaskBtn: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  addTaskBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
  overdueCard: { borderLeftWidth: 3, borderLeftColor: '#ff9800' },
  overdueDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  moreText: { fontSize: 13, color: COLORS.primary, marginTop: 6 },
  quickActions: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    elevation: 2,
  },
  quickBtnText: { fontSize: 11, color: COLORS.text, fontWeight: '500', textAlign: 'center' },
});
