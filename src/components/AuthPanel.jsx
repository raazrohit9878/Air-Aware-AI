import React from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Shield, Wind } from 'lucide-react';
import FormMessages from './FormMessages.jsx';

const AUTH_COPY = {
  login: {
    title: 'Welcome back.',
    subtitle: 'Sign in to see your household’s air-aware plan.',
    eyebrow: 'AIRAWARE AI',
  },
  signup: {
    title: 'Create your account.',
    subtitle: 'Your personalized air-quality guide starts here.',
    eyebrow: 'START WITH A CLEARER PICTURE',
  },
  reset: {
    title: 'Reset your password.',
    subtitle: 'Enter the email address associated with your account.',
    eyebrow: 'AIRAWARE AI',
  },
  verify: {
    title: 'Check your inbox.',
    subtitle: 'Follow the verification link in your email, then sign in to continue.',
    eyebrow: 'AIRAWARE AI',
  },
};

function SocialButtons({ onSocial, busy }) {
  return (
    <div className="social-buttons">
      <button type="button" disabled={busy} onClick={() => onSocial('google')}>
        <span className="social-g" aria-hidden="true">G</span>Google
      </button>
      <button type="button" disabled={busy} onClick={() => onSocial('twitter')}>
        <span className="social-x" aria-hidden="true">X</span>X / Twitter
      </button>
      <button type="button" disabled={busy} onClick={() => onSocial('github')}>
        <span className="social-gh" aria-hidden="true">GH</span>GitHub
      </button>
    </div>
  );
}

/**
 * Authentication panel handling login, signup, password reset, and email verification.
 */
