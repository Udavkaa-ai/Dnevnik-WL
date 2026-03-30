import React, { useRef, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Modal, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ITEM_H = 64;
const VISIBLE = 5;
const PAD = 2;

function Column({ data, selected, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    const idx = data.indexOf(selected);
    if (ref.current && idx >= 0) {
      setTimeout(() => {
        ref.current?.scrollToOffset({ offset: idx * ITEM_H, animated: false });
      }, 80);
    }
  }, [selected]);

  const handleMomentumScrollEnd = useCallback((e) => {
    const offset = e.nativeEvent.contentOffset.y;
    const newIdx = Math.round(offset / ITEM_H);
    onChange(data[Math.max(0, Math.min(newIdx, data.length - 1))]);
  }, [data, onChange]);

  return (
    <FlatList
      ref={ref}
      data={data}
      keyExtractor={(item) => String(item)}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      style={{ height: VISIBLE * ITEM_H, width: 110 }}
      contentContainerStyle={{ paddingVertical: PAD * ITEM_H }}
      getItemLayout={(_, index) => ({ length: ITEM_H, offset: index * ITEM_H, index })}
      renderItem={({ item }) => {
        const isSel = item === selected;
        return (
          <View style={colStyles.item}>
            <Text style={[colStyles.text, isSel && colStyles.textSel]}>
              {String(item).padStart(2, '0')}
            </Text>
          </View>
        );
      }}
    />
  );
}

const colStyles = StyleSheet.create({
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 26, fontWeight: '300', color: 'rgba(255,255,255,0.3)' },
  textSel: { fontSize: 40, fontWeight: '600', color: '#fff' },
});

// Main exported component - a Modal wrapper
export default function TimePickerModal({ visible, initial, onConfirm, onCancel }) {
  const parseInitial = (str) => {
    if (!str) return { h: 9, m: 0 };
    const [h, m] = str.split(':').map(Number);
    return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m };
  };

  const [hours, setHours] = React.useState(() => parseInitial(initial).h);
  const [minutes, setMinutes] = React.useState(() => parseInitial(initial).m);

  // Reset when opened
  useEffect(() => {
    if (visible) {
      const { h, m } = parseInitial(initial);
      setHours(h);
      setMinutes(m);
    }
  }, [visible, initial]);

  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINS = Array.from({ length: 60 }, (_, i) => i);

  const handleConfirm = () => {
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    onConfirm(`${hh}:${mm}`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Highlight bar */}
          <View style={styles.highlight} />

          {/* Columns */}
          <View style={styles.picker}>
            <Column data={HOURS} selected={hours} onChange={setHours} />
            <Text style={styles.colon}>:</Text>
            <Column data={MINS} selected={minutes} onChange={setMinutes} />
          </View>

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnCancel} onPress={onCancel}>
              <Text style={styles.btnCancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnOk} onPress={handleConfirm}>
              <LinearGradient colors={['#4a7fa8', '#2d5070']} style={styles.btnOkGrad}>
                <Text style={styles.btnOkText}>Готово</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#111',
    borderRadius: 20,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  highlight: {
    position: 'absolute',
    top: VISIBLE * ITEM_H / 2 - ITEM_H / 2,
    left: 0,
    right: 0,
    height: ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    pointerEvents: 'none',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  colon: {
    fontSize: 36,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
    marginTop: -6,
    paddingHorizontal: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  btnCancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },
  btnOk: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  btnOkGrad: { paddingVertical: 14, alignItems: 'center' },
  btnOkText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
