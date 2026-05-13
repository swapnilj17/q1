import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');

const C = {
  bg: '#0A0E14',
  green: '#00C853',
  glass: 'rgba(0,0,0,0.45)',
  border: 'rgba(255,255,255,0.12)',
  white: '#FFFFFF',
  dim: 'rgba(255,255,255,0.6)',
  red: '#FF3B30',
};

interface Props {
  visible: boolean;
  onRecordingComplete: (uri: string) => void;
  onCancel: () => void;
}

export default function VideoRecorder({ visible, onRecordingComplete, onCancel }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [facing, setFacing] = useState<'front' | 'back'>('back');

  useEffect(() => {
    if (!isRecording) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const ensurePermissions = async () => {
    if (!camPerm?.granted) { const r = await requestCamPerm(); if (!r.granted) return false; }
    if (!micPerm?.granted) { const r = await requestMicPerm(); if (!r.granted) return false; }
    return true;
  };

  const handleRecord = async () => {
    const ok = await ensurePermissions();
    if (!ok) { Alert.alert('Permissions required', 'Camera and microphone access are needed.'); return; }
    if (!cameraRef.current) return;
    setIsRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (result?.uri) onRecordingComplete(result.uri);
    } catch (e: any) {
      if (!String(e).includes('cancelled')) Alert.alert('Error', 'Recording failed.');
    } finally {
      setIsRecording(false);
    }
  };

  const handleStop = () => {
    cameraRef.current?.stopRecording();
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const permissionGranted = camPerm?.granted && micPerm?.granted;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent>
      <View style={st.container}>
        {permissionGranted ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="video"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, st.noPerm]}>
            <Ionicons name="videocam-off" size={48} color={C.dim} />
            <Text style={st.noPermText}>Camera permission required</Text>
            <TouchableOpacity style={st.grantBtn} onPress={ensurePermissions}>
              <Text style={st.grantText}>Grant Access</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Frosted top bar */}
        <BlurView intensity={60} tint="dark" style={st.topBar}>
          <TouchableOpacity style={st.iconBtn} onPress={onCancel}>
            <Ionicons name="close" size={24} color={C.white} />
          </TouchableOpacity>
          {isRecording && (
            <View style={st.timerPill}>
              <View style={st.recDot} />
              <Text style={st.timerTxt}>{fmt(seconds)}</Text>
            </View>
          )}
          <TouchableOpacity
            style={st.iconBtn}
            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
          >
            <Ionicons name="camera-reverse" size={24} color={C.white} />
          </TouchableOpacity>
        </BlurView>

        {/* Frosted edge overlays */}
        <BlurView intensity={30} tint="dark" style={st.edgeLeft} pointerEvents="none" />
        <BlurView intensity={30} tint="dark" style={st.edgeRight} pointerEvents="none" />

        {/* Bottom controls */}
        <BlurView intensity={60} tint="dark" style={st.bottomBar}>
          <View style={{ width: 56 }} />
          <TouchableOpacity
            style={[st.recBtn, isRecording && st.recBtnRec]}
            onPress={isRecording ? handleStop : handleRecord}
          >
            {isRecording
              ? <View style={st.stopIcon} />
              : <View style={st.recInner} />}
          </TouchableOpacity>
          <View style={{ width: 56 }} />
        </BlurView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  noPerm: { backgroundColor: '#0A0E14', justifyContent: 'center', alignItems: 'center', gap: 16 },
  noPermText: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },
  grantBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#00C853', borderRadius: 20 },
  grantText: { color: '#000', fontWeight: '700' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: Platform.OS === 'ios' ? 54 : 28,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' },
  timerTxt: { color: '#fff', fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] },
  edgeLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 20 },
  edgeRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 20 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    paddingTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recBtn: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  recBtnRec: { borderColor: '#FF3B30' },
  recInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF3B30' },
  stopIcon: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#fff' },
});
