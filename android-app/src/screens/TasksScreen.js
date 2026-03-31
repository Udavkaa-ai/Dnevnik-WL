import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Modal, Pressable,
  Animated, LayoutAnimation, UIManager, Platform,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useOnboarding } from '../context/OnboardingContext';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllTasksForPlanner, addPlan, updatePlan, updatePlanStatus, moveToUndated,
  deletePlan, getRecurringTasks, addRecurringTask, updateRecurringTask,
  deleteRecurringTask, materializeRecurringTasks,
} from '../db/database';
import { today, addDays, formatDate, formatDateRelative } from '../utils';
import { useColors, useTheme } from '../ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import TimePickerModal from '../components/TimePicker';
import { scheduleTaskReminder, cancelTaskReminder } from '../services/notifications';

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
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { registerRef } = useOnboarding();

  const [tasks, setTasks] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // ── Add one-off task modal ─────────────────────────────────────────────────
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(addDays(today(), 1));
  const [newTaskShowTime, setNewTaskShowTime] = useState(false);
  const [newTaskTimeStart, setNewTaskTimeStart] = useState('');
  const [newTaskTimeEnd, setNewTaskTimeEnd] = useState('');

  // ── Task action bottom-sheet ───────────────────────────────────────────────
  const [actionTask, setActionTask] = useState(null);

  // ── Edit task modal ────────────────────────────────────────────────────────
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState(today());
  const [editShowTime, setEditShowTime] = useState(false);
  const [editTimeStart, setEditTimeStart] = useState('');
  const [editTimeEnd, setEditTimeEnd] = useState('');

  // ── Time picker modal ──────────────────────────────────────────────────────
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState(null); // 'newStart'|'newEnd'|'editStart'|'editEnd'
  const [newTaskReminderMins, setNewTaskReminderMins] = useState(0);
  const [editReminderMins, setEditReminderMins] = useState(0);

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
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
  const visibleHistoryDates = historyExpanded ? historyDates : [];

  // ── Handlers: one-off tasks ────────────────────────────────────────────────
  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    const timeStart = newTaskShowTime && /^\d{1,2}:\d{2}$/.test(newTaskTimeStart.trim())
      ? newTaskTimeStart.trim() : null;
    const timeEnd = newTaskShowTime && /^\d{1,2}:\d{2}$/.test(newTaskTimeEnd.trim())
      ? newTaskTimeEnd.trim() : null;
    const id = await addPlan(newTaskDate, newTaskText.trim(), timeStart, timeEnd, newTaskReminderMins);
    if (timeStart && newTaskReminderMins > 0 && newTaskDate !== 'undated') {
      await scheduleTaskReminder(id, newTaskDate, timeStart, newTaskReminderMins, newTaskText.trim());
    }
    setNewTaskText('');
    setNewTaskDate(addDays(today(), 1));
    setNewTaskShowTime(false);
    setNewTaskTimeStart('');
    setNewTaskTimeEnd('');
    setNewTaskReminderMins(0);
    setAddModalVisible(false);
    loadAll();
  };

  const handleTaskAction = (task) => setActionTask(task);

  const handleEditTask = async () => {
    if (!editText.trim() || !editingTaskId) return;
    const timeStart = editShowTime && /^\d{1,2}:\d{2}$/.test(editTimeStart.trim())
      ? editTimeStart.trim() : null;
    const timeEnd = editShowTime && /^\d{1,2}:\d{2}$/.test(editTimeEnd.trim())
      ? editTimeEnd.trim() : null;
    await updatePlan(editingTaskId, editText.trim(), editDate, timeStart, timeEnd, editReminderMins);
    await cancelTaskReminder(editingTaskId);
    if (timeStart && editReminderMins > 0 && editDate !== 'undated') {
      await scheduleTaskReminder(editingTaskId, editDate, timeStart, editReminderMins, editText.trim());
    }
    setEditModalVisible(false);
    setEditingTaskId(null);
    loadAll();
  };

  const openEditModal = (task) => {
    setEditingTaskId(task.id);
    setEditText(task.task_text);
    setEditDate(task.plan_date);
    setEditTimeStart(task.time_start || '');
    setEditTimeEnd(task.time_end || '');
    setEditShowTime(!!task.time_start);
    setEditReminderMins(task.reminder_minutes || 0);
    setActionTask(null);
    setEditModalVisible(true);
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
        activeOpacity={0.75}
      >
        <Ionicons name={icon.name} size={20} color={icon.color} />
        <View style={{ flex: 1 }}>
          <Text style={[
            styles.taskText,
            item.status === 'done' && styles.taskDone,
            item.status === 'cancelled' && styles.taskCancelled,
          ]}>
            {item.task_text}
          </Text>
          {!!item.time_start && (
            <Text style={styles.timeLabel}>
              {item.time_start}{item.time_end ? ` – ${item.time_end}` : ''}
            </Text>
          )}
        </View>
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
    <LinearGradient
      colors={isDark ? ['#161520', '#1a1830'] : ['#f9f5eb', '#ede8da']}
      style={{ flex: 1 }}
    >
    <View style={{ flex: 1 }}>
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
                {!historyExpanded && (
                  <TouchableOpacity onPress={() => setHistoryExpanded(true)} style={styles.showMoreBtn}>
                    <Text style={styles.showMoreText}>
                      Показать историю ({historyDates.length} {historyDates.length === 1 ? 'день' : historyDates.length < 5 ? 'дня' : 'дней'})
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
        ref={registerRef('tasksFab')}
        collapsable={false}
        style={styles.fab}
        onPress={() => { setNewTaskDate(addDays(today(), 1)); setAddModalVisible(true); }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Task action bottom-sheet ──────────────────────────────────────── */}
      <Modal
        visible={actionTask !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActionTask(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActionTask(null)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]} numberOfLines={2}>
                {actionTask?.task_text}
              </Text>
              <TouchableOpacity onPress={() => setActionTask(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.actionSubtitle}>
              {actionTask?.plan_date === 'undated' ? '📌 Без даты' : formatDateRelative(actionTask?.plan_date ?? '')}
            </Text>

            <TouchableOpacity style={styles.actionRow} onPress={async () => {
              await updatePlanStatus(actionTask.id, 'moved', { moved_to: addDays(today(), 1) });
              setActionTask(null); loadAll();
            }}>
              <Ionicons name="calendar-outline" size={22} color={COLORS.text} />
              <Text style={styles.actionText}>На завтра</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={async () => {
              await moveToUndated(actionTask.id);
              setActionTask(null); loadAll();
            }}>
              <Ionicons name="bookmark-outline" size={22} color={COLORS.text} />
              <Text style={styles.actionText}>Без даты</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => openEditModal(actionTask)}>
              <Ionicons name="pencil-outline" size={22} color={COLORS.text} />
              <Text style={styles.actionText}>Изменить</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionRow, styles.actionRowDanger]} onPress={() => {
              const t = actionTask;
              setActionTask(null);
              Alert.alert('Удалить задачу?', t.task_text, [
                { text: 'Отмена', style: 'cancel' },
                { text: 'Удалить', style: 'destructive', onPress: async () => { await deletePlan(t.id); loadAll(); } },
              ]);
            }}>
              <Ionicons name="trash-outline" size={22} color="#f44336" />
              <Text style={[styles.actionText, { color: '#f44336' }]}>Удалить</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Edit task modal ────────────────────────────────────────────────── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalTitleRow}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Изменить задачу</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, { marginTop: 16 }]}
              placeholder="Текст задачи..."
              placeholderTextColor={COLORS.textSecondary}
              value={editText}
              onChangeText={setEditText}
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
                  style={[styles.datePill, editDate === val && styles.datePillActive]}
                  onPress={() => setEditDate(val)}
                >
                  <Text style={[styles.datePillText, editDate === val && styles.datePillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.datePill, editShowTime && styles.datePillActive, { alignSelf: 'flex-start', marginBottom: 16 }]}
              onPress={() => { setEditShowTime(v => !v); if (editShowTime) { setEditTimeStart(''); setEditTimeEnd(''); } }}
            >
              <Text style={[styles.datePillText, editShowTime && styles.datePillTextActive]}>
                🕐 со временем
              </Text>
            </TouchableOpacity>
            {editShowTime && (
              <View style={{ marginBottom: 16 }}>
                <View style={styles.timeRow}>
                  <TouchableOpacity
                    style={styles.timePill}
                    onPress={() => { setTimePickerTarget('editStart'); setTimePickerVisible(true); }}
                  >
                    <Text style={styles.timePillText}>{editTimeStart || '–:–'}</Text>
                    <Text style={styles.timePillLabel}>начало</Text>
                  </TouchableOpacity>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 20, alignSelf: 'center' }}>→</Text>
                  <TouchableOpacity
                    style={styles.timePill}
                    onPress={() => { setTimePickerTarget('editEnd'); setTimePickerVisible(true); }}
                  >
                    <Text style={styles.timePillText}>{editTimeEnd || '–:–'}</Text>
                    <Text style={styles.timePillLabel}>конец</Text>
                  </TouchableOpacity>
                </View>
                {!!editTimeStart && (
                  <View>
                    <Text style={[styles.modalLabel, { marginBottom: 6 }]}>Напомнить до начала:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {[0, 5, 10, 15, 30, 60].map(m => (
                        <TouchableOpacity
                          key={m}
                          style={[styles.remPill, editReminderMins === m && styles.remPillActive]}
                          onPress={() => setEditReminderMins(m)}
                        >
                          <Text style={[styles.remPillText, editReminderMins === m && styles.remPillTextActive]}>
                            {m === 0 ? 'Нет' : m < 60 ? `${m} мин` : '1 час'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity
              style={[styles.modalSaveBtn, !editText.trim() && { opacity: 0.5 }]}
              onPress={handleEditTask}
              disabled={!editText.trim()}
            >
              <Text style={styles.modalSaveBtnText}>Сохранить</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
              style={[styles.datePill, newTaskShowTime && styles.datePillActive, { alignSelf: 'flex-start', marginBottom: 16 }]}
              onPress={() => { setNewTaskShowTime(v => !v); if (newTaskShowTime) { setNewTaskTimeStart(''); setNewTaskTimeEnd(''); } }}
            >
              <Text style={[styles.datePillText, newTaskShowTime && styles.datePillTextActive]}>
                🕐 со временем
              </Text>
            </TouchableOpacity>
            {newTaskShowTime && (
              <View style={{ marginBottom: 16 }}>
                <View style={styles.timeRow}>
                  <TouchableOpacity
                    style={styles.timePill}
                    onPress={() => { setTimePickerTarget('newStart'); setTimePickerVisible(true); }}
                  >
                    <Text style={styles.timePillText}>{newTaskTimeStart || '–:–'}</Text>
                    <Text style={styles.timePillLabel}>начало</Text>
                  </TouchableOpacity>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 20, alignSelf: 'center' }}>→</Text>
                  <TouchableOpacity
                    style={styles.timePill}
                    onPress={() => { setTimePickerTarget('newEnd'); setTimePickerVisible(true); }}
                  >
                    <Text style={styles.timePillText}>{newTaskTimeEnd || '–:–'}</Text>
                    <Text style={styles.timePillLabel}>конец</Text>
                  </TouchableOpacity>
                </View>
                {!!newTaskTimeStart && (
                  <View>
                    <Text style={[styles.modalLabel, { marginBottom: 6 }]}>Напомнить до начала:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {[0, 5, 10, 15, 30, 60].map(m => (
                        <TouchableOpacity
                          key={m}
                          style={[styles.remPill, newTaskReminderMins === m && styles.remPillActive]}
                          onPress={() => setNewTaskReminderMins(m)}
                        >
                          <Text style={[styles.remPillText, newTaskReminderMins === m && styles.remPillTextActive]}>
                            {m === 0 ? 'Нет' : m < 60 ? `${m} мин` : '1 час'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
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

      <TimePickerModal
        visible={timePickerVisible}
        initial={
          timePickerTarget === 'newStart' ? newTaskTimeStart :
          timePickerTarget === 'newEnd' ? newTaskTimeEnd :
          timePickerTarget === 'editStart' ? editTimeStart :
          editTimeEnd
        }
        onConfirm={(t) => {
          if (timePickerTarget === 'newStart') setNewTaskTimeStart(t);
          else if (timePickerTarget === 'newEnd') setNewTaskTimeEnd(t);
          else if (timePickerTarget === 'editStart') setEditTimeStart(t);
          else setEditTimeEnd(t);
          setTimePickerVisible(false);
        }}
        onCancel={() => setTimePickerVisible(false)}
      />
    </View>
    </LinearGradient>
  );
}

function createStyles(C) {
  return StyleSheet.create({
    section: { marginBottom: 20 },
    sectionHeader: {
      fontSize: 14, fontWeight: '700', color: C.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
      
    },
    sectionHeaderOverdue: { color: C.accent },
    sectionHeaderToday: { color: C.primary },
    sectionHeaderRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 10,
    },
    overdueDate: { fontSize: 11, color: C.accent, marginBottom: 2, paddingLeft: 2 },
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
      backgroundColor: C.surface, borderRadius: 10,
      padding: 14, marginBottom: 6, gap: 10,
      borderWidth: 1, borderColor: C.border,
      borderLeftWidth: 3, borderLeftColor: C.notebookLine,
    },
    taskRowHistory: { opacity: 0.75 },
    taskText: { fontSize: 15, color: C.text },
    timeLabel: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
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
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40,
      borderTopWidth: 2, borderTopColor: C.notebookLine,
    },
    modalHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: C.border, alignSelf: 'center', marginBottom: 16,
    },
    modalTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 16 },
    actionSubtitle: { fontSize: 13, color: C.textSecondary, marginBottom: 16 },
    actionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.border,
    },
    actionRowDanger: {},
    actionText: { fontSize: 16, color: C.text },
    modalInput: {
      borderBottomWidth: 2, borderBottomColor: C.notebookLine,
      paddingVertical: 10, paddingHorizontal: 2,
      fontSize: 15, color: C.text, minHeight: 60, textAlignVertical: 'top', marginBottom: 20,
      fontStyle: 'italic',
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
    timeRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
    timePill: {
      flex: 1, backgroundColor: C.background, borderRadius: 12,
      paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center',
      borderWidth: 1, borderColor: C.border,
    },
    timePillText: { fontSize: 22, fontWeight: '600', color: C.text },
    timePillLabel: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
    remPill: {
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: 16, borderWidth: 1, borderColor: C.border,
    },
    remPillActive: { backgroundColor: C.primary, borderColor: C.primary },
    remPillText: { fontSize: 13, color: C.text },
    remPillTextActive: { color: '#fff', fontWeight: '600' },
  });
}
