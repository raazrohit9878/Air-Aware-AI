import React from 'react';
import { Activity, ArrowRight, Baby, Check, Heart, Home, MapPin, Shield, Wind } from 'lucide-react';
import { BUDGET_OPTIONS, COMMUTE_OPTIONS, HOUSEHOLD_TYPE_OPTIONS } from '../onboardingOptions.js';

function Toggle({ icon: Icon, title, detail, value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(value)}
      className="toggle-row"
      onClick={() => onChange(!value)}
    >
      <span className="toggle-icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className="toggle-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <span className={`switch ${value ? 'on' : ''}`} aria-hidden="true">
        <i />
      </span>
    </button>
  );
}

/**
 * Household preference editor synchronized with onboarding options and Supabase storage.
 */
export default function HouseholdView({
  profile,
  setProfile,
  place,
  query,
  setQuery,
  onSearch,
  onSave,
  saving,
  status,
}) {
  const update = (key, val) => setProfile((prev) => ({ ...prev, [key]: val }));
  const commuteChoices = COMMUTE_OPTIONS.includes(profile.commute)
    ? COMMUTE_OPTIONS
    : [profile.commute, ...COMMUTE_OPTIONS].filter(Boolean);
  const budgetChoices = BUDGET_OPTIONS.includes(profile.budget)
    ? BUDGET_OPTIONS
    : [profile.budget, ...BUDGET_OPTIONS].filter(Boolean);

  return (
    <div className="page-wrap narrow">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" /> YOUR HOUSEHOLD
          </div>
          <h1>
            Advice that fits <em>your life.</em>
          </h1>
          <p>Share only what helps make your daily plan more practical. Sensitive details are optional.</p>
        </div>
      </section>

      <div className="form-card">
        <div className="form-section">
          <div className="form-number">01</div>
          <div className="form-content">
            <h2>Your location</h2>
            <p>Air conditions and local guidance are based on this place.</p>
            <form className="inline-search" onSubmit={onSearch}>
              <MapPin size={17} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={place.city}
                aria-label="Search for a new location"
                maxLength={100}
              />
              <button type="submit">Update location</button>
            </form>
          </div>
        </div>

        <div className="form-section">
          <div className="form-number">02</div>
          <div className="form-content">
            <h2>Who’s at home?</h2>
            <p>This helps prioritize household routines.</p>
            <div className="option-row" role="group" aria-label="Household type">
              {HOUSEHOLD_TYPE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={profile.household === option}
                  onClick={() => update('household', option)}
                  className={`choice ${profile.household === option ? 'selected' : ''}`}
                >
                  {profile.household === option && <Check size={14} aria-hidden="true" />} {option}
                </button>
              ))}
            </div>
            <div className="toggle-list">
              <Toggle
                icon={Baby}
                title="Children in the household"
                detail="Under 18"
                value={profile.children}
                onChange={(val) => update('children', val)}
              />
              <Toggle
                icon={Heart}
                title="Older adults in the household"
                detail="Age 65+"
                value={profile.olderAdults}
                onChange={(val) => update('olderAdults', val)}
              />
              <Toggle
                icon={Activity}
                title="Respiratory sensitivity"
                detail="Optional — e.g. asthma"
                value={profile.sensitivity}
                onChange={(val) => update('sensitivity', val)}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-number">03</div>
          <div className="form-content">
            <h2>Your everyday setup</h2>
            <p>Tell us what’s realistic for your home and commute.</p>
            <div className="field-grid">
              <label>
                Usual commute
                <select value={profile.commute} onChange={(event) => update('commute', event.target.value)}>
                  {commuteChoices.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Budget preference
                <select value={profile.budget} onChange={(event) => update('budget', event.target.value)}>
                  {budgetChoices.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="toggle-list compact-toggles">
              <Toggle
                icon={Wind}
                title="I have an air purifier"
                detail="We’ll include filter and usage tips"
                value={profile.purifier}
                onChange={(val) => update('purifier', val)}
              />
              <Toggle
                icon={Home}
                title="I can control window ventilation"
                detail="Open or close windows as conditions change"
                value={profile.ventilation}
                onChange={(val) => update('ventilation', val)}
              />
            </div>
          </div>
        </div>

        <div className="form-footer">
          <span>
            <Shield size={15} aria-hidden="true" />
            Preferences update your plan immediately and sync when saved.
          </span>
          <button className="primary-button" type="button" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save my preferences'} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        {status && (
          <div className="community-success form-status-banner" role="status">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
