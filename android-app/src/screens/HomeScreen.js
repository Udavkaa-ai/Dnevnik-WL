import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Modal, Pressable, TextInput, Animated,
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

// Lightweight wrapper that fades + slides in from below
function FadeSlideIn({ anim, children }) {
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// TextInput styled as a ruled notebook page
function RuledInput({ value, onChangeText, placeholder, placeholderTextColor, autoFocus, onFocus, onBlur, focused, colors }) {
  const LINE_H = 28;
  const lineCount = 5;
  return (
    <View style={{ minHeight: LINE_H * lineCount, marginBottom: 16 }}>
      {Array.from({ length: lineCount }).map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: (i + 1) * LINE_H - 1,
            height: 1,
            backgroundColor: focused ? colors.primary + '66' : colors.notebookLine,
          }}
        />
      ))}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onBlur={onBlur}
        multiline
        style={{
          minHeight: LINE_H * lineCount,
          fontSize: 15,
          lineHeight: LINE_H,
          color: colors.text,
          textAlignVertical: 'top',
          padding: 4,
          paddingTop: 4,
          backgroundColor: 'transparent',
        }}
      />
    </View>
  );
}

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
  const [inputFocused, setInputFocused] = useState(false);

  // Staggered entrance animations
  const anim0 = useRef(new Animated.Value(0)).current; // header
  const anim1 = useRef(new Animated.Value(0)).current; // quote
  const anim2 = useRef(new Animated.Value(0)).current; // tasks
  const anim3 = useRef(new Animated.Value(0)).current; // overdue
  const anim4 = useRef(new Animated.Value(0)).current; // ai

  const todayStr = today();
  const dayOfMonth = new Date().getDate();
  const quote = DAILY_QUOTES[dayOfMonth - 1];

  const playEntrance = () => {
    [anim0, anim1, anim2, anim3, anim4].forEach(a => a.setValue(0));
    Animated.stagger(70, [
      Animated.spring(anim0, { toValue: 1, useNativeDriver: true, tension: 65, friction: 9 }),
      Animated.spring(anim1, { toValue: 1, useNativeDriver: true, tension: 65, friction: 9 }),
      Animated.spring(anim2, { toValue: 1, useNativeDriver: true, tension: 65, friction: 9 }),
      Animated.spring(anim3, { toValue: 1, useNativeDriver: true, tension: 65, friction: 9 }),
      Animated.spring(anim4, { toValue: 1, useNativeDriver: true, tension: 65, friction: 9 }),
    ]).start();
  };

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

  useFocusEffect(useCallback(() => { load(); playEntrance(); }, []));

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
      {/* Header */}
      <FadeSlideIn anim={anim0}>
        <View style={styles.header}>
          <Text style={styles.dateText}>{formatDate(todayStr)}</Text>
          <View style={styles.headerRow}>
            <Text style={styles.greeting}>Сегодня</Text>
            <TouchableOpacity
              ref={registerRef('homeEntryBtn')}
              collapsable={false}
              style={styles.diaryBtn}
              onPress={() => navigation.navigate('Entry', { date: todayStr })}
              activeOpacity={0.75}
            >
              <Ionicons name="create-outline" size={16} color={COLORS.primary} />
              <Text style={styles.diaryBtnText}>Итог дня</Text>
            </TouchableOpacity>
          </View>
        </View>
      </FadeSlideIn>

      {/* Quote of the day */}
      <FadeSlideIn anim={anim1}>
        <View style={styles.quoteCard}>
          <Ionicons name="bulb-outline" size={18} color={COLORS.accent} style={{ marginBottom: 8 }} />
          <Text style={styles.quoteText}>«{quote.text}»</Text>
          <Text style={styles.quoteAuthor}>— {quote.author}</Text>
        </View>
      </FadeSlideIn>

      {/* Today's tasks */}
      <FadeSlideIn anim={anim2}>
        <View ref={registerRef('homeTodayCard')} collapsable={false} style={styles.card}>
          <View style={styles.cardAccent} />
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Задачи на сегодня</Text>
            <View style={styles.cardHeaderRight}>
              {todayPlans.length > 0 && (
                <View style={styles.taskCountBadge}>
                  <Text style={styles.taskCount}>{doneCount}/{todayPlans.length}</Text>
                </View>
              )}
              <TouchableOpacity
                ref={registerRef('homeAddTaskBtn')}
                collapsable={false}
                style={styles.addBtn}
                onPress={() => { setNewTaskDate(todayStr); setAddModalVisible(true); }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {todayPlans.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyTasks}
              onPress={() => { setNewTaskDate(todayStr); setAddModalVisible(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-outline" size={24} color={COLORS.border} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTasksText}>Нет задач на сегодня</Text>
              <Text style={styles.emptyTasksHint}>Нажмите + чтобы добавить</Text>
            </TouchableOpacity>
          ) : (
            todayPlans.map((plan, index) => (
              <TouchableOpacity
                key={plan.id}
                style={[styles.taskRow, index < todayPlans.length - 1 && styles.taskRowRuled]}
                onPress={() => toggleTask(plan)}
                activeOpacity={0.6}
              >
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
      </FadeSlideIn>

      {/* Overdue tasks */}
      {overduePlans.length > 0 && (
        <FadeSlideIn anim={anim3}>
          <View style={[styles.card, styles.overdueCard]}>
            <View style={[styles.cardAccent, { backgroundColor: '#ff9800' }]} />
            <Text style={[styles.cardTitle, { marginTop: 4, marginBottom: 10 }]}>⚠️ Просроченные ({overduePlans.length})</Text>
            {overduePlans.slice(0, 3).map((plan, index) => (
              <TouchableOpacity
                key={plan.id}
                style={[styles.taskRow, index < Math.min(overduePlans.length, 3) - 1 && styles.taskRowRuled]}
                onPress={() => handleOverdueTask(plan)}
                activeOpacity={0.6}
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
                <Text style={styles.moreText}>Ещё {overduePlans.length - 3} задач → все задачи</Text>
              </TouchableOpacity>
            )}
          </View>
        </FadeSlideIn>
      )}

      {/* AI Analysis button */}
      <FadeSlideIn anim={anim4}>
        <TouchableOpacity
          ref={registerRef('homeAiCard')}
          collapsable={false}
          style={styles.analysisCard}
          onPress={() => navigation.navigate('Analysis')}
          activeOpacity={0.75}
        >
          <View style={styles.analysisIcon}>
            <Ionicons name="analytics-outline" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.analysisText}>
            <Text style={styles.analysisTitle}>AI Анализ дневника</Text>
            <Text style={styles.analysisSub}>Паттерны, баланс, психологический разбор</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </FadeSlideIn>

      {/* Add Task Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            {/* Drag handle */}
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>✏️ Новая задача</Text>

            <RuledInput
              value={newTaskText}
              onChangeText={setNewTaskText}
              placeholder="Напишите задачу..."
              placeholderTextColor={COLORS.textSecondary}
              autoFocus
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              focused={inputFocused}
              colors={COLORS}
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
                  activeOpacity={0.7}
                >
                  <Text style={[styles.datePillText, newTaskDate === val && styles.datePillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.modalSaveBtn, !newTaskText.trim() && { opacity: 0.45 }]}
              onPress={handleAddTask}
              disabled={!newTaskText.trim()}
              activeOpacity={0.8}
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

    // Header
    header: { padding: 20, paddingTop: 10, paddingBottom: 8 },
    dateText: { fontSize: 13, color: C.textSecondary, letterSpacing: 0.3 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
    greeting: { fontSize: 26, fontWeight: '800', color: C.text },
    diaryBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.primaryLight, borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 8,
      shadowColor: C.primary, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
    },
    diaryBtnText: { fontSize: 13, color: C.primary, fontWeight: '600' },

    // Quote card
    quoteCard: {
      backgroundColor: C.surface, borderRadius: 16, padding: 16,
      marginHorizontal: 16, marginBottom: 12,
      borderLeftWidth: 4, borderLeftColor: C.accent,
      shadowColor: '#B8860B', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1, shadowRadius: 6, elevation: 2,
    },
    quoteText: { fontSize: 14, color: C.text, lineHeight: 22, fontStyle: 'italic', marginBottom: 8 },
    quoteAuthor: { fontSize: 12, color: C.accent, fontWeight: '700' },

    // Cards
    card: {
      backgroundColor: C.surface, borderRadius: 16, padding: 16,
      marginHorizontal: 16, marginBottom: 12,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
      overflow: 'hidden',
    },
    // Coloured top-strip accent (like a notebook tab)
    cardAccent: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
      backgroundColor: C.primary,
    },
    overdueCard: {},
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: C.text },
    cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    taskCountBadge: {
      backgroundColor: C.primaryLight, borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 2,
    },
    taskCount: { fontSize: 13, color: C.primary, fontWeight: '700' },
    addBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: C.primaryLight,
      justifyContent: 'center', alignItems: 'center',
    },
    emptyTasks: { paddingVertical: 20, alignItems: 'center' },
    emptyTasksText: { fontSize: 14, color: C.textSecondary },
    emptyTasksHint: { fontSize: 12, color: C.textSecondary, marginTop: 4, opacity: 0.7 },
    // Task rows with notebook ruled-line dividers
    taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
    taskRowRuled: { borderBottomWidth: 1, borderBottomColor: C.notebookLine },
    taskText: { fontSize: 15, color: C.text, flex: 1 },
    taskDone: { textDecorationLine: 'line-through', color: C.textSecondary },
    overdueDate: { fontSize: 11, color: C.textSecondary, marginTop: 1 },
    moreText: { fontSize: 13, color: C.primary, marginTop: 8, fontWeight: '500' },

    // AI Analysis card
    analysisCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: C.surface, borderRadius: 16, padding: 16,
      marginHorizontal: 16, marginBottom: 24,
      borderTopWidth: 3, borderTopColor: C.primary,
      shadowColor: C.primary, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
    },
    analysisIcon: {
      width: 50, height: 50, borderRadius: 25,
      backgroundColor: C.primaryLight,
      justifyContent: 'center', alignItems: 'center',
    },
    analysisText: { flex: 1 },
    analysisTitle: { fontSize: 16, fontWeight: '700', color: C.text },
    analysisSub: { fontSize: 12, color: C.textSecondary, marginTop: 3 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40,
    },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center', marginBottom: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 16 },
    modalLabel: { fontSize: 13, color: C.textSecondary, marginBottom: 10, fontWeight: '500' },
    dateSelector: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
    datePill: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.background,
    },
    datePillActive: { backgroundColor: C.primary, borderColor: C.primary },
    datePillText: { fontSize: 13, color: C.text },
    datePillTextActive: { color: '#fff', fontWeight: '700' },
    modalSaveBtn: {
      backgroundColor: C.primary, borderRadius: 14,
      paddingVertical: 15, alignItems: 'center',
      shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
    },
    modalSaveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  });
}
