import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, ChatRoom } from '@/services/api';

// Liquid Glass palette
const COLORS = {
  bg: '#0A0E14',
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.18)',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  neon: '#00C853',
  neonSoft: 'rgba(0,200,83,0.18)',
};

function formatRelative(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

export default function ChatListScreen() {
  const router = useRouter();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.listChatRooms();
      setRooms(data);
    } catch (e) {
      console.error('Failed to load chats', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = query.trim()
    ? rooms.filter((r) => r.display_name.toLowerCase().includes(query.toLowerCase()))
    : rooms;

  const renderItem = ({ item }: { item: ChatRoom }) => (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => router.push(`/chat/${item.id}`)}
      style={styles.rowWrap}
    >
      <BlurView intensity={30} tint="dark" style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(item.display_name)}</Text>
          {item.is_group && (
            <View style={styles.groupBadge}>
              <Ionicons name="people" size={10} color={COLORS.bg} />
            </View>
          )}
        </View>
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName} numberOfLines={1}>{item.display_name}</Text>
            <Text style={styles.rowTime}>{formatRelative(item.last_message_at)}</Text>
          </View>
          <Text style={styles.rowPreview} numberOfLines={1}>
            {item.last_message_preview || 'Start the conversation…'}
          </Text>
        </View>
      </BlurView>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.lockPill}>
          <Ionicons name="lock-closed" size={12} color={COLORS.neon} />
          <Text style={styles.lockText}>Private</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <BlurView intensity={30} tint="dark" style={styles.searchInner}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
          />
        </BlurView>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.neon} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={56} color={COLORS.textSecondary} />
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptyText}>Tap the + button to start a conversation</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.neon}
            />
          }
        />
      )}

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => router.push('/chat/new')}>
        <Ionicons name="add" size={28} color={COLORS.bg} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  title: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  lockPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.neonSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(0,200,83,0.35)',
  },
  lockText: { color: COLORS.neon, fontSize: 11, fontWeight: '600' },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.glass, borderColor: COLORS.glassBorder, borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden',
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15, paddingVertical: 0 },
  rowWrap: { borderRadius: 18, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderWidth: 1, borderColor: COLORS.glassBorder,
    backgroundColor: COLORS.glass, borderRadius: 18,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.neonSoft,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,200,83,0.35)',
  },
  avatarText: { color: COLORS.neon, fontSize: 18, fontWeight: '700' },
  groupBadge: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: COLORS.neon, width: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.bg,
  },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  rowTime: { color: COLORS.textSecondary, fontSize: 12 },
  rowPreview: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '600' },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },
  fab: {
    position: 'absolute', right: 20, bottom: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.neon, justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.neon, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
});
