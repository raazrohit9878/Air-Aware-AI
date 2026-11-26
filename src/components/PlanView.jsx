import React from 'react';
import { ArrowDownRight, Check, Leaf, Shield, Sparkles, Sun } from 'lucide-react';

/**
 * Daily 3-step action plan paired with the illustrative solo-car vs. transit CO2e calculator.
 */
export default function PlanView({
  advice,
  band,
  profile,
  place,
  current,
  distance,
  setDistance,
  weeklyKg,
  monthlyKg,
  savedKg,
  saveActivity,
  savedKm,
  activityStatus,
  winter,
}) {
  return (
    <div className="page-wrap">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" /> YOUR DAILY ACTION PLAN
          </div>
          <h1>
            A few ways to <em>breathe easier.</em>
          </h1>
          <p>
            Personalized for {profile.household.toLowerCase()} life in {place.city}. Keep what works; skip what doesn’t.
          </p>
        </div>
        <div className={`plan-weather ${band[1]}`}>
          <span>LOCAL AIR · MODELLED US AQI</span>
          <strong>
            {current?.us_aqi == null ? '—' : Math.round(current.us_aqi)} <small>{band[0]}</small>
          </strong>
        </div>
      </section>

      {winter && (
        <div className="winter-note">
          <div>
            <span className="eyebrow">WINTER AIR ROUTINE</span>
            <strong>Plan around both pollution and cold.</strong>
            <p>
              Use the local hourly outlook to choose outdoor activity and ventilation times. Avoid indoor smoke and
              unvented fuel heaters. This app does not measure temperature inversions or indoor air.
            </p>
          </div>
        </div>
      )}

      <div className="plan-layout">
        <div className="plan-list">
          <div className="timeline-label">
            <Sun size={16} aria-hidden="true" /> TODAY’S PRIORITIES <span>3 practical actions</span>
          </div>
          {advice.map((item, index) => (
            <article className="action-card" key={item.title}>
              <div className="action-index">0{index + 1}</div>
              <div className="action-body">
                <div className="action-meta">
                  <span className="time-tag">{item.time}</span>
                  <span className="action-type">{item.type}</span>
                </div>
                <h2>{item.title}</h2>
                <p>{item.action}</p>
                <div className="why-box">
                  <Sparkles size={15} aria-hidden="true" />
                  <span>
                    <strong>Why it fits:</strong> {item.why}
                  </span>
                </div>
                <div className="benefit-row">
                  <div>
                    <span>PERSONAL EXPOSURE</span>
                    <p>{item.exposure}</p>
                  </div>
                  <div>
                    <span>ENVIRONMENT</span>
                    <p>{item.environment}</p>
                  </div>
                </div>
                <div className="affordable">
                  <Leaf size={15} aria-hidden="true" />
                  <span>
                    <strong>Low-cost option:</strong> {item.affordable}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="impact-panel" aria-label="Commute emissions comparison">
          <div className="eyebrow">YOUR COMMUTE, REIMAGINED</div>
          <h2>What if one trip changed?</h2>
          <p>Compare a solo car commute with a lower-emission option. Adjust the one-way distance.</p>
          <label className="distance-label" htmlFor="commute-distance">
            One-way distance <strong>{distance} km</strong>
          </label>
          <input
            id="commute-distance"
            className="range"
            type="range"
            min="1"
            max="40"
            value={distance}
            onChange={(event) => setDistance(Number(event.target.value))}
          />
          <div className="range-ends" aria-hidden="true">
            <span>1 km</span>
            <span>40 km</span>
          </div>
          <div className="calculator-flow">
            <div>
              <span>Solo car · 5 days/week</span>
              <strong>
                {(distance * 2 * 5 * 0.192).toFixed(1)} <small>kg CO₂e</small>
              </strong>
            </div>
            <ArrowDownRight size={18} aria-hidden="true" />
            <div className="flow-alt">
              <span>Public transport · estimate</span>
              <strong>
                {weeklyKg.toFixed(1)} <small>kg CO₂e avoided / week</small>
              </strong>
            </div>
          </div>
          <div className="impact-month">
            <span>IF YOU DO THIS FOR A MONTH</span>
            <strong>
              ~{monthlyKg.toFixed(1)} <small>kg CO₂e estimated</small>
            </strong>
          </div>
          <p className="assumption">
            Estimate assumes a solo petrol car at 192 g CO₂e/km and near-zero incremental emissions for public transit.
            Actual impact varies by vehicle, fuel, occupancy, and transit system. This does not measure city air quality.
          </p>
          <button type="button" className="primary-button full" onClick={saveActivity}>
            <Check size={16} aria-hidden="true" /> {savedKm > 0 ? 'Log another commute swap' : 'Log this activity'}
          </button>
          {savedKm > 0 && (
            <div className="saved-progress">
              <div className="saved-icon" aria-hidden="true">
                <Leaf size={16} />
              </div>
              <span>
                <strong>{savedKm} km logged</strong>
                <small>~{savedKg.toFixed(1)} kg CO₂e estimated savings</small>
              </span>
            </div>
          )}
        </aside>
      </div>

      <div className="plan-disclaimer">
        <Shield size={17} aria-hidden="true" />
        <span>
          These are general recommendations based on the available model estimate, any eligible nearby station category,
          and your preferences. They cannot guarantee protection or replace medical advice.
        </span>
      </div>
      {activityStatus && (
        <div className={activityStatus.startsWith('Saved') ? 'community-success' : 'community-error'} role="status">
          {activityStatus}
        </div>
      )}
    </div>
  );
}
