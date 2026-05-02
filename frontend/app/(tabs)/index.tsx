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
import { api } from '@/services/api';
import { Note, DailyBriefing } from '@/types';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFab, setShowFab] = useState(false);

  const loadData = async () => {
    try {
      const [briefingData, notesData] = await Promise.all([
        api.getDailyBriefing(),
        api.getNotes({ pinned: true }),
      ]);
      setBriefing(briefingData);
      setPinnedNotes(notesData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'sunny': case 'clear': return 'sunny';
      case 'cloudy': return 'cloudy';
      case 'partly cloudy': return 'partly-sunny';
      case 'rainy': return 'rainy';
      default: return 'partly-sunny';
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    greeting: { fontSize: 24, fontWeight: '700', color: colors.text },
    date: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    content: { flex: 1, paddingHorizontal: 20 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
    briefingCard: { backgroundColor: colors.primary },
    briefingTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 8 },
    briefingText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 22 },
    statsRow: { flexDirection: 'row', marginTop: 16, gap: 12 },
    statItem: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    statNumber: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    weatherCard: { flexDirection: 'row', alignItems: 'center' },
    weatherIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    weatherInfo: { flex: 1 },
    temperature: { fontSize: 28, fontWeight: '700', color: colors.text },
    condition: { fontSize: 14, color: colors.textSecondary },
    highLow: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    pinnedNote: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pinnedNoteIcon: { marginRight: 12 },
    pinnedNoteTitle: { flex: 1, fontSize: 14, color: colors.text },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
    fab: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    fabMenu: {
      position: 'absolute',
      bottom: 90,
      right: 20,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    fabMenuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8 },
    fabMenuText: { marginLeft: 12, fontSize: 14, fontWeight: '500', color: colors.text },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}!</Text>
          <Text style={styles.date}>{dateString}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Briefing Card */}
        <View style={[styles.card, styles.briefingCard]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
            <Text style={[styles.briefingTitle, { marginLeft: 8, marginBottom: 0 }]}>Today's Briefing</Text>
          </View>
          <Text style={styles.briefingText}>
            {briefing?.briefing || 'Loading your daily briefing...'}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{briefing?.events_count || 0}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{briefing?.reminders_count || 0}</Text>
              <Text style={styles.statLabel}>Tasks</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{briefing?.pinned_notes_count || 0}</Text>
              <Text style={styles.statLabel}>Pinned</Text>
            </View>
          </View>
        </View>

        {/* Weather Card */}
        {briefing?.weather && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Weather</Text>
            <View style={styles.weatherCard}>
              <View style={styles.weatherIcon}>
                <Ionicons name={getWeatherIcon(briefing.weather.condition) as any} size={28} color={colors.primary} />
              </View>
              <View style={styles.weatherInfo}>
                <Text style={styles.temperature}>{briefing.weather.temperature}°F</Text>
                <Text style={styles.condition}>{briefing.weather.condition}</Text>
                <Text style={styles.highLow}>H: {briefing.weather.high}° L: {briefing.weather.low}°</Text>
              </View>
            </View>
          </View>
        )}

        {/* Pinned Notes Card */}
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

      {/* FAB Menu */}
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
