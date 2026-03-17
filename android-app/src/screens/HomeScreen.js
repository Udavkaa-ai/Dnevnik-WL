import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Modal, Pressable, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPlansForDate, getOverduePlans, updatePlanStatus, addPlan } from '../db/database';
import { today, addDays, formatDate } from '../utils';
import { useColors } from '../ThemeContext';
import { useOnboarding } from '../context/OnboardingContext';

const DAILY_QUOTES = [
  { text: 'Ваш разум создан для идей, а не для их хранения. Записывайте всё, что требует внимания, в надёжную систему — тогда голова останется свободной для главного.', author: 'Дэвид Аллен' },
  { text: 'Начните с конца в голове. Прежде чем действовать, ясно представьте, каким должен быть результат — это сэкономит время и направит усилия в нужную сторону.', author: 'Стивен Кови' },
  { text: 'Начните день с самой трудной и важной задачи. После неё всё остальное покажется легче, а продуктивность резко вырастет — этот принцип называют «съешьте лягушку».', author: 'Брайан Трейси' },
  { text: '20% усилий дают 80% результата. Определите, какие задачи входят в эти ключевые 20%, и сосредоточьтесь именно на них — остальное можно делегировать или отложить.', author: 'Принцип Парето' },
  { text: 'Работа занимает всё отведённое для неё время. Ставьте чёткие дедлайны — они помогают сосредоточиться и не растягивать задачи бесконечно.', author: 'Закон Паркинсона' },
  { text: 'Работайте сфокусированно 25 минут, затем делайте 5-минутный перерыв. Такой ритм поддерживает концентрацию и снижает усталость в течение всего дня.', author: 'Метод Помодоро' },
  { text: 'Разделяйте задачи на важные и срочные. Срочные, но неважные дела крадут время у того, что действительно влияет на вашу жизнь — делегируйте или откажитесь от них.', author: 'Матрица Эйзенхауэра' },
  { text: 'Освоить продуктивность — не значит делать больше. Это значит делать меньше, но то, что по-настоящему важно. Научитесь говорить «нет» тому, что не приближает вас к целям.', author: 'Тим Феррис' },
  { text: 'Многозадачность — миф. Мозг не работает параллельно, а быстро переключается, теряя до 40% эффективности. Один проект, одна задача, одно дело за раз.', author: 'Принцип однозадачности' },
  { text: 'Глубокая работа — это навык, который становится всё более редким и всё более ценным. Создавайте в расписании блоки без прерываний для самых важных дел.', author: 'Кал Ньюпорт' },
  { text: 'Если задача займёт меньше двух минут — сделайте её немедленно. Откладывание таких мелочей создаёт умственный шум и незаметно снижает продуктивность.', author: 'Правило двух минут' },
  { text: 'Главное — держать главное главным. Большинство людей теряют время на срочное, забывая о важном. Ежедневно задавайте себе вопрос: что сегодня действительно имеет значение?', author: 'Стивен Кови' },
  { text: 'Управляйте не только временем, но и энергией. Определите, в какие часы вы наиболее продуктивны, и планируйте важные задачи именно на это время.', author: 'Принцип энергии' },
  { text: 'Не ждите идеального момента, нужных условий или полной готовности — их не будет. Сделайте первый маленький шаг, и остальное придёт в движение само.', author: 'Принцип начала' },
  { text: 'Большие цели парализуют действие. Вместо «закончить проект» спросите себя: «Какое конкретное действие я могу сделать прямо сейчас?» — и немедленно сделайте его.', author: 'Метод следующего шага' },
  { text: 'Пять минут планирования вечером экономят час утром. Составляйте список на завтра перед сном — и следующий день начнётся с ясностью, а не с хаосом.', author: 'Принцип вечернего планирования' },
  { text: 'Всё занимает больше времени, чем вы думаете. Добавляйте 20–30% буферного времени к любым оценкам — это снизит стресс и повысит надёжность ваших планов.', author: 'Закон Мёрфи' },
  { text: 'Держать задачи в голове — всё равно что работать с десятками открытых вкладок в браузере. Записывайте всё в одно место и регулярно пересматривайте список.', author: 'Принцип разгрузки разума' },
  { text: 'Продуктивные люди полагаются на ритуалы, а не на силу воли. Создавайте предсказуемые утренние и вечерние процедуры — они переводят нужные действия в автопилот.', author: 'Принцип ритуалов' },
  { text: 'Вы не поднимаетесь до уровня своих целей — вы опускаетесь до уровня своих систем. Создайте систему ежедневных небольших действий, и результаты придут сами.', author: 'Джеймс Клир' },
  { text: 'Незаконченные дела потребляют энергию даже тогда, когда вы о них не думаете. Либо завершите задачу, либо осознанно отложите с новой датой, либо откажитесь — третьего не дано.', author: 'Принцип завершения' },
  { text: 'Сначала кладите в расписание крупные важные дела, потом мелкие. Если начать с мелочей, для главного места не останется — так работает принцип «больших камней».', author: 'Метод больших камней' },
  { text: 'Нельзя управлять тем, что нельзя измерить. Ставьте конкретные цели с понятными критериями достижения — иначе вы будете казаться занятыми, не будучи продуктивными.', author: 'Питер Друкер' },
  { text: 'Продуктивность — это марафон, а не спринт. Регулярный отдых — это не потеря времени, а инвестиция в долгосрочную эффективность и сохранение качества работы.', author: 'Принцип устойчивого темпа' },
  { text: 'Группируйте похожие задачи и выполняйте их подряд: звонки — в один блок, письма — в другой. Переключение между разными режимами работы стоит дорого.', author: 'Принцип контекстного планирования' },
  { text: '«Не мало у нас времени, но много его теряется впустую». Проблема редко в нехватке часов — чаще в том, как мы ими распоряжаемся. Ведите учёт своего времени хотя бы несколько дней.', author: 'Сенека' },
  { text: 'Любую большую задачу можно разбить на шаги по 15–30 минут. Начните с первого шага — он создаёт импульс, который несёт вас дальше, даже когда мотивация падает.', author: 'Метод малых шагов' },
  { text: 'Раз в неделю остановитесь и посмотрите на общую картину: правильная ли дорога, что сработало, а что нет? Корректируйте маршрут, пока не уехали слишком далеко.', author: 'Принцип еженедельного обзора' },
  { text: 'Слишком много вариантов парализует действие. Ограничивайте список задач на день тремя главными приоритетами — это создаёт ясность и снижает тревогу.', author: 'Парадокс выбора' },
  { text: 'Для повторяющихся задач создавайте шаблоны и процедуры. Чем меньше решений вы принимаете по мелочам, тем больше энергии остаётся для действительно важного.', author: 'Принцип автоматизации рутины' },
  { text: 'В конце каждого дня честно спрашивайте себя: «Я потратил время на то, что важно, или только казался занятым?» Разница между активностью и продуктивностью — ключевой вопрос каждого дня.', author: 'Принцип честного итога' },
];

