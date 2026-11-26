import React, { Suspense, lazy } from 'react';
import {
  ArrowRight, Cloud, CloudSun, ExternalLink, MapPin, Shield, Sparkles, Wind,
} from 'lucide-react';
import { formatMetric, readableTime, stationCanGuide } from '../airQualityUtils.js';
import StationCard from './StationCard.jsx';

const MonitorMap = lazy(() => import('../MonitorMap.jsx'));

const POLLUTANT_CARDS = [
  ['PM2.5', 'pm2_5', 'µg/m³'],
  ['PM10', 'pm10', 'µg/m³'],
  ['NO₂', 'nitrogen_dioxide', 'µg/m³'],
  ['O₃', 'ozone', 'µg/m³'],
];

/**
 * Daily air-quality briefing view combining model estimates, ground stations, map, forecast, and weather.
 */
export default function TodayView({
  place,
  query,
  setQuery,
  onSearch,
  air,
  current,
  weather,
  band,
  error,
  reload,
  setPage,
  advice,
  ground,
  groundLoading,
  groundError,
  winter,
}) {
  const rawAqi = current?.us_aqi;
  const aqi = rawAqi === null || rawAqi === undefined || rawAqi === '' ? NaN : Number(rawAqi);
  const stationRisk = (ground?.stations || []).some(
    (station) => stationCanGuide(station) && Number(station.indiaAqi?.value) >= 101,
  );
  const isRisk = stationRisk || (band[1] !== 'good' && band[1] !== 'moderate' && band[1] !== 'unknown');
  const stamp = current?.time;
  const stale =
    stamp && Number.isFinite(new Date(stamp).getTime()) && Date.now() - new Date(stamp).getTime() > 3 * 60 * 60 * 1000;
  const dayHours = air?.hourly?.time?.slice(0, 12) || [];
  const values = air?.hourly?.us_aqi?.slice(0, 12) || [];
  const forecastSummary = dayHours.length
    ? dayHours
        .slice(0, 4)
        .map((time, index) => `${new Date(time).toLocaleTimeString([], { hour: 'numeric' })}: ${values[index] ?? 'unavailable'}`)
        .join(', ')
    : 'Forecast unavailable';

  return (
    <div className="page-wrap">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" /> DAILY AIR BRIEFING
          </div>
          <h1>
            A clearer view of <em>today.</em>
          </h1>
          <p>Local air conditions and practical steps for the people you care about.</p>
        </div>
        <div className="heading-date">
          <span>YOUR LOCATION</span>
          <strong>
            <MapPin size={15} aria-hidden="true" />
            {place.city}
          </strong>
          <form onSubmit={onSearch} className="location-search">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Change city…"
              aria-label="Search for a city"
              maxLength={100}
            />
            <button type="submit" aria-label="Search location">
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </form>
        </div>
      </section>

      {error && (
        <div className="alert" role="alert">
          <Cloud size={17} aria-hidden="true" />
          <span>
            {error}{' '}
            <button type="button" onClick={reload}>
              Retry
            </button>
          </span>
        </div>
      )}
      {stale && (
        <div className="alert stale-warning" role="status">
          <Cloud size={16} aria-hidden="true" />
          <span>The model timestamp is over three hours old. Refresh or check local official monitoring before relying on it.</span>
          <button type="button" onClick={reload}>
            Refresh
          </button>
        </div>
      )}

      <section className="hero-grid">
        <div className={`aqi-card ${band[1]}`}>
          <div className="aqi-top">
            <span className="card-overline">
              AIR QUALITY NOW <span className="model-tag">MODEL ESTIMATE</span>
            </span>
            <span className="card-time">{stamp ? readableTime(stamp) : '—'}</span>
          </div>
          <div className="aqi-main">
            <div className="aqi-number">{Number.isFinite(aqi) ? Math.round(aqi) : '—'}</div>
            <div className="aqi-label-wrap">
              <span className="aqi-category">{band[0]}</span>
              <span className="aqi-standard">US AQI · Open-Meteo model</span>
            </div>
          </div>
          <div className="aqi-meter" aria-hidden="true">
            <span style={{ width: `${Number.isFinite(aqi) ? Math.min(100, aqi / 3) : 2}%` }} />
          </div>
          <div className="aqi-bottom" aria-hidden="true">
            <span>Lower pollution</span>
            <span>Higher pollution</span>
          </div>
          <p className="aqi-explain">
            {Number.isFinite(aqi)
              ? `A modelled AQI of ${Math.round(aqi)}. This is a forecast estimate, not a ground-station reading.`
              : 'No current air-quality estimate available.'}
          </p>
        </div>

        <div className="day-guidance">
          <div className="guidance-icon" aria-hidden="true">
            <Shield size={20} />
          </div>
          <span className="card-overline">{winter ? 'WINTER AIR PRECAUTION' : 'A NOTE FOR YOUR HOUSEHOLD'}</span>
          <h2>
            {isRisk
              ? 'Take it a little easier outside.'
              : band[1] === 'unknown'
                ? 'Conditions are not available yet.'
                : 'A good day for a little fresh air.'}
          </h2>
          <p>
            {isRisk
              ? `Consider lighter outdoor activity, especially for children and anyone with respiratory sensitivity. Choose a lower-traffic route when possible.${stationRisk ? ' A nearby OpenAQ station’s calculated India AQI also indicates elevated pollution; see its reading below.' : ''}`
              : band[1] === 'unknown'
                ? 'Try refreshing in a moment, or check local official monitoring sources for conditions near you.'
                : 'Enjoy outdoor activities as comfortable. Check again later, since conditions can change through the day.'}
            {winter
              ? ' In winter, also avoid indoor smoke and unvented fuel heaters; use the hourly outlook when deciding whether to ventilate. This seasonal tip does not detect smog inversions.'
              : ''}
          </p>
          <button type="button" className="text-link" onClick={() => setPage('plan')}>
            See your tailored plan <ArrowRight size={15} aria-hidden="true" />
          </button>
          <div className="guidance-decoration" aria-hidden="true">
            <Wind size={72} />
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <div className="eyebrow">AT A GLANCE</div>
            <h2>What’s in the air</h2>
          </div>
          <span className="source-note">Forecast model · {place.city}</span>
        </div>
        <div className="metric-grid">
          {POLLUTANT_CARDS.map(([label, key, unit]) => (
            <div className="metric-card" key={key}>
              <span>{label}</span>
              <strong>{formatMetric(current?.[key], 1)}</strong>
              <small>{unit}</small>
              <div className={`metric-status ${current?.[key] == null ? 'muted' : ''}`}>
                {current?.[key] == null ? 'Unavailable' : 'Model estimate'}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="station-section section-block">
        <div className="section-head">
          <div>
            <div className="eyebrow">GROUND MONITORS</div>
            <h2>Nearby station observations</h2>
          </div>
          <span className="source-note">OpenAQ · checked {ground?.checkedAt ? readableTime(ground.checkedAt) : '—'}</span>
        </div>

        {groundLoading ? (
          <div className="station-empty" role="status">
            Checking for nearby monitoring stations…
          </div>
        ) : groundError ? (
          <div className="station-empty">
            Ground monitor data is unavailable right now. The model estimate above is separate and still labelled as a
            forecast.{groundError.includes('sign in') ? ' Sign in to access this data.' : ''}
          </div>
        ) : !ground?.available ? (
          <div className="station-empty">
            {ground?.reason || 'No ground-monitor data is available. No station values are being estimated here.'}
          </div>
        ) : ground.stations?.length ? (
          <div className="station-grid">
            {ground.stations.map((station) => (
              <StationCard key={station.id} station={station} />
            ))}
          </div>
        ) : (
          <div className="station-empty">
            OpenAQ returned no nearby monitoring locations. The model estimate is not a substitute for a station reading.
          </div>
        )}

        <div className="station-source-link">
          Sources:{' '}
          <a href="https://docs.openaq.org/resources/locations" target="_blank" rel="noopener noreferrer">
            OpenAQ stations and measurements <ExternalLink size={12} aria-hidden="true" />
          </a>
          {place.countryCode === 'IN' && (
            <>
              {' '}·{' '}
              <a href="https://airquality.cpcb.gov.in/AQI_India/" target="_blank" rel="noopener noreferrer">
                CPCB National AQI portal <ExternalLink size={12} aria-hidden="true" />
              </a>
            </>
          )}
        </div>
      </section>

      <section className="station-section section-block">
        <div className="section-head">
          <div>
            <div className="eyebrow">LOCATION MAP</div>
            <h2>Air monitors near {place.city}</h2>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="station-empty" role="status">
              Loading the station map…
            </div>
          }
        >
          <MonitorMap place={place} stations={ground?.stations || []} />
        </Suspense>
      </section>

      <section className="lower-grid">
        <div className="forecast-card">
          <div className="section-head compact">
            <div>
              <div className="eyebrow">NEXT HOURS</div>
              <h2>Air quality outlook</h2>
            </div>
            <span className="tiny-label">MODEL FORECAST · US AQI</span>
          </div>
          <div
            className="forecast-chart"
            role="img"
            aria-label={`Hourly US AQI model forecast for ${place.city}. ${forecastSummary}`}
          >
            {dayHours.map((time, index) => {
              const val = values[index];
              const height = val == null ? 4 : Math.max(7, Math.min(100, val / 3));
              return (
                <div className="chart-col" key={time}>
                  <div
                    className={`chart-bar ${Number(val) > 100 ? 'warn' : ''}`}
                    style={{ height: `${height}%` }}
                    title={`${readableTime(time)} · AQI ${val ?? 'unavailable'}`}
                  />
                  <span>{new Date(time).toLocaleTimeString([], { hour: 'numeric' })}</span>
                </div>
              );
            })}
          </div>
          <div className="chart-legend">
            <span>
              <i aria-hidden="true" />
              Modelled AQI by hour
            </span>
            <span>Forecasts can differ from local monitors</span>
          </div>
        </div>

        <div className="weather-card">
          <div className="eyebrow">LOCAL WEATHER</div>
          <h2>Conditions outside</h2>
          <div className="weather-primary">
            <CloudSun size={31} aria-hidden="true" />
            <strong>{weather?.temperature_2m == null ? '—' : `${formatMetric(weather.temperature_2m)}°`}</strong>
            <span>Temperature</span>
          </div>
          <div className="weather-stats">
            <div>
              <span>Humidity</span>
              <strong>{weather?.relative_humidity_2m == null ? '—' : `${weather.relative_humidity_2m}%`}</strong>
            </div>
            <div>
              <span>Wind</span>
              <strong>{weather?.wind_speed_10m == null ? '—' : `${formatMetric(weather.wind_speed_10m)} km/h`}</strong>
            </div>
          </div>
          <p>Weather values are current model data and may vary locally.</p>
        </div>
      </section>

      <section className="tip-strip">
        <div className="tip-spark" aria-hidden="true">
          <Sparkles size={18} />
        </div>
        <div>
          <strong>Your first small step</strong>
          <p>{advice[0]?.action || 'Check conditions again before planning strenuous outdoor activity.'}</p>
        </div>
        <button type="button" onClick={() => setPage('plan')}>
          View my plan <ArrowRight size={15} aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
