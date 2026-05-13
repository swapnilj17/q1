import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

const COLORS = {
  bg: '#0A0E14',
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.18)',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  neon: '#00C853',
  neonSoft: 'rgba(0,200,83,0.18)',
  red: '#FF4444',
};

interface Props {
  onRecordingComplete: (uri: string, duration: number) => void;
  onCancel: () => void;
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;
}

export default function VoiceRecorder({ onRecordingComplete, onCancel, isRecording, setIsRecording }: Props) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [duration, setDuration] = useState(0);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  // Pulsing animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isRecording]);

  // Auto-start recording when component mounts with isRecording=true
  useEffect(() => {
    if (isRecording && !recording) {
      startRecording();
    }
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Duration counter
      durationInterval.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (e) {
      console.error('Failed to start recording:', e);
      onCancel();
    }
  }, [onCancel]);

  const stopRecording = useCallback(async (cancelled: boolean = false) => {
    if (!recording) {
      onCancel();
      return;
    }
    
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);

      if (cancelled || !uri || duration < 1) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onCancel();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onRecordingComplete(uri, duration * 1000);
      }
    } catch (e) {
      console.error('Failed to stop recording:', e);
      onCancel();
    }
  }, [recording, duration, onRecordingComplete, onCancel, setIsRecording]);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.recordingBar}>
      {/* Cancel button */}
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={() => stopRecording(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={22} color={COLORS.red} />
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>

      {/* Recording indicator */}
      <View style={styles.recordingCenter}>
        <Animated.View
          style={[
            styles.pulseRing,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <View style={styles.recordingDot} />
        <Text style={styles.durationText}>{formatDuration(duration)}</Text>
      </View>

      {/* Send button */}
      <TouchableOpacity
        style={styles.sendBtn}
        onPress={() => stopRecording(false)}
        activeOpacity={0.8}
      >
        <Ionicons name="send" size={20} color={COLORS.bg} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: {
    color: COLORS.red,
    fontSize: 14,
    fontWeight: '500',
  },
  recordingCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulseRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,68,68,0.3)',
    position: 'absolute',
    left: -4,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.red,
  },
  durationText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 50,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neon,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