export default function AuthPanel({
  screen,
  setScreen,
  signIn,
  signInSocial,
  signUp,
  sendReset,
  resendVerification,
  verificationEmail,
  setVerificationEmail,
  busy,
  error,
  notice,
  showPassword,
  setShowPassword,
  resetMessage,
}) {
  const copy = AUTH_COPY[screen] || AUTH_COPY.verify;
  const goTo = (target) => {
    resetMessage();
    setScreen(target);
  };

  return (
    <section className="auth-panel-wrap">
      <div className="auth-panel">
        <button type="button" className="back-to-home" onClick={() => goTo('welcome')}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to home
        </button>
        <div className="auth-panel-brand" aria-hidden="true">
          <Wind size={19} />
        </div>
        <div className="eyebrow">{copy.eyebrow}</div>
        <h1>{copy.title}</h1>
        <p className="auth-subtitle">{copy.subtitle}</p>

        {screen === 'login' && (
          <>
            <div className="social-login">
              <SocialButtons onSocial={signInSocial} busy={busy} />
              <div className="auth-divider">
                <span />or continue with email<span />
              </div>
            </div>
            <form onSubmit={signIn} className="auth-form">
              <label>
                Email address
                <div className="input-wrap">
                  <Mail size={16} aria-hidden="true" />
                  <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
                </div>
              </label>
              <label>
                Password
                <div className="input-wrap">
                  <LockKeyhole size={16} aria-hidden="true" />
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
              </label>
              <button type="button" className="forgot-link" onClick={() => goTo('reset')}>
                Forgot password?
              </button>
              <FormMessages error={error} notice={notice} />
              <button type="submit" disabled={busy} className="primary-button auth-submit">
                {busy ? 'Signing in…' : 'Login'} <ArrowRight size={15} aria-hidden="true" />
              </button>
              <div className="auth-switch">
                New to AirAware?{' '}
                <button type="button" onClick={() => goTo('signup')}>
                  Create an account
                </button>
              </div>
            </form>
          </>
        )}

        {screen === 'signup' && (
          <>
            <div className="social-login">
              <SocialButtons onSocial={signInSocial} busy={busy} />
              <div className="auth-divider">
                <span />or sign up with email<span />
              </div>
            </div>
            <form onSubmit={signUp} className="auth-form">
              <label>
                Full name
                <div className="input-wrap">
                  <input name="name" required autoComplete="name" placeholder="Your full name" />
                </div>
              </label>
              <label>
                Email address
                <div className="input-wrap">
                  <Mail size={16} aria-hidden="true" />
                  <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
                </div>
              </label>
              <label>
                Password
                <div className="input-wrap">
                  <LockKeyhole size={16} aria-hidden="true" />
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="At least 10 characters"
                    aria-describedby="password-requirements"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
                <small id="password-requirements" className="field-hint">
                  Use 10+ characters with uppercase, lowercase, and a number.
                </small>
              </label>
              <label>
                Confirm password
                <div className="input-wrap">
                  <LockKeyhole size={16} aria-hidden="true" />
                  <input
                    name="confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                  />
                </div>
              </label>
              <label className="terms-row">
                <input name="terms" type="checkbox" />
                <span>
                  I accept the <a href="#privacy-summary">Privacy Policy</a> and <a href="#terms-summary">Terms of Use</a>.
                </span>
              </label>
              <details id="privacy-summary" className="terms-details">
                <summary>Privacy &amp; Terms summary</summary>
                <p id="terms-summary">
                  Profile and sensitivity details are stored under per-user Row Level Security in Supabase and used only
                  to tailor general air-quality guidance. AirAware provides informational planning tips, not medical
                  advice.
                </p>
              </details>
              <FormMessages error={error} notice={notice} />
              <button type="submit" disabled={busy} className="primary-button auth-submit">
                {busy ? 'Creating account…' : 'Create account'} <ArrowRight size={15} aria-hidden="true" />
              </button>
              <div className="auth-switch">
                Already registered?{' '}
                <button type="button" onClick={() => goTo('login')}>
                  Login
                </button>
              </div>
            </form>
          </>
        )}

        {screen === 'reset' && (
          <form onSubmit={sendReset} className="auth-form">
            <label>
              Email address
              <div className="input-wrap">
                <Mail size={16} aria-hidden="true" />
                <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
              </div>
            </label>
            <FormMessages error={error} notice={notice} />
            <button type="submit" disabled={busy} className="primary-button auth-submit">
              {busy ? 'Sending…' : 'Send reset link'} <ArrowRight size={15} aria-hidden="true" />
            </button>
            <div className="auth-switch">
              <button type="button" onClick={() => goTo('login')}>
                Return to login
              </button>
            </div>
          </form>
        )}

        {screen === 'verify' && (
          <div className="verify-state">
            <div aria-hidden="true">
              <Mail size={23} />
            </div>
            <FormMessages error={error} notice={notice} />
            <form onSubmit={resendVerification} className="auth-form">
              <label>
                Email address
                <div className="input-wrap">
                  <Mail size={16} aria-hidden="true" />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={verificationEmail}
                    onChange={(event) => setVerificationEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </label>
              <button type="submit" disabled={busy} className="primary-button auth-submit">
                {busy ? 'Sending…' : 'Resend verification link'} <ArrowRight size={15} aria-hidden="true" />
              </button>
            </form>
            <button type="button" className="quiet-button" onClick={() => goTo('login')}>
              Continue to login
            </button>
          </div>
        )}

        <div className="auth-security">
          <Shield size={14} aria-hidden="true" /> Secure account access powered by Supabase Auth
        </div>
      </div>

      <div className="auth-side-visual" aria-hidden="true">
        <div className="auth-orb orb-one" />
        <div className="auth-orb orb-two" />
        <div className="auth-side-copy">
          <div className="auth-side-icon">
            <Wind size={20} />
          </div>
          <span>THE AIR AROUND US</span>
          <h2>
            Small choices.
            <br />
            <em>Meaningful change.</em>
          </h2>
          <p>Understand your air, care for your home, and find the next step that works for you.</p>
        </div>
        <div className="auth-side-illustration">
          <div className="side-building s-build-a" />
          <div className="side-building s-build-b" />
          <div className="side-tree st-a" />
          <div className="side-tree st-b" />
          <div className="side-tree st-c" />
        </div>
      </div>
    </section>
  );
}
