import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Animated, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { getEntry, upsertEntry, getUser } from '../db/database';
import { dailyTip } from '../services/ai';
import { formatDateWithWeekday, moodLabel } from '../utils';
import { useColors, useTheme } from '../ThemeContext';

const STEPS = ['text', 'mood', 'done_screen'];

const SPHERE_PROMPTS = [
  { icon: '💼', label: 'Работа / учёба' },
  { icon: '🏃', label: 'Здоровье и спорт' },
  { icon: '❤️', label: 'Близкие и общение' },
  { icon: '🌱', label: 'Личное развитие' },
  { icon: '😌', label: 'Отдых и настроение' },
];

const PHOTOS_DIR = FileSystem.documentDirectory + 'diary_photos/';

async function ensurePhotosDir() {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

async function resizePhotoTo720p(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      async (width, height) => {
        try {
          const maxDim = 1280;
          let resize;
          if (width >= height) {
            resize = { width: Math.min(width, maxDim) };
          } else {
            resize = { height: Math.min(height, maxDim) };
          }
          const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
          );
          resolve(result);
        } catch (e) {
          reject(e);
        }
      },
      reject
    );
  });
}

async function savePhotoToDiary(uri, dateStr) {
  await ensurePhotosDir();
  const timestamp = Date.now();
  const destPath = PHOTOS_DIR + `diary_${dateStr}_${timestamp}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: destPath });
  return destPath;
}

async function deletePhotoFile(photoPath) {
  if (!photoPath) return;
  try {
    const info = await FileSystem.getInfoAsync(photoPath);
    if (info.exists) {
      await FileSystem.deleteAsync(photoPath, { idempotent: true });
    }
  } catch (_) {}
}

export default function EntryScreen({ route, navigation }) {
  const COLORS = useColors();
  const { isDark } = useTheme();
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
  const [photoUri, setPhotoUri] = useState(null); // local display URI
  const [savedPhotoPath, setSavedPhotoPath] = useState(null); // DB path
  const [originalPhotoPath, setOriginalPhotoPath] = useState(null); // for edit mode

  const stepAnim = useRef(new Animated.Value(1)).current;
  const doneAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (editMode) loadExisting();
  }, [editMode]);

  const loadExisting = async () => {
    const entry = await getEntry(dateStr);
    if (entry) {
      setText(entry.done || '');
      setMoodScore(entry.mood_score || null);
      setAiTip(entry.ai_tip || '');
      if (entry.photo_path) {
        const info = await FileSystem.getInfoAsync(entry.photo_path);
        if (info.exists) {
          setPhotoUri(entry.photo_path);
          setSavedPhotoPath(entry.photo_path);
          setOriginalPhotoPath(entry.photo_path);
        }
      }
    }
  };

  const currentStep = STEPS[step];

  const animateStepTransition = (callback) => {
    Animated.sequence([
      Animated.timing(stepAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      callback();
      Animated.timing(stepAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const pickPhoto = async (fromCamera = false) => {
    try {
      let result;
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Нет доступа', 'Разреши доступ к камере в настройках');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 1,
          allowsEditing: false,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Нет доступа', 'Разреши доступ к галерее в настройках');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
          allowsEditing: false,
        });
      }

      if (result.canceled) return;
      const pickedUri = result.assets[0].uri;

      // Resize to 720p
      const resized = await resizePhotoTo720p(pickedUri);

      // Save to diary photos dir
      const savedPath = await savePhotoToDiary(resized.uri, dateStr);

      // Delete old photo if replacing
      if (savedPhotoPath && savedPhotoPath !== originalPhotoPath) {
        await deletePhotoFile(savedPhotoPath);
      }

      setPhotoUri(savedPath);
      setSavedPhotoPath(savedPath);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось добавить фото: ' + e.message);
    }
  };

  const showPhotoPicker = () => {
    Alert.alert('Добавить фото', 'Выберите источник', [
      { text: 'Камера', onPress: () => pickPhoto(true) },
      { text: 'Галерея', onPress: () => pickPhoto(false) },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const removePhoto = () => {
    Alert.alert('Удалить фото?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          if (savedPhotoPath && savedPhotoPath !== originalPhotoPath) {
            await deletePhotoFile(savedPhotoPath);
          }
          setPhotoUri(null);
          setSavedPhotoPath(null);
        },
      },
    ]);
  };

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
    animateStepTransition(() => setStep(s => s + 1));
  };

  const saveEntry = async () => {
    setSaving(true);
    try {
      // If photo was removed in edit mode, delete original file
      if (editMode && originalPhotoPath && savedPhotoPath === null) {
        await deletePhotoFile(originalPhotoPath);
      }
      await upsertEntry(dateStr, {
        done: text.trim(),
        mood_score: moodScore,
        photo_path: savedPhotoPath || null,
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

  const gradientColors = isDark
    ? ['#1e2e3d', '#161520']
    : ['#f9f5eb', '#ede8da'];

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

  useEffect(() => {
    if (currentStep === 'done_screen') {
      Animated.spring(doneAnim, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    }
  }, [currentStep]);

  // ── Completion screen ──
  if (currentStep === 'done_screen') {
    return (
      <LinearGradient colors={gradientColors} style={styles.doneContainer}>
        <Animated.View style={[styles.doneCard, {
          opacity: doneAnim,
          transform: [{ scale: doneAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        }]}>
          <Text style={styles.doneEmoji}>✍️</Text>
          <Text style={styles.doneTitle}>Запись сохранена!</Text>
          <Text style={styles.doneSub}>
            {formatDateWithWeekday(dateStr)} • Оценка дня: {moodScore}/10
          </Text>
          {photoUri && (
            <Image source={{ uri: photoUri }} style={styles.donePhoto} resizeMode="cover" />
          )}
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
        </Animated.View>
      </LinearGradient>
    );
  }

  // ── Input steps ──
  return (
    <LinearGradient colors={gradientColors} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled">

          {/* Progress dots */}
          <View style={styles.progress}>
            {STEPS.slice(0, -1).map((s, i) => (
              <View key={s} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
            ))}
          </View>

          <Animated.View style={[styles.content, { opacity: stepAnim, transform: [{ translateX: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
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

                <View style={styles.paperInput}>
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
                </View>

                {/* Photo section */}
                <View style={styles.photoSection}>
                  {photoUri ? (
                    <View style={styles.photoPreviewWrap}>
                      <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                      <TouchableOpacity style={styles.photoRemoveBtn} onPress={removePhoto}>
                        <Ionicons name="close-circle" size={26} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.photoPickerBtn} onPress={showPhotoPicker}>
                      <Ionicons name="camera-outline" size={20} color={COLORS.primary} />
                      <Text style={styles.photoPickerText}>Прикрепить фото</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
                <TouchableOpacity style={styles.backBtn} onPress={() => animateStepTransition(() => setStep(s => s - 1))}>
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
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function createStyles(C) {
  return StyleSheet.create({
    progress: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 18 },
    progressDot: {
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: C.border, borderWidth: 1.5, borderColor: C.notebookLine,
    },
    progressDotActive: { backgroundColor: C.primary, borderColor: C.primary, width: 24, borderRadius: 5 },
    content: { padding: 20 },
    dateLabel: {
      fontSize: 16, color: C.primary, marginBottom: 8,
       letterSpacing: 0.3,
    },
    stepTitle: {
      fontSize: 26, fontWeight: '700', color: C.text, marginBottom: 6,
      
    },
    stepHint: { fontSize: 14, color: C.textSecondary, marginBottom: 16 },
    promptsToggle: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      marginBottom: 12,
    },
    promptsToggleText: { fontSize: 13, color: C.primary },
    promptsBox: {
      backgroundColor: C.primaryLight, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: C.accent,
      padding: 14, marginBottom: 16, gap: 6,
    },
    promptItem: { fontSize: 14, color: C.text },
    promptsHint: {
      fontSize: 12, color: C.textSecondary,
      marginTop: 8, lineHeight: 17,
    },
    // Paper-styled input wrapper
    paperInput: {
      backgroundColor: C.surface,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: C.notebookLine,
      borderLeftWidth: 4,
      borderLeftColor: C.accent,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      marginBottom: 16,
    },
    textInput: {
      padding: 16,
      paddingTop: 12,
      fontSize: 16,
      color: C.text,
      minHeight: 220,
      maxHeight: 380,
      lineHeight: 26,
      
    },
    // Photo
    photoSection: { marginBottom: 8 },
    photoPickerBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.primaryLight,
      borderRadius: 12, borderWidth: 1, borderColor: C.notebookLine,
      borderStyle: 'dashed',
      paddingVertical: 14, paddingHorizontal: 16,
      justifyContent: 'center',
    },
    photoPickerText: { fontSize: 14, color: C.primary, fontWeight: '500' },
    photoPreviewWrap: { position: 'relative', borderRadius: 12, overflow: 'hidden' },
    photoPreview: {
      width: '100%', height: 200,
      borderRadius: 12,
    },
    photoRemoveBtn: {
      position: 'absolute', top: 8, right: 8,
      backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 13,
    },
    moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
    moodBtn: {
      width: 52, height: 52, borderRadius: 10,
      backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.notebookLine,
      justifyContent: 'center', alignItems: 'center',
      elevation: 2,
    },
    moodBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    moodBtnText: { fontSize: 18, fontWeight: '600', color: C.text },
    moodBtnTextActive: { color: '#fff' },
    moodLabel: {
      fontSize: 18, color: C.text, marginTop: 16, textAlign: 'center',
      
    },
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
      elevation: 3,
    },
    nextBtnDisabled: { opacity: 0.6 },
    nextBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    // Done screen
    doneContainer: { flex: 1, justifyContent: 'center', padding: 20 },
    doneCard: {
      backgroundColor: C.surface, borderRadius: 20, padding: 28, alignItems: 'center',
      elevation: 6,
      borderWidth: 1, borderColor: C.notebookLine,
      borderTopWidth: 4, borderTopColor: C.primary,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    },
    doneEmoji: { fontSize: 52, marginBottom: 12 },
    doneTitle: {
      fontSize: 28, fontWeight: '700', color: C.text,
      
    },
    doneSub: { fontSize: 14, color: C.textSecondary, marginTop: 6, textAlign: 'center' },
    donePhoto: {
      width: '100%', height: 180, borderRadius: 12, marginTop: 16,
    },
    tipLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
    tipLoadingText: { fontSize: 13, color: C.textSecondary },
    tipBox: {
      backgroundColor: C.primaryLight, borderRadius: 14, padding: 16, marginTop: 20, width: '100%',
      borderLeftWidth: 3, borderLeftColor: C.primary,
    },
    tipLabel: { fontSize: 13, fontWeight: '600', color: C.primary, marginBottom: 6 },
    tipText: { fontSize: 14, color: C.text, lineHeight: 20 },
    doneBtn: {
      marginTop: 24, backgroundColor: C.primary,
      borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14,
      elevation: 3,
    },
    doneBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  });
}
