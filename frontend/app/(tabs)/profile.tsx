import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import * as db from '@/services/database';
import { fullSync } from '@/services/sync';

const SYNC_OPTIONS = [
  { value: 'manual', label: 'Manual Only' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function ProfileScreen() {
  const { user, logout, updateUser, updateSyncFrequency } = useAuth();
  const { colors, theme, toggleTheme } = useTheme();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [showSyncOptions, setShowSyncOptions] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    loadSyncStatus();
  }, [user]);

  const loadSyncStatus = async () => {
    if (user) {
      const count = await db.getUnsyncedCount();
      setUnsyncedCount(count);
      const localUser = await db.getLocalUser();
      setLastSync(localUser?.last_sync || null);
    }
  };

  const handleSync = async () => {
    if (!user) return;
    
    setIsSyncing(true);
    try {
      const result = await fullSync(user.id);
      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Uploaded: ${result.uploaded} items\nDownloaded: ${result.downloaded} items`
        );
      } else {
        Alert.alert(
          'Sync Partial',
          `Synced with ${result.errors} errors.\nUploaded: ${result.uploaded}\nDownloaded: ${result.downloaded}`
        );
      }
      await loadSyncStatus();
    } catch (error) {
      Alert.alert('Sync Failed', 'Could not sync with cloud. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncFrequencyChange = async (frequency: string) => {
    await updateSyncFrequency(frequency);
    setShowSyncOptions(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      unsyncedCount > 0 
        ? `You have ${unsyncedCount} unsynced changes. Logging out will lose this data. Continue?`
        : 'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleUpgrade = async () => {
    if (user?.subscription === 'pro') {
      Alert.alert('Info', 'You are already on Pro plan!');
      return;
    }

    Alert.alert(
      'Upgrade to Pro',
      'Unlock all premium features for $9.99/month:\n\n• Unlimited cloud sync\n• AI-powered insights\n• Priority support\n• Custom themes',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upgrade',
          onPress: async () => {
            setIsUpgrading(true);
            try {
              await api.updateSubscription('pro');
              if (user) {
                updateUser({ ...user, subscription: 'pro' });
              }
              Alert.alert('Success', 'Welcome to Pro!');
            } catch (error) {
              Alert.alert('Error', 'Failed to upgrade.');
            } finally {
              setIsUpgrading(false);
            }
          },
        },
      ]
    );
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingVertical: 16 },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    profileSection: { alignItems: 'center', paddingVertical: 24 },
    avatar: {
      width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    avatarText: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
    userName: { fontSize: 22, fontWeight: '600', color: colors.text, marginBottom: 4 },
    userEmail: { fontSize: 14, color: colors.textSecondary },
    subscriptionBadge: {
      flexDirection: 'row', alignItems: 'center', marginTop: 12,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    },
    freeBadge: { backgroundColor: colors.border },
    proBadge: { backgroundColor: colors.warning },
    badgeText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
    section: { marginHorizontal: 20, marginBottom: 24 },
    sectionTitle: {
      fontSize: 13, fontWeight: '600', color: colors.textSecondary,
      marginBottom: 8, textTransform: 'uppercase',
    },
    card: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' },
    row: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
      paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: {
      width: 36, height: 36, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    rowContent: { flex: 1 },
    rowTitle: { fontSize: 16, color: colors.text, fontWeight: '500' },
    rowSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    rowValue: { fontSize: 14, color: colors.textSecondary, marginRight: 8 },
    syncCard: {
      backgroundColor: colors.primaryLight, borderRadius: 16, padding: 16, marginBottom: 16,
    },
    syncHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    syncTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    syncBadge: {
      backgroundColor: colors.warning, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    },
    syncBadgeText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
    syncInfo: { marginTop: 8 },
    syncInfoText: { fontSize: 13, color: colors.textSecondary },
    syncButton: {
      backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12,
      alignItems: 'center', marginTop: 12,
    },
    syncButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    upgradeCard: { backgroundColor: colors.primary, borderRadius: 16, padding: 20 },
    upgradeTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
    upgradeDesc: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 16, lineHeight: 20 },
    upgradeButton: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    upgradeButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
    logoutButton: {
      backgroundColor: colors.error, borderRadius: 12, paddingVertical: 14,
      alignItems: 'center', marginHorizontal: 20, marginBottom: 40,
    },
    logoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center', alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.card, borderRadius: 16, padding: 20,
      width: '80%', maxWidth: 300,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 16 },
    optionButton: {
      paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8,
    },
    optionSelected: { backgroundColor: colors.primaryLight },
    optionText: { fontSize: 16, color: colors.text },
    optionSelectedText: { color: colors.primary, fontWeight: '600' },
  });

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const currentFrequency = SYNC_OPTIONS.find(o => o.value === (user?.sync_frequency || 'manual'));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.name || 'U')}</Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={[styles.subscriptionBadge, user?.subscription === 'pro' ? styles.proBadge : styles.freeBadge]}>
            <Ionicons name={user?.subscription === 'pro' ? 'star' : 'star-outline'} size={14}
              color={user?.subscription === 'pro' ? '#FFFFFF' : colors.textSecondary} />
            <Text style={[styles.badgeText, { color: user?.subscription === 'pro' ? '#FFFFFF' : colors.textSecondary }]}>
              {user?.subscription === 'pro' ? 'PRO' : 'FREE'}
            </Text>
          </View>
        </View>

        {/* Cloud Sync Card */}
        <View style={styles.section}>
          <View style={styles.syncCard}>
            <View style={styles.syncHeader}>
              <Text style={styles.syncTitle}>Cloud Sync</Text>
              {unsyncedCount > 0 && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>{unsyncedCount} pending</Text>
                </View>
              )}
            </View>
            <View style={styles.syncInfo}>
              <Text style={styles.syncInfoText}>Last sync: {formatLastSync(lastSync)}</Text>
              <Text style={styles.syncInfoText}>Auto-sync: {currentFrequency?.label}</Text>
            </View>
            <TouchableOpacity style={styles.syncButton} onPress={handleSync} disabled={isSyncing}>
              {isSyncing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.syncButtonText}>Sync Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Subscription */}
        {user?.subscription !== 'pro' && (
          <View style={styles.section}>
            <View style={styles.upgradeCard}>
              <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
              <Text style={styles.upgradeDesc}>Unlimited sync, AI insights, and premium features.</Text>
              <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade} disabled={isUpgrading}>
                {isUpgrading ? <ActivityIndicator color={colors.primary} /> : (
                  <Text style={styles.upgradeButtonText}>Upgrade $9.99/mo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={18} color={colors.primary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Dark Mode</Text>
              </View>
              <Switch value={theme === 'dark'} onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF" />
            </View>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => setShowSyncOptions(true)}>
              <View style={[styles.rowIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="cloud-upload" size={18} color="#4CAF50" />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Auto Sync</Text>
                <Text style={styles.rowSubtitle}>How often to sync to cloud</Text>
              </View>
              <Text style={styles.rowValue}>{currentFrequency?.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sync Frequency Modal */}
      <Modal visible={showSyncOptions} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSyncOptions(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Auto Sync Frequency</Text>
            {SYNC_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, user?.sync_frequency === option.value && styles.optionSelected]}
                onPress={() => handleSyncFrequencyChange(option.value)}
              >
                <Text style={[styles.optionText, user?.sync_frequency === option.value && styles.optionSelectedText]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
