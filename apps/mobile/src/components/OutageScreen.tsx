import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type OutageMood = {
  icon: IconName;
  title: string;
  message: string;
};

const OUTAGE_MOODS: OutageMood[] = [
  {
    icon: 'paw-outline',
    message: "Our server went for a walk and forgot to come back. Chasing it down now.",
    title: 'A stray connection ran off!',
  },
  {
    icon: 'rainy-outline',
    message: "It's raining packets somewhere else. Give it a moment to clear up.",
    title: "Signal's stuck in traffic",
  },
  {
    icon: 'bug-outline',
    message: 'A tiny bug is doing yoga in our servers. We are gently asking it to leave.',
    title: 'One curious little bug',
  },
  {
    icon: 'battery-dead-outline',
    message: 'Somewhere, a server is taking an unscheduled nap. We are waking it up with coffee.',
    title: 'Server power nap',
  },
  {
    icon: 'planet-outline',
    message: "We may have briefly lost contact with planet Wi-Fi. Reconnecting the antenna.",
    title: 'Lost the satellite link',
  },
];

function randomMood(): OutageMood {
  return OUTAGE_MOODS[Math.floor(Math.random() * OUTAGE_MOODS.length)];
}

/** A tiny offline tap-the-target game so waiting does not feel wasted. No network or assets needed. */
function TapDodgeGame() {
  const [score, setScore] = useState(0);
  const [boardSize, setBoardSize] = useState({ height: 0, width: 0 });
  const position = useRef(new Animated.ValueXY({ x: 20, y: 20 })).current;
  const targetSize = 52;

  function moveTarget() {
    if (boardSize.width <= targetSize || boardSize.height <= targetSize) return;
    const nextX = Math.random() * (boardSize.width - targetSize);
    const nextY = Math.random() * (boardSize.height - targetSize);
    Animated.spring(position, {
      friction: 6,
      toValue: { x: nextX, y: nextY },
      useNativeDriver: true,
    }).start();
  }

  function onLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;
    setBoardSize({ height, width });
  }

  function onTap() {
    setScore((current) => current + 1);
    moveTarget();
  }

  return (
    <View style={styles.gameWrapper}>
      <Text style={styles.gameScore}>While you wait, tap the target: {score}</Text>
      <View onLayout={onLayout} style={styles.gameBoard}>
        <Animated.View
          style={[
            styles.gameTarget,
            { height: targetSize, transform: position.getTranslateTransform(), width: targetSize },
          ]}
        >
          <Pressable accessibilityLabel="Tap target" onPress={onTap} style={styles.gameTargetPressable}>
            <Ionicons name="game-controller-outline" size={22} color={colors.surface} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

type OutageScreenProps = {
  onRetry?: () => void;
  showGame?: boolean;
};

/** Full-screen fallback shown for network errors or service outages, with a light-hearted tone. */
export function OutageScreen({ onRetry, showGame = true }: Readonly<OutageScreenProps>) {
  const [mood] = useState(randomMood);

  return (
    <View style={styles.wrapper}>
      <View style={styles.iconCircle}>
        <Ionicons color={colors.surface} name={mood.icon} size={44} />
      </View>
      <Text style={styles.title}>{mood.title}</Text>
      <Text style={styles.message}>{mood.message}</Text>

      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Ionicons color={colors.surface} name="refresh" size={16} />
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      ) : null}

      {showGame ? <TapDodgeGame /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 28 },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    marginBottom: 18,
    width: 96,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  message: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  retryButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  gameWrapper: { alignItems: 'center', marginTop: 28, width: '100%' },
  gameScore: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 10 },
  gameBoard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 220,
    overflow: 'hidden',
    width: '100%',
  },
  gameTarget: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  gameTargetPressable: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: 26,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
});
