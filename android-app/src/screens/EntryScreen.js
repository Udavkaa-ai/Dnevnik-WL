import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEntry, upsertEntry, addPlans, getUser } from '../db/database';
import { dailyTip } from '../services/ai';
import { formatDateWithWeekday, tomorrow, moodLabel } from '../utils';
import { useColors } from '../ThemeContext';

const STEPS = ['done', 'not_done', 'mood', 'plans', 'done_screen'];

export default function EntryScreen({ route, navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const { date, editMode = false } = route.params || {};
  const dateStr = date || new Date().toISOString().split('T')[0];

  const [step, setStep] = useState(0);
  const [done, setDone] = useState('');
  const [notDone, setNotDone] = useState('');
  const [moodScore, setMoodScore] = useState(null);
  const [plansText, setPlansText] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiTip, setAiTip] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editMode) loadExisting();
  }, [editMode]);

  const loadExisting = async () => {
    const entry = await getEntry(dateStr);
    if (entry) {
      setDone(entry.done || '');
      setNotDone(entry.not_done || '');
      setMoodScore(entry.mood_score || null);
      setAiTip(entry.ai_tip || '');
    }
  };

  const currentStep = STEPS[step];

  const goNext = async () => {
    if (currentStep === 'done' && !done.trim()) {
      Alert.alert('Напиши хотя бы что-нибудь', 'Что ты сделал сегодня?');
      return;
    }
    if (currentStep === 'mood' && !moodScore) {
      Alert.alert('Поставь оценку', 'Оцени день от 1 до 10');
      return;
    }
    if (currentStep === 'plans') {
      await saveEntry();
      return;
    }
    setStep(s => s + 1);
  };

  const saveEntry = async () => {
    setSaving(true);
    try {
      await upsertEntry(dateStr, {
        done: done.trim(),
        not_done: notDone.trim() || null,
        mood_score: moodScore,
      });
      if (!editMode) {
        const tasks = plansText.split('\n').filter(t => t.trim());
        if (tasks.length > 0) await addPlans(tomorrow(dateStr), tasks);
      }
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
      const tip = await dailyTip({ done, not_done: notDone, mood_score: moodScore }, user, user.openrouter_key);
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

  const stepInfo = {
    done: {
      title: 'Что сделал сегодня?',
      hint: 'Опиши чего ты достиг, что было значимого',
      input: done, setInput: setDone, multiline: true,
      placeholder: 'Поработал над проектом, сходил в спортзал...',
    },
    not_done: {
      title: 'Что не получилось?',
      hint: 'Что планировал но не сделал? (можно пропустить)',
      input: notDone, setInput: setNotDone, multiline: true,
      placeholder: 'Не успел позвонить клиенту...',
    },
    plans: {
      title: 'Планы на завтра',
      hint: 'Каждая задача с новой строки',
      input: plansText, setInput: setPlansText, multiline: true,
      placeholder: 'Закончить отчёт\nПозвонить в банк\nСходить на прогулку',
    },
  };

  const info = stepInfo[currentStep];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          {STEPS.slice(0, -1).map((s, i) => (
            <View key={s} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
          ))}
        </View>
        <View style={styles.content}>
          <Text style={styles.dateLabel}>{formatDateWithWeekday(dateStr)}</Text>
          {currentStep === 'mood' ? (
            <>
              <Text style={styles.stepTitle}>Оценка дня</Text>
              <Text style={styles.stepHint}>Как в целом прошёл день?</Text>
              {renderMoodSelector()}
              {moodScore && <Text style={styles.moodLabel}>{moodLabel(moodScore)}</Text>}
            </>
          ) : (
            <>
              <Text style={styles.stepTitle}>{info.title}</Text>
              <Text style={styles.stepHint}>{info.hint}</Text>
              <TextInput
                style={[styles.input, info.multiline && styles.inputMultiline]}
                value={info.input}
                onChangeText={info.setInput}
                placeholder={info.placeholder}
                placeholderTextColor={COLORS.textSecondary}
                multiline={info.multiline}
                autoFocus
                textAlignVertical="top"
              />
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
                  <Text style={styles.nextBtnText}>{currentStep === 'plans' ? 'Сохранить' : 'Далее'}</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
          {currentStep === 'not_done' && (
            <TouchableOpacity style={styles.skipBtn} onPress={() => { setNotDone(''); setStep(s => s + 1); }}>
              <Text style={styles.skipBtnText}>Пропустить</Text>
            </TouchableOpacity>
          )}
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
    stepHint: { fontSize: 14, color: C.textSecondary, marginBottom: 20 },
    input: {
      backgroundColor: C.surface, borderRadius: 14, padding: 16,
      fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border,
    },
    inputMultiline: { minHeight: 140, maxHeight: 260 },
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
    actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 24, gap: 12 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 10 },
    backBtnText: { fontSize: 15, color: C.textSecondary },
    nextBtn: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.primary, borderRadius: 14,
      paddingHorizontal: 24, paddingVertical: 14, gap: 8,
    },
    nextBtnDisabled: { opacity: 0.6 },
    nextBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    skipBtn: { alignSelf: 'center', marginTop: 12 },
    skipBtnText: { fontSize: 14, color: C.textSecondary },
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
    doneBtn: { marginTop: 24, backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
    doneBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  });
}
