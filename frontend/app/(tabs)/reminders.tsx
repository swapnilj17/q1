import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  RefreshControl, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as db from '@/services/database';
import { Reminder } from '@/types';

export default function RemindersScreen() {
  const { colors } = useTheme();
  const { user, isDbReady } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newReminder, setNewReminder] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const loadReminders = async () => {
    if (!user || !isDbReady) return;
    try {
      const data = await db.getLocalReminders(user.id);
      setReminders(data);
    } catch (error) {
      console.error('Failed to load reminders:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { if (isDbReady) loadReminders(); }, [user, isDbReady]));

  const onRefresh = () => { setRefreshing(true); loadReminders(); };

  const handleAddReminder = async () => {
    if (!newReminder.trim() || !user) return;
    setIsAdding(true);
    Keyboard.dismiss();
    try {
      const created = await db.createLocalReminder(user.id, { title: newReminder.trim() });
      setReminders([created, ...reminders]);
      setNewReminder('');
    } catch (error) {
      Alert.alert('Error', 'Failed to add reminder');
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleReminder = async (reminder: Reminder) => {
    try {
      const updated = await db.updateLocalReminder(reminder.id, { completed: !reminder.completed });
      if (updated) setReminders(reminders.map(r => r.id === reminder.id ? updated : r));
    } catch (error) {
      Alert.alert('Error', 'Failed to update reminder');
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await db.deleteLocalReminder(id);
      setReminders(reminders.filter(r => r.id !== id));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete reminder');
    }
  };

  const handleClearCompleted = () => {
    const completedCount = reminders.filter(r => r.completed).length;
    if (completedCount === 0) { Alert.alert('Info', 'No completed reminders'); return; }
    Alert.alert('Clear Completed', `Delete ${completedCount} completed?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        if (user) {
          await db.clearCompletedLocalReminders(user.id);
          setReminders(reminders.filter(r => !r.completed));
        }
      }},
    ]);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    clearButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
    clearButtonText: { marginLeft: 6, fontSize: 14, fontWeight: '500', color: colors.textSecondary },
    inputContainer: {
      flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16,
      backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border,
    },
    input: { flex: 1, height: 52, fontSize: 16, color: colors.text },
    addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    addButtonDisabled: { backgroundColor: colors.border },
    listContent: { paddingHorizontal: 20, paddingBottom: 100 },
    reminderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
    reminderText: { flex: 1, fontSize: 16, color: colors.text },
    reminderTextCompleted: { textDecorationLine: 'line-through', color: colors.textSecondary },
    deleteButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, color: colors.textSecondary, marginTop: 12 },
    statsContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, paddingVertical: 16, marginBottom: 8 },
    statItem: { alignItems: 'center' },
    statNumber: { fontSize: 24, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  const renderReminder = ({ item }: { item: Reminder }) => (
    <View style={styles.reminderCard}>
      <TouchableOpacity style={[styles.checkbox, item.completed && styles.checkboxChecked]} onPress={() => handleToggleReminder(item)}>
        {item.completed && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
      </TouchableOpacity>
      <Text style={[styles.reminderText, item.completed && styles.reminderTextCompleted]}>{item.title}</Text>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteReminder(item.id)}>
        <Ionicons name="trash-outline" size={18} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  if (isLoading || !isDbReady) {
    return <SafeAreaView style={styles.container}><View style={styles.loader}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  const pendingCount = reminders.filter(r => !r.completed).length;
  const completedCount = reminders.filter(r => r.completed).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <TouchableOpacity style={styles.clearButton} onPress={handleClearCompleted}>
          <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.clearButtonText}>Clear Done</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.statsContainer}>
        <View style={styles.statItem}><Text style={styles.statNumber}>{pendingCount}</Text><Text style={styles.statLabel}>Pending</Text></View>
        <View style={styles.statItem}><Text style={styles.statNumber}>{completedCount}</Text><Text style={styles.statLabel}>Done</Text></View>
        <View style={styles.statItem}><Text style={styles.statNumber}>{reminders.length}</Text><Text style={styles.statLabel}>Total</Text></View>
      </View>
      <View style={styles.inputContainer}>
        <TextInput style={styles.input} placeholder="Add a new task..." placeholderTextColor={colors.textSecondary}
          value={newReminder} onChangeText={setNewReminder} onSubmitEditing={handleAddReminder} returnKeyType="done" />
        <TouchableOpacity style={[styles.addButton, (!newReminder.trim() || isAdding) && styles.addButtonDisabled]}
          onPress={handleAddReminder} disabled={!newReminder.trim() || isAdding}>
          {isAdding ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="add" size={22} color="#FFFFFF" />}
        </TouchableOpacity>
      </View>
      <FlatList data={reminders} renderItem={renderReminder} keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="checkbox-outline" size={48} color={colors.textSecondary} /><Text style={styles.emptyText}>No tasks yet</Text></View>}
      />
    </SafeAreaView>
  );
}
