import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOnboarding, TOUR_STEPS } from '../context/OnboardingContext';
import { useColors } from '../ThemeContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HL_PADDING = 8;

export default function OnboardingOverlay() {
  const { isActive, currentStep, getRef, nextStep, skipTour } = useOnboarding();
  const COLORS = useColors();
  const [highlight, setHighlight] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const total = TOUR_STEPS.length;

  useEffect(() => {
    if (!isActive) {
      fadeAnim.setValue(0);
      return;
    }

    setHighlight(null);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    if (!step.targetRef) return;

    let attempts = 0;
    const tryMeasure = () => {
      const ref = getRef(step.targetRef);
      if (ref) {
        ref.measure((x, y, width, height, pageX, pageY) => {
          if (width > 0 && height > 0) {
            setHighlight({
              x: pageX - HL_PADDING,
              y: pageY - HL_PADDING,
              width: width + HL_PADDING * 2,
              height: height + HL_PADDING * 2,
            });
          } else if (attempts < 6) {
            attempts++;
            setTimeout(tryMeasure, 200);
          }
        });
      } else if (attempts < 6) {
        attempts++;
        setTimeout(tryMeasure, 200);
      }
    };

    const timer = setTimeout(tryMeasure, 400);
    return () => clearTimeout(timer);
  }, [isActive, currentStep]);

  if (!isActive) return null;

  const hasHL = highlight !== null;

  // Tooltip vertical position: below the highlight if there's room, otherwise above
  const getTooltipTop = () => {
    if (!hasHL || step.tooltipPosition === 'center') {
      return SCREEN_H / 2 - 130;
    }
    const hl = highlight;
    const tooltipH = 210;
    const margin = 14;
    if (step.tooltipPosition === 'top') {
      const above = hl.y - tooltipH - margin;
      return above > 60 ? above : hl.y + hl.height + margin;
    }
    const below = hl.y + hl.height + margin;
    return below + tooltipH < SCREEN_H - 40 ? below : hl.y - tooltipH - margin;
  };

  return (
    <Modal
      visible={isActive}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={skipTour}
    >
      <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
        {/* Spotlight: four dark rectangles around the highlighted element */}
        {hasHL ? (
          <>
            <View style={[styles.dark, { top: 0, left: 0, right: 0, height: highlight.y }]} />
            <View style={[styles.dark, { top: highlight.y + highlight.height, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.dark, { top: highlight.y, left: 0, width: highlight.x, height: highlight.height }]} />
            <View style={[styles.dark, { top: highlight.y, left: highlight.x + highlight.width, right: 0, height: highlight.height }]} />
            <View style={[styles.ring, {
              top: highlight.y,
              left: highlight.x,
              width: highlight.width,
              height: highlight.height,
            }]} />
          </>
        ) : (
          <View style={[styles.dark, { top: 0, left: 0, right: 0, bottom: 0 }]} />
        )}

        {/* Tooltip card */}
        <View style={[
          styles.tooltip,
          {
            backgroundColor: COLORS.surface,
            top: getTooltipTop(),
          },
        ]}>
          {/* Header row: progress + skip */}
          <View style={styles.headerRow}>
            <View style={styles.dotsRow}>
              {TOUR_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i <= currentStep ? COLORS.primary : COLORS.border,
                      width: i === currentStep ? 18 : 6,
                    },
                  ]}
                />
              ))}
            </View>
            <TouchableOpacity onPress={skipTour} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.skipText, { color: COLORS.textSecondary }]}>Пропустить</Text>
            </TouchableOpacity>
          </View>

          {/* Step content */}
          <Text style={[styles.title, { color: COLORS.text }]}>{step.title}</Text>
          <Text style={[styles.description, { color: COLORS.textSecondary }]}>{step.description}</Text>

          {/* Next / Finish button */}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: COLORS.primary }]}
            onPress={isLast ? skipTour : nextStep}
          >
            {!isLast ? (
              <>
                <Text style={styles.nextBtnText}>Далее</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" style={{ marginLeft: 6 }} />
              </>
            ) : (
              <Text style={styles.nextBtnText}>Начать!</Text>
            )}
          </TouchableOpacity>

          {/* Step counter */}
          <Text style={[styles.counter, { color: COLORS.textSecondary }]}>
            {currentStep + 1} / {total}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dark: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  ring: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6c63ff',
  },
  tooltip: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  skipText: {
    fontSize: 13,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  nextBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  counter: {
    fontSize: 12,
    textAlign: 'center',
  },
});
