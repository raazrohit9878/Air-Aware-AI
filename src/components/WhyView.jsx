import React from 'react';
import { ArrowUpRight, Cloud, CloudSun, Navigation, Shield, Sparkles } from 'lucide-react';
import { formatMetric, readableTime } from '../airQualityUtils.js';

/**
 * Transparency view explaining data sources, methodology, limitations, and urgent symptom guidance.
 */
export default function WhyView({ place, current, weather, band, ground, winter }) {
  return (
    <div className="page-wrap narrow">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" /> TRANSPARENCY &amp; SOURCES
          </div>
          <h1>
            Know what’s behind <em>the advice.</em>
          </h1>
          <p>See the data, assumptions, and limitations used to shape your daily plan.</p>
        </div>
      </section>

      <div className="why-stack">
        <section className="source-card">
          <div className="source-icon" aria-hidden="true">
            <Cloud size={19} />
          </div>
          <div className="source-detail">
            <span className="eyebrow">AIR-QUALITY ESTIMATES</span>
            <h2>Open-Meteo Air Quality API</h2>
            <p>
              Atmospheric model estimates for {place.city}. These are not readings from a nearby ground-monitoring
              station.
            </p>
            <div className="source-facts">
              <div>
                <span>MODEL AQI</span>
                <strong>{current?.us_aqi == null ? 'Unavailable' : `${Math.round(current.us_aqi)} · ${band[0]}`}</strong>
              </div>
              <div>
                <span>MODEL TIME</span>
                <strong>{current?.time ? readableTime(current.time) : 'Unavailable'}</strong>
              </div>
              <div>
                <span>LOCATION</span>
                <strong>
                  {place.latitude.toFixed(3)}°, {place.longitude.toFixed(3)}°
                </strong>
              </div>
            </div>
            <div className="source-link">
              Source:{' '}
              <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noopener noreferrer">
                Open-Meteo Air Quality documentation <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section className="source-card">
          <div className="source-icon weather" aria-hidden="true">
            <CloudSun size={19} />
          </div>
          <div className="source-detail">
            <span className="eyebrow">WEATHER CONDITIONS</span>
            <h2>Open-Meteo Forecast API</h2>
            <p>Weather context is useful for planning, but it does not identify pollution exposure by itself.</p>
            <div className="source-facts">
              <div>
                <span>TEMPERATURE</span>
                <strong>{weather?.temperature_2m == null ? 'Unavailable' : `${formatMetric(weather.temperature_2m)}°C`}</strong>
              </div>
              <div>
                <span>HUMIDITY</span>
                <strong>{weather?.relative_humidity_2m == null ? 'Unavailable' : `${weather.relative_humidity_2m}%`}</strong>
              </div>
              <div>
                <span>WIND</span>
                <strong>{weather?.wind_speed_10m == null ? 'Unavailable' : `${formatMetric(weather.wind_speed_10m)} km/h`}</strong>
              </div>
            </div>
            <div className="source-link">
              Source:{' '}
              <a href="https://open-meteo.com/en/docs" target="_blank" rel="noopener noreferrer">
                Open-Meteo Forecast documentation <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section className="source-card">
          <div className="source-icon" aria-hidden="true">
            <Navigation size={19} />
          </div>
          <div className="source-detail">
            <span className="eyebrow">NEARBY GROUND OBSERVATIONS</span>
            <h2>OpenAQ station feed</h2>
            <p>
              {ground?.available
                ? `${ground.stations?.length || 0} nearby location(s) returned; data checked ${
                    ground.checkedAt ? readableTime(ground.checkedAt) : 'at an unavailable time'
                  }.`
                : ground?.reason || 'Station data is currently unavailable.'}{' '}
              Raw readings retain their upstream units and timestamps. A station may be far away, delayed, or have
              incomplete pollutant coverage.
            </p>
            <div className="source-link">
              Source:{' '}
              <a href="https://docs.openaq.org/api" target="_blank" rel="noopener noreferrer">
                OpenAQ API v3 documentation <ArrowUpRight size={13} aria-hidden="true" />
              </a>
              {place.countryCode === 'IN' && (
                <>
                  {' '}·{' '}
                  <a href="https://airquality.cpcb.gov.in/AQI_India/" target="_blank" rel="noopener noreferrer">
                    CPCB portal <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="method-card">
          <div className="method-head">
            <div className="source-icon method" aria-hidden="true">
              <Sparkles size={18} />
            </div>
            <div>
              <span className="eyebrow">HOW YOUR PLAN IS MADE</span>
              <h2>Rules first, tailored explanation second.</h2>
            </div>
          </div>
          <div className="method-steps">
            <div>
              <span>01</span>
              <p>Read available Open-Meteo model estimates and nearby OpenAQ station observations independently.</p>
            </div>
            <div>
              <span>02</span>
              <p>
                Apply conservative exposure-reduction guidance using the model AQI category and, when complete, the more
                cautious applicable station category, together with household preferences. Winter routines are seasonal
                guidance; the app does not detect smog inversions.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>Explain personal exposure actions separately from household transport emission estimates.</p>
            </div>
          </div>
          <div className="limitations">
            <Shield size={17} aria-hidden="true" />
            <div>
              <strong>Limitations to keep in mind</strong>
              <p>
                Open-Meteo values are model estimates using US AQI, not India’s National AQI or a station reading. Nearby
                OpenAQ values are reported observations; where there is sufficient hourly pollutant coverage, an India AQI
                estimate is calculated using CPCB breakpoints and is not a CPCB-published value. If coverage is
                insufficient, no station AQI is shown.{' '}
                {winter
                  ? 'Seasonal winter advice does not detect temperature inversions or measure indoor air.'
                  : 'This app does not measure indoor air.'}{' '}
                Chat uses NVIDIA NIM when configured and reviewed AirAware guidance otherwise; AI replies may be
                inaccurate. It does not diagnose, promise protection, or replace a clinician’s advice.
              </p>
            </div>
          </div>
        </section>

        <section className="reference-card">
          <span className="eyebrow">GENERAL HEALTH GUIDANCE</span>
          <h2>For urgent symptoms, seek medical help.</h2>
          <p>
            If someone has significant breathing difficulty, chest pain, or rapidly worsening symptoms, contact local
            emergency services or a healthcare professional. Follow existing care plans from your clinician.
          </p>
          <div className="source-link">
            Background:{' '}
            <a href="https://www.who.int/health-topics/air-pollution" target="_blank" rel="noopener noreferrer">
              World Health Organization · Air pollution <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
