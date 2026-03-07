import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from '../src/i18n';

export default function PrivacyPolicyScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.updated}>{t('privacy.updated')}</Text>

      <Text style={styles.sectionTitle}>{t('privacy.section1Title')}</Text>
      <Text style={styles.body}>{t('privacy.section1Body')}</Text>

      <Text style={styles.sectionTitle}>{t('privacy.section2Title')}</Text>
      <Text style={styles.body}>{t('privacy.section2Body')}</Text>

      <Text style={styles.sectionTitle}>{t('privacy.section3Title')}</Text>
      <Text style={styles.body}>{t('privacy.section3Body')}</Text>

      <Text style={styles.sectionTitle}>{t('privacy.section4Title')}</Text>
      <Text style={styles.body}>{t('privacy.section4Body')}</Text>

      <Text style={styles.sectionTitle}>{t('privacy.section5Title')}</Text>
      <Text style={styles.body}>{t('privacy.section5Body')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 48 },
  updated: { fontSize: 12, color: '#999', marginBottom: 20 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 6,
  },
  body: { fontSize: 14, color: '#444', lineHeight: 22 },
});
