import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Pressable, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAllEntries } from '../db/database';
import { formatDateFull, moodColor, moodEmoji } from '../utils';
import { COLORS } from '../theme';

export default function DiaryScreen({ navigation }) {
  const [entries, setEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);

  useFocusEffect(useCallback(() => {
    getAllEntries().then(setEntries).catch(e => console.log('Diary load error:', e.message));
  }, []));

  const renderEntry = ({ item }) => (
    <TouchableOpacity
      style={styles.entryCard}
      onPress={() => setSelectedEntry(item)}
    >
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
          <Text style={styles.entryPreview} numberOfLines={2}>
            {item.done}
          </Text>
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
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={60} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Пока нет записей</Text>
            <Text style={styles.emptySubtext}>
              Добавь первую запись через «Итог дня» на главной
            </Text>
          </View>
        }
        ListHeaderComponent={
          entries.length > 0 ? (
            <Text style={styles.listHeader}>{entries.length} записей</Text>
          ) : null
        }
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
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>✅ Что сделал</Text>
                    <Text style={styles.sectionText}>{selectedEntry.done}</Text>
                  </View>
                )}

                {selectedEntry.not_done && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>❌ Не получилось</Text>
                    <Text style={styles.sectionText}>{selectedEntry.not_done}</Text>
                  </View>
                )}

                {selectedEntry.ai_tip && (
                  <View style={[styles.section, styles.tipSection]}>
                    <Text style={styles.sectionTitle}>💡 Совет</Text>
                    <Text style={styles.sectionText}>{selectedEntry.ai_tip}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listHeader: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 },
  entryCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    gap: 12,
  },
  entryLeft: { alignItems: 'center', paddingTop: 2 },
  moodCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  moodEmoji: { fontSize: 22 },
  entryRight: { flex: 1 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  entryDate: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  entryMood: { fontSize: 14, fontWeight: '700' },
  entryPreview: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalDate: { fontSize: 16, fontWeight: '600', color: COLORS.text, flex: 1 },
  moodBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  moodBannerEmoji: { fontSize: 28 },
  moodBannerScore: { fontSize: 22, fontWeight: '700' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  sectionText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  tipSection: { backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 14 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    justifyContent: 'center', paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 8,
  },
  editBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '500' },
});
