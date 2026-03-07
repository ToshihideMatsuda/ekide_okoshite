import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyRouteStore, MyRoute } from '../../src/store/myRouteStore';
import { useSessionStore } from '../../src/store/sessionStore';
import { useGraphStore } from '../../src/store/graphStore';
import { useTranslation } from '../../src/i18n';
import { buildGraph } from '../../src/services/routing';
import { DEFAULT_DETECTION_RADIUS, DEFAULT_VOLUME, SESSION_DURATION_MS } from '../../src/constants/config';

export default function MyRoutesScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { routes, loadRoutes, deleteRoute } = useMyRouteStore();
    const { startSession, activeSession, cancelSession } = useSessionStore();
    const { graph, setGraph } = useGraphStore();
    const [startingId, setStartingId] = useState<string | null>(null);

    useEffect(() => {
        loadRoutes();
    }, []);

    const handleDelete = (item: MyRoute) => {
        Alert.alert(t('myRoute.deleteTitle'), t('myRoute.deleteMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('myRoute.delete'),
                style: 'destructive',
                onPress: () => deleteRoute(item.id),
            },
        ]);
    };

    const handleStart = async (item: MyRoute) => {
        if (activeSession) {
            const elapsed = Date.now() - new Date(activeSession.startedAt).getTime();
            if (elapsed >= SESSION_DURATION_MS) {
                await cancelSession(activeSession.id);
            } else {
                Alert.alert(
                    t('home.sessionActiveTitle'),
                    t('home.sessionActiveMessage'),
                    [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('home.goToSession'), onPress: () => router.push('/session/active') },
                    ]
                );
                return;
            }
        }

        setStartingId(item.id);
        try {
            let g = graph;
            if (!g) {
                g = await buildGraph();
                setGraph(g);
            }
            await startSession({
                originStation: item.originStation,
                destinationStation: item.destinationStation,
                route: item.route,
                allStations: item.allStations,
                detectionRadius: DEFAULT_DETECTION_RADIUS,
                soundType: 'vibration',
                volume: DEFAULT_VOLUME,
                isFromMyRoute: true,
            });
            router.push('/session/active');
        } catch (err) {
            console.error('[MyRoutes] 開始エラー:', err);
            Alert.alert(t('common.error'), t('common.failed'));
        } finally {
            setStartingId(null);
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    const renderItem = ({ item }: { item: MyRoute }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.cardStations}>
                    <Text style={styles.originText} numberOfLines={1}>{item.originStation.name}</Text>
                    <Ionicons name="arrow-forward" size={14} color="#888" />
                    <Text style={styles.destText} numberOfLines={1}>{item.destinationStation.name}</Text>
                </View>
                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
                    <Ionicons name="trash-outline" size={18} color="#e53935" />
                </TouchableOpacity>
            </View>

            {/* 中間乗り継ぎ */}
            {item.route.length > 2 && (
                <View style={styles.transfersRow}>
                    <Ionicons name="git-merge-outline" size={13} color="#888" />
                    <Text style={styles.transfersText} numberOfLines={1}>
                        {item.route.slice(1, -1).map(s => s.name).join(' → ')}
                    </Text>
                </View>
            )}

            <View style={styles.cardFooter}>
                <Text style={styles.savedAt}>{formatDate(item.savedAt)}</Text>
                <TouchableOpacity
                    style={[styles.startButton, startingId === item.id && styles.startButtonDisabled]}
                    onPress={() => handleStart(item)}
                    disabled={startingId !== null}
                >
                    {startingId === item.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Ionicons name="train-outline" size={15} color="#fff" />
                            <Text style={styles.startButtonText}>{t('myRoute.startButton')}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('myRoute.screenTitle') }} />

            {routes.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="bookmark-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyText}>{t('myRoute.empty')}</Text>
                </View>
            ) : (
                <FlatList
                    data={routes}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    listContent: { padding: 16, gap: 12 },

    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    cardStations: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    originText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#2E7D32',
        flex: 1,
        textAlign: 'right',
    },
    destText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#c62828',
        flex: 1,
    },
    deleteButton: { padding: 4, marginLeft: 8 },
    transfersRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 10,
        paddingLeft: 2,
    },
    transfersText: {
        fontSize: 12,
        color: '#888',
        flex: 1,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    savedAt: { fontSize: 12, color: '#aaa' },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#1565C0',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        minWidth: 100,
        justifyContent: 'center',
    },
    startButtonDisabled: { backgroundColor: '#90CAF9' },
    startButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 15,
        color: '#aaa',
    },
});
