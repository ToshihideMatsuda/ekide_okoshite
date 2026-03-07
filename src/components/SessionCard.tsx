import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '../types';
import { useTranslation } from '../i18n';

type Props = {
  session: Session;
  onDelete?: (id: string) => void;
};

export default function SessionCard({ session, onDelete }: Props) {
  const { t } = useTranslation();

  const handleDeletePress = () => {
    Alert.alert(t('sessionCard.deleteTitle'), t('sessionCard.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sessionCard.delete'), style: 'destructive', onPress: () => onDelete?.(session.id) },
    ]);
  };

  const statusLabels: Record<Session['status'], string> = {
    active: t('sessionCard.statusActive'),
    completed: t('sessionCard.statusCompleted'),
    cancelled: t('sessionCard.statusCancelled'),
  };

  const statusColors: Record<Session['status'], string> = {
    active: '#4CAF50',
    completed: '#1565C0',
    cancelled: '#aaa',
  };

  const date = new Date(session.startedAt);
  const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={[styles.card, session.status === 'active' && styles.cardActive]}>
      <View style={styles.header}>
        <View style={styles.routeRow}>
          <Ionicons name="train-outline" size={16} color="#1565C0" />
          <Text style={styles.routeText} numberOfLines={1}>
            {session.originStation.name}
            {' → '}
            {session.destinationStation.name}
          </Text>
        </View>
        <View style={styles.rightGroup}>
          <View style={[styles.badge, { backgroundColor: statusColors[session.status] }]}>
            <Text style={styles.badgeText}>{statusLabels[session.status]}</Text>
          </View>
          {session.status !== 'active' && onDelete && (
            <TouchableOpacity onPress={handleDeletePress} style={styles.deleteButton} hitSlop={8}>
              <Ionicons name="trash-outline" size={16} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.metaRow}>
          <Ionicons name="map-outline" size={13} color="#888" />
          <Text style={styles.metaText}>
            {t('sessionCard.stations', { count: session.route.length })}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color="#888" />
          <Text style={styles.metaText}>{session.detectionRadius}m</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color="#888" />
          <Text style={styles.metaText}>{dateStr}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardActive: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  routeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deleteButton: {
    padding: 2,
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#888',
  },
});
