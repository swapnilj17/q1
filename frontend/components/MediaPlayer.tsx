import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';

const C = {
  bg: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.10)',
  green: '#00C853',
  white: '#FFFFFF',
  dim: 'rgba(255,255,255,0.5)',
  track: 'rgba(255,255,255,0.12)',
};

const fmt = (sec: number) => {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// ──── Audio Player ────
function AudioControls({ uri }: { uri: string }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);

  const toggleSpeed = useCallback(() => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    player.playbackRate = next;
  }, [speed, player]);

  const dur = status.duration ?? 0;
  const cur = status.currentTime ?? 0;
  const progress = dur > 0 ? cur / dur : 0;

  return (
    <View style={ps.wrap}>
      <View style={ps.row}>
        <Ionicons name="musical-notes" size={16} color={C.green} />
        <Text style={ps.timeL}>{fmt(cur)}</Text>
        {/* Progress bar */}
        <View style={ps.trackWrap}>
          <View style={ps.trackBg} />
          <View style={[ps.trackFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={ps.timeR}>{fmt(dur)}</Text>
        <TouchableOpacity style={ps.speedBtn} onPress={toggleSpeed}>
          <Text style={ps.speedTxt}>{speed}x</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={ps.playBtn}
        onPress={() => status.playing ? player.pause() : player.play()}
      >
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={22}
          color="#000"
        />
      </TouchableOpacity>
    </View>
  );
}

// ──── Video Player ────
function VideoControls({ uri }: { uri: string }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.volume = 1.0;
  });

  useEffect(() => {
    const id = setInterval(() => {
      try {
        setCurrent(player.currentTime ?? 0);
        setDuration(player.duration ?? 0);
        setPlaying(player.playing ?? false);
      } catch {}
    }, 500);
    return () => clearInterval(id);
  }, [player]);

  const toggleSpeed = useCallback(() => {
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    player.playbackRate = next;
  }, [speed, player]);

  const progress = duration > 0 ? current / duration : 0;

  return (
    <View>
      <VideoView
        player={player}
        style={vs.video}
        nativeControls={false}
      />
      <View style={ps.wrap}>
        <View style={ps.row}>
          <Ionicons name="videocam" size={16} color={C.green} />
          <Text style={ps.timeL}>{fmt(current)}</Text>
          <View style={ps.trackWrap}>
            <View style={ps.trackBg} />
            <View style={[ps.trackFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={ps.timeR}>{fmt(duration)}</Text>
          <TouchableOpacity style={ps.speedBtn} onPress={toggleSpeed}>
            <Text style={ps.speedTxt}>{speed}x</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={ps.playBtn}
          onPress={() => playing ? player.pause() : player.play()}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ──── Public Component ────
interface Props {
  uri: string;
  mediaType: 'audio' | 'video';
}

export default function MediaPlayer({ uri, mediaType }: Props) {
  if (!uri) return null;
  return mediaType === 'audio'
    ? <AudioControls uri={uri} />
    : <VideoControls uri={uri} />;
}

const ps = StyleSheet.create({
  wrap: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeL: { fontSize: 11, color: C.dim, minWidth: 34, fontVariant: ['tabular-nums'] },
  timeR: { fontSize: 11, color: C.dim, minWidth: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },
  trackWrap: { flex: 1, height: 4, position: 'relative' },
  trackBg: { ...StyleSheet.absoluteFillObject, backgroundColor: C.track, borderRadius: 2 },
  trackFill: { height: 4, backgroundColor: C.green, borderRadius: 2 },
  playBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.green,
    alignSelf: 'center',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8,
    elevation: 4,
  },
  speedBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg,
  },
  speedTxt: { color: C.green, fontSize: 11, fontWeight: '700' },
});

const vs = StyleSheet.create({
  video: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#000', marginBottom: 12 },
});
