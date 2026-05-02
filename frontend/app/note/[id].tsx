import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import { Note } from '@/types';

export default function NoteEditorScreen() {
  const { colors } = useTheme();
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
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!isNewNote && id) {
      loadNote();
    }
  }, [id]);

  const loadNote = async () => {
    try {
      const noteData = await api.getNote(id!);
      setNote(noteData);
      setTitle(noteData.title);
      setContent(noteData.content);
      setTags(noteData.tags || []);
      setPinned(noteData.pinned);
    } catch (error) {
      Alert.alert('Error', 'Failed to load note');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    setIsSaving(true);
    try {
      if (isNewNote) {
        await api.createNote({
          title: title.trim(),
          content,
          tags,
          pinned,
        });
      } else {
        await api.updateNote(id!, {
          title: title.trim(),
          content,
          tags,
          pinned,
        });
      }
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (isNewNote) {
      router.back();
      return;
    }

    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteNote(id!);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSummarize = async () => {
    if (isNewNote || !id) {
      Alert.alert('Info', 'Please save the note first to use AI features');
      return;
    }

    setIsAiLoading(true);
    try {
      const result = await api.summarizeNote(id);
      Alert.alert('AI Summary', result.summary);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to summarize note');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSuggestTags = async () => {
    if (isNewNote || !id) {
      Alert.alert('Info', 'Please save the note first to use AI features');
      return;
    }

    setIsAiLoading(true);
    try {
      const result = await api.suggestTags(id);
      if (result.tags && result.tags.length > 0) {
        const newTags = result.tags.filter((t: string) => !tags.includes(t));
        if (newTags.length > 0) {
          setTags([...tags, ...newTags]);
          Alert.alert('Success', `Added ${newTags.length} suggested tags`);
        } else {
          Alert.alert('Info', 'No new tags to suggest');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to suggest tags');
    } finally {
      setIsAiLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerButton: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    titleInput: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    contentInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      paddingHorizontal: 20,
      textAlignVertical: 'top',
      lineHeight: 24,
    },
    previewContent: {
      fontSize: 16,
      color: colors.text,
      paddingHorizontal: 20,
      lineHeight: 24,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      gap: 8,
    },
    toolbarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    toolbarButtonActive: {
      backgroundColor: colors.primaryLight,
    },
    toolbarButtonText: {
      marginLeft: 6,
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    toolbarButtonTextActive: {
      color: colors.primary,
    },
    aiToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      gap: 8,
    },
    aiButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primaryLight,
    },
    aiButtonText: {
      marginLeft: 6,
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
    tagsSection: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    tagsSectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    tagText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500',
    },
    tagRemove: {
      marginLeft: 6,
    },
    tagInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    tagInput: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addTagButton: {
      marginLeft: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    addTagButtonText: {
      color: '#FFFFFF',
      fontWeight: '500',
      fontSize: 13,
    },
    loader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isNewNote ? 'New Note' : 'Edit Note'}</Text>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.titleInput}
            placeholder="Note Title"
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
          />

          {showPreview ? (
            <Text style={styles.previewContent}>{content || 'No content'}</Text>
          ) : (
            <TextInput
              style={styles.contentInput}
              placeholder="Start writing..."
              placeholderTextColor={colors.textSecondary}
              value={content}
              onChangeText={setContent}
              multiline
              scrollEnabled={false}
            />
          )}

          {/* Tags Section */}
          <View style={styles.tagsSection}>
            <Text style={styles.tagsSectionTitle}>TAGS</Text>
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                  <TouchableOpacity
                    style={styles.tagRemove}
                    onPress={() => handleRemoveTag(tag)}
                  >
                    <Ionicons name="close-circle" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                placeholder="Add a tag..."
                placeholderTextColor={colors.textSecondary}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addTagButton} onPress={handleAddTag}>
                <Text style={styles.addTagButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* AI Toolbar */}
        {!isNewNote && (
          <View style={styles.aiToolbar}>
            <TouchableOpacity
              style={styles.aiButton}
              onPress={handleSummarize}
              disabled={isAiLoading}
            >
              {isAiLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                  <Text style={styles.aiButtonText}>Summarize</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.aiButton}
              onPress={handleSuggestTags}
              disabled={isAiLoading}
            >
              <Ionicons name="pricetag" size={16} color={colors.primary} />
              <Text style={styles.aiButtonText}>Suggest Tags</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={[styles.toolbarButton, pinned && styles.toolbarButtonActive]}
            onPress={() => setPinned(!pinned)}
          >
            <Ionicons
              name={pinned ? 'pin' : 'pin-outline'}
              size={18}
              color={pinned ? colors.primary : colors.text}
            />
            <Text style={[styles.toolbarButtonText, pinned && styles.toolbarButtonTextActive]}>
              {pinned ? 'Pinned' : 'Pin'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolbarButton, showPreview && styles.toolbarButtonActive]}
            onPress={() => setShowPreview(!showPreview)}
          >
            <Ionicons
              name={showPreview ? 'eye' : 'eye-outline'}
              size={18}
              color={showPreview ? colors.primary : colors.text}
            />
            <Text style={[styles.toolbarButtonText, showPreview && styles.toolbarButtonTextActive]}>
              Preview
            </Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.toolbarButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.toolbarButtonText, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
