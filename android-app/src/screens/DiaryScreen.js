import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Pressable,
  ScrollView, Image, TouchableWithoutFeedback,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAllEntries } from '../db/database';
import { formatDateFull, moodColor, moodEmoji, today } from '../utils';
import { useColors, useTheme } from '../ThemeContext';
import { useOnboarding } from '../context/OnboardingContext';

function DatePickerModal({ visible, onClose, onSelect, existingDates }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const todayStr = today();
  const todayDate = new Date(todayStr + 'T00:00:00');

  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь',
    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pad = (n) => String(n).padStart(2, '0');
  const monthStr = `${year}-${pad(month + 1)}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={() => {}}>
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>{monthNames[month]} {year}</Text>
            <TouchableOpacity
              onPress={() => changeMonth(1)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              disabled={`${year}-${pad(month + 1)}` >= `${todayDate.getFullYear()}-${pad(todayDate.getMonth() + 1)}`}
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={monthStr >= `${todayDate.getFullYear()}-${pad(todayDate.getMonth() + 1)}` ? COLORS.border : COLORS.primary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.calWeekRow}>
            {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
              <Text key={d} style={styles.calWeekDay}>{d}</Text>
            ))}
          </View>

          <View style={styles.calGrid}>
            {cells.map((day, idx) => {
              if (!day) return <View key={`e${idx}`} style={styles.calCell} />;
              const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > todayStr;
              const hasEntry = existingDates.includes(dateStr);

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.calCell, isToday && styles.calCellToday, isFuture && styles.calCellDisabled]}
                  onPress={() => { if (!isFuture) { onSelect(dateStr); onClose(); } }}
                  disabled={isFuture}
                >
                  <Text style={[styles.calDayText, isToday && styles.calDayToday, isFuture && styles.calDayDisabled]}>
                    {day}
                  </Text>
                  {hasEntry && <View style={[styles.calDot, isToday && { backgroundColor: '#fff' }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.calHint}>
            Точка под датой — запись уже есть (можно редактировать)
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function DiaryScreen({ navigation }) {
  const COLORS = useColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { registerRef } = useOnboarding();

  const [entries, setEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    getAllEntries().then(setEntries).catch(e => console.log('Diary load error:', e.message));
  }, []));

  const existingDates = entries.map(e => e.date);

  const handleDateSelect = (dateStr) => {
    const hasEntry = existingDates.includes(dateStr);
    navigation.navigate('Entry', { date: dateStr, editMode: hasEntry });
  };

  const gradientBg = isDark
    ? ['#161520', '#1a1830']
    : ['#f9f5eb', '#ede8da'];

  const renderEntry = ({ item, index }) => {
    const accent = moodColor(item.mood_score);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setSelectedEntry(item)}
      >
        <View style={[styles.entryCard, { borderLeftColor: accent }]}>
          {/* Mood badge */}
          <View style={[styles.moodBadge, { backgroundColor: accent + '22' }]}>
            <Text style={styles.moodEmoji}>{moodEmoji(item.mood_score)}</Text>
            {item.mood_score != null && (
              <Text style={[styles.moodScore, { color: accent }]}>{item.mood_score}</Text>
            )}
          </View>

          {/* Content */}
          <View style={styles.entryContent}>
            <Text style={styles.entryDate}>{formatDateFull(item.date)}</Text>
            {item.done ? (
              <Text style={styles.entryPreview} numberOfLines={2}>{item.done}</Text>
            ) : null}
            <View style={styles.entryFooter}>
              {item.photo_path ? (
                <View style={styles.photoIndicator}>
                  <Ionicons name="image-outline" size={12} color={COLORS.primary} />
                  <Text style={styles.photoIndicatorText}>фото</Text>
                </View>
              ) : null}
              {item.ai_tip ? (
                <View style={styles.tipIndicator}>
                  <Ionicons name="bulb-outline" size={12} color={COLORS.textSecondary} />
                </View>
              ) : null}
            </View>
          </View>

          {/* Photo thumbnail */}
          {item.photo_path ? (
            <Image
              source={{ uri: item.photo_path }}
              style={styles.entryThumb}
              resizeMode="cover"
            />
          ) : null}

          {/* Decorative corner fold */}
          <View style={styles.cornerFold} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={gradientBg} style={{ flex: 1 }}>
      <View ref={registerRef('diaryList')} collapsable={false} style={{ flex: 1 }}>
        <FlatList
          data={entries}
          keyExtractor={item => String(item.id)}
          renderItem={renderEntry}
          contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📖</Text>
              <Text style={styles.emptyText}>Страницы пусты</Text>
              <Text style={styles.emptySubtext}>
                Нажми на кнопку «Итог дня» на главной или выбери дату через календарь
              </Text>
            </View>
          }
        />

        {/* FAB */}
        <TouchableOpacity style={styles.fab} onPress={() => setCalendarVisible(true)}>
          <LinearGradient
            colors={['#4a7fa8', '#2d5070']}
            style={styles.fabGradient}
          >
            <Ionicons name="calendar-outline" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Calendar date picker */}
        <DatePickerModal
          visible={calendarVisible}
          onClose={() => setCalendarVisible(false)}
          onSelect={handleDateSelect}
          existingDates={existingDates}
        />

        {/* Entry Detail Modal */}
        <Modal
          visible={!!selectedEntry}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedEntry(null)}
        >
          <View style={styles.modalOverlay}>
            {/* Tap backdrop to close */}
            <TouchableWithoutFeedback onPress={() => setSelectedEntry(null)}>
              <View style={StyleSheet.absoluteFillObject} />
            </TouchableWithoutFeedback>

            {/* Modal sheet — plain View so ScrollView works freely */}
            <View style={styles.modalContent}>
              {selectedEntry && (
                <>
                  {/* Gradient header — outside ScrollView so always visible */}
                  <LinearGradient
                    colors={isDark ? ['#1e2e3d', '#0f1a26'] : ['#3d6b8e', '#2d5070']}
                    style={styles.modalHeaderGradient}
                  >
                    <View style={styles.modalHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalDate}>{formatDateFull(selectedEntry.date)}</Text>
                        {selectedEntry.mood_score && (
                          <Text style={styles.modalMoodLine}>
                            {moodEmoji(selectedEntry.mood_score)}  {selectedEntry.mood_score}/10
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => setSelectedEntry(null)} style={styles.modalCloseBtn}>
                        <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>

                  {/* Scrollable body */}
                  <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ paddingBottom: 90 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {/* Photo — contain so vertical photos aren't cropped */}
                    {selectedEntry.photo_path ? (
                      <View style={styles.modalPhotoWrap}>
                        <Image
                          source={{ uri: selectedEntry.photo_path }}
                          style={styles.modalPhoto}
                          resizeMode="contain"
                        />
                      </View>
                    ) : null}

                    {selectedEntry.done && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>📝 Запись дня</Text>
                        <Text style={styles.detailSectionText}>{selectedEntry.done}</Text>
                      </View>
                    )}
                    {selectedEntry.not_done && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>📌 Заметка</Text>
                        <Text style={styles.detailSectionText}>{selectedEntry.not_done}</Text>
                      </View>
                    )}
                    {selectedEntry.ai_tip && (
                      <View style={[styles.detailSection, styles.tipSection]}>
                        <Text style={styles.detailSectionTitle}>💡 Совет</Text>
                        <Text style={styles.detailSectionText}>{selectedEntry.ai_tip}</Text>
                      </View>
                    )}
                  </ScrollView>

                  {/* Floating edit FAB — outside ScrollView, always visible */}
                  <TouchableOpacity
                    style={styles.floatingEditBtn}
                    onPress={() => {
                      setSelectedEntry(null);
                      navigation.navigate('Entry', { date: selectedEntry.date, editMode: true });
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="create" size={22} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </LinearGradient>
  );
}

function createStyles(C) {
  return StyleSheet.create({
    // Entry card
    entryCard: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 12,
      marginBottom: 10,
      borderLeftWidth: 4,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      overflow: 'hidden',
      minHeight: 80,
    },
    moodBadge: {
      width: 56, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 12, gap: 2,
    },
    moodEmoji: { fontSize: 22 },
    moodScore: { fontSize: 12, fontWeight: '700' },
    entryContent: {
      flex: 1, paddingVertical: 12, paddingHorizontal: 10,
      justifyContent: 'center',
    },
    entryDate: {
      fontSize: 14, color: C.textSecondary,
       marginBottom: 3,
    },
    entryPreview: {
      fontSize: 14, color: C.text, lineHeight: 20,
    },
    entryFooter: {
      flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center',
    },
    photoIndicator: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
    },
    photoIndicatorText: {
      fontSize: 11, color: C.primary,
    },
    tipIndicator: {
      alignItems: 'center',
    },
    entryThumb: {
      width: 72, height: '100%', borderTopRightRadius: 12, borderBottomRightRadius: 12,
    },
    cornerFold: {
      position: 'absolute', top: 0, right: 0,
      width: 0, height: 0,
      borderTopWidth: 16, borderRightWidth: 16,
      borderTopColor: C.notebookLine, borderRightColor: C.background,
      borderLeftWidth: 0, borderBottomWidth: 0,
    },
    // Empty state
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyIcon: { fontSize: 60 },
    emptyText: {
      fontSize: 20, fontWeight: '600', color: C.text, marginTop: 12,
      
    },
    emptySubtext: {
      fontSize: 14, color: C.textSecondary, marginTop: 8,
      textAlign: 'center', lineHeight: 20,
    },
    // FAB
    fab: {
      position: 'absolute', bottom: 24, right: 24,
      width: 56, height: 56, borderRadius: 28,
      elevation: 8,
      shadowColor: '#3d6b8e',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8,
    },
    fabGradient: {
      width: 56, height: 56, borderRadius: 28,
      justifyContent: 'center', alignItems: 'center',
    },
    // Calendar
    calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    calMonthLabel: { fontSize: 17, fontWeight: '700', color: C.text, fontFamily: 'Caveat_700Bold' },
    calWeekRow: { flexDirection: 'row', marginBottom: 6 },
    calWeekDay: { flex: 1, textAlign: 'center', fontSize: 12, color: C.textSecondary, fontWeight: '600' },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
    calCellToday: { backgroundColor: C.primary, borderRadius: 22 },
    calCellDisabled: { opacity: 0.3 },
    calDayText: { fontSize: 15, color: C.text, fontWeight: '500' },
    calDayToday: { color: '#fff', fontWeight: '700' },
    calDayDisabled: { color: C.textSecondary },
    calDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.primary, position: 'absolute', bottom: 4 },
    calHint: { fontSize: 11, color: C.textSecondary, textAlign: 'center', marginTop: 12 },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      height: '88%',
      overflow: 'visible',
    },
    modalHeaderGradient: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden',
    },
    modalHeaderRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    },
    modalDate: {
      fontSize: 22, fontWeight: '700', color: '#fff',
      
    },
    modalMoodLine: {
      fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 4,
      
    },
    modalCloseBtn: {
      padding: 4,
    },
    modalPhotoWrap: {
      backgroundColor: '#000',
      width: '100%',
      maxHeight: 320,
      justifyContent: 'center',
    },
    modalPhoto: {
      width: '100%',
      height: 300,
    },
    detailSection: { marginBottom: 16, paddingHorizontal: 20, paddingTop: 16 },
    detailSectionTitle: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 8 },
    detailSectionText: {
      fontSize: 15, color: C.text, lineHeight: 22,
    },
    tipSection: { backgroundColor: C.primaryLight, borderRadius: 12, marginHorizontal: 20, paddingHorizontal: 14 },
    floatingEditBtn: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
    },
  });
}
