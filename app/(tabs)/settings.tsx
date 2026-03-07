import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useTranslation } from '../../src/i18n';
import { useAdStore } from '../../src/store/adStore';
import versionInfo from '../../version.json';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { completedSessionsCount } = useAdStore();

  return (
    <View style={styles.outer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* アプリについて */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sectionAbout')}</Text>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="information-circle-outline" size={20} color="#1565C0" />
              <Text style={styles.rowLabel}>{t('settings.version')}</Text>
            </View>
            <View style={styles.rowValueColumn}>
              <Text style={styles.rowValue}>1.0.0</Text>
              <Text style={styles.jsVersionText}>JS {versionInfo.jsVersion}</Text>
            </View>
          </View>
          <Link href="/privacy-policy" asChild>
            <TouchableOpacity style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#1565C0" />
                <Text style={styles.rowLabel}>{t('settings.privacy')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#ccc" />
            </TouchableOpacity>
          </Link>
        </View>

      </ScrollView>
      <View style={styles.bottomBar}>
        <Text style={styles.arrivalCountText}>
          {t('settings.arrivalCount', { count: completedSessionsCount })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1 },
  content: { paddingBottom: 40 },
  section: { marginTop: 24, marginHorizontal: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },

  // アプリについて
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowLabel: { fontSize: 15, color: '#1a1a1a' },
  rowValue: { fontSize: 14, color: '#888' },
  rowValueColumn: { alignItems: 'flex-end' },
  jsVersionText: { fontSize: 11, color: '#bbb', marginTop: 2 },

  // 到着回数フッター
  bottomBar: {
    alignItems: 'flex-end',
  },
  arrivalCountText: {
    fontSize: 11,
    color: '#bbb',
    paddingRight: 14,
    paddingBottom: 4,
  },
});
