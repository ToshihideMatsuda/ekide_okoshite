import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '../../src/store/sessionStore';
import { useGraphStore } from '../../src/store/graphStore';
import { useTranslation } from '../../src/i18n';
import { Station } from '../../src/types';
import { dijkstra, RouteResult } from '../../src/services/routing';
import { getProvider } from '../../src/providers';
import StationSearchInput from '../../src/components/StationSearchInput';

/** 指定の route が出発→各乗り継ぎ→目的地の順で到達可能か検証し、
 *  到達できなくなる最初のインデックスを返す。全OKなら -1 */
function findFirstUnreachableSegment(
    route: Station[],
    graph: ReturnType<typeof useGraphStore.getState>['graph']
): number {
    if (!graph) return -1;
    for (let i = 1; i < route.length; i++) {
        const from = route[i - 1];
        const to = route[i];
        const fromGroupId = from.groupId;
        const toGroupId = to.groupId;
        if (!fromGroupId || !toGroupId) return i;
        const result = dijkstra(graph, fromGroupId, toGroupId);
        if (!result) return i;
    }
    return -1;
}

export default function RouteEditScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { activeSession, updateActiveSessionRoute } = useSessionStore();
    const { graph } = useGraphStore();

    // 編集中の経路ステート
    // route[0] = 出発（固定）、route[last] = 目的地（固定）、中間 = 乗り継ぎ
    const [editRoute, setEditRoute] = useState<Station[]>(
        activeSession?.route ?? []
    );
    const [isApplying, setIsApplying] = useState(false);
    const [showAddSearch, setShowAddSearch] = useState(false);
    const [searchInsertIndex, setSearchInsertIndex] = useState<number | null>(null);

    const originStation = editRoute[0];
    const destStation = editRoute[editRoute.length - 1];
    const transfers = editRoute.slice(1, -1);

    // 乗り継ぎ駅を追加するインデックスを決定
    const handleAddTransfer = (beforeIndex: number) => {
        setSearchInsertIndex(beforeIndex);
        setShowAddSearch(true);
    };

    const handleSelectTransfer = useCallback(
        async (newStation: Station) => {
            if (searchInsertIndex === null) return;
            setShowAddSearch(false);

            // insertIndex はルート配列での挿入位置（0=originの後の最初の乗り継ぎ位置）
            const insertAt = searchInsertIndex;
            const candidate = [...editRoute.slice(0, insertAt), newStation, ...editRoute.slice(insertAt)];

            // 到達可能性チェック
            if (!graph) {
                Alert.alert(t('common.error'), 'グラフが読み込まれていません');
                return;
            }

            // 挿入駅の前後セグメントを検証
            const prevStation = candidate[insertAt - 1];
            const nextStation = candidate[insertAt + 1];

            // prev → newStation
            const fromGid = prevStation?.groupId;
            const newGid = newStation.groupId;
            if (fromGid && newGid) {
                const reachPrev = dijkstra(graph, fromGid, newGid);
                if (!reachPrev) {
                    Alert.alert(t('common.error'), t('routeEdit.unreachable'));
                    return;
                }
            }

            // newStation → next: 到達できない場合は残りを切り詰めてよいか確認
            if (nextStation && newGid && nextStation.groupId) {
                const reachNext = dijkstra(graph, newGid, nextStation.groupId);
                if (!reachNext) {
                    // 後続に到達できない → 警告後に以降を削除
                    Alert.alert(
                        t('common.error'),
                        t('routeEdit.truncateWarning'),
                        [
                            { text: t('common.cancel'), style: 'cancel' },
                            {
                                text: 'OK',
                                onPress: () => {
                                    // insertAt 以降を削除し、新駅と目的地だけ残す
                                    const truncated = [...candidate.slice(0, insertAt), newStation, destStation];
                                    setEditRoute(truncated);
                                },
                            },
                        ]
                    );
                    return;
                }
            }

            setEditRoute(candidate);
        },
        [editRoute, searchInsertIndex, graph, t, destStation]
    );

    const handleDeleteTransfer = (transferIndexInTransfers: number) => {
        // transfers は editRoute[1..-2] なので、editRoute のインデックスは +1
        const routeIdx = transferIndexInTransfers + 1;
        const next = editRoute.filter((_, i) => i !== routeIdx);
        setEditRoute(next);
    };

    const handleConfirm = async () => {
        if (!activeSession || !graph) return;

        // 最終チェック: 全セグメント到達可能か
        const badIdx = findFirstUnreachableSegment(editRoute, graph);
        if (badIdx !== -1) {
            Alert.alert(t('common.error'), t('routeEdit.unreachable'));
            return;
        }

        setIsApplying(true);
        try {
            // allStations を再構築: 各セグメントのダイクストラパスを実際の駅に展開
            const provider = getProvider();
            const newAllStations: Station[] = [];

            for (let i = 0; i < editRoute.length; i++) {
                const cur = editRoute[i];
                if (i === 0) {
                    newAllStations.push(cur);
                    continue;
                }
                const prev = editRoute[i - 1];
                if (prev.groupId && cur.groupId) {
                    const result = dijkstra(graph, prev.groupId, cur.groupId);
                    if (result) {
                        // 中間ノード（prev を除く cur まで）を追加
                        for (let j = 1; j < result.path.length; j++) {
                            const step = result.path[j];
                            const st = await provider.getStationByGroupId(step.groupId);
                            if (st) {
                                const lineName = step.lineId ? (await provider.getLineName(step.lineId)) : st.lineName;
                                newAllStations.push({ ...st, lineId: step.lineId || st.lineId, lineName });
                            }
                        }
                    } else {
                        newAllStations.push(cur);
                    }
                } else {
                    newAllStations.push(cur);
                }
            }

            await updateActiveSessionRoute(editRoute, newAllStations);
            Alert.alert('', t('routeEdit.applied'), [{ text: 'OK', onPress: () => router.back() }]);
        } catch (err) {
            console.error('[RouteEdit] 確定エラー:', err);
            Alert.alert(t('common.error'), t('common.failed'));
        } finally {
            setIsApplying(false);
        }
    };

    if (!activeSession) return null;

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: t('routeEdit.screenTitle'),
                    headerBackVisible: true,
                }}
            />

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* 出発駅（固定） */}
                <View style={styles.stationRow}>
                    <View style={[styles.stationBadge, styles.originBadge]}>
                        <Text style={styles.stationBadgeText}>出発</Text>
                    </View>
                    <View style={styles.stationInfo}>
                        <Text style={styles.stationName}>{originStation?.name}</Text>
                        <Text style={styles.stationLine}>{originStation?.lineName}</Text>
                    </View>
                    <Text style={styles.fixedLabel}>{t('routeEdit.origin')}</Text>
                </View>

                {/* 乗り継ぎ駅 */}
                {transfers.map((transfer, idx) => (
                    <React.Fragment key={`${transfer.id}-${idx}`}>
                        {/* 乗り継ぎ追加ボタン（各駅の前） */}
                        <View style={styles.addRow}>
                            <View style={styles.connector} />
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={() => handleAddTransfer(idx + 1)} // editRoute のインデックス
                            >
                                <Ionicons name="add-circle-outline" size={18} color="#1565C0" />
                                <Text style={styles.addButtonText}>{t('routeEdit.addTransfer')}</Text>
                            </TouchableOpacity>
                            <View style={styles.connector} />
                        </View>

                        <View style={styles.stationRow}>
                            <View style={[styles.stationBadge, styles.transferBadge]}>
                                <Text style={styles.stationBadgeText}>乗換</Text>
                            </View>
                            <View style={styles.stationInfo}>
                                <Text style={styles.stationName}>{transfer.name}</Text>
                                <Text style={styles.stationLine}>{transfer.lineName}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => handleDeleteTransfer(idx)}
                            >
                                <Ionicons name="trash-outline" size={18} color="#e53935" />
                            </TouchableOpacity>
                        </View>
                    </React.Fragment>
                ))}

                {/* 最後の乗り継ぎ追加ボタン（目的地の前） */}
                <View style={styles.addRow}>
                    <View style={styles.connector} />
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => handleAddTransfer(editRoute.length - 1)} // 目的地の直前
                    >
                        <Ionicons name="add-circle-outline" size={18} color="#1565C0" />
                        <Text style={styles.addButtonText}>{t('routeEdit.addTransfer')}</Text>
                    </TouchableOpacity>
                    <View style={styles.connector} />
                </View>

                {/* 目的地（固定） */}
                <View style={styles.stationRow}>
                    <View style={[styles.stationBadge, styles.destBadge]}>
                        <Text style={styles.stationBadgeText}>目的</Text>
                    </View>
                    <View style={styles.stationInfo}>
                        <Text style={styles.stationName}>{destStation?.name}</Text>
                        <Text style={styles.stationLine}>{destStation?.lineName}</Text>
                    </View>
                    <Text style={styles.fixedLabel}>{t('routeEdit.destination')}</Text>
                </View>

                {/* 乗り継ぎ駅検索（インラインモーダル） */}
                {showAddSearch && (
                    <View style={styles.searchCard}>
                        <View style={styles.searchHeader}>
                            <Text style={styles.searchTitle}>{t('routeEdit.addTransfer')}</Text>
                            <TouchableOpacity onPress={() => setShowAddSearch(false)}>
                                <Ionicons name="close" size={20} color="#888" />
                            </TouchableOpacity>
                        </View>
                        <StationSearchInput
                            label=""
                            value={null}
                            onSelect={handleSelectTransfer}
                            placeholder="駅名を入力"
                        />
                    </View>
                )}

                {/* 確定ボタン */}
                <TouchableOpacity
                    style={[styles.confirmButton, isApplying && styles.confirmButtonDisabled]}
                    onPress={handleConfirm}
                    disabled={isApplying}
                >
                    {isApplying ? (
                        <>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text style={styles.confirmButtonText}>{t('routeEdit.applying')}</Text>
                        </>
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                            <Text style={styles.confirmButtonText}>{t('routeEdit.confirm')}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    content: { padding: 16, paddingBottom: 40 },

    stationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        gap: 12,
    },
    stationBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    originBadge: { backgroundColor: '#2E7D32' },
    transferBadge: { backgroundColor: '#F57F17' },
    destBadge: { backgroundColor: '#c62828' },
    stationBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    stationInfo: { flex: 1 },
    stationName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
    stationLine: { fontSize: 12, color: '#888', marginTop: 2 },
    fixedLabel: {
        fontSize: 11,
        color: '#aaa',
        fontStyle: 'italic',
    },
    deleteButton: {
        padding: 6,
    },

    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
        gap: 8,
    },
    connector: {
        width: 1,
        height: 16,
        backgroundColor: '#ddd',
        marginLeft: 31, // バッジの中央に揃える
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#E3F2FD',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#90CAF9',
        flex: 1,
        justifyContent: 'center',
    },
    addButtonText: {
        fontSize: 13,
        color: '#1565C0',
        fontWeight: '600',
    },

    searchCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        marginTop: 16,
        borderWidth: 1.5,
        borderColor: '#1565C0',
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    searchTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1565C0',
    },

    confirmButton: {
        flexDirection: 'row',
        backgroundColor: '#1565C0',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 24,
    },
    confirmButtonDisabled: { backgroundColor: '#90CAF9' },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
