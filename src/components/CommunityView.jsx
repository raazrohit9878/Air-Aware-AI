import React, { useState } from 'react';
import { Check, Leaf, Share2, Users } from 'lucide-react';
import { readableTime } from '../airQualityUtils.js';

/**
 * Community sharing, privacy-thresholded 30-day activity totals, and trip logging view.
 */
export default function CommunityView({ place, current, band, stats, loading, error, activityStatus, saveActivity }) {
  const [shareStatus, setShareStatus] = useState('');
  const shareNotice = `AirAware AI air-quality update for ${place.city}: Open-Meteo model estimate ${
    current?.us_aqi == null ? 'unavailable' : `${Math.round(current.us_aqi)} US AQI (${band[0]})`
  }${current?.time ? ` at ${readableTime(current.time)}` : ''}. Model estimate, not a local station reading. Check official local guidance before making health decisions.`;

  async function share() {
    setShareStatus('');
    try {
      if (navigator.share) {
        await navigator.share({ title: `AirAware AI · ${place.city}`, text: shareNotice });
      } else {
        await navigator.clipboard.writeText(shareNotice);
        setShareStatus('Notice copied. Share it with your community.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') setShareStatus('Sharing is unavailable in this browser.');
    }
  }

  const statsReady = stats?.available === true;

  return (
    <div className="page-wrap narrow">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" /> COMMUNITY CLEAN AIR
          </div>
          <h1>
            Small actions, <em>shared locally.</em>
          </h1>
          <p>Track household travel choices and share a clearly labelled local air update for {place.city}.</p>
        </div>
      </section>

      <section className="community-notice">
        <div>
          <span className="eyebrow">SHARE TODAY’S AIR BRIEF</span>
          <h2>{band[1] === 'unknown' ? 'Air reading unavailable' : `${band[0]} · model estimate`}</h2>
          <p>{shareNotice}</p>
        </div>
        <button type="button" className="primary-button" onClick={share}>
          <Share2 size={16} aria-hidden="true" /> Share notice
        </button>
      </section>

      {shareStatus && (
        <div className="community-success" role="status">
          {shareStatus}
        </div>
      )}

      <section className="community-stats-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">LAST 30 DAYS · {place.city.toUpperCase()}</div>
            <h2>Community activity</h2>
          </div>
          <Users size={22} aria-hidden="true" />
        </div>

        {loading ? (
          <p role="status">Loading privacy-protected totals…</p>
        ) : error ? (
          <div className="community-error" role="alert">
            {error.includes('community_activities') || error.includes('get_airaware_community_stats') ? (
              <>
                Community tracking needs its Supabase migration. Run <code>supabase/community-activities.sql</code> in
                the project SQL Editor, then reload.
              </>
            ) : (
              error
            )}
          </div>
        ) : statsReady ? (
          <div className="community-stat-grid">
            <div>
              <strong>{stats.participating_households}</strong>
              <span>participating households</span>
            </div>
            <div>
              <strong>{stats.activities_logged}</strong>
              <span>activities logged</span>
            </div>
            <div>
              <strong>{Number(stats.estimated_co2e_avoided_kg).toFixed(1)} kg</strong>
              <span>estimated CO₂e avoided</span>
            </div>
          </div>
        ) : (
          <div className="community-private">
            <Users size={19} aria-hidden="true" />
            <div>
              <strong>Community totals are hidden until at least five households participate.</strong>
              <p>
                {stats?.reason === 'sign_in_required'
                  ? 'Sign in to view or log household activities.'
                  : 'This privacy threshold prevents small groups from being identifiable. No city-wide air-quality improvement is inferred from these estimates.'}
              </p>
            </div>
          </div>
        )}
        <p className="community-caveat">
          Transport savings are modeled household estimates from logged activities. They are not measured reductions in
          city emissions or air pollution.
        </p>
      </section>

      <section className="community-action-card">
        <div className="source-icon method" aria-hidden="true">
          <Leaf size={19} />
        </div>
        <div>
          <span className="eyebrow">ONE PRACTICAL CONTRIBUTION</span>
          <h2>Log a lower-emission trip</h2>
          <p>
            If a shared ride or combined errand fits your plans, log one round-trip estimate. Short walking or cycling
            trips are options only when outdoor air, route safety, and mobility needs make them suitable.
          </p>
          <button type="button" className="primary-button" onClick={saveActivity}>
            <Check size={16} aria-hidden="true" /> Log one round-trip swap
          </button>
          {activityStatus && (
            <p className={activityStatus.startsWith('Saved') ? 'community-success' : 'community-error'} role="status">
              {activityStatus}
            </p>
          )}
        </div>
      </section>

      <section className="community-ideas">
        <span className="eyebrow">IDEAS TO START LOCALLY</span>
        <h2>Make clean-air habits easier together.</h2>
        <ul>
          <li>Coordinate a shared school drop-off for a day that works for families.</li>
          <li>Share the hourly air outlook before planning outdoor group activity.</li>
          <li>Ask building managers about kitchen exhaust maintenance and smoke-free shared spaces.</li>
        </ul>
        <small>These are suggestions, not existing AirAware or government programs.</small>
      </section>
    </div>
  );
}
