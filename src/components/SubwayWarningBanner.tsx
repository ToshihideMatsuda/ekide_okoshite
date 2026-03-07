import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../i18n';

type Props = {
  stationNames: string[];
};

export default function SubwayWarningBanner({ stationNames }: Props) {
  const { t } = useTranslation();
  if (stationNames.length === 0) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="warning-outline" size={16} color="#E65100" style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{t('subway.warningTitle')}</Text>
        <Text style={styles.body}>{t('subway.warningBody')}</Text>
        <Text style={styles.stations}>{stationNames.join('・')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#E65100',
  },
  icon: { marginTop: 1, marginRight: 8 },
  textContainer: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: '#E65100', marginBottom: 2 },
  body: { fontSize: 12, color: '#5D4037', lineHeight: 17 },
  stations: { fontSize: 12, color: '#795548', marginTop: 3, fontWeight: '500' },
});
