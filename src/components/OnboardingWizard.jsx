import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Shield } from 'lucide-react';
import Brand from './Brand.jsx';
import FormMessages from './FormMessages.jsx';
import { ChoiceGrid, Facility, Field, ReviewSection, StepHead, yesNo } from './OnboardingFields.jsx';
import {
  AGE_RANGE_OPTIONS, BUDGET_OPTIONS, COMMUTE_OPTIONS, HOUSEHOLD_TYPE_OPTIONS,
  LANGUAGE_OPTIONS, OUTDOOR_ACTIVITY_TIME_OPTIONS, SENSITIVITY_OPTIONS,
} from '../onboardingOptions.js';

const STEPS = ['About you', 'Household', 'Sensitivities', 'Lifestyle', 'Home', 'Review'];
const SENSITIVITY_LABELS = SENSITIVITY_OPTIONS.map(({ label }) => label);

/**
 * Six-step onboarding and profile-editing wizard with accessible step announcements.
 */
export default function OnboardingWizard({
  profile,
  update,
  onboardingData,
  step,
  setStep,
  editing,
  busy,
  error,
  notice,
  resetMessage,
  continueOnboarding,
  saveProfile,
  deleteProfile,
  signOut,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mainRef = useRef(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (previousStep.current !== step) {
      previousStep.current = step;
      mainRef.current?.focus();
    }
  }, [step]);

  return (
    <div className="profile-page">
      <a className="skip-link" href="#main-content">
        Skip to onboarding form
      </a>
      <header className="auth-top">
        <Brand className="auth-brand" />
        <button type="button" className="quiet-button" onClick={signOut}>
          Sign out
        </button>
      </header>
      <main id="main-content" ref={mainRef} className="onboard-wrap" tabIndex={-1}>
        <div className="onboard-title">
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" /> YOUR AIRAWARE PROFILE
          </div>
          <h1>
            A plan made for <em>your household.</em>
          </h1>
          <p>Share only what makes your advice more useful. Health preferences are optional.</p>
        </div>

        <ol className="progress-row" aria-label="Onboarding steps">
          {STEPS.map((label, index) => (
            <li
              className={`progress-step ${index <= step ? 'done' : ''} ${index === step ? 'current' : ''}`}
              aria-current={index === step ? 'step' : undefined}
              key={label}
            >
              <span>{index < step ? <Check size={13} aria-hidden="true" /> : index + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>

        <div className="onboard-card">
          {step === 0 && (
            <>
              <StepHead n="01" title="A little about you" desc="Set your location and how you’d like to use AirAware." />
              <div className="auth-fields two">
                <Field label="Full name" value={profile.full_name} onChange={(v) => update('full_name', v)} placeholder="Your name" required />
                <Field label="Age range" value={profile.age_range} onChange={(v) => update('age_range', v)} select options={AGE_RANGE_OPTIONS} />
                <Field label="City" value={profile.city} onChange={(v) => update('city', v)} placeholder="e.g. Bengaluru" required />
                <Field label="State / region" value={profile.state} onChange={(v) => update('state', v)} placeholder="e.g. Karnataka" />
                <Field label="Country" value={profile.country} onChange={(v) => update('country', v)} placeholder="Country" required />
                <Field label="Preferred language" value={profile.preferred_language} onChange={(v) => update('preferred_language', v)} select options={LANGUAGE_OPTIONS} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <StepHead n="02" title="Who’s in your household?" desc="This helps us put the most relevant daily actions first." />
              <ChoiceGrid value={profile.household_type} onChange={(v) => update('household_type', v)} options={HOUSEHOLD_TYPE_OPTIONS} />
              <div className="auth-fields two">
                <Field label="Household size (optional)" value={profile.household_size} onChange={(v) => update('household_size', v)} type="number" placeholder="Number of people" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <StepHead
                n="03"
                title="Sensitivities (optional)"
                desc="Only select what you choose to share. These preferences are private and can be changed or removed later."
              />
              <div className="sensitivity-list">
                {SENSITIVITY_LABELS.map((label) => (
                  <label key={label} className="check-row">
                    <input
                      type="checkbox"
                      checked={profile.optional_sensitivities.includes(label)}
                      onChange={(event) =>
                        update(
                          'optional_sensitivities',
                          event.target.checked
                            ? [...profile.optional_sensitivities, label]
                            : profile.optional_sensitivities.filter((item) => item !== label),
                        )
                      }
                    />
                    <span>{label}</span>
                    <small>Optional</small>
                  </label>
                ))}
              </div>
              <div className="privacy-note">
                <Shield size={16} aria-hidden="true" /> We don’t ask for diagnoses or treatment details. This information
                is stored in your private profile under Row Level Security.
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <StepHead n="04" title="Your usual routine" desc="Choose the travel and activity patterns that are most like your week." />
              <div className="auth-fields two">
                <Field label="Usual commute" value={profile.commute_method} onChange={(v) => update('commute_method', v)} select allowEmpty options={COMMUTE_OPTIONS} />
                <Field label="Usual outdoor activity time" value={profile.outdoor_activity_time} onChange={(v) => update('outdoor_activity_time', v)} select allowEmpty options={OUTDOOR_ACTIVITY_TIME_OPTIONS} />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <StepHead n="05" title="Your indoor environment" desc="We’ll adapt tips to the facilities you have. No equipment purchase is required." />
              <div className="facility-list">
                <Facility title="Air purifier available" value={profile.air_purifier_available} onChange={(v) => update('air_purifier_available', v)} />
                <Facility title="Air conditioning available" value={profile.air_conditioning_available} onChange={(v) => update('air_conditioning_available', v)} />
                <Facility title="Kitchen exhaust ventilation" value={profile.kitchen_exhaust_available} onChange={(v) => update('kitchen_exhaust_available', v)} />
                <Facility title="Can open windows for outdoor ventilation" value={profile.outdoor_ventilation_available} onChange={(v) => update('outdoor_ventilation_available', v)} />
              </div>
              <div className="auth-fields">
                <Field label="Budget for air-quality improvements" value={profile.budget_preference} onChange={(v) => update('budget_preference', v)} select allowEmpty options={BUDGET_OPTIONS} />
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <StepHead n="06" title="Review your profile" desc="Check the details and save when you’re ready. You can update these later." />
              <div className="review-sections">
                <ReviewSection
                  title="Personal information"
                  items={[
                    ['Name', onboardingData?.personal?.full_name || profile.full_name || 'Not provided'],
                    [
                      'Location',
                      [
                        onboardingData?.personal?.city || profile.city,
                        onboardingData?.personal?.state || profile.state,
                        onboardingData?.personal?.country || profile.country,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Not provided',
                    ],
                    ['Language', onboardingData?.personal?.preferred_language || profile.preferred_language || 'Not provided'],
                  ]}
                />
                <ReviewSection
                  title="Household"
                  items={[
                    ['Household type', onboardingData?.household?.household_type || profile.household_type || 'Not provided'],
                    [
                      'Household size',
                      onboardingData?.household
                        ? onboardingData.household.household_size ?? 'Not provided'
                        : profile.household_size || 'Not provided',
                    ],
                  ]}
                />
                <ReviewSection
                  title="Sensitivities (optional)"
                  items={SENSITIVITY_OPTIONS.map(({ label, column }) => [
                    label,
                    onboardingData?.sensitivities
                      ? yesNo(onboardingData.sensitivities[column])
                      : onboardingData?.personal?.optional_sensitivities?.includes(label)
                        ? 'Yes'
                        : 'Not provided',
                  ])}
                />
                <ReviewSection
                  title="Lifestyle"
                  items={[
                    [
                      'Usual commute',
                      onboardingData?.lifestyle
                        ? onboardingData.lifestyle.usual_commute || 'Not provided'
                        : onboardingData?.personal?.commute_method || 'Not provided',
                    ],
                    [
                      'Outdoor activity time',
                      onboardingData?.lifestyle
                        ? onboardingData.lifestyle.usual_outdoor_activity_time || 'Not provided'
                        : onboardingData?.personal?.outdoor_activity_time || 'Not provided',
                    ],
                  ]}
                />
                <ReviewSection
                  title="Home environment"
                  items={[
                    ['Air purifier', onboardingData?.home ? yesNo(onboardingData.home.air_purifier_available) : 'Not provided'],
                    ['Air conditioning', onboardingData?.home ? yesNo(onboardingData.home.air_conditioning_available) : 'Not provided'],
                    ['Kitchen exhaust ventilation', onboardingData?.home ? yesNo(onboardingData.home.kitchen_exhaust_ventilation) : 'Not provided'],
                    ['Can open windows', onboardingData?.home ? yesNo(onboardingData.home.can_open_windows) : 'Not provided'],
                    ['Budget', onboardingData?.home ? onboardingData.home.budget_preference || 'Not provided' : 'Not provided'],
                  ]}
                />
              </div>
            </>
          )}

          <FormMessages error={error} notice={notice} />

          {confirmDelete && (
            <div className="auth-alert error confirm-delete-box" role="alertdialog" aria-labelledby="delete-profile-heading">
              <strong id="delete-profile-heading">Delete your household profile?</strong>
              <p>Your AirAware account will remain active, and you can recreate a profile anytime.</p>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setConfirmDelete(false);
                  await deleteProfile();
                }}
              >
                Confirm delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          )}

          <div className="onboard-actions">
            {step > 0 ? (
              <button type="button" className="outline-button" onClick={() => { resetMessage(); setStep(step - 1); }}>
                <ArrowLeft size={15} aria-hidden="true" /> Back
              </button>
            ) : editing ? (
              <button type="button" className="outline-button danger" onClick={() => setConfirmDelete(true)}>
                Delete profile
              </button>
            ) : (
              <span className="optional-label">
                <Shield size={14} aria-hidden="true" /> Sensitive questions are optional
              </span>
            )}
            <div>
              {step < 5 ? (
                <button type="button" className="primary-button" disabled={busy} onClick={continueOnboarding}>
                  {busy ? 'Saving…' : 'Continue'} <ArrowRight size={15} aria-hidden="true" />
                </button>
              ) : (
                <>
                  <button type="button" className="outline-button" onClick={() => setStep(0)}>
                    Edit details
                  </button>
                  <button type="button" className="outline-button" disabled={busy} onClick={saveProfile}>
                    Skip optional questions
                  </button>
                  <button type="button" className="primary-button" disabled={busy} onClick={saveProfile}>
                    {busy ? 'Saving…' : 'Save profile'} <Check size={15} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        <p className="auth-footnote">Your profile is private and only visible to your account. You can edit or delete it at any time.</p>
      </main>
    </div>
  );
}
