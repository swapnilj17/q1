import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { api, ChatUser } from '@/services/api';

const COLORS = {
  bg: '#0A0E14',
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.18)',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  neon: '#00C853',
  neonSoft: 'rgba(0,200,83,0.18)',
};

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

export default function NewChatScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listChatUsers();
      setUsers(data);
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;
  }, [users, query]);

  const toggleSelect = (id: string) => {
    setSelected((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]));
  };

  const createChat = async () => {
    if (selected.length === 0 || creating) return;
    setCreating(true);
    try {
      const isGroup = selected.length > 1;
      const room = await api.createChatRoom(selected, isGroup, isGroup ? groupName.trim() || undefined : undefined);
      router.replace(`/chat/${room.id}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create chat');
    } finally {
      setCreating(false);
    }
  };

  const isGroup = selected.length > 1;

  const renderUser = ({ item }: { item: ChatUser }) => {
    const chosen = selected.includes(item.id);
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => toggleSelect(item.id)} style={styles.rowWrap}>
        <BlurView intensity={30} tint="dark" style={[styles.row, chosen && styles.rowSelected]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(item.name)}</Text>
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rowEmail} numberOfLines={1}>{item.email}</Text>
          </View>
          <View style={[styles.check, chosen && styles.checkOn]}>
            {chosen && <Ionicons name="checkmark" size={16} color={COLORS.bg} />}
          </View>
        </BlurView>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BlurView intensity={40} tint="dark" style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Chat</Text>
        <View style={{ width: 30 }} />
      </BlurView>

      <View style={styles.searchWrap}>
        <BlurView intensity={30} tint="dark" style={styles.searchInner}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
          />
        </BlurView>
      </View>

      {isGroup && (
        <View style={styles.groupNameWrap}>
          <BlurView intensity={30} tint="dark" style={styles.groupNameInner}>
            <Ionicons name="people" size={18} color={COLORS.neon} />
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder={`Group name (${selected.length} people)`}
              placeholderTextColor={COLORS.textSecondary}
              style={styles.searchInput}
            />
          </BlurView>
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.neon} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          renderItem={renderUser}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="person-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No users to chat with yet</Text>
              <Text style={styles.emptyHint}>Ask a friend to sign up for LifeFlow</Text>
            </View>
          }
        />
      )}

      {selected.length > 0 && (
        <TouchableOpacity
          onPress={createChat}
          disabled={creating}
          style={styles.cta}
          activeOpacity={0.85}
        >
          {creating ? (
            <ActivityIndicator color={COLORS.bg} />
          ) : (
            <>
              <Text style={styles.ctaText}>
                {isGroup ? `Create group (${selected.length})` : 'Start chat'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.bg} />
            </>
          )}
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.glassBorder,
    overflow: 'hidden',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '600' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  groupNameWrap: { paddingHorizontal: 16, paddingBottom: 6 },
  searchInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.glass, borderColor: COLORS.glassBorder, borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden',
  },
  groupNameInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.neonSoft, borderColor: 'rgba(0,200,83,0.35)', borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden',
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15, paddingVertical: 0 },
  rowWrap: { borderRadius: 18, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderWidth: 1, borderColor: COLORS.glassBorder,
    borderRadius: 18, backgroundColor: COLORS.glass,
  },
  rowSelected: { borderColor: COLORS.neon, backgroundColor: COLORS.neonSoft },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.neonSoft,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,200,83,0.35)',
  },
  avatarText: { color: COLORS.neon, fontSize: 15, fontWeight: '700' },
  rowContent: { flex: 1 },
  rowName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  rowEmail: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  check: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: COLORS.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  checkOn: { backgroundColor: COLORS.neon, borderColor: COLORS.neon },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  emptyHint: { color: COLORS.textSecondary, fontSize: 13 },
  cta: {
    position: 'absolute', left: 20, right: 20, bottom: 28,
    flexDirection: 'row', gap: 10,
    backgroundColor: COLORS.neon, borderRadius: 18, paddingVertical: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.neon, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
  },
  ctaText: { color: COLORS.bg, fontSize: 16, fontWeight: '700' },
});
