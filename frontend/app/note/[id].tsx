import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as db from '@/services/database';
import { Note } from '@/types';
import VoiceRecorder from '@/components/VoiceRecorder';
import VideoRecorder from '@/components/VideoRecorder';
import MediaPlayer from '@/components/MediaPlayer';

export default function NoteEditorScreen() {
  const { colors } = useTheme();
  const { user, isDbReady } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNewNote = id === 'new';

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [pinned, setPinned] = useState(false);
  const [isLoading, setIsLoading] = useState(!isNewNote);
  const [isSaving, setIsSaving] = useState(false);

  // Media state
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'audio' | 'video' | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isNewNote && id && isDbReady) loadNote();
  }, [id, isDbReady]);

  const loadNote = async () => {
    try {
      const noteData = await db.getLocalNote(id!);
      if (noteData) {
        setNote(noteData);
        setTitle(noteData.title);
        setContent(noteData.content);
        setTags(noteData.tags || []);
        setPinned(noteData.pinned);
        // Load existing media
        if (noteData.media_url) {
          setMediaUrl(noteData.media_url);
          setMediaType(noteData.media_type || null);
        }
      } else {
        Alert.alert('Error', 'Note not found');
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load note');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !user) { Alert.alert('Error', 'Please enter a title'); return; }
    setIsSaving(true);
    try {
      const noteData = {
        title: title.trim(),
        content,
        tags,
        pinned,
        media_url: mediaUrl,
        media_type: mediaType,
      };

      if (isNewNote) {
        await db.createLocalNote(user.id, noteData);
      } else {
        await db.updateLocalNote(id!, noteData);
      }
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (isNewNote) { router.back(); return; }
    Alert.alert('Delete Note', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await db.deleteLocalNote(id!);
        router.back();
      }},
    ]);
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => setTags(tags.filter(t => t !== tagToRemove));

  // Voice recording complete handler
  const handleVoiceRecordingComplete = async (uri: string, durationMs: number) => {
    setShowVoiceRecorder(false);
    setIsUploading(true);
    try {
      // For now, store the local URI directly
      // In production, this would upload to Supabase Storage
      setMediaUrl(uri);
      setMediaType('audio');
      Alert.alert('Voice Note Added', `Duration: ${Math.round(durationMs / 1000)}s`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save voice note');
    } finally {
      setIsUploading(false);
    }
  };

  // Video recording complete handler
  const handleVideoRecordingComplete = async (uri: string) => {
    setShowVideoRecorder(false);
    setIsUploading(true);
    try {
      // For now, store the local URI directly
      // In production, this would upload to Supabase Storage
      setMediaUrl(uri);
      setMediaType('video');
      Alert.alert('Video Note Added', 'Your video has been attached.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save video note');
    } finally {
      setIsUploading(false);
    }
  };

  // Remove attached media
  const handleRemoveMedia = () => {
    Alert.alert('Remove Media', 'Remove attached recording?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        setMediaUrl(null);
        setMediaType(null);
      }},
    ]);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
    headerButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
    saveButton: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    saveButtonText: { color: '#FFFFFF', fontWeight: '600' },
    content: { flex: 1 },
    titleInput: { fontSize: 22, fontWeight: '600', color: colors.text, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
    contentInput: { flex: 1, fontSize: 16, color: colors.text, paddingHorizontal: 20, textAlignVertical: 'top', lineHeight: 24, minHeight: 120 },
    // Media Toolbar
    mediaToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    mediaToolbarTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginRight: 8,
    },
    mediaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: 'rgba(0,200,83,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(0,200,83,0.25)',
    },
    mediaBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#00C853',
    },
    mediaBtnDisabled: {
      opacity: 0.5,
    },
    // Media Player Section
    mediaSection: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    mediaSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    mediaSectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    removeMediaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    removeMediaText: {
      fontSize: 12,
      color: colors.error,
      fontWeight: '500',
    },
    // Smart Insights placeholder
    insightsCard: {
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 8,
      padding: 16,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    insightsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    insightsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#00C853',
    },
    insightsPlaceholder: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    // Upload indicator
    uploadingOverlay: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 10,
      backgroundColor: 'rgba(0,200,83,0.1)',
      marginHorizontal: 20,
      marginTop: 12,
      borderRadius: 10,
    },
    uploadingText: {
      color: '#00C853',
      fontSize: 13,
      fontWeight: '500',
    },
    toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, gap: 8 },
    toolbarButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.background },
    toolbarButtonActive: { backgroundColor: colors.primaryLight },
    toolbarButtonText: { marginLeft: 6, fontSize: 13, fontWeight: '500', color: colors.text },
    toolbarButtonTextActive: { color: colors.primary },
    tagsSection: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
    tagsSectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    tagText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
    tagRemove: { marginLeft: 6 },
    tagInputContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    tagInput: { flex: 1, backgroundColor: colors.inputBackground, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
    addTagButton: { marginLeft: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary },
    addTagButtonText: { color: '#FFFFFF', fontWeight: '500', fontSize: 13 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });

  if (isLoading) {
    return <SafeAreaView style={styles.container}><View style={styles.loader}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isNewNote ? 'New Note' : 'Edit Note'}</Text>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveButtonText}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput style={styles.titleInput} placeholder="Note Title" placeholderTextColor={colors.textSecondary} value={title} onChangeText={setTitle} />
          <TextInput style={styles.contentInput} placeholder="Start writing..." placeholderTextColor={colors.textSecondary} value={content} onChangeText={setContent} multiline scrollEnabled={false} />

          {/* Media Toolbar */}
          <View style={styles.mediaToolbar}>
            <Text style={styles.mediaToolbarTitle}>ATTACH</Text>
            <TouchableOpacity
              style={[styles.mediaBtn, (mediaUrl || isUploading) && styles.mediaBtnDisabled]}
              onPress={() => setShowVoiceRecorder(true)}
              disabled={!!mediaUrl || isUploading}
            >
              <Ionicons name="mic" size={18} color="#00C853" />
              <Text style={styles.mediaBtnText}>Voice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mediaBtn, (mediaUrl || isUploading) && styles.mediaBtnDisabled]}
              onPress={() => setShowVideoRecorder(true)}
              disabled={!!mediaUrl || isUploading}
            >
              <Ionicons name="videocam" size={18} color="#00C853" />
              <Text style={styles.mediaBtnText}>Video</Text>
            </TouchableOpacity>
          </View>

          {/* Upload Progress */}
          {isUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="small" color="#00C853" />
              <Text style={styles.uploadingText}>Processing media...</Text>
            </View>
          )}

          {/* Media Player */}
          {mediaUrl && mediaType && !isUploading && (
            <View style={styles.mediaSection}>
              <View style={styles.mediaSectionHeader}>
                <Text style={styles.mediaSectionTitle}>
                  {mediaType === 'audio' ? 'Voice Note' : 'Video Note'}
                </Text>
                <TouchableOpacity style={styles.removeMediaBtn} onPress={handleRemoveMedia}>
                  <Ionicons name="trash-outline" size={14} color={colors.error} />
                  <Text style={styles.removeMediaText}>Remove</Text>
                </TouchableOpacity>
              </View>
              <MediaPlayer uri={mediaUrl} mediaType={mediaType} />
            </View>
          )}

          {/* Smart Insights Placeholder (AI disabled per user request) */}
          {mediaUrl && mediaType && (
            <View style={styles.insightsCard}>
              <View style={styles.insightsHeader}>
                <Ionicons name="sparkles" size={16} color="#00C853" />
                <Text style={styles.insightsTitle}>Smart Insights</Text>
              </View>
              <Text style={styles.insightsPlaceholder}>
                AI transcription and summary will appear here once enabled. Your {mediaType === 'audio' ? 'voice' : 'video'} note is saved locally.
              </Text>
            </View>
          )}

          {/* Tags Section */}
          <View style={styles.tagsSection}>
            <Text style={styles.tagsSectionTitle}>TAGS</Text>
            <View style={styles.tagsContainer}>
              {tags.map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                  <TouchableOpacity style={styles.tagRemove} onPress={() => handleRemoveTag(tag)}>
                    <Ionicons name="close-circle" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.tagInputContainer}>
              <TextInput style={styles.tagInput} placeholder="Add a tag..." placeholderTextColor={colors.textSecondary} value={tagInput} onChangeText={setTagInput} onSubmitEditing={handleAddTag} returnKeyType="done" />
              <TouchableOpacity style={styles.addTagButton} onPress={handleAddTag}><Text style={styles.addTagButtonText}>Add</Text></TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.toolbar}>
          <TouchableOpacity style={[styles.toolbarButton, pinned && styles.toolbarButtonActive]} onPress={() => setPinned(!pinned)}>
            <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={18} color={pinned ? colors.primary : colors.text} />
            <Text style={[styles.toolbarButtonText, pinned && styles.toolbarButtonTextActive]}>{pinned ? 'Pinned' : 'Pin'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.toolbarButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.toolbarButtonText, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Voice Recorder Modal */}
      <VoiceRecorder
        visible={showVoiceRecorder}
        onRecordingComplete={handleVoiceRecordingComplete}
        onCancel={() => setShowVoiceRecorder(false)}
      />

      {/* Video Recorder Modal */}
      <VideoRecorder
        visible={showVideoRecorder}
        onRecordingComplete={handleVideoRecordingComplete}
        onCancel={() => setShowVideoRecorder(false)}
      />
    </SafeAreaView>
  );
}
