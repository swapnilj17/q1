import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ChatMessage, ChatRoom } from '@/services/api';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

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

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Memoised message bubble to avoid re-renders when new messages stream in
const MessageBubble = memo(({ msg, isMe }: { msg: ChatMessage; isMe: boolean }) => (
  <View style={[styles.bubbleRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
    <View style={[
      styles.bubble,
      isMe ? styles.bubbleMine : styles.bubbleTheirs,
    ]}>
      <Text style={[styles.bubbleText, isMe && { color: COLORS.textPrimary }]}>{msg.content}</Text>
      <Text style={styles.bubbleTime}>{formatTime(msg.created_at)}</Text>
    </View>
  </View>
));

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = String(id || '');
  const router = useRouter();
  const { user } = useAuth();

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);

  // Fetch initial room + messages
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rm, msgs] = await Promise.all([
          api.getChatRoom(roomId),
          api.getChatMessages(roomId),
        ]);
        if (!alive) return;
        setRoom(rm);
        setMessages(msgs);
      } catch (e) {
        console.error('Failed to load chat', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [roomId]);

  // Supabase realtime subscription
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

  const handleSend = useCallback(async () => {
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
      // Replace optimistic with saved
      setMessages((curr) => curr.map((m) => (m.id === optimistic.id ? saved : m)));
    } catch (e) {
      console.error('Send failed', e);
      setMessages((curr) => curr.filter((m) => m.id !== optimistic.id));
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  }, [input, sending, roomId, user?.id]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageBubble msg={item} isMe={item.sender_id === user?.id} />
    ),
    [user?.id]
  );

  useEffect(() => {
    // auto-scroll to end on new messages (list isn't inverted so scrollToEnd)
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <BlurView intensity={40} tint="dark" style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {room?.display_name || 'Chat'}
          </Text>
          <View style={styles.headerSub}>
            <Ionicons name="lock-closed" size={11} color={COLORS.neon} />
            <Text style={styles.headerSubText}>End-to-end protected</Text>
          </View>
        </View>
        <View style={styles.avatarSm}>
          <Text style={styles.avatarSmText}>
            {(room?.display_name || 'C').split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)}
          </Text>
        </View>
      </BlurView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={10}
      >
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={COLORS.neon} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            removeClippedSubviews
            initialNumToRender={20}
            maxToRenderPerBatch={15}
            windowSize={10}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={52} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>Say hi 👋</Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <BlurView intensity={40} tint="dark" style={styles.inputBar}>
          <View style={styles.inputField}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message"
              placeholderTextColor={COLORS.textSecondary}
              style={styles.input}
              multiline
              maxLength={4000}
              onSubmitEditing={handleSend}
            />
          </View>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
            activeOpacity={0.8}
          >
            <Ionicons name={sending ? 'hourglass' : 'send'} size={20} color={COLORS.bg} />
          </TouchableOpacity>
        </BlurView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.glassBorder,
    overflow: 'hidden',
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '600' },
  headerSub: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  headerSubText: { color: COLORS.neon, fontSize: 11, fontWeight: '500' },
  avatarSm: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.neonSoft,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,200,83,0.35)',
  },
  avatarSmText: { color: COLORS.neon, fontSize: 14, fontWeight: '700' },
  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 18, borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: COLORS.neonSoft,
    borderColor: COLORS.neon,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: COLORS.bubbleOther,
    borderColor: COLORS.glassBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: COLORS.textPrimary, fontSize: 15, lineHeight: 20 },
  bubbleTime: { color: COLORS.textSecondary, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1, borderTopColor: COLORS.glassBorder,
    overflow: 'hidden',
  },
  inputField: {
    flex: 1, backgroundColor: COLORS.glass,
    borderWidth: 1, borderColor: COLORS.glassBorder, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    maxHeight: 120,
  },
  input: { color: COLORS.textPrimary, fontSize: 15, minHeight: 30 },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.neon,
    justifyContent: 'center', alignItems: 'center',
  },
});
