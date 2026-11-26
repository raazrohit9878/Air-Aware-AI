import React from 'react';
import {
  formatMetric, measurementIsStale, pollutantLabel, readableTime,
  stationCanGuide, stationHasFreshData,
} from '../airQualityUtils.js';

/**
 * Render an OpenAQ ground-monitor card with CPCB India AQI coverage details and attribution.
 */
export default function StationCard({ station }) {
  return (
    <article className="station-card">
      <div className="station-card-head">
        <div>
          <span className="station-provider">{station.provider}</span>
          <h3>{station.name || 'Monitoring location'}</h3>
        </div>
        <span className="station-distance">
          {station.distanceMeters == null ? 'Distance unavailable' : `${(station.distanceMeters / 1000).toFixed(1)} km`}
        </span>
      </div>

      {station.measurements.length > 0 && !stationHasFreshData(station) && (
        <p className="stale-warning">
          Latest available readings are older than 6 hours. They are shown for context and excluded from today’s plan.
        </p>
      )}

      {station.indiaAqi?.value == null ? (
        <>
          <p className="station-aqi-unavailable">
            India AQI unavailable:{' '}
            {station.indiaAqi?.reason || 'not enough valid hourly measurements for the CPCB method.'}
          </p>
          <div className="coverage-details">
            <strong>Valid hourly coverage · past 24 hours</strong>
            <small>
              CPCB needs 16 hours for each pollutant sub-index and at least three sub-indices, including PM2.5 or PM10.
              CO and ozone also need at least six hours in the latest eight-hour window.
            </small>
            {Object.keys(station.indiaAqi?.coverage || {}).length ? (
              <div>
                {Object.entries(station.indiaAqi.coverage).map(([pollutant, count]) => {
                  const value = typeof count === 'number' ? { hours24: count } : count;
                  return (
                    <span key={pollutant}>
                      {pollutantLabel(pollutant)}: {value.hours24}/16
                      {value.hours8 == null ? '' : ` · latest 8h ${value.hours8}/6`}
                    </span>
                  );
                })}
              </div>
            ) : (
              <small>No supported pollutant sensors returned hourly data.</small>
            )}
          </div>
        </>
      ) : (
        <div className="station-india-aqi">
          <strong>{station.indiaAqi.value}</strong>
          <span>
            <b>India AQI estimate · {station.indiaAqi.category}</b>
            <small>
              Calculated from OpenAQ hourly data using CPCB breakpoints; not an official CPCB AQI result. Dominant
              pollutant: {station.indiaAqi.pollutant}.
            </small>
          </span>
        </div>
      )}

      {station.indiaAqi?.value != null && !stationCanGuide(station) && (
        <p className="stale-warning">
          This 24-hour AQI estimate is shown for context. Its supporting readings are incomplete or stale, so it is not
          used to raise today’s precaution level.
        </p>
      )}

      <div className="station-measurements">
        {station.measurements.length ? (
          station.measurements.map((measurement, index) => (
            <div key={`${measurement.sensorId}-${index}`}>
              <span>{measurement.parameter}</span>
              <strong>
                {formatMetric(measurement.value, 2)} {measurement.unit}
              </strong>
              <small>
                {measurement.datetime ? readableTime(measurement.datetime) : 'Time unavailable'}
                {measurementIsStale(measurement) ? ' · stale' : ''}
              </small>
            </div>
          ))
        ) : (
          <p>No latest supported pollutant readings reported by this location.</p>
        )}
      </div>

      <small className="station-attribution">
        OpenAQ observation · data provider: {station.provider}
        {station.owner ? ` · station owner: ${station.owner}` : ''}. Values and timestamps are reported upstream;
        coverage and reporting delays vary. Gas readings reported in ppm are converted approximately at 25°C before
        applying mass-concentration AQI breakpoints.
      </small>
    </article>
  );
}
