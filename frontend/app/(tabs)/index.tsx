import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as db from '@/services/database';
import { Note } from '@/types';

export default function DashboardScreen() {
  const { user, isDbReady } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([]);
  const [stats, setStats] = useState({ events: 0, reminders: 0, pinned: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFab, setShowFab] = useState(false);

  const loadData = async () => {
    if (!user || !isDbReady) return;
    try {
      const [notes, events, reminders] = await Promise.all([
        db.getLocalNotes(user.id, { pinned: true }),
        db.getLocalEvents(user.id),
        db.getLocalReminders(user.id, false),
      ]);
      setPinnedNotes(notes);
      setStats({ events: events.length, reminders: reminders.length, pinned: notes.length });
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isDbReady) loadData();
    }, [user, isDbReady])
  );

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 16,
    },
    greeting: { fontSize: 24, fontWeight: '700', color: colors.text },
    date: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    content: { flex: 1, paddingHorizontal: 20 },
    card: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
    welcomeCard: { backgroundColor: colors.primary },
    welcomeTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 8 },
    welcomeText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 22 },
    statsRow: { flexDirection: 'row', marginTop: 16, gap: 12 },
    statItem: {
      flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12,
      padding: 12, alignItems: 'center',
    },
    statNumber: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    pinnedNote: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    pinnedNoteIcon: { marginRight: 12 },
    pinnedNoteTitle: { flex: 1, fontSize: 14, color: colors.text },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
    fab: {
      position: 'absolute', bottom: 20, right: 20, width: 56, height: 56,
      borderRadius: 28, backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
    },
    fabMenu: {
      position: 'absolute', bottom: 90, right: 20, backgroundColor: colors.surface,
      borderRadius: 12, padding: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
    },
    fabMenuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8 },
    fabMenuText: { marginLeft: 12, fontSize: 14, fontWeight: '500', color: colors.text },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    offlineBadge: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent,
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    },
    offlineBadgeText: { fontSize: 11, color: '#FFFFFF', marginLeft: 4, fontWeight: '500' },
  });

  if (isLoading || !isDbReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}!</Text>
          <Text style={styles.date}>{dateString}</Text>
        </View>
        <View style={styles.offlineBadge}>
          <Ionicons name="phone-portrait" size={12} color="#FFFFFF" />
          <Text style={styles.offlineBadgeText}>Local</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, styles.welcomeCard]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="flash" size={20} color="#FFFFFF" />
            <Text style={[styles.welcomeTitle, { marginLeft: 8, marginBottom: 0 }]}>Device-First Mode</Text>
          </View>
          <Text style={styles.welcomeText}>
            Your data is stored locally for instant access. Sync to cloud from Profile when ready.
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.events}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.reminders}</Text>
              <Text style={styles.statLabel}>Tasks</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.pinned}</Text>
              <Text style={styles.statLabel}>Pinned</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardTitle}>Pinned Notes</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/notes')}>
              <Text style={{ color: colors.primary, fontSize: 14 }}>See All</Text>
            </TouchableOpacity>
          </View>
          {pinnedNotes.length === 0 ? (
            <Text style={styles.emptyText}>No pinned notes yet</Text>
          ) : (
            pinnedNotes.slice(0, 5).map((note, index) => (
              <TouchableOpacity
                key={note.id}
                style={[styles.pinnedNote, index === Math.min(pinnedNotes.length - 1, 4) && { borderBottomWidth: 0 }]}
                onPress={() => router.push(`/note/${note.id}`)}
              >
                <Ionicons name="pin" size={16} color={colors.accent} style={styles.pinnedNoteIcon} />
                <Text style={styles.pinnedNoteTitle} numberOfLines={1}>{note.title}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {showFab && (
        <View style={styles.fabMenu}>
          <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setShowFab(false); router.push('/note/new'); }}>
            <Ionicons name="document-text" size={20} color={colors.primary} />
            <Text style={styles.fabMenuText}>New Note</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setShowFab(false); router.push('/(tabs)/calendar'); }}>
            <Ionicons name="calendar" size={20} color={colors.accent} />
            <Text style={styles.fabMenuText}>New Event</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setShowFab(false); router.push('/(tabs)/reminders'); }}>
            <Ionicons name="checkbox" size={20} color={colors.warning} />
            <Text style={styles.fabMenuText}>New Task</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowFab(!showFab)} activeOpacity={0.8}>
        <Ionicons name={showFab ? 'close' : 'add'} size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
