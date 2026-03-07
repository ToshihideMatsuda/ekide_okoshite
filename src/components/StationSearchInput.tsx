import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Station } from '../types';
import { searchStationsByName } from '../services/stationDb';
import { useTranslation } from '../i18n';

type Props = {
  label: string;
  value: Station | null;
  onSelect: (station: Station) => void;
  onClear?: () => void;
  placeholder?: string;
  currentLocation?: { latitude: number; longitude: number } | null;
};

export default function StationSearchInput({ label, value, onSelect, onClear, placeholder, currentLocation }: Props) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = useCallback(async (text: string) => {
    setKeyword(text);
    if (!text.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setIsLoading(true);
    try {
      const stations = await searchStationsByName(text.trim(), currentLocation);
      setResults(stations);
      setShowResults(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelect = (station: Station) => {
    onSelect(station);
    setKeyword('');
    setResults([]);
    setShowResults(false);
  };

  const formatLineNames = (lineNames: string[] | undefined, lineName: string): string => {
    const names = lineNames && lineNames.length > 0 ? lineNames : [lineName];
    if (names.length >= 3) return `${names[0]} / ${names[1]} ...`;
    return names.join(' / ');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {value && !showResults ? (
        <View style={styles.selectedRow}>
          <Ionicons name="train-outline" size={18} color="#1565C0" />
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedName}>{value.name}</Text>
            <Text style={styles.selectedLine}>{formatLineNames(value.lineNames, value.lineName)}</Text>
          </View>
          {onClear && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                onClear();
                setKeyword('');
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.inputRow}>
          <Ionicons name="search" size={18} color="#888" />
          <TextInput
            style={styles.input}
            value={keyword}
            onChangeText={handleSearch}
            placeholder={placeholder ?? t('stationSearch.placeholder')}
            autoFocus={showResults}
          />
          {isLoading && <ActivityIndicator size="small" color="#1565C0" />}
          {keyword.length > 0 && !isLoading && (
            <TouchableOpacity
              onPress={() => {
                setKeyword('');
                setResults([]);
                setShowResults(false);
              }}
            >
              <Ionicons name="close-circle" size={18} color="#aaa" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {showResults && results.length > 0 && (
        <ScrollView style={styles.resultList} keyboardShouldPersistTaps="handled">
          {results.map((item) => (
            <TouchableOpacity
              key={item.groupId ?? item.id}
              style={styles.resultItem}
              onPress={() => handleSelect(item)}
            >
              <Ionicons name="train-outline" size={16} color="#1565C0" />
              <View style={styles.resultText}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultLine}>{formatLineNames(item.lineNames, item.lineName)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {showResults && !isLoading && keyword.trim() && results.length === 0 && (
        <Text style={styles.noResult}>
          {t('stationSearch.noResult', { keyword })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1565C0',
  },
  selectedLine: {
    fontSize: 12,
    color: '#1565C0',
    opacity: 0.7,
    marginTop: 1,
  },
  clearButton: {
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  resultList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    maxHeight: 240,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  resultLine: {
    fontSize: 12,
    color: '#888',
    marginTop: 1,
  },
  noResult: {
    fontSize: 13,
    color: '#aaa',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
