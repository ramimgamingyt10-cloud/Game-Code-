import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, PanResponder, StyleSheet, StatusBar, Platform,
  useColorScheme, useWindowDimensions, Vibration, AppState,
} from 'react-native';

const N = 18;
const THEMES = {
  light: { bg: '#cfd9ba', screen: '#bccaa0', ink: '#26301f', dim: '#97a67f' },
  dark: { bg: '#11160d', screen: '#192213', ink: '#b9e48c', dim: '#2f4023' },
};
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });

const randomFood = (snake) => {
  let f;
  do { f = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; }
  while (snake.some((p) => p.x === f.x && p.y === f.y));
  return f;
};

const fresh = () => {
  const snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
  return { snake, dir: { x: 1, y: 0 }, next: { x: 1, y: 0 }, food: randomFood(snake), score: 0 };
};

const Dots = React.memo(({ cell, color }) => {
  const d = Math.max(2, cell * 0.1);
  const items = [];
  for (let i = 0; i < N * N; i++) {
    const x = i % N, y = Math.floor(i / N);
    items.push(
      <View key={i} style={{ position: 'absolute', left: (x + 0.5) * cell - d / 2, top: (y + 0.5) * cell - d / 2, width: d, height: d, backgroundColor: color }} />
    );
  }
  return <>{items}</>;
});

export default function App() {
  const isDark = useColorScheme() === 'dark';
  const t = isDark ? THEMES.dark : THEMES.light;
  const { width, height } = useWindowDimensions();
  const size = Math.min(width * 0.92, height * 0.5, 420);
  const cell = (size - 6) / N;

  const g = useRef(fresh());
  const timer = useRef(null);
  const tickRef = useRef(null);
  const statusRef = useRef('idle');
  const [, render] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | play | pause | over
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const setSt = (s) => { statusRef.current = s; setStatus(s); };
  const schedule = (ms) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => tickRef.current(), ms ?? Math.max(70, 140 - g.current.score * 3));
  };

  const gameOver = () => {
    clearTimeout(timer.current);
    setSt('over');
    setBest((b) => Math.max(b, g.current.score));
    Vibration.vibrate(60);
    render((n) => n + 1);
  };

  tickRef.current = () => {
    const s = g.current;
    s.dir = s.next;
    const h = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
    const eat = h.x === s.food.x && h.y === s.food.y;
    const body = eat ? s.snake : s.snake.slice(0, -1);
    if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || body.some((p) => p.x === h.x && p.y === h.y)) return gameOver();
    s.snake.unshift(h);
    if (eat) { s.score += 1; s.food = randomFood(s.snake); setScore(s.score); Vibration.vibrate(15); }
    else s.snake.pop();
    render((n) => n + 1);
    schedule();
  };

  const start = () => { g.current = fresh(); setScore(0); setSt('play'); render((n) => n + 1); schedule(140); };
  const resume = () => { setSt('play'); schedule(140); };
  const pause = () => { if (statusRef.current === 'play') { clearTimeout(timer.current); setSt('pause'); } };

  const turn = (x, y) => {
    const st = statusRef.current;
    if (st === 'idle' || st === 'over') start();
    else if (st === 'pause') resume();
    const s = g.current;
    if (x === -s.dir.x && y === -s.dir.y) return;
    s.next = { x, y };
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderRelease: (_, { dx, dy }) => {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
        const st = statusRef.current;
        if (st === 'idle' || st === 'over') start();
        else if (st === 'pause') resume();
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
      else turn(0, dy > 0 ? 1 : -1);
    },
  })).current;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') pause(); });
    return () => { sub.remove(); clearTimeout(timer.current); };
  }, []);

  const s = g.current;
  const k = cell * 0.55;
  const overlay = {
    idle: ['সাপ খেলা', 'শুরু করতে ট্যাপ করুন'],
    pause: ['বিরতি', 'চালিয়ে যেতে ট্যাপ করুন'],
    over: ['খেলা শেষ', `স্কোর ${score}। আবার খেলতে ট্যাপ করুন`],
  }[status];

  const key = (label, dx, dy, a11y) => (
    <Pressable
      accessibilityLabel={a11y}
      onPressIn={() => turn(dx, dy)}
      style={({ pressed }) => [styles.key, { borderColor: t.ink, backgroundColor: pressed ? t.ink : 'transparent' }]}
    >
      {({ pressed }) => <Text style={{ color: pressed ? t.bg : t.ink, fontSize: 26 }}>{label}</Text>}
    </Pressable>
  );
  const gap = <View style={styles.gap} />;

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]} {...pan.panHandlers}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
      <View style={[styles.hud, { width: size }]}>
        <Text style={[styles.hudText, { color: t.ink }]}>স্কোর  <Text style={styles.num}>{score}</Text></Text>
        <Text style={[styles.hudText, { color: t.ink }]}>সর্বোচ্চ  <Text style={styles.num}>{best}</Text></Text>
      </View>

      <View style={{ width: size, height: size, backgroundColor: t.screen, borderColor: t.ink, borderWidth: 3, borderRadius: 6, overflow: 'hidden' }}>
        <Dots cell={cell} color={t.dim} />
        {s.snake.map((p, i) => {
          const inset = i ? cell * 0.1 : 0;
          return <View key={i} style={{ position: 'absolute', left: p.x * cell + inset, top: p.y * cell + inset, width: cell - 2 * inset, height: cell - 2 * inset, backgroundColor: t.ink }} />;
        })}
        <View style={{ position: 'absolute', left: (s.food.x + 0.5) * cell - k / 2, top: (s.food.y + 0.5) * cell - k / 2, width: k, height: k, backgroundColor: t.ink, transform: [{ rotate: '45deg' }] }} />
        {overlay && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: t.screen + 'DB' }]}>
            <Text style={[styles.title, { color: t.ink }]}>{overlay[0]}</Text>
            <Text style={[styles.msg, { color: t.ink }]}>{overlay[1]}</Text>
            {status === 'idle' && <Text style={[styles.msg, { color: t.ink }]}>সোয়াইপ করুন বা নিচের বাটন চাপুন</Text>}
          </View>
        )}
      </View>

      <View>
        <View style={styles.row}>{gap}{key('↑', 0, -1, 'উপরে')}{gap}</View>
        <View style={styles.row}>{key('←', -1, 0, 'বামে')}{gap}{key('→', 1, 0, 'ডানে')}</View>
        <View style={styles.row}>{gap}{key('↓', 0, 1, 'নিচে')}{gap}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  hud: { flexDirection: 'row', justifyContent: 'space-between' },
  hudText: { fontFamily: MONO, fontSize: 16 },
  num: { fontSize: 22, fontWeight: '700' },
  overlay: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  title: { fontSize: 27, fontWeight: '700', textAlign: 'center' },
  msg: { fontSize: 16, textAlign: 'center' },
  row: { flexDirection: 'row' },
  key: { width: 58, height: 58, margin: 3, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  gap: { width: 58, height: 58, margin: 3 },
});
