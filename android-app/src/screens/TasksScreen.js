import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Modal, Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPendingPlans, addPlan, updatePlanStatus, moveToUndated } from '../db/database';
import { today, addDays, formatDate, formatDateRelative } from '../utils';
import { useColors } from '../ThemeContext';

export default function TasksScreen() {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [plans, setPlans] = useState([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(today());

  useFocusEffect(useCallback(() => { loadPlans(); }, []));

  const loadPlans = async () => {
    try {
      const data = await getPendingPlans();
      setPlans(data);
    } catch (e) {
      console.log('Tasks load error:', e.message);
    }
  };

  const undatedPlans = plans.filter(p => p.plan_date === 'undated');
  const datedPlans = plans.filter(p => p.plan_date !== 'undated');

  const grouped = datedPlans.reduce((acc, plan) => {
    if (!acc[plan.plan_date]) acc[plan.plan_date] = [];
    acc[plan.plan_date].push(plan);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    await addPlan(newTaskDate, newTaskText.trim());
    setNewTaskText('');
    setNewTaskDate(today());
    setAddModalVisible(false);
    loadPlans();
  };

  const handleTaskAction = (plan) => {
    const tomorrowStr = addDays(today(), 1);
    Alert.alert(
      plan.task_text,
      plan.plan_date === 'undated' ? 'Без даты' : formatDateRelative(plan.plan_date),
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: '✅ Выполнено',
          onPress: async () => { await updatePlanStatus(plan.id, 'done'); loadPlans(); },
        },
        {
          text: `📅 На завтра (${formatDate(tomorrowStr)})`,
          onPress: async () => {
            await updatePlanStatus(plan.id, 'moved', { moved_to: tomorrowStr });
            loadPlans();
          },
        },
        {
          text: '📌 Без даты',
          onPress: async () => { await moveToUndated(plan.id); loadPlans(); },
        },
        {
          text: '🗑 Отменить задачу',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Отменить задачу?', plan.task_text, [
              { text: 'Нет' },
              {
                text: 'Да', style: 'destructive',
                onPress: async () => { await updatePlanStatus(plan.id, 'cancelled'); loadPlans(); },
              },
            ]);
          },
        },
      ]
    );
  };

  const renderTaskItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.taskRow}
      onLongPress={() => handleTaskAction(item)}
    >
      <TouchableOpacity
        onPress={async () => { await updatePlanStatus(item.id, 'done'); loadPlans(); }}
      >
        <Ionicons name="ellipse-outline" size={22} color={COLORS.primary} />
      </TouchableOpacity>
      <Text style={styles.taskText}>{item.task_text}</Text>
      <TouchableOpacity
        onPress={() => handleTaskAction(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={[0]}
        keyExtractor={() => 'root'}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={() => (
          <>
            {sortedDates.length === 0 && undatedPlans.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="checkmark-done-circle-outline" size={60} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>Нет активных задач</Text>
                <Text style={styles.emptySubtext}>Добавь задачи через кнопку ниже</Text>
              </View>
            )}

            {sortedDates.map(date => (
              <View key={date} style={styles.group}>
                <Text style={[
                  styles.groupHeader,
                  date < today() && styles.groupHeaderOverdue,
                  date === today() && styles.groupHeaderToday,
                ]}>
                  {date < today() && '⚠️ '}
                  {formatDateRelative(date)}
                  {date < today() && ' (просрочено)'}
                </Text>
                {grouped[date].map(plan => renderTaskItem(plan))}
              </View>
            ))}

            {undatedPlans.length > 0 && (
              <View style={styles.group}>
                <Text style={[styles.groupHeader, styles.groupHeaderUndated]}>
                  📌 Без-датые дела
                </Text>
                {undatedPlans.map(plan => renderTaskItem(plan))}
              </View>
            )}
          </>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setNewTaskDate(today()); setAddModalVisible(true); }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Новая задача</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Текст задачи..."
              placeholderTextColor={COLORS.textSecondary}
              value={newTaskText}
              onChangeText={setNewTaskText}
              autoFocus
              multiline
            />

            <Text style={styles.modalLabel}>Дата:</Text>
            <View style={styles.dateSelector}>
              {[
                { label: 'Сегодня', val: today() },
                { label: 'Завтра', val: addDays(today(), 1) },
                { label: 'Послезавтра', val: addDays(today(), 2) },
                { label: 'Без даты', val: 'undated' },
              ].map(({ label, val }) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.datePill, newTaskDate === val && styles.datePillActive]}
                  onPress={() => setNewTaskDate(val)}
                >
                  <Text style={[styles.datePillText, newTaskDate === val && styles.datePillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.modalSaveBtn, !newTaskText.trim() && { opacity: 0.5 }]}
              onPress={handleAddTask}
              disabled={!newTaskText.trim()}
            >
              <Text style={styles.modalSaveBtnText}>Добавить задачу</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    group: { marginBottom: 16 },
    groupHeader: {
      fontSize: 13, fontWeight: '600', color: C.textSecondary,
      marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
    },
    groupHeaderOverdue: { color: '#ff9800' },
    groupHeaderToday: { color: C.primary },
    groupHeaderUndated: { color: C.primary, textTransform: 'none' },
    taskRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: 12,
      padding: 14, marginBottom: 8, gap: 12, elevation: 1,
    },
    taskText: { flex: 1, fontSize: 15, color: C.text },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyText: { fontSize: 18, fontWeight: '600', color: C.text, marginTop: 16 },
    emptySubtext: { fontSize: 14, color: C.textSecondary, marginTop: 6 },
    fab: {
      position: 'absolute', bottom: 24, right: 24,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: C.primary,
      justifyContent: 'center', alignItems: 'center',
      elevation: 6, shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8,
    },
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 40,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 16 },
    modalInput: {
      backgroundColor: C.background, borderRadius: 12, padding: 14,
      fontSize: 15, color: C.text, minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
    },
    modalLabel: { fontSize: 13, color: C.textSecondary, marginBottom: 8 },
    dateSelector: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
    datePill: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1, borderColor: C.border,
    },
    datePillActive: { backgroundColor: C.primary, borderColor: C.primary },
    datePillText: { fontSize: 13, color: C.text },
    datePillTextActive: { color: '#fff', fontWeight: '600' },
    modalSaveBtn: {
      backgroundColor: C.primary, borderRadius: 14,
      paddingVertical: 15, alignItems: 'center',
    },
    modalSaveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  });
}
