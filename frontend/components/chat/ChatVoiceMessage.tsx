import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Haptics from 'expo-haptics';

const COLORS = {
  bg: '#0A0E14',
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.18)',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  neon: '#00C853',
  neonSoft: 'rgba(0,200,83,0.18)',
  bubbleOther: 'rgba(255,255,255,0.09)',
};

interface Props {
  mediaUrl: string;
  duration?: number;
  isMe: boolean;
  timestamp: string;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ChatVoiceMessage({ mediaUrl, duration = 0, isMe, timestamp }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [loading, setLoading] = useState(false);
  
  // Animated waveform bars
  const waveAnim = useRef([...Array(20)].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  // Animate waveform when playing
  useEffect(() => {
    if (isPlaying) {
      const animations = waveAnim.map((anim, i) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.4 + Math.random() * 0.6,
              duration: 100 + Math.random() * 150,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2 + Math.random() * 0.3,
              duration: 100 + Math.random() * 150,
              useNativeDriver: true,
            }),
          ])
        );
      });
      Animated.parallel(animations).start();
    } else {
      waveAnim.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [isPlaying]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setTotalDuration(status.durationMillis || duration);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  }, [duration]);

  const handlePlayPause = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
      } else {
        setLoading(true);
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: mediaUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setLoading(false);
      }
    } catch (e) {
      console.error('Playback error:', e);
      setLoading(false);
    }
  }, [sound, isPlaying, mediaUrl, onPlaybackStatusUpdate]);

  const progress = totalDuration > 0 ? position / totalDuration : 0;

  return (
    <View style={[styles.container, isMe ? styles.containerMe : styles.containerThem]}>
      {/* Play/Pause button */}
      <TouchableOpacity
        onPress={handlePlayPause}
        style={[styles.playBtn, isMe && styles.playBtnMe]}
        activeOpacity={0.7}
        disabled={loading}
      >
        <Ionicons
          name={loading ? 'hourglass' : isPlaying ? 'pause' : 'play'}
          size={20}
          color={isMe ? COLORS.bg : COLORS.neon}
        />
      </TouchableOpacity>

      {/* Waveform */}
      <View style={styles.waveformContainer}>
        <View style={styles.waveform}>
          {waveAnim.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                isMe && styles.waveBarMe,
                {
                  transform: [{ scaleY: anim }],
                  opacity: i / waveAnim.length <= progress ? 1 : 0.4,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>
            {formatDuration(isPlaying ? position : totalDuration)}
          </Text>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: '80%',
    gap: 10,
  },
  containerMe: {
    backgroundColor: COLORS.neonSoft,
    borderColor: COLORS.neon,
    borderBottomRightRadius: 4,
  },
  containerThem: {
    backgroundColor: COLORS.bubbleOther,
    borderColor: COLORS.glassBorder,
    borderBottomLeftRadius: 4,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.glass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  playBtnMe: {
    backgroundColor: COLORS.neon,
    borderColor: COLORS.neon,
  },
  waveformContainer: {
    flex: 1,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    gap: 2,
  },
  waveBar: {
    width: 3,
    height: '100%',
    backgroundColor: COLORS.neon,
    borderRadius: 2,
  },
  waveBarMe: {
    backgroundColor: COLORS.textPrimary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  timestamp: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
});
