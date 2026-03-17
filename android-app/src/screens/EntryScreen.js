import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEntry, upsertEntry, getUser } from '../db/database';
import { dailyTip } from '../services/ai';
import { formatDateWithWeekday, moodLabel } from '../utils';
import { useColors } from '../ThemeContext';

// Two steps before the completion screen
const STEPS = ['text', 'mood', 'done_screen'];

const SPHERE_PROMPTS = [
  { icon: '💼', label: 'Работа / учёба' },
  { icon: '🏃', label: 'Здоровье и спорт' },
  { icon: '❤️', label: 'Близкие и общение' },
  { icon: '🌱', label: 'Личное развитие' },
  { icon: '😌', label: 'Отдых и настроение' },
];

export default function EntryScreen({ route, navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const { date, editMode = false } = route.params || {};
  const dateStr = date || new Date().toISOString().split('T')[0];

  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [moodScore, setMoodScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiTip, setAiTip] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);

  useEffect(() => {
    if (editMode) loadExisting();
  }, [editMode]);

  const loadExisting = async () => {
    const entry = await getEntry(dateStr);
    if (entry) {
      setText(entry.done || '');
      setMoodScore(entry.mood_score || null);
      setAiTip(entry.ai_tip || '');
    }
  };

  const currentStep = STEPS[step];

  const goNext = async () => {
    if (currentStep === 'text' && !text.trim()) {
      Alert.alert('Напиши хотя бы несколько слов', 'Расскажи как прошёл день');
      return;
    }
    if (currentStep === 'mood') {
      if (!moodScore) {
        Alert.alert('Поставь оценку', 'Оцени день от 1 до 10');
        return;
      }
      await saveEntry();
      return;
    }
    setStep(s => s + 1);
  };

  const saveEntry = async () => {
    setSaving(true);
    try {
      await upsertEntry(dateStr, {
        done: text.trim(),
        mood_score: moodScore,
      });
      setStep(STEPS.indexOf('done_screen'));
      generateTip();
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSaving(false);
    }
  };

  const generateTip = async () => {
    try {
      const user = await getUser();
      if (!user?.openrouter_key) return;
      setLoading(true);
      const tip = await dailyTip({ done: text, mood_score: moodScore }, user, user.openrouter_key);
      setAiTip(tip);
      await upsertEntry(dateStr, { ai_tip: tip });
    } catch (e) {
      console.log('AI tip error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderMoodSelector = () => (
    <View style={styles.moodGrid}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <TouchableOpacity
          key={n}
          style={[styles.moodBtn, moodScore === n && styles.moodBtnActive]}
          onPress={() => setMoodScore(n)}
        >
          <Text style={[styles.moodBtnText, moodScore === n && styles.moodBtnTextActive]}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Completion screen ──
  if (currentStep === 'done_screen') {
    return (
      <View style={styles.doneContainer}>
        <View style={styles.doneCard}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={styles.doneTitle}>Запись сохранена!</Text>
          <Text style={styles.doneSub}>
            {formatDateWithWeekday(dateStr)} • Оценка дня: {moodScore}/10
          </Text>
          {loading && (
            <View style={styles.tipLoading}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={styles.tipLoadingText}>Генерирую совет на завтра...</Text>
            </View>
          )}
          {aiTip ? (
            <View style={styles.tipBox}>
              <Text style={styles.tipLabel}>💡 Совет на завтра</Text>
              <Text style={styles.tipText}>{aiTip}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.doneBtnText}>На главную</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Input steps ──
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

        {/* Progress dots */}
        <View style={styles.progress}>
          {STEPS.slice(0, -1).map((s, i) => (
            <View key={s} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
          ))}
        </View>

        <View style={styles.content}>
          <Text style={styles.dateLabel}>{formatDateWithWeekday(dateStr)}</Text>

          {currentStep === 'text' ? (
            <>
              <Text style={styles.stepTitle}>Как прошёл день?</Text>
              <Text style={styles.stepHint}>Пиши в свободной форме — всё что считаешь важным</Text>

              {/* Life sphere prompts toggle */}
              <TouchableOpacity
                style={styles.promptsToggle}
                onPress={() => setShowPrompts(v => !v)}
              >
                <Ionicons
                  name={showPrompts ? 'chevron-up-circle-outline' : 'chevron-down-circle-outline'}
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.promptsToggleText}>
                  {showPrompts ? 'Скрыть подсказки' : 'Показать подсказки по сферам'}
                </Text>
              </TouchableOpacity>

              {showPrompts && (
                <View style={styles.promptsBox}>
                  {SPHERE_PROMPTS.map(p => (
                    <Text key={p.label} style={styles.promptItem}>
                      {p.icon} {p.label}
                    </Text>
                  ))}
                  <Text style={styles.promptsHint}>
                    Пройдись по каждой сфере — даже пара предложений даёт хороший материал для анализа
                  </Text>
                </View>
              )}

              <TextInput
                style={styles.textInput}
                value={text}
                onChangeText={setText}
                placeholder={'Сегодня я...'}
                placeholderTextColor={COLORS.textSecondary}
                multiline
                autoFocus={!showPrompts}
                textAlignVertical="top"
              />
            </>
          ) : (
            <>
              <Text style={styles.stepTitle}>Оценка дня</Text>
              <Text style={styles.stepHint}>Как в целом прошёл день?</Text>
              {renderMoodSelector()}
              {moodScore ? <Text style={styles.moodLabel}>{moodLabel(moodScore)}</Text> : null}
            </>
          )}

          <View style={styles.actions}>
            {step > 0 && (
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
                <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
                <Text style={styles.backBtnText}>Назад</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
              onPress={goNext}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>
                    {currentStep === 'mood' ? 'Сохранить' : 'Далее'}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    progress: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
    progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
    progressDotActive: { backgroundColor: C.primary },
    content: { padding: 20 },
    dateLabel: { fontSize: 13, color: C.textSecondary, marginBottom: 8 },
    stepTitle: { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 6 },
    stepHint: { fontSize: 14, color: C.textSecondary, marginBottom: 12 },
    promptsToggle: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      marginBottom: 10,
    },
    promptsToggleText: { fontSize: 13, color: C.primary },
    promptsBox: {
      backgroundColor: C.primaryLight, borderRadius: 12,
      padding: 14, marginBottom: 14, gap: 6,
    },
    promptItem: { fontSize: 14, color: C.text },
    promptsHint: {
      fontSize: 12, color: C.textSecondary,
      marginTop: 8, lineHeight: 17,
    },
    textInput: {
      backgroundColor: C.surface, borderRadius: 14, padding: 16,
      fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border,
      minHeight: 200, maxHeight: 360,
    },
    moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
    moodBtn: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
      justifyContent: 'center', alignItems: 'center',
    },
    moodBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    moodBtnText: { fontSize: 18, fontWeight: '600', color: C.text },
    moodBtnTextActive: { color: '#fff' },
    moodLabel: { fontSize: 16, color: C.text, marginTop: 16, textAlign: 'center' },
    actions: {
      flexDirection: 'row', justifyContent: 'flex-end',
      alignItems: 'center', marginTop: 24, gap: 12,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 10 },
    backBtnText: { fontSize: 15, color: C.textSecondary },
    nextBtn: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.primary, borderRadius: 14,
      paddingHorizontal: 24, paddingVertical: 14, gap: 8,
    },
    nextBtnDisabled: { opacity: 0.6 },
    nextBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    // Done screen
    doneContainer: { flex: 1, backgroundColor: C.background, justifyContent: 'center', padding: 20 },
    doneCard: { backgroundColor: C.surface, borderRadius: 20, padding: 28, alignItems: 'center', elevation: 4 },
    doneEmoji: { fontSize: 52, marginBottom: 12 },
    doneTitle: { fontSize: 22, fontWeight: '700', color: C.text },
    doneSub: { fontSize: 14, color: C.textSecondary, marginTop: 6, textAlign: 'center' },
    tipLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
    tipLoadingText: { fontSize: 13, color: C.textSecondary },
    tipBox: { backgroundColor: C.primaryLight, borderRadius: 14, padding: 16, marginTop: 20, width: '100%' },
    tipLabel: { fontSize: 13, fontWeight: '600', color: C.primary, marginBottom: 6 },
    tipText: { fontSize: 14, color: C.text, lineHeight: 20 },
    doneBtn: {
      marginTop: 24, backgroundColor: C.primary,
      borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14,
    },
    doneBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  });
}
