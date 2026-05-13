import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

import { useAuth } from '@/contexts/AuthContext';
import { api, ChatMessage, ChatRoom } from '@/services/api';
import { supabase } from '@/services/supabase';
import ChatVoiceMessage from '@/components/chat/ChatVoiceMessage';
import ChatVideoMessage from '@/components/chat/ChatVideoMessage';
import VoiceRecorder from '@/components/chat/VoiceRecorder';
import VideoRecorder from '@/components/chat/VideoRecorder';

const COLORS = {
  bg: '#0A0E14',
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.18)',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  neon: '#00C853',
  neonSoft: 'rgba(0,200,83,0.18)',
  bubbleMe: 'rgba(0,200,83,0.18)',
  bubbleOther: 'rgba(255,255,255,0.09)',
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export default function ChatRoom() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Voice/Video recording states
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Load room details
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        const r = await api.getChatRoom(roomId);
        setRoom(r);
      } catch (e) {
        console.error('Failed to load room', e);
      }
    })();
  }, [roomId]);

  // Load messages
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        setLoading(true);
        const msgs = await api.getChatMessages(roomId);
        setMessages(msgs);
      } catch (e) {
        console.error('Failed to load messages', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId]);

  // Supabase Realtime — postgres_changes subscription (native WebSocket on mobile)
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((curr) => {
            // Avoid duplicate when local echo has already inserted it
            if (curr.find((m) => m.id === msg.id)) return curr;
            return [...curr, msg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Upload media to Supabase Storage
  const uploadMedia = useCallback(async (localUri: string, mediaType: 'voice' | 'video'): Promise<string> => {
    const ext = mediaType === 'voice' ? 'm4a' : 'mp4';
    const timestamp = Date.now();
    const path = `rooms/${roomId}/${user?.id}/${timestamp}.${ext}`;
    
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const contentType = mediaType === 'voice' ? 'audio/m4a' : 'video/mp4';
    
    const { data, error } = await supabase.storage
      .from('chat-media')
      .upload(path, bytes, { contentType, upsert: true });
    
    if (error) throw error;
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(path);
    
    return urlData.publicUrl;
  }, [roomId, user?.id]);

  // Send text message
  const handleSendText = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    
    setSending(true);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      room_id: roomId,
      sender_id: user?.id || '',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((curr) => [...curr, optimistic]);
    setInput('');
    
    try {
      const saved = await api.sendChatMessage(roomId, trimmed);
      setMessages((curr) => curr.map((m) => (m.id === optimistic.id ? saved : m)));
    } catch (e) {
      console.error('Send failed', e);
      setMessages((curr) => curr.filter((m) => m.id !== optimistic.id));
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  }, [input, sending, roomId, user?.id]);

  // Handle voice recording complete
  const handleVoiceComplete = useCallback(async (uri: string, duration: number) => {
    setIsRecordingVoice(false);
    setUploadingMedia(true);
    
    // Optimistic UI
    const optimisticId = `local-voice-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      room_id: roomId,
      sender_id: user?.id || '',
      content: '🎤 Sending voice...',
      created_at: new Date().toISOString(),
      media_type: 'voice',
      media_duration: duration,
    };
    setMessages((curr) => [...curr, optimistic]);
    
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const mediaUrl = await uploadMedia(uri, 'voice');
      const saved = await api.sendChatMessage(roomId, '', mediaUrl, 'voice', duration);
      setMessages((curr) => curr.map((m) => (m.id === optimisticId ? saved : m)));
    } catch (e) {
      console.error('Voice send failed', e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessages((curr) => curr.filter((m) => m.id !== optimisticId));
    } finally {
      setUploadingMedia(false);
    }
  }, [roomId, user?.id, uploadMedia]);

  // Handle video recording complete
  const handleVideoComplete = useCallback(async (uri: string, duration: number) => {
    setShowVideoRecorder(false);
    setUploadingMedia(true);
    
    const optimisticId = `local-video-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      room_id: roomId,
      sender_id: user?.id || '',
      content: '🎬 Sending video...',
      created_at: new Date().toISOString(),
      media_type: 'video',
      media_duration: duration,
    };
    setMessages((curr) => [...curr, optimistic]);
    
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const mediaUrl = await uploadMedia(uri, 'video');
      const saved = await api.sendChatMessage(roomId, '', mediaUrl, 'video', duration);
      setMessages((curr) => curr.map((m) => (m.id === optimisticId ? saved : m)));
    } catch (e) {
      console.error('Video send failed', e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessages((curr) => curr.filter((m) => m.id !== optimisticId));
    } finally {
      setUploadingMedia(false);
    }
  }, [roomId, user?.id, uploadMedia]);

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender_id === user?.id;
    const timestamp = formatTime(item.created_at);
    
    // Voice message
    if (item.media_type === 'voice' && item.media_url) {
      return (
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          <ChatVoiceMessage
            mediaUrl={item.media_url}
            duration={item.media_duration || 0}
            isMe={isMe}
            timestamp={timestamp}
          />
        </View>
      );
    }
    
    // Video message
    if (item.media_type === 'video' && item.media_url) {
      return (
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          <ChatVideoMessage
            mediaUrl={item.media_url}
            duration={item.media_duration || 0}
            isMe={isMe}
            timestamp={timestamp}
          />
        </View>
      );
    }
    
    // Text message
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={styles.msgText}>{item.content}</Text>
          <Text style={styles.msgTime}>{timestamp}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: COLORS.bg },
          headerTintColor: COLORS.textPrimary,
          headerTitle: room?.display_name || 'Chat',
          headerBackTitle: 'Back',
        }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.neon} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Input toolbar */}
      <BlurView intensity={60} tint="dark" style={styles.inputBar}>
        {isRecordingVoice ? (
          <VoiceRecorder
            isRecording={isRecordingVoice}
            setIsRecording={setIsRecordingVoice}
            onRecordingComplete={handleVoiceComplete}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <View style={styles.inputRow}>
            {/* Camera button */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowVideoRecorder(true);
              }}
              disabled={uploadingMedia}
            >
              <Ionicons name="videocam" size={24} color={COLORS.neon} />
            </TouchableOpacity>

            {/* Text input */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Message..."
                placeholderTextColor={COLORS.textSecondary}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={4000}
                editable={!uploadingMedia}
              />
            </View>

            {/* Mic / Send button */}
            {input.trim() ? (
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={handleSendText}
                disabled={sending || uploadingMedia}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={COLORS.bg} />
                ) : (
                  <Ionicons name="send" size={20} color={COLORS.bg} />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.micBtn}
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setIsRecordingVoice(true);
                }}
                delayLongPress={200}
                disabled={uploadingMedia}
              >
                {uploadingMedia ? (
                  <ActivityIndicator size="small" color={COLORS.neon} />
                ) : (
                  <Ionicons name="mic" size={24} color={COLORS.neon} />
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </BlurView>

      {/* Video recorder modal */}
      <VideoRecorder
        visible={showVideoRecorder}
        onClose={() => setShowVideoRecorder(false)}
        onVideoRecorded={handleVideoComplete}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 12,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  bubbleMe: {
    backgroundColor: COLORS.bubbleMe,
    borderColor: COLORS.neon,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: COLORS.bubbleOther,
    borderColor: COLORS.glassBorder,
    borderBottomLeftRadius: 4,
  },
  msgText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 21,
  },
  msgTime: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.glass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.glass,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    maxHeight: 120,
  },
  input: {
    color: COLORS.textPrimary,
    fontSize: 16,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.neon,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.neonSoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.neon,
  },
});
