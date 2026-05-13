import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
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
  bubbleOther: 'rgba(255,255,255,0.09)',
};

interface Props {
  mediaUrl: string;
  duration?: number;
  isMe: boolean;
  timestamp: string;
  thumbnailUrl?: string;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ChatVideoMessage({ mediaUrl, duration = 0, isMe, timestamp, thumbnailUrl }: Props) {
  const [showPlayer, setShowPlayer] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const player = useVideoPlayer(mediaUrl, (p) => {
    p.loop = false;
  });

  const handleOpen = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowPlayer(true);
    player.play();
  }, [player]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    player.pause();
    setShowPlayer(false);
  }, [player]);

  // Generate thumbnail from video URL (first frame)
  const thumbUri = thumbnailUrl || mediaUrl;

  return (
    <>
      {/* Thumbnail bubble */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleOpen}
        style={[styles.container, isMe ? styles.containerMe : styles.containerThem]}
      >
        <View style={styles.thumbnailWrapper}>
          {!imageLoaded && (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="videocam" size={32} color={COLORS.textSecondary} />
            </View>
          )}
          <Image
            source={{ uri: thumbUri }}
            style={styles.thumbnail}
            resizeMode="cover"
            onLoad={() => setImageLoaded(true)}
          />
          {/* Play overlay */}
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={24} color={COLORS.textPrimary} />
            </View>
          </View>
          {/* Duration badge */}
          {duration > 0 && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.timestamp}>{timestamp}</Text>
      </TouchableOpacity>

      {/* Fullscreen glass-morphic player modal */}
      <Modal
        visible={showPlayer}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <BlurView intensity={90} tint="dark" style={styles.modalBg}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={16}>
            <Ionicons name="close-circle" size={36} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Video player */}
          <View style={styles.videoContainer}>
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls={false}
            />
            {/* Minimal controls */}
            <TouchableOpacity
              style={styles.videoControlBtn}
              onPress={() => {
                if (player.playing) {
                  player.pause();
                } else {
                  player.play();
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={player.playing ? 'pause' : 'play'}
                size={48}
                color={COLORS.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    maxWidth: '70%',
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
  thumbnailWrapper: {
    width: 200,
    height: 150,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  thumbnailPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,200,83,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  timestamp: {
    color: COLORS.textSecondary,
    fontSize: 10,
    padding: 8,
    alignSelf: 'flex-end',
  },
  modalBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  videoContainer: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT * 0.6,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  video: {
    flex: 1,
  },
  videoControlBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -30,
    marginTop: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
