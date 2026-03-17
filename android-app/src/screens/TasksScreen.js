import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Modal, Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllTasksForPlanner, addPlan, updatePlanStatus, moveToUndated,
  getRecurringTasks, addRecurringTask, updateRecurringTask,
  deleteRecurringTask, materializeRecurringTasks,
} from '../db/database';
import { today, addDays, formatDate, formatDateRelative } from '../utils';
import { useColors } from '../ThemeContext';

const WEEK_DAYS = [
  { label: 'Пн', value: 1 }, { label: 'Вт', value: 2 }, { label: 'Ср', value: 3 },
  { label: 'Чт', value: 4 }, { label: 'Пт', value: 5 }, { label: 'Сб', value: 6 },
  { label: 'Вс', value: 7 },
];

function recurrenceLabel(type, day) {
  if (type === 'daily') return 'Каждый день';
  if (type === 'weekly') {
    const d = WEEK_DAYS.find(d => d.value === day);
    return `Каждую неделю, ${d ? d.label.toLowerCase() : ''}`;
  }
  if (type === 'monthly') return `Каждый месяц, ${day}-го`;
  return '';
}

export default function TasksScreen() {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [tasks, setTasks] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // ── Add one-off task modal ─────────────────────────────────────────────────
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(addDays(today(), 1));

  // ── Add/edit recurring task modal ─────────────────────────────────────────
  const [recurringModalVisible, setRecurringModalVisible] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);
  const [rText, setRText] = useState('');
  const [rType, setRType] = useState('daily');
  const [rDay, setRDay] = useState(1);
  const [rMonthDay, setRMonthDay] = useState('1');

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  const loadAll = async () => {
    try {
      await materializeRecurringTasks();
      const [taskData, recurringData] = await Promise.all([
        getAllTasksForPlanner(),
        getRecurringTasks(),
      ]);
      setTasks(taskData);
      setRecurring(recurringData);
    } catch (e) {
      console.log('Tasks load error:', e.message);
    }
  };

  const todayStr = today();

  // ── Section splits ─────────────────────────────────────────────────────────
  const overduePending = tasks.filter(
    t => t.status === 'pending' && t.plan_date !== 'undated' && t.plan_date < todayStr
  );
  const todayPending = tasks.filter(
    t => t.status === 'pending' && t.plan_date === todayStr
  );
  const futurePending = tasks.filter(
    t => t.status === 'pending' && t.plan_date !== 'undated' && t.plan_date > todayStr
  );
  const undatedPending = tasks.filter(
    t => t.status === 'pending' && t.plan_date === 'undated'
  );

  const futureGrouped = futurePending.reduce((acc, t) => {
    if (!acc[t.plan_date]) acc[t.plan_date] = [];
    acc[t.plan_date].push(t);
    return acc;
  }, {});
  const futureDates = Object.keys(futureGrouped).sort();

  const history = tasks.filter(t => t.status !== 'pending');
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

  // ── Handlers: one-off tasks ────────────────────────────────────────────────
  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    await addPlan(newTaskDate, newTaskText.trim());
    setNewTaskText('');
    setNewTaskDate(addDays(today(), 1));
    setAddModalVisible(false);
    loadAll();
  };

  const handleTaskAction = (task) => {
    const tomorrowStr = addDays(today(), 1);
    const dateLabel = task.plan_date === 'undated' ? 'Без даты' : formatDateRelative(task.plan_date);
    Alert.alert(task.task_text, dateLabel, [
      { text: 'Отмена', style: 'cancel' },
      { text: '✅ Выполнено', onPress: async () => { await updatePlanStatus(task.id, 'done'); loadAll(); } },
      { text: '📅 На завтра', onPress: async () => { await updatePlanStatus(task.id, 'moved', { moved_to: tomorrowStr }); loadAll(); } },
      { text: '📌 Без даты', onPress: async () => { await moveToUndated(task.id); loadAll(); } },
      {
        text: '🗑 Отменить задачу', style: 'destructive',
        onPress: () => Alert.alert('Отменить задачу?', task.task_text, [
          { text: 'Нет' },
          { text: 'Да', style: 'destructive', onPress: async () => { await updatePlanStatus(task.id, 'cancelled'); loadAll(); } },
        ]),
      },
    ]);
  };

  // Long-press on history item → restore to pending
  const handleHistoryAction = (task) => {
    Alert.alert(task.task_text, '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: '↩️ Вернуть в список',
        onPress: async () => { await updatePlanStatus(task.id, 'pending'); loadAll(); },
      },
    ]);
  };

  // ── Handlers: recurring tasks ──────────────────────────────────────────────
  const openAddRecurring = () => {
    setEditingRecurring(null);
    setRText(''); setRType('daily'); setRDay(1); setRMonthDay('1');
    setRecurringModalVisible(true);
  };

  const openRecurringAction = (r) => {
    Alert.alert(r.task_text, recurrenceLabel(r.recurrence_type, r.recurrence_day), [
      { text: 'Отмена', style: 'cancel' },
      {
        text: '✏️ Изменить',
        onPress: () => {
          setEditingRecurring(r);
          setRText(r.task_text);
          setRType(r.recurrence_type);
          setRDay(r.recurrence_day ?? 1);
          setRMonthDay(String(r.recurrence_day ?? 1));
          setRecurringModalVisible(true);
        },
      },
      {
        text: '🗑 Удалить', style: 'destructive',
        onPress: () => Alert.alert('Удалить повторяющуюся задачу?', r.task_text, [
          { text: 'Нет', style: 'cancel' },
          { text: 'Удалить', style: 'destructive', onPress: async () => { await deleteRecurringTask(r.id); loadAll(); } },
        ]),
      },
    ]);
  };

  const handleSaveRecurring = async () => {
    if (!rText.trim()) return;
    const day = rType === 'daily' ? null : rType === 'weekly' ? rDay : (parseInt(rMonthDay, 10) || 1);
    if (editingRecurring) {
      await updateRecurringTask(editingRecurring.id, rText.trim(), rType, day);
    } else {
      await addRecurringTask(rText.trim(), rType, day);
    }
    setRecurringModalVisible(false);
    loadAll();
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
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
        onPress={isPending ? async () => { await updatePlanStatus(item.id, 'done'); loadAll(); } : undefined}
        onLongPress={isPending ? () => handleTaskAction(item) : () => handleHistoryAction(item)}
      >
        <Ionicons name={icon.name} size={20} color={icon.color} />
        <Text style={[
          styles.taskText,
          item.status === 'done' && styles.taskDone,
          item.status === 'cancelled' && styles.taskCancelled,
        ]}>
          {item.task_text}
        </Text>
        {!!item.recurring_id && (
          <Ionicons name="repeat" size={13} color={COLORS.textSecondary} />
        )}
        {isPending && (
          <TouchableOpacity onPress={() => handleTaskAction(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
        {item.status === 'moved' && item.moved_to && item.moved_to !== 'undated' && (
          <Text style={styles.movedLabel}>→ {formatDate(item.moved_to)}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const hasActiveTasks = overduePending.length > 0 || todayPending.length > 0
    || futurePending.length > 0 || undatedPending.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <FlatList
        data={[0]}
        keyExtractor={() => 'root'}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={() => (
          <>
            {/* Overdue */}
            {overduePending.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionHeader, styles.sectionHeaderOverdue]}>
                  Просрочено ({overduePending.length})
                </Text>
                {overduePending.map(t => (
                  <View key={t.id}>
                    <Text style={styles.overdueDate}>{formatDateRelative(t.plan_date)}</Text>
                    {renderTask(t, true)}
                  </View>
                ))}
              </View>
            )}

            {/* Today */}
            {todayPending.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionHeader, styles.sectionHeaderToday]}>Сегодня</Text>
                {todayPending.map(t => renderTask(t, true))}
              </View>
            )}

            {/* Future */}
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

            {/* Undated */}
            {undatedPending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Без даты</Text>
                {undatedPending.map(t => renderTask(t, true))}
              </View>
            )}

            {/* Empty state */}
            {!hasActiveTasks && history.length === 0 && recurring.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={60} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>Нет задач</Text>
                <Text style={styles.emptySubtext}>Добавь задачи через кнопку ниже</Text>
              </View>
            )}

            {/* Recurring templates */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>Повторяющиеся</Text>
                <TouchableOpacity
                  onPress={openAddRecurring}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              {recurring.length === 0 && (
                <Text style={styles.recurringEmpty}>Нет повторяющихся задач</Text>
              )}
              {recurring.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.taskRow}
                  onPress={() => openRecurringAction(r)}
                  onLongPress={() => openRecurringAction(r)}
                >
                  <Ionicons name="repeat" size={20} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskText}>{r.task_text}</Text>
                    <Text style={styles.recurrenceLabel}>
                      {recurrenceLabel(r.recurrence_type, r.recurrence_day)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => openRecurringAction(r)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>

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
                    <Text style={styles.showMoreText}>
                      Показать всю историю ({historyDates.length} дней)
                    </Text>
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

      {/* ── Add one-off task modal ─────────────────────────────────────────── */}
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

      {/* ── Add/edit recurring task modal ─────────────────────────────────── */}
      <Modal
        visible={recurringModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRecurringModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRecurringModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {editingRecurring ? 'Изменить' : 'Повторяющаяся задача'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Текст задачи..."
              placeholderTextColor={COLORS.textSecondary}
              value={rText}
              onChangeText={setRText}
              autoFocus
              multiline
            />

            <Text style={styles.modalLabel}>Повторение:</Text>
            <View style={styles.dateSelector}>
              {[
                { label: 'Каждый день', val: 'daily' },
                { label: 'Каждую неделю', val: 'weekly' },
                { label: 'Каждый месяц', val: 'monthly' },
              ].map(({ label, val }) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.datePill, rType === val && styles.datePillActive]}
                  onPress={() => setRType(val)}
                >
                  <Text style={[styles.datePillText, rType === val && styles.datePillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {rType === 'weekly' && (
              <>
                <Text style={styles.modalLabel}>День недели:</Text>
                <View style={styles.dateSelector}>
                  {WEEK_DAYS.map(({ label, value }) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.datePill, rDay === value && styles.datePillActive]}
                      onPress={() => setRDay(value)}
                    >
                      <Text style={[styles.datePillText, rDay === value && styles.datePillTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {rType === 'monthly' && (
              <>
                <Text style={styles.modalLabel}>День месяца (1–31):</Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 0, height: 44, marginBottom: 16 }]}
                  placeholder="15"
                  placeholderTextColor={COLORS.textSecondary}
                  value={rMonthDay}
                  onChangeText={v => setRMonthDay(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="numeric"
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.modalSaveBtn, !rText.trim() && { opacity: 0.5 }]}
              onPress={handleSaveRecurring}
              disabled={!rText.trim()}
            >
              <Text style={styles.modalSaveBtnText}>
                {editingRecurring ? 'Сохранить' : 'Добавить'}
              </Text>
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
    sectionHeaderOverdue: { color: '#f44336' },
    sectionHeaderToday: { color: C.primary },
    sectionHeaderRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 10,
    },
    overdueDate: { fontSize: 11, color: '#f44336', marginBottom: 2, paddingLeft: 2 },
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
    recurrenceLabel: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
    recurringEmpty: { fontSize: 13, color: C.textSecondary, paddingLeft: 2, marginBottom: 4 },
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
