import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, ChevronDown, CircleHelp, Heart, Home, MapPin, Menu, RefreshCw, Sun, Users,
} from 'lucide-react';
import './chat.css';
import 'leaflet/dist/leaflet.css';
import { loadCommunityStats, logCommunityActivity } from './communityService.js';
import { syncDashboardHousehold } from './onboardingService.js';
import { supabaseConfigured } from './supabase.js';
import {
  DEFAULT_PLACE, DEFAULT_PROFILE, aqiBand, buildAdvice, guidanceBand,
  isCarCommute, isWinterLocation, readStorageJson,
} from './airQualityUtils.js';
import Brand from './components/Brand.jsx';
import ChatAssistant from './components/ChatAssistant.jsx';
import TodayView from './components/TodayView.jsx';
import HouseholdView from './components/HouseholdView.jsx';
import PlanView from './components/PlanView.jsx';
import CommunityView from './components/CommunityView.jsx';
import WhyView from './components/WhyView.jsx';

const NAV_ITEMS = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'household', label: 'My household', icon: Home },
  { id: 'plan', label: 'My plan', icon: Activity },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'why', label: 'Why this advice?', icon: CircleHelp },
];

/**
 * Signed-in AirAware dashboard shell coordinating navigation, air/weather fetches, and chat context.
 */
