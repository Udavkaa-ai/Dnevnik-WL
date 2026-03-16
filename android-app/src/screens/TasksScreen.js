import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Modal, Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPendingPlans, addPlan, updatePlanStatus, deletePlan } from '../db/database';
import { today, addDays, formatDateRelative } from '../utils';
import { COLORS } from '../theme';

export default function TasksScreen() {
  const [plans, setPlans] = useState([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(today());
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useFocusEffect(useCallback(() => { loadPlans(); }, []));

  const loadPlans = async () => {
    try {
      const data = await getPendingPlans();
      setPlans(data);
    } catch (e) {
      console.log('Tasks load error:', e.message);
    }
  };

  const grouped = plans.reduce((acc, plan) => {
    if (!acc[plan.plan_date]) acc[plan.plan_date] = [];
    acc[plan.plan_date].push(plan);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    await addPlan(newTaskDate, newTaskText.trim());
    setNewTaskText('');
    setAddModalVisible(false);
    loadPlans();
  };

  const handleTaskAction = (plan) => {
    Alert.alert(
      plan.task_text,
      formatDateRelative(plan.plan_date),
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: '✅ Выполнено',
          onPress: async () => { await updatePlanStatus(plan.id, 'done'); loadPlans(); }
        },
        {
          text: '📅 Перенести',
          onPress: () => { setSelectedPlan(plan); setMoveModalVisible(true); }
        },
        {
          text: '🗑 Отменить',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Отменить задачу?', plan.task_text, [
              { text: 'Нет' },
              {
                text: 'Да',
                style: 'destructive',
                onPress: async () => { await updatePlanStatus(plan.id, 'cancelled'); loadPlans(); }
              },
            ]);
          }
        },
      ]
    );
  };

  const handleMove = async (daysOffset) => {
    if (!selectedPlan) return;
    const newDate = addDays(today(), daysOffset);
    await updatePlanStatus(selectedPlan.id, 'moved', { moved_to: newDate });
    setMoveModalVisible(false);
    setSelectedPlan(null);
    loadPlans();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.taskRow} onLongPress={() => handleTaskAction(item)}>
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
        data={sortedDates}
        keyExtractor={item => item}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={60} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Нет активных задач</Text>
            <Text style={styles.emptySubtext}>Добавь задачи через кнопку ниже</Text>
          </View>
        }
        renderItem={({ item: date }) => (
          <View style={styles.group}>
            <Text style={[
              styles.groupHeader,
              date < today() && styles.groupHeaderOverdue,
              date === today() && styles.groupHeaderToday,
            ]}>
              {date < today() && '⚠️ '}
              {formatDateRelative(date)}
              {date < today() && ' (просрочено)'}
            </Text>
            {grouped[date].map(plan => (
              <React.Fragment key={plan.id}>
                {renderItem({ item: plan })}
              </React.Fragment>
            ))}
          </View>
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
              {[0, 1, 2, 3].map(n => {
                const d = addDays(today(), n);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.datePill, newTaskDate === d && styles.datePillActive]}
                    onPress={() => setNewTaskDate(d)}
                  >
                    <Text style={[styles.datePillText, newTaskDate === d && styles.datePillTextActive]}>
                      {n === 0 ? 'Сегодня' : n === 1 ? 'Завтра' : formatDateRelative(d)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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

      {/* Move Modal */}
      <Modal
        visible={moveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMoveModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMoveModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Перенести задачу</Text>
            {selectedPlan && (
              <Text style={styles.moveTaskName}>{selectedPlan.task_text}</Text>
            )}
            {[
              { label: 'Сегодня', days: 0 },
              { label: 'Завтра', days: 1 },
              { label: 'Послезавтра', days: 2 },
              { label: 'Через неделю', days: 7 },
            ].map(({ label, days }) => (
              <TouchableOpacity
                key={days}
                style={styles.moveOption}
                onPress={() => handleMove(days)}
              >
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                <Text style={styles.moveOptionText}>{label}</Text>
                <Text style={styles.moveOptionDate}>{formatDateRelative(addDays(today(), days))}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  group: { marginBottom: 16 },
  groupHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupHeaderOverdue: { color: '#ff9800' },
  groupHeaderToday: { color: COLORS.primary },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    elevation: 1,
  },
  taskText: { flex: 1, fontSize: 15, color: COLORS.text },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6 },
  fab: {
    position: 'absolute',
    bottom: 24, right: 24,
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12, padding: 14,
    fontSize: 15, color: COLORS.text,
    minHeight: 80, textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  dateSelector: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  datePill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  datePillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  datePillText: { fontSize: 13, color: COLORS.text },
  datePillTextActive: { color: '#fff', fontWeight: '600' },
  modalSaveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  modalSaveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  moveTaskName: {
    fontSize: 14, color: COLORS.textSecondary,
    marginBottom: 16, fontStyle: 'italic',
  },
  moveOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  moveOptionText: { flex: 1, fontSize: 15, color: COLORS.text },
  moveOptionDate: { fontSize: 13, color: COLORS.textSecondary },
});
