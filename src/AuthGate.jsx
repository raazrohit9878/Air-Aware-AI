import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleCheck, LockKeyhole } from 'lucide-react';
import { supabase, supabaseConfigured } from './supabase.js';
import {
  deleteAllOnboardingData, loadOnboardingData, saveHomeProfile, saveHouseholdProfile,
  saveLifestyleProfile, savePersonalProfile, saveSensitivityProfile,
} from './onboardingService.js';
import {
  BLANK_PROFILE, hasValidPassword, mergeOnboardingData, syncLocalProfileAndPlace,
} from './authHelpers.js';
import Brand from './components/Brand.jsx';
import FormMessages from './components/FormMessages.jsx';
import LandingPage from './components/LandingPage.jsx';
import AuthPanel from './components/AuthPanel.jsx';
import OnboardingWizard from './components/OnboardingWizard.jsx';

export { mergeOnboardingData };

/**
 * Gate access to the dashboard behind Supabase authentication and 6-step onboarding.
 */
export default function AuthGate({ Dashboard }) {
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState('welcome');
  const [profile, setProfile] = useState(BLANK_PROFILE);
  const [onboardingData, setOnboardingData] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editing, setEditing] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState(
    () => globalThis.localStorage?.getItem('airaware-pending-verification-email') || '',
  );
  const verificationLinkExpired = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.get('error_code') !== 'otp_expired') return;
    verificationLinkExpired.current = true;
    setVerificationEmail(globalThis.localStorage?.getItem('airaware-pending-verification-email') || '');
    setError('This verification link has expired. Enter your email below to request a fresh link.');
    setNotice('');
    setScreen('verify');
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setBusy(false);
      return undefined;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setBusy(false);
      })
      .catch(() => {
        setError('Could not connect to Supabase. Check your project URL, public key, and internet connection.');
        setBusy(false);
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setScreen('reset-update');
      setBusy(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfileReady(false);
      return undefined;
    }
    let active = true;
    (async () => {
      setBusy(true);
      if (!verificationLinkExpired.current) setError('');
      const records = await loadOnboardingData();
      if (!active) return;
      const merged = mergeOnboardingData(
        records,
        session.user.user_metadata?.full_name || '',
        globalThis.localStorage?.getItem('airaware-city') || '',
      );
      setOnboardingData(records);
      setProfile(merged);
      if (records.personal) {
        await syncLocalProfileAndPlace(merged);
        setProfileReady(true);
        if (!verificationLinkExpired.current) setScreen('dashboard');
      } else {
        setProfileReady(false);
        if (!verificationLinkExpired.current) setScreen('profile');
      }
      setBusy(false);
    })().catch((err) => {
      if (!active) return;
      if (!verificationLinkExpired.current) {
        setError(`Could not load your profile: ${err.message || 'Check your connection and Supabase table setup.'}`);
        setScreen('profile');
      }
      setBusy(false);
    });
    return () => { active = false; };
  }, [session?.user?.id]);

  function resetMessage() {
    setError('');
    setNotice('');
  }

  async function signIn(event) {
    event.preventDefault();
    resetMessage();
    verificationLinkExpired.current = false;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim();
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: String(form.get('password')),
      });
      if (authError) {
        if (/email not confirmed/i.test(authError.message)) {
          setVerificationEmail(email);
          globalThis.localStorage?.setItem('airaware-pending-verification-email', email);
          setError('Your email is not verified yet. Request a fresh verification link below.');
          setScreen('verify');
        } else {
          setError(authError.message);
        }
      }
    } catch {
      setError('Could not reach Supabase. Check your connection and project configuration, then try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signInSocial(provider) {
    resetMessage();
    if (!supabaseConfigured) {
      setError('Add your Supabase project URL and public key before using social sign-in.');
      return;
    }
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (authError) {
        setError(authError.message);
        setBusy(false);
      }
    } catch {
      setError('Could not start social sign-in. Check that this provider is enabled in Supabase.');
      setBusy(false);
    }
  }

  async function signUp(event) {
    event.preventDefault();
    resetMessage();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get('name')).trim();
    const email = String(form.get('email')).trim();
    const password = String(form.get('password'));
    const confirm = String(form.get('confirm'));
    setVerificationEmail(email);
    globalThis.localStorage?.setItem('airaware-pending-verification-email', email);

    if (!hasValidPassword(password)) {
      setError('Use at least 10 characters, with an uppercase letter, a lowercase letter, and a number.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!form.get('terms')) {
      setError('Please accept the privacy policy and terms to continue.');
      return;
    }

    setBusy(true);
    let data;
    try {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
      });
      data = result.data;
      if (result.error) {
        setError(result.error.message);
        return;
      }
    } catch {
      setError('Could not reach Supabase. Check your connection and project configuration, then try again.');
      return;
    } finally {
      setBusy(false);
    }

    if (data.user?.identities?.length === 0) {
      setError('An account may already exist for this email. Try logging in or resetting your password.');
      return;
    }
    setProfile((prev) => ({ ...prev, full_name: fullName }));
    if (data.session) {
      setScreen('profile');
      setNotice('Account created. Let’s set up your household profile.');
    } else {
      setScreen('verify');
      setNotice(`We sent a verification link to ${email}. Open it to verify your address, then return here to sign in.`);
    }
  }

  async function resendVerification(event) {
    event.preventDefault();
    resetMessage();
    const email = verificationEmail.trim();
    if (!email) {
      setError('Enter the email address you registered with.');
      return;
    }
    setBusy(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (resendError) setError(resendError.message);
      else setNotice(`A new verification link has been sent to ${email}. Use the newest email; earlier links may have expired.`);
    } catch {
      setError('Could not send a verification email. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(event) {
    event.preventDefault();
    resetMessage();
    setBusy(true);
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (resetError) setError(resetError.message);
      else setNotice('If an account exists for that address, a password reset link has been sent.');
    } catch {
      setError('Could not reach Supabase. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(event) {
    event.preventDefault();
    resetMessage();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    const confirm = String(form.get('confirm'));
    if (!hasValidPassword(password)) {
      setError('Use at least 10 characters, with an uppercase letter, a lowercase letter, and a number.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      await supabase.auth.signOut();
      setSession(null);
      setScreen('login');
      setNotice('Password updated. You can now sign in with your new password.');
    } catch {
      setError('Could not update the password. The reset link may have expired; request a new one.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    resetMessage();
    if (!profile.full_name.trim() || !profile.city.trim() || !profile.country.trim()) {
      setError('Please enter your name, city, and country.');
      return;
    }
    setBusy(true);
    try {
      const savedPersonal = await savePersonalProfile(profile);
      const records = await loadOnboardingData();
      const latest = mergeOnboardingData({ ...records, personal: savedPersonal });
      setOnboardingData(records);
      setProfile(latest);
      await syncLocalProfileAndPlace(latest);
      setProfileReady(true);
      setEditing(false);
      setScreen('dashboard');
    } catch (err) {
      setError(`Profile could not be saved: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function continueOnboarding() {
    resetMessage();
    if (step === 0 && (!profile.full_name.trim() || !profile.city.trim() || !profile.country.trim())) {
      setError('Please enter your name, city, and country.');
      return;
    }
    const persistStep = {
      0: () => savePersonalProfile(profile),
      1: () => saveHouseholdProfile(profile.household_type, profile.household_size),
      2: () => saveSensitivityProfile(profile.optional_sensitivities),
      3: () => saveLifestyleProfile(profile.commute_method, profile.outdoor_activity_time),
      4: () => saveHomeProfile({
        air_purifier_available: profile.air_purifier_available,
        air_conditioning_available: profile.air_conditioning_available,
        kitchen_exhaust_ventilation: profile.kitchen_exhaust_available,
        can_open_windows: profile.outdoor_ventilation_available,
        budget_preference: profile.budget_preference,
      }),
    }[step];

    if (persistStep) {
      setBusy(true);
      try {
        const saved = await persistStep();
        const sectionKey = { 0: 'personal', 1: 'household', 2: 'sensitivities', 3: 'lifestyle', 4: 'home' }[step];
        setOnboardingData((old) => ({ ...old, [sectionKey]: saved }));
        if (step === 0) setProfile((old) => ({ ...old, ...saved }));
        if (step === 1) setProfile((old) => ({ ...old, household_size: saved.household_size ?? '' }));
      } catch (err) {
        setError(`Could not save this onboarding step: ${err.message}`);
        return;
      } finally {
        setBusy(false);
      }
    }
    setStep(step + 1);
  }

  async function deleteProfile() {
    setBusy(true);
    try {
      await deleteAllOnboardingData();
      globalThis.localStorage?.removeItem('airaware-profile');
      setOnboardingData(null);
      setProfile(BLANK_PROFILE);
      setProfileReady(false);
      setScreen('profile');
      setStep(0);
      setNotice('Profile deleted. You can create a new one whenever you’re ready.');
    } catch (err) {
      setError(err?.message || 'Could not reach Supabase to delete the profile. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      globalThis.localStorage?.removeItem('airaware-profile');
      setScreen('welcome');
      setProfileReady(false);
    }
  }

  if (!supabaseConfigured && screen !== 'welcome') {
    return (
      <main id="main-content" className="config-screen">
        <div className="config-card">
          <Brand className="auth-brand" />
          <button type="button" className="back-to-home" onClick={() => setScreen('welcome')}>
            <ArrowLeft size={14} aria-hidden="true" /> Back to AirAware AI
          </button>
          <div className="config-symbol" aria-hidden="true">
            <LockKeyhole size={22} />
          </div>
          <div className="eyebrow">AUTHENTICATION SETUP</div>
          <h1>Connect your Supabase project</h1>
          <p>
            Real sign-in and registration are enabled, but require your project URL and public anon key. Add them to a
            local <code>.env</code> file, then restart the dev server.
          </p>
          <pre>
            VITE_SUPABASE_URL=https://your-project.supabase.co{'\n'}
            VITE_SUPABASE_ANON_KEY=your-public-anon-key
          </pre>
          <p className="config-small">
            Then run the SQL in <code>supabase/schema.sql</code>. Keep service-role keys and NVIDIA credentials on a backend only.
          </p>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
            Open Supabase dashboard <ArrowRight size={14} aria-hidden="true" />
          </a>
        </div>
      </main>
    );
  }

  if (busy && !session) {
    return (
      <main id="main-content" className="auth-loading" role="status">
        <div className="spinner" aria-hidden="true" />
        <span>Connecting securely…</span>
      </main>
    );
  }

  if (session && screen === 'dashboard' && profileReady && !editing) {
    return (
      <>
        <nav className="account-bar" aria-label="Account controls">
          <span>
            <CircleCheck size={15} aria-hidden="true" /> Signed in as {session.user.email}
          </span>
          <button type="button" onClick={() => { setEditing(true); setScreen('profile'); setStep(0); }}>
            Edit profile
          </button>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </nav>
        <Dashboard accessToken={session.access_token} />
      </>
    );
  }

  if (screen === 'reset-update' && session) {
    return (
      <main id="main-content" className="config-screen">
        <div className="config-card">
          <Brand className="auth-brand" />
          <div className="eyebrow">ACCOUNT SECURITY</div>
          <h1>Choose a new password</h1>
          <form className="auth-form" onSubmit={updatePassword}>
            <label>
              New password
              <div className="input-wrap">
                <LockKeyhole size={16} aria-hidden="true" />
                <input name="password" type="password" required autoComplete="new-password" placeholder="At least 10 characters" />
              </div>
            </label>
            <label>
              Confirm new password
              <div className="input-wrap">
                <LockKeyhole size={16} aria-hidden="true" />
                <input name="confirm" type="password" required autoComplete="new-password" placeholder="Enter it again" />
              </div>
            </label>
            <p className="config-small">Use 10+ characters with uppercase, lowercase, and a number.</p>
            <FormMessages error={error} notice={notice} />
            <button type="submit" className="primary-button auth-submit" disabled={busy}>
              {busy ? 'Updating…' : 'Update password'} <ArrowRight size={15} aria-hidden="true" />
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (screen === 'profile' && session) {
    return (
      <OnboardingWizard
        profile={profile}
        update={(key, value) => setProfile((prev) => ({ ...prev, [key]: value }))}
        onboardingData={onboardingData}
        step={step}
        setStep={setStep}
        editing={editing}
        busy={busy}
        error={error}
        notice={notice}
        resetMessage={resetMessage}
        continueOnboarding={continueOnboarding}
        saveProfile={saveProfile}
        deleteProfile={deleteProfile}
        signOut={signOut}
      />
    );
  }

  return (
    <div className="auth-site">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="auth-top">
        <Brand className="auth-brand" />
        <nav className="landing-nav" aria-label="Landing sections">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="landing-actions">
          <button type="button" className="quiet-button" onClick={() => { resetMessage(); setScreen('login'); }}>
            Login
          </button>
          <button type="button" className="primary-button" onClick={() => { resetMessage(); setScreen('signup'); }}>
            Get started <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {screen === 'welcome' ? (
          <LandingPage onGetStarted={() => { resetMessage(); setScreen('signup'); }} />
        ) : (
          <AuthPanel
            screen={screen}
            setScreen={setScreen}
            signIn={signIn}
            signInSocial={signInSocial}
            signUp={signUp}
            sendReset={sendReset}
            resendVerification={resendVerification}
            verificationEmail={verificationEmail}
            setVerificationEmail={setVerificationEmail}
            busy={busy}
            error={error}
            notice={notice}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            resetMessage={resetMessage}
          />
        )}
      </main>

      <footer className="landing-footer">
        <Brand className="auth-brand" />
        <span>Useful air information. Practical everyday choices.</span>
        <a href="https://www.who.int/health-topics/air-pollution" target="_blank" rel="noopener noreferrer">
          Air pollution guidance
        </a>
      </footer>
    </div>
  );
}
