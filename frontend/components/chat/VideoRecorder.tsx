import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  visible: boolean;
  onClose: () => void;
  onVideoRecorded: (uri: string, duration: number) => void;
}

export default function VideoRecorder({ visible, onClose, onVideoRecorded }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [facing, setFacing] = useState<CameraType>('back');
  const cameraRef = useRef<CameraView>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission]);

  useEffect(() => {
    if (!visible) {
      // Cleanup on close
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      setIsRecording(false);
      setDuration(0);
    }
  }, [visible]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsRecording(true);
      setDuration(0);
      
      durationInterval.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: 60, // 1 minute max
      });
      
      if (video?.uri) {
        onVideoRecorded(video.uri, duration * 1000);
      }
    } catch (e) {
      console.error('Recording failed:', e);
    }
  }, [duration, onVideoRecorded]);

  const stopRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) return;
    
    try {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await cameraRef.current.stopRecording();
      setIsRecording(false);
      onClose();
    } catch (e) {
      console.error('Stop recording failed:', e);
    }
  }, [isRecording, onClose]);

  const toggleFacing = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <BlurView intensity={80} tint="dark" style={styles.permissionModal}>
          <Ionicons name="videocam-off" size={64} color={COLORS.textSecondary} />
          <Text style={styles.permissionText}>Camera permission required</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Camera view */}
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode="video"
        />

        {/* Frosted glass overlay */}
        <BlurView intensity={30} tint="dark" style={styles.overlay}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={isRecording}>
              <Ionicons name="close" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            
            {isRecording && (
              <View style={styles.recordingBadge}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTime}>{formatDuration(duration)}</Text>
              </View>
            )}
            
            <TouchableOpacity onPress={toggleFacing} style={styles.flipBtn} disabled={isRecording}>
              <Ionicons name="camera-reverse" size={26} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              onPress={isRecording ? stopRecording : startRecording}
              style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
              activeOpacity={0.8}
            >
              {isRecording ? (
                <View style={styles.stopIcon} />
              ) : (
                <View style={styles.recordIcon} />
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>
              {isRecording ? 'Tap to stop' : 'Tap to record'}
            </Text>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.red,
  },
  recordingTime: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    gap: 16,
  },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: COLORS.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  recordBtnActive: {
    borderColor: COLORS.red,
  },
  recordIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.red,
  },
  stopIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: COLORS.red,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  permissionModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  permissionText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  permissionBtn: {
    backgroundColor: COLORS.neon,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  permissionBtnText: {
    color: COLORS.bg,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