export default function HomeScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { registerRef } = useOnboarding();

  const [todayPlans, setTodayPlans] = useState([]);
  const [overduePlans, setOverduePlans] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(today());

  const todayStr = today();
  const dayOfMonth = new Date().getDate();
  const quote = DAILY_QUOTES[dayOfMonth - 1];

  const load = async () => {
    try {
      const [tp, op] = await Promise.all([
        getPlansForDate(todayStr),
        getOverduePlans(),
      ]);
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
        { text: 'Да', onPress: async () => { await updatePlanStatus(plan.id, 'pending'); load(); } },
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
          text: '📅 На сегодня',
          onPress: async () => {
            await updatePlanStatus(plan.id, 'moved', { moved_to: todayStr, reason: 'перенесено вручную' });
            load();
          },
        },
        {
          text: '📌 Без даты',
          onPress: async () => {
            await updatePlanStatus(plan.id, 'moved', { moved_to: 'undated', reason: 'убрано без даты' });
            load();
          },
        },
        { text: '🗑 Отменить', style: 'destructive', onPress: async () => { await updatePlanStatus(plan.id, 'cancelled'); load(); } },
      ]
    );
  };

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    await addPlan(newTaskDate, newTaskText.trim());
    setNewTaskText('');
    setNewTaskDate(todayStr);
    setAddModalVisible(false);
    load();
  };

  const doneCount = todayPlans.filter(p => p.status === 'done').length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.dateText}>{formatDate(todayStr)}</Text>
        <View style={styles.headerRow}>
          <Text style={styles.greeting}>Сегодня</Text>
          <TouchableOpacity
            ref={registerRef('homeEntryBtn')}
            collapsable={false}
            style={styles.diaryBtn}
            onPress={() => navigation.navigate('Entry', { date: todayStr })}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={styles.diaryBtnText}>Итог дня</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quote of the day */}
      <View style={styles.quoteCard}>
        <Ionicons name="bulb-outline" size={18} color={COLORS.primary} style={{ marginBottom: 8 }} />
        <Text style={styles.quoteText}>«{quote.text}»</Text>
        <Text style={styles.quoteAuthor}>— {quote.author}</Text>
      </View>

      {/* Today's tasks */}
      <View ref={registerRef('homeTodayCard')} collapsable={false} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Задачи на сегодня</Text>
          <View style={styles.cardHeaderRight}>
            {todayPlans.length > 0 && (
              <Text style={styles.taskCount}>{doneCount}/{todayPlans.length}</Text>
            )}
            <TouchableOpacity
              ref={registerRef('homeAddTaskBtn')}
              collapsable={false}
              style={styles.addBtn}
              onPress={() => { setNewTaskDate(todayStr); setAddModalVisible(true); }}
            >
              <Ionicons name="add" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {todayPlans.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyTasks}
            onPress={() => { setNewTaskDate(todayStr); setAddModalVisible(true); }}
          >
            <Text style={styles.emptyTasksText}>Нет задач на сегодня</Text>
            <Text style={styles.emptyTasksHint}>Нажмите + чтобы добавить</Text>
          </TouchableOpacity>
        ) : (
          todayPlans.map(plan => (
            <TouchableOpacity key={plan.id} style={styles.taskRow} onPress={() => toggleTask(plan)}>
              <Ionicons
                name={plan.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={plan.status === 'done' ? '#4caf50' : COLORS.textSecondary}
              />
              <Text style={[styles.taskText, plan.status === 'done' && styles.taskDone]}>
                {plan.task_text}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Overdue tasks */}
      {overduePlans.length > 0 && (
        <View style={[styles.card, styles.overdueCard]}>
          <Text style={styles.cardTitle}>⚠️ Просроченные ({overduePlans.length})</Text>
          {overduePlans.slice(0, 3).map(plan => (
            <TouchableOpacity key={plan.id} style={styles.taskRow} onPress={() => handleOverdueTask(plan)}>
              <Ionicons name="alert-circle-outline" size={22} color="#ff9800" />
              <View style={{ flex: 1 }}>
                <Text style={styles.taskText}>{plan.task_text}</Text>
                <Text style={styles.overdueDate}>{formatDate(plan.plan_date)}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {overduePlans.length > 3 && (
            <TouchableOpacity onPress={() => navigation.navigate('Tasks')}>
              <Text style={styles.moreText}>Ещё {overduePlans.length - 3} задач → все задачи</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* AI Analysis button */}
      <TouchableOpacity ref={registerRef('homeAiCard')} collapsable={false} style={styles.analysisCard} onPress={() => navigation.navigate('Analysis')}>
        <View style={styles.analysisIcon}>
          <Ionicons name="analytics-outline" size={28} color={COLORS.primary} />
        </View>
        <View style={styles.analysisText}>
          <Text style={styles.analysisTitle}>AI Анализ дневника</Text>
          <Text style={styles.analysisSub}>Паттерны, баланс, психологический разбор</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
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
                { label: 'Сегодня', val: todayStr },
                { label: 'Завтра', val: addDays(todayStr, 1) },
                { label: 'Послезавтра', val: addDays(todayStr, 2) },
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
    </ScrollView>
  );
}

function createStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: { padding: 20, paddingTop: 10, paddingBottom: 8 },
    dateText: { fontSize: 13, color: C.textSecondary },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
    greeting: { fontSize: 24, fontWeight: '700', color: C.text },
    diaryBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.primaryLight, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    diaryBtnText: { fontSize: 13, color: C.primary, fontWeight: '600' },
    quoteCard: {
      backgroundColor: C.surface, borderRadius: 16, padding: 16,
      marginHorizontal: 16, marginBottom: 12,
      borderLeftWidth: 3, borderLeftColor: C.primary,
      elevation: 2,
    },
    quoteText: { fontSize: 14, color: C.text, lineHeight: 21, fontStyle: 'italic', marginBottom: 8 },
    quoteAuthor: { fontSize: 12, color: C.primary, fontWeight: '600' },
    card: {
      backgroundColor: C.surface, borderRadius: 16, padding: 16,
      marginHorizontal: 16, marginBottom: 12,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: C.text },
    cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    taskCount: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
    addBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: C.primaryLight,
      justifyContent: 'center', alignItems: 'center',
    },
    emptyTasks: { paddingVertical: 12, alignItems: 'center' },
    emptyTasksText: { fontSize: 14, color: C.textSecondary },
    emptyTasksHint: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
    taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
    taskText: { fontSize: 14, color: C.text, flex: 1 },
    taskDone: { textDecorationLine: 'line-through', color: C.textSecondary },
    overdueCard: { borderLeftWidth: 3, borderLeftColor: '#ff9800' },
    overdueDate: { fontSize: 11, color: C.textSecondary, marginTop: 1 },
    moreText: { fontSize: 13, color: C.primary, marginTop: 6 },
    analysisCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface, borderRadius: 16, padding: 16,
      marginHorizontal: 16, marginBottom: 20,
      elevation: 3,
    },
    analysisIcon: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: C.primaryLight,
      justifyContent: 'center', alignItems: 'center',
    },
    analysisText: { flex: 1 },
    analysisTitle: { fontSize: 16, fontWeight: '600', color: C.text },
    analysisSub: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
    // Modal
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