export default function App({ accessToken }) {
  const [page, setPage] = useState('today');
  const [profile, setProfile] = useState(() => ({
    ...DEFAULT_PROFILE,
    ...readStorageJson('airaware-profile', {}),
  }));
  const [place, setPlace] = useState(() => readStorageJson('airaware-place', DEFAULT_PLACE));
  const [air, setAir] = useState(null);
  const [weather, setWeather] = useState(null);
  const [ground, setGround] = useState(null);
  const [groundLoading, setGroundLoading] = useState(false);
  const [groundError, setGroundError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [distance, setDistance] = useState(8);
  const [savedKm, setSavedKm] = useState(() => Number(globalThis.localStorage?.getItem('airaware-saved-km') || 0));
  const [activityStatus, setActivityStatus] = useState('');
  const [householdStatus, setHouseholdStatus] = useState('');
  const [savingHousehold, setSavingHousehold] = useState(false);
  const [communityStats, setCommunityStats] = useState(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const menuButtonRef = useRef(null);
  const wasMobileNavOpen = useRef(false);

  useEffect(() => {
    globalThis.localStorage?.setItem('airaware-profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    globalThis.localStorage?.setItem('airaware-place', JSON.stringify(place));
  }, [place]);

  useEffect(() => {
    globalThis.localStorage?.setItem('airaware-saved-km', String(savedKm));
  }, [savedKm]);

  useEffect(() => {
    loadConditions(place);
  }, [place]);

  useEffect(() => {
    if (mobileNav) {
      wasMobileNavOpen.current = true;
      const onKeyDown = (event) => {
        if (event.key === 'Escape') setMobileNav(false);
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
    if (wasMobileNavOpen.current) {
      wasMobileNavOpen.current = false;
      menuButtonRef.current?.focus();
    }
    return undefined;
  }, [mobileNav]);

  useEffect(() => {
    let active = true;
    async function loadGroundStations() {
      if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) {
        setGround(null);
        return;
      }
      setGroundLoading(true);
      setGroundError('');
      try {
        const country = place.countryCode || (place.country === 'India' ? 'IN' : '');
        const response = await fetch(
          `/api/air-quality/stations?latitude=${encodeURIComponent(place.latitude)}&longitude=${encodeURIComponent(place.longitude)}&country=${encodeURIComponent(country)}`,
          { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Monitoring station data is unavailable.');
        if (active) setGround(data);
      } catch (err) {
        if (active) {
          setGround(null);
          setGroundError(err.message || 'Monitoring station data is unavailable.');
        }
      } finally {
        if (active) setGroundLoading(false);
      }
    }
    loadGroundStations();
    return () => { active = false; };
  }, [place.latitude, place.longitude, place.country, place.countryCode, accessToken]);

  useEffect(() => {
    if (page !== 'community') return undefined;
    let active = true;
    setCommunityLoading(true);
    setCommunityError('');
    loadCommunityStats(place.city)
      .then((data) => { if (active) setCommunityStats(data); })
      .catch((err) => { if (active) setCommunityError(err.message || 'Community activity is unavailable.'); })
      .finally(() => { if (active) setCommunityLoading(false); });
    return () => { active = false; };
  }, [page, place.city]);

  async function loadConditions(targetPlace) {
    if (!Number.isFinite(targetPlace.latitude) || !Number.isFinite(targetPlace.longitude)) {
      setAir(null);
      setWeather(null);
      setError('We could not locate this city. Use the city search to choose a nearby supported place.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${targetPlace.latitude}&longitude=${targetPlace.longitude}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&forecast_days=2&timezone=auto`;
      const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${targetPlace.latitude}&longitude=${targetPlace.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`;
      const [airResponse, wxResponse] = await Promise.all([fetch(airUrl), fetch(wxUrl)]);
      if (!airResponse.ok || !wxResponse.ok) {
        throw new Error('Live conditions could not be retrieved. Please try again.');
      }
      const [airData, wxData] = await Promise.all([airResponse.json(), wxResponse.json()]);
      if (!airData.current) throw new Error('No current model estimate is available for this location.');
      setAir(airData);
      setWeather(wxData.current || null);
    } catch (err) {
      setAir(null);
      setWeather(null);
      setError(err.message || 'Conditions unavailable.');
    } finally {
      setLoading(false);
    }
  }

  async function searchPlace(event) {
    event?.preventDefault();
    const cleaned = query.trim().slice(0, 100);
    if (!cleaned) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleaned)}&count=1&language=en&format=json`,
      );
      const data = await response.json();
      const match = data.results?.[0];
      const lat = Number(match?.latitude);
      const lon = Number(match?.longitude);
      if (!match || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error('We could not find that place. Try a city or district name.');
      }
      const cityLabel = [match.name, match.admin1].filter(Boolean).join(', ');
      setPlace({
        city: cityLabel,
        country: match.country,
        countryCode: match.country_code,
        latitude: lat,
        longitude: lon,
      });
      setProfile((prev) => ({ ...prev, city: cityLabel }));
      setQuery('');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function saveHouseholdPreferences() {
    setHouseholdStatus('');
    if (!supabaseConfigured || !accessToken) {
      setHouseholdStatus('Saved on this browser.');
      return;
    }
    setSavingHousehold(true);
    try {
      await syncDashboardHousehold(profile);
      setHouseholdStatus('Saved to your AirAware profile and this browser.');
    } catch (err) {
      setHouseholdStatus(`Saved on this browser (cloud sync note: ${err.message}).`);
    } finally {
      setSavingHousehold(false);
    }
  }

  const current = air?.current;
  const band = aqiBand(current?.us_aqi);
  const winter = isWinterLocation(place);
  const adviceBand = guidanceBand(band[1], ground);
  const advice = useMemo(
    () => buildAdvice(adviceBand, profile, weather, winter, adviceBand !== band[1]),
    [adviceBand, profile, weather, winter, band],
  );
  const dailyKm = Number(distance) * 2;
  const weeklyKg = dailyKm * 5 * 0.192;
  const monthlyKg = weeklyKg * 4.33;
  const savedKg = savedKm * 0.192;

  async function saveActivity() {
    setActivityStatus('');
    const avoided = dailyKm * 0.192;
    try {
      await logCommunityActivity({
        city: place.city,
        activityType: isCarCommute(profile.commute) ? 'shared_trip' : 'combined_errands',
        distanceKm: dailyKm,
        estimatedCo2eKg: avoided,
      });
      setSavedKm((value) => value + dailyKm);
      setActivityStatus('Saved. This is a household estimate, not a measured change in city air.');
      if (page === 'community') setCommunityStats(await loadCommunityStats(place.city));
    } catch (err) {
      setActivityStatus(`Could not save to community progress: ${err.message}`);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside
        className={`sidebar ${mobileNav ? 'open' : ''}`}
        aria-label="Dashboard navigation"
        role={mobileNav ? 'dialog' : undefined}
        aria-modal={mobileNav ? 'true' : undefined}
      >
        <Brand />
        <div className="side-label">YOUR AIR, YOUR DAY</div>
        <div className="location-card">
          <MapPin size={15} aria-hidden="true" />
          <span>{place.city}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
        <nav aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => { setPage(item.id); setMobileNav(false); }}
            >
              <item.icon size={18} aria-hidden="true" />
              {item.label}
              {item.id === 'plan' && <span className="nav-dot" aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <div className="note-icon" aria-hidden="true"><Heart size={16} /></div>
          <strong>Small steps add up.</strong>
          <p>Build healthier habits for your home and your neighbourhood.</p>
          <button type="button" onClick={() => setPage('plan')}>
            See your plan <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="profile-chip">
          <div className="avatar" aria-hidden="true">{(profile.household || 'F')[0]}</div>
          <div>
            <strong>{profile.household}</strong>
            <span>Your household</span>
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          type="button"
          className="scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation menu"
        />
      )}
      <main id="main-content" className="main-content" tabIndex={-1}>
        <header className="topbar">
          <button
            ref={menuButtonRef}
            type="button"
            className="menu-button"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileNav}
          >
            <Menu aria-hidden="true" />
          </button>
          <div className="breadcrumb">
            AirAware <span aria-hidden="true">/</span> {NAV_ITEMS.find((x) => x.id === page)?.label}
          </div>
          <div className="top-actions">
            <span className="live-pill"><i aria-hidden="true" />{loading ? 'Updating' : 'Model data'}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Refresh air conditions"
              onClick={() => loadConditions(place)}
            >
              <RefreshCw size={17} aria-hidden="true" />
            </button>
            <div className="top-avatar" aria-hidden="true">{(profile.household || 'F')[0]}</div>
          </div>
        </header>

        {page === 'today' && (
          <TodayView
            place={place}
            query={query}
            setQuery={setQuery}
            onSearch={searchPlace}
            air={air}
            current={current}
            weather={weather}
            band={band}
            error={error}
            reload={() => loadConditions(place)}
            setPage={setPage}
            advice={advice}
            ground={ground}
            groundLoading={groundLoading}
            groundError={groundError}
            winter={winter}
          />
        )}
        {page === 'household' && (
          <HouseholdView
            profile={profile}
            setProfile={setProfile}
            place={place}
            query={query}
            setQuery={setQuery}
            onSearch={searchPlace}
            onSave={saveHouseholdPreferences}
            saving={savingHousehold}
            status={householdStatus}
          />
        )}
        {page === 'plan' && (
          <PlanView
            advice={advice}
            band={band}
            profile={profile}
            place={place}
            current={current}
            distance={distance}
            setDistance={setDistance}
            weeklyKg={weeklyKg}
            monthlyKg={monthlyKg}
            savedKg={savedKg}
            saveActivity={saveActivity}
            savedKm={savedKm}
            activityStatus={activityStatus}
            winter={winter}
          />
        )}
        {page === 'community' && (
          <CommunityView
            place={place}
            current={current}
            band={band}
            stats={communityStats}
            loading={communityLoading}
            error={communityError}
            activityStatus={activityStatus}
            saveActivity={saveActivity}
          />
        )}
        {page === 'why' && (
          <WhyView
            place={place}
            current={current}
            weather={weather}
            band={band}
            ground={ground}
            winter={winter}
          />
        )}

        <footer className="footer">
          <span>AirAware AI <b>·</b> Breathe better, live smarter.</span>
          <span>Environmental data by Open-Meteo <b>·</b> Advice is general guidance</span>
        </footer>
      </main>

      <ChatAssistant
        accessToken={accessToken}
        context={{
          city: place.city,
          aqi: current?.us_aqi ?? null,
          aqiCategory: band[0],
          updatedAt: current?.time || null,
          pollutants: current || {},
          nextAqi: air?.hourly?.us_aqi || [],
          weather: weather || {},
          profile,
          winter,
          groundStations: ground?.stations || [],
        }}
      />
    </div>
  );
}
