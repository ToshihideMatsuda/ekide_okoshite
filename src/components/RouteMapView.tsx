import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, Circle, Region, LongPressEvent } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Station } from '../types';
import { isSubwayLine } from '../services/subwayDetection';

type Props = {
  route: Station[];
  /** ポリライン描画用の全駅。未指定時は route を使用 */
  polylineStations?: Station[];
  destinationId: string;
  showUserLocation?: boolean;
  focusedStationId?: string;
  /** ジオフェンス対象駅（乗り換え駅＋終点） */
  geofenceStations?: Station[];
  /** ジオフェンス半径（メートル） */
  detectionRadius?: number;
  /** コンテナスタイルの上書き */
  style?: StyleProp<ViewStyle>;
  /** 初期ビューに戻るボタンの bottom 位置（デフォルト: 10） */
  resetButtonBottom?: number;
  /** デバッグ用: 画面上で表現する現在地 */
  userLocation?: { latitude: number; longitude: number } | null;
  /** 地図ロングタップイベント */
  onMapLongPress?: (event: LongPressEvent) => void;
};

function computeRegion(route: Station[]): Region {
  if (route.length === 0) {
    return { latitude: 35.6812, longitude: 139.7671, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  }
  const lats = route.map((s) => s.latitude);
  const lons = route.map((s) => s.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const padding = 0.06;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: maxLat - minLat + padding,
    longitudeDelta: maxLon - minLon + padding,
  };
}

export default function RouteMapView({
  route,
  polylineStations,
  destinationId,
  showUserLocation = false,
  focusedStationId,
  geofenceStations,
  detectionRadius,
  style,
  resetButtonBottom = 10,
  userLocation,
  onMapLongPress,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const region = computeRegion(route);
  const polylineCoords = (polylineStations ?? route).map((s) => ({ latitude: s.latitude, longitude: s.longitude }));

  // route が切り替わったとき（スワイプ時）にマーカーのカスタムビューを再描画させる。
  // tracksViewChanges=false はネイティブ側のスナップショットをロックするため、
  // レイアウト完了前にロックされると駅名ラベルが空白になる。
  // route 変更ごとに一時的に true に戻し、描画完了後に false へ切り替える。
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, [route, destinationId]);

  useEffect(() => {
    if (focusedStationId == null) return;
    const station = route.find((s) => s.id === focusedStationId);
    if (!station) return;
    mapRef.current?.animateToRegion(
      { latitude: station.latitude, longitude: station.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      400
    );
  }, [focusedStationId]);

  const handleResetView = () => {
    mapRef.current?.animateToRegion(region, 400);
  };

  return (
    <View style={style ?? styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation={showUserLocation && !userLocation}
        showsMyLocationButton={false}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
        onLongPress={onMapLongPress}
      >
        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userDotOuter}>
              <View style={styles.userDotInner} />
            </View>
          </Marker>
        )}
        {polylineCoords.length >= 2 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor="#1565C0"
            strokeWidth={3}
          />
        )}
        {geofenceStations != null && detectionRadius != null &&
          geofenceStations.map((station) => {
            const isDest = station.id === destinationId;
            return (
              <Circle
                key={`geofence-${station.id}`}
                center={{ latitude: station.latitude, longitude: station.longitude }}
                radius={detectionRadius}
                fillColor={isDest ? 'rgba(229,57,53,0.12)' : 'rgba(255,193,7,0.15)'}
                strokeColor={isDest ? 'rgba(229,57,53,0.5)' : 'rgba(255,193,7,0.6)'}
                strokeWidth={1.5}
              />
            );
          })
        }
        {route.map((station, index) => {
          const isOrigin = index === 0;
          // 目的地は常にrouteの末尾（ルーティングフィルタが保証）のため
          // station.idとdestinationIdの不一致による表示漏れを防ぐためインデックスで判定する
          const isDest = index === route.length - 1;
          const isSubway = isSubwayLine(station.lineName);
          // chip style: 薄い背景色＋色付きテキスト（active.tsxのchipに合わせる）
          const bgColor = isDest ? '#FFCDD2' : isOrigin ? '#E8F5E9' : '#FFF9C4';
          const textColor = isDest ? '#c62828' : isOrigin ? '#2E7D32' : '#F57F17';
          const dotColor = isDest ? '#e53935' : isOrigin ? '#4CAF50' : '#FFC107';
          return (
            <Marker
              key={station.id}
              coordinate={{ latitude: station.latitude, longitude: station.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={tracksViewChanges}
            >
              <View style={markerStyles.container}>
                <View style={[markerStyles.label, markerStyles.labelRow, { backgroundColor: bgColor }]}>
                  <Text style={[markerStyles.labelText, { color: textColor }]} numberOfLines={1}>{station.name}</Text>
                  {isSubway && (
                    <Ionicons name="warning-outline" size={11} color={textColor} />
                  )}
                </View>
                <View style={[markerStyles.dot, { backgroundColor: dotColor }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>
      {/* 初期ビューに戻るボタン */}
      <TouchableOpacity
        style={[styles.resetButton, { bottom: resetButtonBottom }]}
        onPress={handleResetView}
        activeOpacity={0.8}
      >
        <Ionicons name="navigate" size={20} color="#1565C0" />
      </TouchableOpacity>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  container: { alignItems: 'center' },
  label: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 3,
    maxWidth: 120,
    // 薄い影で地図背景から浮かせる
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  labelText: { fontSize: 13, color: '#333' },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#fff' },
});

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  resetButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 24,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  userDotOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(33, 150, 243, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E88E5',
  },
  userDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E88E5',
  },
});
