import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const { colors, theme, toggleTheme } = useTheme();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
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
      'Unlock all premium features for $9.99/month:\n\n• Unlimited notes\n• AI-powered insights\n• Priority support\n• Custom themes',
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
              Alert.alert('Success', 'Welcome to Pro! Enjoy your premium features.');
            } catch (error) {
              Alert.alert('Error', 'Failed to upgrade. Please try again.');
            } finally {
              setIsUpgrading(false);
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },
    profileSection: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    avatarText: {
      fontSize: 32,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    userName: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    subscriptionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    freeBadge: {
      backgroundColor: colors.border,
    },
    proBadge: {
      backgroundColor: colors.warning,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 4,
    },
    section: {
      marginHorizontal: 20,
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    rowContent: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    rowSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    upgradeCard: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: 20,
    },
    upgradeTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 8,
    },
    upgradeDesc: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.9)',
      marginBottom: 16,
      lineHeight: 20,
    },
    upgradeButton: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    upgradeButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    logoutButton: {
      backgroundColor: colors.error,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginHorizontal: 20,
      marginBottom: 40,
    },
    logoutText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.name || 'U')}</Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={[
            styles.subscriptionBadge,
            user?.subscription === 'pro' ? styles.proBadge : styles.freeBadge
          ]}>
            <Ionicons
              name={user?.subscription === 'pro' ? 'star' : 'star-outline'}
              size={14}
              color={user?.subscription === 'pro' ? '#FFFFFF' : colors.textSecondary}
            />
            <Text style={[
              styles.badgeText,
              { color: user?.subscription === 'pro' ? '#FFFFFF' : colors.textSecondary }
            ]}>
              {user?.subscription === 'pro' ? 'PRO' : 'FREE'}
            </Text>
          </View>
        </View>

        {/* Subscription Card */}
        {user?.subscription !== 'pro' && (
          <View style={styles.section}>
            <View style={styles.upgradeCard}>
              <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
              <Text style={styles.upgradeDesc}>
                Unlock unlimited notes, AI insights, and premium features.
              </Text>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={handleUpgrade}
                disabled={isUpgrading}
              >
                {isUpgrading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.upgradeButtonText}>Upgrade for $9.99/mo</Text>
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
                <Text style={styles.rowSubtitle}>Switch between light and dark theme</Text>
              </View>
              <Switch
                value={theme === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={[styles.row, styles.rowLast]}>
              <View style={[styles.rowIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="notifications" size={18} color="#4CAF50" />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Notifications</Text>
                <Text style={styles.rowSubtitle}>Manage notification preferences</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="person" size={18} color="#2196F3" />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Edit Profile</Text>
                <Text style={styles.rowSubtitle}>Change your name and photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
            <View style={[styles.row, styles.rowLast]}>
              <View style={[styles.rowIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="shield" size={18} color="#FF9800" />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Privacy & Security</Text>
                <Text style={styles.rowSubtitle}>Manage your data and security</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
