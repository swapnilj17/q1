import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
  ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Calendar, DateData } from 'react-native-calendars';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as db from '@/services/database';
import { Note } from '@/types';
import { format } from 'date-fns';

export default function JournalScreen() {
  const { colors } = useTheme();
  const { user, isDbReady } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [journalEntry, setJournalEntry] = useState<Note | null>(null);
  const [markedDates, setMarkedDates] = useState<{ [key: string]: any }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadJournalEntries = async () => {
    if (!user || !isDbReady) return;
    try {
      const entries = await db.getLocalNotes(user.id, { journal: true });
      const marked: { [key: string]: any } = {};
      entries.forEach(entry => {
        if (entry.journal_date) {
          marked[entry.journal_date] = { marked: true, dotColor: colors.primary };
        }
      });
      setMarkedDates(marked);
      const todayEntry = entries.find(e => e.journal_date === selectedDate);
      setJournalEntry(todayEntry || null);
      if (todayEntry) setEditorContent(todayEntry.content);
    } catch (error) {
      console.error('Failed to load journal entries:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const loadEntryForDate = async (date: string) => {
    if (!user) return;
    try {
      const entries = await db.getLocalNotes(user.id, { journal_date: date });
      if (entries.length > 0) {
        setJournalEntry(entries[0]);
        setEditorContent(entries[0].content);
      } else {
        setJournalEntry(null);
        setEditorContent('');
      }
    } catch (error) {
      console.error('Failed to load journal entry:', error);
    }
  };

  useFocusEffect(useCallback(() => { if (isDbReady) loadJournalEntries(); }, [user, isDbReady]));

  const onRefresh = () => { setRefreshing(true); loadJournalEntries(); };
  const handleDateSelect = (day: DateData) => { setSelectedDate(day.dateString); loadEntryForDate(day.dateString); };

  const handleSaveEntry = async () => {
    if (!editorContent.trim() || !user) { Alert.alert('Error', 'Please write something'); return; }
    setIsSaving(true);
    try {
      if (journalEntry) {
        const updated = await db.updateLocalNote(journalEntry.id, { content: editorContent });
        setJournalEntry(updated);
      } else {
        const created = await db.createLocalNote(user.id, {
          title: `Journal - ${format(new Date(selectedDate), 'MMMM d, yyyy')}`,
          content: editorContent,
          journal_date: selectedDate,
          tags: ['journal'],
        });
        setJournalEntry(created);
        setMarkedDates(prev => ({ ...prev, [selectedDate]: { marked: true, dotColor: colors.primary } }));
      }
      setShowEditor(false);
      Alert.alert('Success', 'Journal entry saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save journal entry');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingVertical: 16 },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    calendarContainer: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.card },
    entryContainer: { flex: 1, marginTop: 20, marginHorizontal: 20 },
    dateHeader: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
    entryCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, flex: 1 },
    entryContent: { fontSize: 15, color: colors.text, lineHeight: 24 },
    emptyEntry: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 16, color: colors.textSecondary, marginTop: 12, marginBottom: 20 },
    createButton: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    editButton: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    modalButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    saveButton: { backgroundColor: colors.primary },
    saveButtonText: { color: '#FFFFFF', fontWeight: '600' },
    cancelText: { color: colors.textSecondary, fontWeight: '500' },
    editorInput: { flex: 1, padding: 20, fontSize: 16, color: colors.text, textAlignVertical: 'top' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  const calendarTheme = {
    backgroundColor: colors.card, calendarBackground: colors.card,
    textSectionTitleColor: colors.textSecondary,
    selectedDayBackgroundColor: colors.primary, selectedDayTextColor: '#ffffff',
    todayTextColor: colors.primary, dayTextColor: colors.text,
    textDisabledColor: colors.textSecondary, dotColor: colors.primary,
    selectedDotColor: '#ffffff', arrowColor: colors.primary, monthTextColor: colors.text,
  };

  if (isLoading || !isDbReady) {
    return <SafeAreaView style={styles.container}><View style={styles.loader}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.header}><Text style={styles.title}>Journal</Text></View>
        <View style={styles.calendarContainer}>
          <Calendar current={selectedDate} onDayPress={handleDateSelect}
            markedDates={{ ...markedDates, [selectedDate]: { ...markedDates[selectedDate], selected: true } }}
            theme={calendarTheme} />
        </View>
        <View style={styles.entryContainer}>
          <Text style={styles.dateHeader}>{format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}</Text>
          <View style={styles.entryCard}>
            {journalEntry ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.entryContent}>{journalEntry.content}</Text>
              </ScrollView>
            ) : (
              <View style={styles.emptyEntry}>
                <Ionicons name="book-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No entry for this day</Text>
                <TouchableOpacity style={styles.createButton} onPress={() => setShowEditor(true)}>
                  <Text style={styles.createButtonText}>Write Entry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
      {journalEntry && <TouchableOpacity style={styles.editButton} onPress={() => setShowEditor(true)}><Ionicons name="pencil" size={24} color="#FFFFFF" /></TouchableOpacity>}
      <Modal visible={showEditor} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowEditor(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>{format(new Date(selectedDate), 'MMM d, yyyy')}</Text>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveEntry} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
          <TextInput style={styles.editorInput} placeholder="Write your thoughts..." placeholderTextColor={colors.textSecondary}
            value={editorContent} onChangeText={setEditorContent} multiline autoFocus />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
