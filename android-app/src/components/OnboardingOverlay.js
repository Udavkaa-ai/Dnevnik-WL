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

  // Background overlay fade
  const overlayFade = useRef(new Animated.Value(0)).current;
  // Tooltip card fade + slide per step
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;
  // Active dot pulse
  const dotPulse = useRef(new Animated.Value(1)).current;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const total = TOUR_STEPS.length;

  // Pulse animation for the active dot
  const runDotPulse = () => {
    dotPulse.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      { iterations: 3 }
    ).start();
  };

  // Animate card in
  const animateCardIn = () => {
    cardFade.setValue(0);
    cardSlide.setValue(28);
    Animated.parallel([
      Animated.timing(cardFade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 0, useNativeDriver: true, tension: 70, friction: 9 }),
    ]).start(() => runDotPulse());
  };

  useEffect(() => {
    if (!isActive) {
      Animated.timing(overlayFade, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      cardFade.setValue(0);
      cardSlide.setValue(28);
      return;
    }

    // Fade in the dark overlay once when tour starts (not per step)
    if (currentStep === 0) {
      overlayFade.setValue(0);
      Animated.timing(overlayFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }

    setHighlight(null);
    animateCardIn();

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

  const getTooltipTop = () => {
    const tooltipH = 260;
    const minTop = 50;
    const maxTop = SCREEN_H - tooltipH - 20;

    if (!hasHL || step.tooltipPosition === 'center') {
      return Math.max(minTop, SCREEN_H / 2 - tooltipH / 2);
    }

    const hl = highlight;
    const margin = 14;

    let preferred;
    if (step.tooltipPosition === 'top') {
      preferred = hl.y - tooltipH - margin;
      if (preferred < minTop) preferred = hl.y + hl.height + margin;
    } else {
      preferred = hl.y + hl.height + margin;
      if (preferred > maxTop) preferred = hl.y - tooltipH - margin;
    }

    return Math.max(minTop, Math.min(maxTop, preferred));
  };

  return (
    <Modal
      visible={isActive}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={skipTour}
    >
      <Animated.View style={[styles.root, { opacity: overlayFade }]}>
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

        {/* Tooltip card — fades + slides in per step */}
        <Animated.View
          style={[
            styles.tooltip,
            {
              backgroundColor: COLORS.surface,
              top: getTooltipTop(),
              opacity: cardFade,
              transform: [{ translateY: cardSlide }],
            },
          ]}
        >
          {/* Notebook-style top accent strip */}
          <View style={[styles.tooltipAccent, { backgroundColor: COLORS.primary }]} />

          {/* Header: dots + skip */}
          <View style={styles.headerRow}>
            <View style={styles.dotsRow}>
              {TOUR_STEPS.map((_, i) => {
                const isActive = i === currentStep;
                const isPast = i < currentStep;
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isPast || isActive ? COLORS.primary : COLORS.border,
                        width: isActive ? 22 : 6,
                        transform: isActive ? [{ scale: dotPulse }] : [],
                      },
                    ]}
                  />
                );
              })}
            </View>
            <TouchableOpacity onPress={skipTour} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
            activeOpacity={0.8}
          >
            {!isLast ? (
              <>
                <Text style={styles.nextBtnText}>Далее</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" style={{ marginLeft: 6 }} />
              </>
            ) : (
              <>
                <Text style={styles.nextBtnText}>Начать!</Text>
                <Ionicons name="rocket-outline" size={15} color="#fff" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Step counter */}
          <Text style={[styles.counter, { color: COLORS.textSecondary }]}>
            {currentStep + 1} / {total}
          </Text>
        </Animated.View>
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
    borderWidth: 2.5,
    borderColor: '#6c63ff',
  },
  tooltip: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 18,
    padding: 20,
    paddingTop: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  tooltipAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 3,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
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
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  counter: {
    fontSize: 12,
    textAlign: 'center',
  },
});
