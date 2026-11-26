import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { DEFAULT_PLACE, DEFAULT_PROFILE, buildAdvice } from '../src/airQualityUtils.js';

const tempDir = mkdtempSync(join(process.cwd(), 'tests', '.tmp-ui-'));

test.after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

await build({
  entryPoints: [
    'src/components/Brand.jsx',
    'src/components/LandingPage.jsx',
    'src/components/AuthPanel.jsx',
    'src/components/FormMessages.jsx',
    'src/components/OnboardingWizard.jsx',
    'src/components/StationCard.jsx',
    'src/components/TodayView.jsx',
    'src/components/HouseholdView.jsx',
    'src/components/PlanView.jsx',
    'src/components/CommunityView.jsx',
    'src/components/WhyView.jsx',
    'src/components/ChatAssistant.jsx',
  ],
  outdir: tempDir,
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  outExtension: { '.js': '.mjs' },
  plugins: [
    {
      name: 'stub-leaflet-map',
      setup(build) {
        build.onResolve({ filter: /MonitorMap\.jsx$/ }, () => ({ path: 'monitor-map-stub', namespace: 'stub' }));
        build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: 'export default function MonitorMapStub() { return null; }',
          loader: 'js',
        }));
      },
    },
  ],
});

const loadComponent = async (name) =>
  (await import(pathToFileURL(join(tempDir, `${name}.mjs`)).href)).default;

test('LandingPage, AuthPanel, and OnboardingWizard render semantic accessible markup', async () => {
  const [Brand, LandingPage, AuthPanel, OnboardingWizard] = await Promise.all([
    loadComponent('Brand'),
    loadComponent('LandingPage'),
    loadComponent('AuthPanel'),
    loadComponent('OnboardingWizard'),
  ]);

  const brandHtml = renderToStaticMarkup(React.createElement(Brand));
  assert.match(brandHtml, /airaware/);

  const landingHtml = renderToStaticMarkup(
    React.createElement(LandingPage, { onGetStarted: () => {} }),
  );
  assert.match(landingHtml, /<h1>Breathe better/);
  assert.match(landingHtml, /Explore features/);

  const signupHtml = renderToStaticMarkup(
    React.createElement(AuthPanel, {
      screen: 'signup',
      setScreen: () => {},
      signIn: () => {},
      signInSocial: () => {},
      signUp: () => {},
      sendReset: () => {},
      resendVerification: () => {},
      verificationEmail: '',
      setVerificationEmail: () => {},
      busy: false,
      error: '',
      notice: '',
      showPassword: false,
      setShowPassword: () => {},
      resetMessage: () => {},
    }),
  );
  assert.match(signupHtml, /id="privacy-summary"/);
  assert.match(signupHtml, /type="checkbox"/);

  const wizardHtml = renderToStaticMarkup(
    React.createElement(OnboardingWizard, {
      profile: {
        full_name: 'Asha',
        city: 'Bengaluru',
        country: 'India',
        preferred_language: 'English',
        household_type: 'Family with children',
        optional_sensitivities: [],
      },
      update: () => {},
      onboardingData: null,
      step: 1,
      setStep: () => {},
      editing: true,
      busy: false,
      error: '',
      notice: '',
      resetMessage: () => {},
      continueOnboarding: () => {},
      saveProfile: () => {},
      deleteProfile: () => {},
      signOut: () => {},
    }),
  );
  assert.match(wizardHtml, /<ol class="progress-row" aria-label="Onboarding steps">/);
  assert.match(wizardHtml, /aria-current="step"/);
  assert.match(wizardHtml, /aria-pressed="true"/);
});

test('Dashboard views render accessible landmarks, switches, labels, and disclaimers', async () => {
  const [TodayView, HouseholdView, PlanView, CommunityView, WhyView, ChatAssistant] = await Promise.all([
    loadComponent('TodayView'),
    loadComponent('HouseholdView'),
    loadComponent('PlanView'),
    loadComponent('CommunityView'),
    loadComponent('WhyView'),
    loadComponent('ChatAssistant'),
  ]);

  const advice = buildAdvice('good', DEFAULT_PROFILE, null, false, false);
  const current = {
    us_aqi: 34,
    pm2_5: 9.6,
    pm10: 10.1,
    nitrogen_dioxide: 34.7,
    ozone: 23,
    time: '2026-11-25T10:00',
  };

  const todayHtml = renderToStaticMarkup(
    React.createElement(TodayView, {
      place: DEFAULT_PLACE,
      query: '',
      setQuery: () => {},
      onSearch: () => {},
      air: { hourly: { time: ['2026-11-25T11:00'], us_aqi: [36] } },
      current,
      weather: { temperature_2m: 24, relative_humidity_2m: 60, wind_speed_10m: 8 },
      band: ['Good', 'good'],
      error: '',
      reload: () => {},
      setPage: () => {},
      advice,
      ground: { available: false, reason: 'OpenAQ API key is not configured.', stations: [] },
      groundLoading: false,
      groundError: '',
      winter: false,
    }),
  );
  assert.match(todayHtml, /MODEL ESTIMATE/);
  assert.match(todayHtml, /rel="noopener noreferrer"/);

  const householdHtml = renderToStaticMarkup(
    React.createElement(HouseholdView, {
      profile: DEFAULT_PROFILE,
      setProfile: () => {},
      place: DEFAULT_PLACE,
      query: '',
      setQuery: () => {},
      onSearch: () => {},
      onSave: () => {},
      saving: false,
      status: 'Saved to your AirAware profile.',
    }),
  );
  assert.match(householdHtml, /role="switch"/);
  assert.match(householdHtml, /aria-checked="true"/);

  const planHtml = renderToStaticMarkup(
    React.createElement(PlanView, {
      advice,
      band: ['Good', 'good'],
      profile: DEFAULT_PROFILE,
      place: DEFAULT_PLACE,
      current,
      distance: 8,
      setDistance: () => {},
      weeklyKg: 15.4,
      monthlyKg: 66.5,
      savedKg: 3.1,
      saveActivity: () => {},
      savedKm: 16,
      activityStatus: '',
      winter: true,
    }),
  );
  assert.match(planHtml, /WINTER AIR ROUTINE/);
  assert.match(planHtml, /for="commute-distance"/);

  const communityHtml = renderToStaticMarkup(
    React.createElement(CommunityView, {
      place: DEFAULT_PLACE,
      current,
      band: ['Good', 'good'],
      stats: { available: false, reason: 'privacy_threshold' },
      loading: false,
      error: '',
      activityStatus: '',
      saveActivity: () => {},
    }),
  );
  assert.match(communityHtml, /five households/);

  const whyHtml = renderToStaticMarkup(
    React.createElement(WhyView, {
      place: DEFAULT_PLACE,
      current,
      weather: { temperature_2m: 24, relative_humidity_2m: 60, wind_speed_10m: 8 },
      band: ['Good', 'good'],
      ground: { available: true, stations: [], checkedAt: '2026-11-25T10:00' },
      winter: false,
    }),
  );
  assert.match(whyHtml, /Open-Meteo Air Quality API/);

  const chatHtml = renderToStaticMarkup(
    React.createElement(ChatAssistant, {
      accessToken: '',
      context: { city: 'Bengaluru', aqi: 34 },
    }),
  );
  assert.match(chatHtml, /aria-label="Open AirAware assistant"/);
});

