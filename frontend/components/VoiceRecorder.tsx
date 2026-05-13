import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';

const C = {
  bg: '#0A0E14',
  green: '#00C853',
  greenDim: 'rgba(0,200,83,0.18)',
  glass: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.10)',
  white: '#FFFFFF',
  dim: 'rgba(255,255,255,0.55)',
  red: '#FF3B30',
};

interface Props {
  visible: boolean;
  onRecordingComplete: (uri: string, durationMs: number) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ visible, onRecordingComplete, onCancel }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 100);
  const [granted, setGranted] = useState(false);

  // 8 individual waveform bar heights
  const h0 = useSharedValue(5); const h1 = useSharedValue(5); const h2 = useSharedValue(5);
  const h3 = useSharedValue(5); const h4 = useSharedValue(5); const h5 = useSharedValue(5);
  const h6 = useSharedValue(5); const h7 = useSharedValue(5);
  const heights = [h0, h1, h2, h3, h4, h5, h6, h7];

  const s0 = useAnimatedStyle(() => ({ height: h0.value }));
  const s1 = useAnimatedStyle(() => ({ height: h1.value }));
  const s2 = useAnimatedStyle(() => ({ height: h2.value }));
  const s3 = useAnimatedStyle(() => ({ height: h3.value }));
  const s4 = useAnimatedStyle(() => ({ height: h4.value }));
  const s5 = useAnimatedStyle(() => ({ height: h5.value }));
  const s6 = useAnimatedStyle(() => ({ height: h6.value }));
  const s7 = useAnimatedStyle(() => ({ height: h7.value }));
  const styles2 = [s0, s1, s2, s3, s4, s5, s6, s7];

  useEffect(() => {
    requestRecordingPermissionsAsync().then(({ granted: g }) => setGranted(g));
  }, []);

  // Animate waveform bars while recording
  useEffect(() => {
    if (!recState.isRecording) {
      heights.forEach(h => { h.value = withSpring(5, { damping: 12 }); });
      return;
    }
    const id = setInterval(() => {
      heights.forEach(h => {
        h.value = withSpring(8 + Math.random() * 52, { damping: 6, stiffness: 220 });
      });
    }, 110);
    return () => clearInterval(id);
  }, [recState.isRecording]);

  const handleRecord = async () => {
    if (!granted) {
      Alert.alert('Microphone required', 'Allow microphone access to record voice notes.');
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const handleStop = async () => {
    await recorder.stop();
    const uri = recorder.uri;
    if (uri) {
      onRecordingComplete(uri, recState.durationMillis ?? 0);
    } else {
      Alert.alert('Error', 'Recording failed. Please try again.');
    }
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const isRec = recState.isRecording;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <BlurView intensity={50} tint="dark" style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <Text style={s.title}>Voice Note</Text>

          {/* Waveform */}
          <View style={s.waveWrap}>
            {heights.map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  s.bar,
                  styles2[i],
                  { opacity: isRec ? 1 : 0.25, backgroundColor: isRec ? C.green : C.dim },
                ]}
              />
            ))}
          </View>

          {/* Timer */}
          <Text style={s.timer}>{fmt(recState.durationMillis ?? 0)}</Text>
          <Text style={s.hint}>
            {isRec ? '● Recording…' : granted ? 'Tap mic to start' : 'Microphone permission required'}
          </Text>

          {/* Controls */}
          <View style={s.row}>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
              <Ionicons name="close" size={22} color={C.dim} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.recBtn, isRec && s.recBtnActive]}
              onPress={isRec ? handleStop : handleRecord}
            >
              {isRec
                ? <View style={s.stopIcon} />
                : <Ionicons name="mic" size={28} color="#000" />}
            </TouchableOpacity>

            {/* spacer */}
            <View style={{ width: 48 }} />
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: C.white, marginBottom: 32 },
  waveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    gap: 6,
    marginBottom: 20,
  },
  bar: { width: 4, borderRadius: 3 },
  timer: { fontSize: 40, fontWeight: '700', color: C.white, letterSpacing: 3, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 13, color: C.dim, marginTop: 8, marginBottom: 36 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 36 },
  cancelBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.glass, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  recBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.green, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12,
    elevation: 8,
  },
  recBtnActive: { backgroundColor: C.red, shadowColor: C.red },
  stopIcon: { width: 22, height: 22, borderRadius: 4, backgroundColor: '#fff' },
});
