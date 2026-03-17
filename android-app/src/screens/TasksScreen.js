import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Modal, Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAllTasksForPlanner, addPlan, updatePlanStatus, moveToUndated } from '../db/database';
import { today, addDays, formatDate, formatDateRelative } from '../utils';
import { useColors } from '../ThemeContext';

export default function TasksScreen() {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [tasks, setTasks] = useState([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(addDays(today(), 1));
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useFocusEffect(useCallback(() => { loadTasks(); }, []));

  const loadTasks = async () => {
    try {
      const data = await getAllTasksForPlanner();
      setTasks(data);
    } catch (e) {
      console.log('Tasks load error:', e.message);
    }
  };

  const todayStr = today();

  // Split into sections
  const futurePending = tasks.filter(t => t.plan_date > todayStr && t.status === 'pending');
  const undatedPending = tasks.filter(t => t.plan_date === 'undated' && t.status === 'pending');
  const history = tasks
    .filter(t => t.status !== 'pending' || (t.plan_date !== 'undated' && t.plan_date < todayStr))
    .sort((a, b) => {
      if (a.plan_date === 'undated') return 1;
      if (b.plan_date === 'undated') return -1;
      return b.plan_date.localeCompare(a.plan_date);
    });

  // Group future pending by date
  const futureGrouped = futurePending.reduce((acc, t) => {
    if (!acc[t.plan_date]) acc[t.plan_date] = [];
    acc[t.plan_date].push(t);
    return acc;
  }, {});
  const futureDates = Object.keys(futureGrouped).sort();

  // Group history by date
  const historyGrouped = history.reduce((acc, t) => {
    const key = t.plan_date === 'undated' ? 'undated' : t.plan_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});
  const historyDates = Object.keys(historyGrouped).sort((a, b) => {
    if (a === 'undated') return 1;
    if (b === 'undated') return -1;
    return b.localeCompare(a);
  });
  const visibleHistoryDates = historyExpanded ? historyDates : historyDates.slice(0, 3);

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    await addPlan(newTaskDate, newTaskText.trim());
    setNewTaskText('');
    setNewTaskDate(addDays(today(), 1));
    setAddModalVisible(false);
    loadTasks();
  };

  const handleTaskAction = (task) => {
    const tomorrowStr = addDays(today(), 1);
    const dateLabel = task.plan_date === 'undated' ? 'Без даты' : formatDateRelative(task.plan_date);
    Alert.alert(task.task_text, dateLabel, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: '✅ Выполнено',
        onPress: async () => { await updatePlanStatus(task.id, 'done'); loadTasks(); },
      },
      {
        text: `📅 На завтра`,
        onPress: async () => {
          await updatePlanStatus(task.id, 'moved', { moved_to: tomorrowStr });
          loadTasks();
        },
      },
      {
        text: '📌 Без даты',
        onPress: async () => { await moveToUndated(task.id); loadTasks(); },
      },
      {
        text: '🗑 Отменить задачу',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Отменить задачу?', task.task_text, [
            { text: 'Нет' },
            {
              text: 'Да', style: 'destructive',
              onPress: async () => { await updatePlanStatus(task.id, 'cancelled'); loadTasks(); },
            },
          ]);
        },
      },
    ]);
  };

  const statusIcon = (status) => {
    if (status === 'done') return { name: 'checkmark-circle', color: '#4caf50' };
    if (status === 'moved') return { name: 'arrow-forward-circle', color: '#ff9800' };
    if (status === 'cancelled') return { name: 'close-circle', color: '#f44336' };
    return { name: 'ellipse-outline', color: COLORS.primary };
  };

  const renderTask = (item, isPending = true) => {
    const icon = statusIcon(item.status);
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.taskRow, !isPending && styles.taskRowHistory]}
        onPress={isPending ? async () => { await updatePlanStatus(item.id, 'done'); loadTasks(); } : undefined}
        onLongPress={isPending ? () => handleTaskAction(item) : undefined}
      >
        <Ionicons name={icon.name} size={20} color={icon.color} />
        <Text style={[
          styles.taskText,
          item.status === 'done' && styles.taskDone,
          item.status === 'cancelled' && styles.taskCancelled,
        ]}>
          {item.task_text}
        </Text>
        {isPending && (
          <TouchableOpacity
            onPress={() => handleTaskAction(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
        {item.status === 'moved' && item.moved_to && item.moved_to !== 'undated' && (
          <Text style={styles.movedLabel}>→ {formatDate(item.moved_to)}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const isEmpty = futurePending.length === 0 && undatedPending.length === 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={[0]}
        keyExtractor={() => 'root'}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={() => (
          <>
            {/* Future pending tasks */}
            {futureDates.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Запланировано</Text>
                {futureDates.map(date => (
                  <View key={date} style={styles.group}>
                    <Text style={[
                      styles.groupLabel,
                      date === addDays(todayStr, 1) && styles.groupLabelTomorrow,
                    ]}>
                      {formatDateRelative(date)}
                    </Text>
                    {futureGrouped[date].map(t => renderTask(t, true))}
                  </View>
                ))}
              </View>
            )}

            {/* Undated pending tasks */}
            {undatedPending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Без даты</Text>
                {undatedPending.map(t => renderTask(t, true))}
              </View>
            )}

            {/* Empty state */}
            {isEmpty && history.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={60} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>Нет запланированных задач</Text>
                <Text style={styles.emptySubtext}>Добавь задачи через кнопку ниже</Text>
              </View>
            )}

            {/* History */}
            {history.length > 0 && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.historySectionHeader}
                  onPress={() => setHistoryExpanded(e => !e)}
                >
                  <Text style={styles.sectionHeader}>История</Text>
                  <Ionicons
                    name={historyExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
                {visibleHistoryDates.map(date => (
                  <View key={date} style={styles.group}>
                    <Text style={styles.groupLabel}>
                      {date === 'undated' ? '📌 Без даты' : formatDateRelative(date)}
                    </Text>
                    {historyGrouped[date].map(t => renderTask(t, false))}
                  </View>
                ))}
                {!historyExpanded && historyDates.length > 3 && (
                  <TouchableOpacity onPress={() => setHistoryExpanded(true)} style={styles.showMoreBtn}>
                    <Text style={styles.showMoreText}>Показать всю историю ({historyDates.length} дней)</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setNewTaskDate(addDays(today(), 1)); setAddModalVisible(true); }}
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
                { label: 'Завтра', val: addDays(today(), 1) },
                { label: 'Послезавтра', val: addDays(today(), 2) },
                { label: 'Сегодня', val: today() },
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
    section: { marginBottom: 20 },
    sectionHeader: {
      fontSize: 13, fontWeight: '700', color: C.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
    },
    historySectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 10,
    },
    group: { marginBottom: 12 },
    groupLabel: {
      fontSize: 12, fontWeight: '600', color: C.textSecondary,
      marginBottom: 6, paddingLeft: 2,
    },
    groupLabelTomorrow: { color: C.primary },
    taskRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: 12,
      padding: 14, marginBottom: 6, gap: 10, elevation: 1,
    },
    taskRowHistory: { opacity: 0.75 },
    taskText: { flex: 1, fontSize: 15, color: C.text },
    taskDone: { textDecorationLine: 'line-through', color: C.textSecondary },
    taskCancelled: { textDecorationLine: 'line-through', color: C.textSecondary },
    movedLabel: { fontSize: 11, color: '#ff9800' },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyText: { fontSize: 18, fontWeight: '600', color: C.text, marginTop: 16 },
    emptySubtext: { fontSize: 14, color: C.textSecondary, marginTop: 6 },
    showMoreBtn: { paddingVertical: 8, alignItems: 'center' },
    showMoreText: { fontSize: 13, color: C.primary },
    fab: {
      position: 'absolute', bottom: 24, right: 24,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: C.primary,
      justifyContent: 'center', alignItems: 'center',
      elevation: 6, shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8,
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
    modalSaveBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    modalSaveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  });
}