test('StationCard, FormMessages, AuthPanel screens, and OnboardingWizard steps render cleanly', async () => {
  const [StationCard, FormMessages, AuthPanel, OnboardingWizard] = await Promise.all([
    loadComponent('StationCard'),
    loadComponent('FormMessages'),
    loadComponent('AuthPanel'),
    loadComponent('OnboardingWizard'),
  ]);

  const validStationHtml = renderToStaticMarkup(
    React.createElement(StationCard, {
      station: {
        id: 1,
        name: 'BTM Layout',
        provider: 'CPCB',
        distanceMeters: 2500,
        measurements: [
          { sensorId: 10, parameter: 'PM2.5', pollutant: 'pm25', value: 18, unit: 'µg/m³', datetime: new Date().toISOString() },
          { sensorId: 11, parameter: 'PM10', pollutant: 'pm10', value: 30, unit: 'µg/m³', datetime: new Date().toISOString() },
          { sensorId: 12, parameter: 'NO₂', pollutant: 'no2', value: 22, unit: 'µg/m³', datetime: new Date().toISOString() },
        ],
        indiaAqi: {
          value: 49,
          category: 'Good',
          pollutant: 'no2',
          subIndices: [{ pollutant: 'pm25' }, { pollutant: 'pm10' }, { pollutant: 'no2' }],
        },
      },
    }),
  );
  assert.match(validStationHtml, /India AQI estimate · Good/);
  assert.match(validStationHtml, /2\.5 km/);

  const missingCoverageHtml = renderToStaticMarkup(
    React.createElement(StationCard, {
      station: {
        id: 2,
        name: 'Sparse Station',
        provider: 'OpenAQ',
        distanceMeters: null,
        measurements: [],
        indiaAqi: {
          value: null,
          reason: 'Insufficient hourly data.',
          coverage: { pm25: { hours24: 4, hours8: null }, co: { hours24: 8, hours8: 2 } },
        },
      },
    }),
  );
  assert.match(missingCoverageHtml, /India AQI unavailable/);
  assert.match(missingCoverageHtml, /latest 8h 2\/6/);

  const schemaMsgHtml = renderToStaticMarkup(
    React.createElement(FormMessages, {
      error: 'PGRST205: could not find the table public.household_profiles in the schema cache',
      notice: 'Saved.',
    }),
  );
  assert.match(schemaMsgHtml, /supabase\/onboarding-sections\.sql/);
  assert.match(schemaMsgHtml, /role="status"/);

  for (const screen of ['login', 'reset', 'verify']) {
    const html = renderToStaticMarkup(
      React.createElement(AuthPanel, {
        screen,
        setScreen: () => {},
        signIn: () => {},
        signInSocial: () => {},
        signUp: () => {},
        sendReset: () => {},
        resendVerification: () => {},
        verificationEmail: 'user@example.com',
        setVerificationEmail: () => {},
        busy: false,
        error: '',
        notice: '',
        showPassword: false,
        setShowPassword: () => {},
        resetMessage: () => {},
      }),
    );
    assert.match(html, /<h1>/);
  }

  for (const step of [0, 2, 3, 4, 5]) {
    const html = renderToStaticMarkup(
      React.createElement(OnboardingWizard, {
        profile: {
          full_name: 'Asha',
          city: 'Bengaluru',
          country: 'India',
          preferred_language: 'English',
          household_type: 'Individual',
          optional_sensitivities: ['Allergies'],
          commute_method: 'Public transportation',
          outdoor_activity_time: 'Morning',
          air_purifier_available: false,
          air_conditioning_available: false,
          kitchen_exhaust_available: true,
          outdoor_ventilation_available: true,
          budget_preference: 'Low cost first',
        },
        update: () => {},
        onboardingData: null,
        step,
        setStep: () => {},
        editing: false,
        busy: false,
        error: '',
        notice: '',
        resetMessage: () => {},
        continueOnboarding: () => {},
        saveProfile: () => {},
        deleteProfile: () => {},
        signOut: () => {},
      }),
    );
    assert.match(html, /onboard-card/);
  }
});
