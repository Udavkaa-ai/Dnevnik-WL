import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Modal, Pressable, TextInput,
  Animated, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getPlansForDate, getOverduePlans, updatePlanStatus, addPlan } from '../db/database';
import { today, addDays, formatDate, formatDateFull } from '../utils';
import { useColors, useTheme } from '../ThemeContext';
import { useOnboarding } from '../context/OnboardingContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

// Animated task row component with press scale effect
function AnimatedTaskRow({ plan, onPress, styles, COLORS }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress(plan);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity style={styles.taskRow} onPress={handlePress} activeOpacity={0.8}>
        <Ionicons
          name={plan.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={plan.status === 'done' ? '#4caf50' : COLORS.textSecondary}
        />
        <Text style={[styles.taskText, plan.status === 'done' && styles.taskDone]}>
          {plan.task_text}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen({ navigation }) {
  const COLORS = useColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { registerRef } = useOnboarding();

  const [todayPlans, setTodayPlans] = useState([]);
  const [tomorrowPlans, setTomorrowPlans] = useState([]);
  const [dayAfterPlans, setDayAfterPlans] = useState([]);
  const [overduePlans, setOverduePlans] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(today());

  // Staggered entrance animations for each section
  const headerAnim = useRef(new Animated.Value(0)).current;
  const quoteAnim = useRef(new Animated.Value(0)).current;
  const tasksAnim = useRef(new Animated.Value(0)).current;
  const analysisAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(quoteAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(tasksAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(analysisAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const makeAnimStyle = (anim) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });

  const todayStr = today();
  const dayOfMonth = new Date().getDate();
  const quote = DAILY_QUOTES[dayOfMonth - 1];

  const load = async () => {
    try {
      const [tp, t2, t3, op] = await Promise.all([
        getPlansForDate(todayStr),
        getPlansForDate(addDays(todayStr, 1)),
        getPlansForDate(addDays(todayStr, 2)),
        getOverduePlans(),
      ]);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTodayPlans(tp);
      setTomorrowPlans(t2);
      setDayAfterPlans(t3);
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

  const bgColor = isDark ? '#12131f' : '#f5f5f5';

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      contentContainerStyle={{ paddingBottom: 100 }}
    >

      {/* AI Analysis card */}
      <TouchableOpacity
        ref={registerRef('homeAiCard')}
        collapsable={false}
        style={styles.analysisCard}
        onPress={() => navigation.navigate('Analysis')}
        activeOpacity={0.8}
      >
        <View style={styles.analysisIcon}>
          <Ionicons name="analytics-outline" size={26} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.analysisTitle}>AI Анализ дневника</Text>
          <Text style={styles.analysisSub}>Паттерны, баланс, психологический разбор</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Overdue */}
      {overduePlans.length > 0 && (
        <View style={styles.overdueSection}>
          <Text style={styles.overdueSectionTitle}>⚠️ Просроченные ({overduePlans.length})</Text>
          {overduePlans.slice(0, 3).map(plan => (
            <TouchableOpacity key={plan.id} style={styles.taskRow} onPress={() => handleOverdueTask(plan)} activeOpacity={0.7}>
              <Ionicons name="alert-circle-outline" size={22} color="#e55" />
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

      {/* ── Day sections ── */}
      <Animated.View style={makeAnimStyle(tasksAnim)}>

        {/* Today */}
        <View ref={registerRef('homeTodayCard')} collapsable={false}>
          <DaySection
            dateStr={todayStr}
            label="Сегодня"
            plans={todayPlans}
            onToggle={toggleTask}
            onAdd={() => { setNewTaskDate(todayStr); setAddModalVisible(true); }}
            addBtnRef={registerRef('homeAddTaskBtn')}
            styles={styles}
            COLORS={COLORS}
            isDark={isDark}
          />
        </View>

        {/* Tomorrow */}
        <DaySection
          dateStr={addDays(todayStr, 1)}
          label="Завтра"
          plans={tomorrowPlans}
          onToggle={toggleTask}
          onAdd={() => { setNewTaskDate(addDays(todayStr, 1)); setAddModalVisible(true); }}
          styles={styles}
          COLORS={COLORS}
          isDark={isDark}
        />

        {/* Day after tomorrow */}
        <DaySection
          dateStr={addDays(todayStr, 2)}
          label={null}
          plans={dayAfterPlans}
          onToggle={toggleTask}
          onAdd={() => { setNewTaskDate(addDays(todayStr, 2)); setAddModalVisible(true); }}
          styles={styles}
          COLORS={COLORS}
          isDark={isDark}
        />

      </Animated.View>

      {/* Quote of the day */}
      <Animated.View style={makeAnimStyle(analysisAnim)}>
        <View style={styles.quoteCard}>
          <View style={styles.notebookLines} pointerEvents="none">
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.notebookLine, { top: 27 + i * 18 }]} />
            ))}
          </View>
          <View style={styles.quoteContent}>
            <Text style={styles.quoteText}>«{quote.text}»</Text>
            <Text style={styles.quoteAuthor}>— {quote.author}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Add Task Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Новая задача</Text>
            <View style={styles.notebookInputWrapper}>
              <TextInput
                style={styles.modalInput}
                placeholder="Текст задачи..."
                placeholderTextColor={COLORS.textSecondary}
                value={newTaskText}
                onChangeText={setNewTaskText}
                autoFocus
                multiline
              />
              <View style={styles.inputUnderline} />
            </View>
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
              <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.modalSaveBtnText}>Добавить задачу</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

    </ScrollView>

    {/* FAB — Итог дня */}
    <TouchableOpacity
      ref={registerRef('homeEntryBtn')}
      collapsable={false}
      style={styles.fab}
      onPress={() => navigation.navigate('Entry', { date: todayStr })}
      activeOpacity={0.85}
    >
      <LinearGradient colors={['#4a7fa8', '#2d5070']} style={styles.fabGradient}>
        <Ionicons name="create-outline" size={22} color="#fff" />
        <Text style={styles.fabText}>Итог дня</Text>
      </LinearGradient>
    </TouchableOpacity>

    </View>
  );
}

// ── Day section component ─────────────────────────────────────────────────────
function DaySection({ dateStr, label, plans, onToggle, onAdd, addBtnRef, styles, COLORS, isDark }) {
  const doneCount = plans.filter(p => p.status === 'done').length;
  const displayLabel = label || formatDateFull(dateStr);

  return (
    <View style={styles.daySection}>
      {/* Day header */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>{displayLabel}</Text>
        <Text style={styles.dayDate}>{label ? formatDateFull(dateStr) : ''}</Text>
        <View style={{ flex: 1 }} />
        {plans.length > 0 && (
          <Text style={[styles.dayProgress, { color: COLORS.primary }]}>{doneCount}/{plans.length}</Text>
        )}
        <TouchableOpacity
          ref={addBtnRef}
          collapsable={false}
          onPress={onAdd}
          style={styles.dayAddBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Task list */}
      <View style={styles.daySectionBody}>
        {plans.length === 0 ? (
          <TouchableOpacity style={styles.emptyDay} onPress={onAdd} activeOpacity={0.7}>
            <Ionicons name="clipboard-outline" size={36} color={COLORS.border} />
            <Text style={styles.emptyDayText}>Нет задач</Text>
          </TouchableOpacity>
        ) : (
          plans.map(plan => (
            <AnimatedTaskRow
              key={plan.id}
              plan={plan}
              onPress={onToggle}
              styles={styles}
              COLORS={COLORS}
            />
          ))
        )}
      </View>
    </View>
  );
}

function createStyles(C) {
  return StyleSheet.create({
    // ── AI card ──
    analysisCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface,
      marginHorizontal: 12, marginTop: 10, marginBottom: 2,
      borderRadius: 14, padding: 14,
      elevation: 2, borderWidth: 1, borderColor: C.border,
      shadowColor: C.primary, shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08, shadowRadius: 4,
    },
    analysisIcon: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: C.primaryLight,
      justifyContent: 'center', alignItems: 'center',
    },
    analysisTitle: { fontSize: 15, fontWeight: '700', color: C.text },
    analysisSub: { fontSize: 12, color: C.textSecondary, marginTop: 1 },

    // ── Day section ──
    daySection: {
      backgroundColor: C.surface,
      marginHorizontal: 12, marginTop: 10,
      borderRadius: 14,
      elevation: 2,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06, shadowRadius: 4,
      overflow: 'hidden',
    },
    dayHeader: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    dayTitle: { fontSize: 16, fontWeight: '700', color: C.text },
    dayDate: { fontSize: 12, color: C.textSecondary, marginLeft: 8, flex: 1 },
    dayProgress: { fontSize: 13, fontWeight: '600', marginRight: 8 },
    dayAddBtn: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: C.primaryLight,
      justifyContent: 'center', alignItems: 'center',
    },
    daySectionBody: { paddingHorizontal: 4 },
    emptyDay: {
      alignItems: 'center', paddingVertical: 24, gap: 8,
    },
    emptyDayText: { fontSize: 13, color: C.textSecondary },

    // ── Task row ──
    taskRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
      paddingHorizontal: 12, gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    },
    taskText: { fontSize: 14, color: C.text, flex: 1, lineHeight: 20 },
    taskDone: { textDecorationLine: 'line-through', color: C.textSecondary },

    // ── Overdue section ──
    overdueSection: {
      backgroundColor: '#fff3f3',
      marginHorizontal: 12, marginTop: 10,
      borderRadius: 14, padding: 14,
      borderLeftWidth: 3, borderLeftColor: '#e55',
      elevation: 1,
    },
    overdueSectionTitle: { fontSize: 14, fontWeight: '700', color: '#c33', marginBottom: 8 },
    overdueDate: { fontSize: 11, color: C.textSecondary, marginTop: 1 },
    moreText: { fontSize: 13, color: C.primary, marginTop: 6 },

    // ── FAB ──
    fab: {
      position: 'absolute', bottom: 20, right: 16, borderRadius: 28,
      elevation: 6,
      shadowColor: '#2d5070', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4, shadowRadius: 8,
    },
    fabGradient: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 20, paddingVertical: 14, borderRadius: 28,
    },
    fabText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    // ── Quote card ──
    quoteCard: {
      backgroundColor: C.surface, borderRadius: 12,
      marginHorizontal: 12, marginTop: 10, marginBottom: 12,
      borderLeftWidth: 4, borderLeftColor: C.accent,
      overflow: 'hidden', elevation: 2,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06, shadowRadius: 4,
    },
    notebookLines: { ...StyleSheet.absoluteFillObject },
    notebookLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: C.notebookLine, opacity: 0.5 },
    quoteContent: { padding: 14, paddingLeft: 16 },
    quoteText: { fontSize: 14, color: C.text, lineHeight: 21, marginBottom: 6 },
    quoteAuthor: { fontSize: 13, color: C.primary, fontWeight: '600' },

    // ── Add task modal ──
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40,
    },
    modalHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: C.border, alignSelf: 'center', marginBottom: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 16 },
    notebookInputWrapper: { marginBottom: 20 },
    modalInput: {
      fontSize: 15, color: C.text, minHeight: 80, textAlignVertical: 'top',
      paddingVertical: 4, paddingHorizontal: 2, fontStyle: 'italic',
    },
    inputUnderline: { height: 2, backgroundColor: C.notebookLine, borderRadius: 1 },
    modalLabel: { fontSize: 13, color: C.textSecondary, marginBottom: 8, fontWeight: '600' },
    dateSelector: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
    datePill: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1.5, borderColor: C.border,
    },
    datePillActive: { backgroundColor: C.primary, borderColor: C.primary },
    datePillText: { fontSize: 13, color: C.text },
    datePillTextActive: { color: '#fff', fontWeight: '600' },
    modalSaveBtn: {
      backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15,
      alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    },
    modalSaveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  });
}
