import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

export type LeafletMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  color?: string;
};

export type LeafletRoutePoint = {
  latitude: number;
  longitude: number;
};

type Props = {
  center: LeafletRoutePoint;
  markers?: LeafletMarker[];
  route?: LeafletRoutePoint[];
  zoom?: number;
};

function buildLeafletHtml(props: Required<Props>) {
  const markerData = JSON.stringify(props.markers);
  const routeData = JSON.stringify(props.route);
  const centerData = JSON.stringify(props.center);

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #08111f; }
      .pin {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        border: 3px solid #ffffff;
        box-shadow: 0 5px 14px rgba(0,0,0,0.35);
      }
      .leaflet-control-attribution { font-size: 10px; }
      .leaflet-popup-content { margin: 8px 10px; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .popup-title { font-weight: 800; color: #0f172a; margin-bottom: 2px; }
      .popup-description { color: #475569; font-size: 12px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const center = ${centerData};
      const markers = ${markerData};
      const route = ${routeData};
      const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      const map = L.map('map', { zoomControl: false }).setView([center.latitude, center.longitude], ${props.zoom});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      markers.forEach((marker) => {
        const icon = L.divIcon({
          html: '<div class="pin" style="background:' + (marker.color || '#fb923c') + '"></div>',
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        const popup =
          '<div class="popup-title">' + escapeHtml(marker.title) + '</div>' +
          (marker.description ? '<div class="popup-description">' + escapeHtml(marker.description) + '</div>' : '');
        L.marker([marker.latitude, marker.longitude], { icon }).addTo(map).bindPopup(popup);
      });

      if (route.length > 1) {
        const line = L.polyline(route.map((point) => [point.latitude, point.longitude]), {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.9
        }).addTo(map);
        map.fitBounds(line.getBounds(), { padding: [32, 32] });
      } else if (markers.length > 1) {
        const group = L.featureGroup(markers.map((marker) => L.marker([marker.latitude, marker.longitude])));
        map.fitBounds(group.getBounds(), { padding: [32, 32] });
      }
    </script>
  </body>
</html>`;
}

export function LeafletMap({ center, markers = [], route = [], zoom = 13 }: Props) {
  const html = useMemo(
    () => buildLeafletHtml({ center, markers, route, zoom }),
    [center.latitude, center.longitude, markers, route, zoom],
  );

  if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Location unavailable</Text>
        <Text style={styles.fallbackText}>Map data will appear once coordinates are available.</Text>
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={["*"]}
      source={{ html }}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      style={styles.webview}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: "#08111f",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 18,
    backgroundColor: "#08111f",
  },
  fallbackTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  fallbackText: {
    color: "#a7b6c8",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
