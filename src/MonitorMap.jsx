import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';

function FitNearby({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(
        points.map(({ latitude, longitude }) => [latitude, longitude]),
        { padding: [28, 28], maxZoom: 12 },
      );
    }
  }, [map, points]);
  return null;
}

/**
 * Render an interactive OpenStreetMap view of the selected city and nearby OpenAQ monitors.
 */
export default function MonitorMap({ place, stations = [] }) {
  const center = [Number(place.latitude), Number(place.longitude)];
  if (!center.every(Number.isFinite)) {
    return <div className="station-empty">Choose a location with coordinates to view the map.</div>;
  }

  const monitors = stations.filter(
    (station) =>
      Number.isFinite(Number(station.coordinates?.latitude)) &&
      Number.isFinite(Number(station.coordinates?.longitude)),
  );
  const points = [
    { latitude: center[0], longitude: center[1] },
    ...monitors.map((station) => ({
      latitude: Number(station.coordinates.latitude),
      longitude: Number(station.coordinates.longitude),
    })),
  ];

  return (
    <div className="monitor-map-wrap">
      <MapContainer
        key={`${center[0]}-${center[1]}`}
        center={center}
        zoom={11}
        scrollWheelZoom={false}
        className="monitor-map"
        aria-label={`Map of ${place.city} and nearby monitoring stations`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitNearby points={points} />
        <CircleMarker
          center={center}
          radius={9}
          pathOptions={{ color: '#fff', weight: 3, fillColor: '#173f2b', fillOpacity: 1 }}
        >
          <Popup>{place.city} · selected location</Popup>
        </CircleMarker>
        {monitors.map((station) => (
          <CircleMarker
            key={station.id}
            center={[Number(station.coordinates.latitude), Number(station.coordinates.longitude)]}
            radius={8}
            pathOptions={{ color: '#fff', weight: 2, fillColor: '#5c9a62', fillOpacity: 0.95 }}
          >
            <Popup>
              <strong>{station.name || 'OpenAQ station'}</strong>
              <br />
              {station.provider}
              <br />
              {station.indiaAqi?.value == null
                ? 'India AQI unavailable'
                : `Calculated India AQI estimate: ${station.indiaAqi.value} · ${station.indiaAqi.category}`}
              <br />
              {station.distanceMeters == null
                ? ''
                : `${(station.distanceMeters / 1000).toFixed(1)} km from selected location`}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-legend">
        <span>
          <i className="map-user-dot" aria-hidden="true" /> Selected location
        </span>
        <span>
          <i className="map-station-dot" aria-hidden="true" /> OpenAQ monitoring location
        </span>
        <small>Tiles © OpenStreetMap contributors. Station markers appear only when supplied by OpenAQ.</small>
      </div>
    </div>
  );
}
