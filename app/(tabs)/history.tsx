import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '../../src/store/sessionStore';
import SessionCard from '../../src/components/SessionCard';
import { useTranslation } from '../../src/i18n';

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { sessions, isLoading, error, loadSessions, clearError, deleteSession } = useSessionStore();

  const handleRefresh = useCallback(() => {
    loadSessions();
  }, [loadSessions]);

  React.useEffect(() => {
    if (error) {
      Alert.alert(t('common.error'), error, [{ text: t('common.ok'), onPress: clearError }]);
    }
  }, [error, clearError, t]);

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SessionCard session={item} onDelete={deleteSession} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>{t('home.noHistory')}</Text>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    paddingBottom: 16,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#bbb',
  },
});
