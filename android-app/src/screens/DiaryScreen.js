import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Pressable,
  ScrollView, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAllEntries } from '../db/database';
import { formatDateFull, moodColor, moodEmoji, today, addDays } from '../utils';
import { useColors } from '../ThemeContext';

// Build a simple calendar for date selection (current month + prev months)
function DatePickerModal({ visible, onClose, onSelect, existingDates }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const todayStr = today();
  const todayDate = new Date(todayStr + 'T00:00:00');

  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth()); // 0-indexed

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

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  // Convert to Mon-first: 0=Mon
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
                  style={[
                    styles.calCell,
                    isToday && styles.calCellToday,
                    isFuture && styles.calCellDisabled,
                  ]}
                  onPress={() => { if (!isFuture) { onSelect(dateStr); onClose(); } }}
                  disabled={isFuture}
                >
                  <Text style={[
                    styles.calDayText,
                    isToday && styles.calDayToday,
                    isFuture && styles.calDayDisabled,
                  ]}>
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
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

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

  const renderEntry = ({ item }) => (
    <TouchableOpacity style={styles.entryCard} onPress={() => setSelectedEntry(item)}>
      <View style={styles.entryLeft}>
        <View style={[styles.moodCircle, { backgroundColor: moodColor(item.mood_score) + '22' }]}>
          <Text style={styles.moodEmoji}>{moodEmoji(item.mood_score)}</Text>
        </View>
      </View>
      <View style={styles.entryRight}>
        <View style={styles.entryHeader}>
          <Text style={styles.entryDate}>{formatDateFull(item.date)}</Text>
          {item.mood_score && (
            <Text style={[styles.entryMood, { color: moodColor(item.mood_score) }]}>
              {item.mood_score}/10
            </Text>
          )}
        </View>
        {item.done && (
          <Text style={styles.entryPreview} numberOfLines={2}>{item.done}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={item => String(item.id)}
        renderItem={renderEntry}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={60} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Пока нет записей</Text>
            <Text style={styles.emptySubtext}>Нажми на кнопку «Итог дня» на главной или выбери дату через календарь</Text>
          </View>
        }
        ListHeaderComponent={
          entries.length > 0 ? <Text style={styles.listHeader}>{entries.length} записей</Text> : null
        }
      />

      {/* FAB — add entry for any date */}
      <TouchableOpacity style={styles.fab} onPress={() => setCalendarVisible(true)}>
        <Ionicons name="calendar-outline" size={24} color="#fff" />
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
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedEntry(null)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            {selectedEntry && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalDate}>{formatDateFull(selectedEntry.date)}</Text>
                  <TouchableOpacity onPress={() => setSelectedEntry(null)}>
                    <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {selectedEntry.mood_score && (
                  <View style={[styles.moodBanner, { backgroundColor: moodColor(selectedEntry.mood_score) + '22' }]}>
                    <Text style={styles.moodBannerEmoji}>{moodEmoji(selectedEntry.mood_score)}</Text>
                    <Text style={[styles.moodBannerScore, { color: moodColor(selectedEntry.mood_score) }]}>
                      {selectedEntry.mood_score}/10
                    </Text>
                  </View>
                )}

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

                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => {
                    setSelectedEntry(null);
                    navigation.navigate('Entry', { date: selectedEntry.date, editMode: true });
                  }}
                >
                  <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.editBtnText}>Редактировать запись</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    listHeader: { fontSize: 13, color: C.textSecondary, marginBottom: 12 },
    entryCard: {
      flexDirection: 'row', backgroundColor: C.surface,
      borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2, gap: 12,
    },
    entryLeft: { alignItems: 'center', paddingTop: 2 },
    moodCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    moodEmoji: { fontSize: 22 },
    entryRight: { flex: 1 },
    entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    entryDate: { fontSize: 13, color: C.textSecondary, flex: 1 },
    entryMood: { fontSize: 14, fontWeight: '700' },
    entryPreview: { fontSize: 14, color: C.text, lineHeight: 20 },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyText: { fontSize: 18, fontWeight: '600', color: C.text, marginTop: 16 },
    emptySubtext: { fontSize: 14, color: C.textSecondary, marginTop: 6, textAlign: 'center' },
    fab: {
      position: 'absolute', bottom: 24, right: 24,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: C.primary,
      justifyContent: 'center', alignItems: 'center',
      elevation: 6, shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8,
    },
    // Calendar
    calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    calMonthLabel: { fontSize: 17, fontWeight: '700', color: C.text },
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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40, maxHeight: '85%',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalDate: { fontSize: 16, fontWeight: '600', color: C.text, flex: 1 },
    moodBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, marginBottom: 16 },
    moodBannerEmoji: { fontSize: 28 },
    moodBannerScore: { fontSize: 22, fontWeight: '700' },
    detailSection: { marginBottom: 16 },
    detailSectionTitle: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 6 },
    detailSectionText: { fontSize: 15, color: C.text, lineHeight: 22 },
    tipSection: { backgroundColor: C.primaryLight, borderRadius: 12, padding: 14 },
    editBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
      paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.border, marginTop: 8,
    },
    editBtnText: { fontSize: 15, color: C.primary, fontWeight: '500' },
  });
}
