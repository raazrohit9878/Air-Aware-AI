import React from 'react';
import { Check } from 'lucide-react';

/**
 * Numbered section header for each onboarding wizard step.
 */
export function StepHead({ n, title, desc }) {
  return (
    <div className="step-head">
      <span>{n}</span>
      <div>
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
    </div>
  );
}

/**
 * Labeled text, number, or select field used in onboarding forms.
 */
export function Field({ label, value, onChange, placeholder, type = 'text', required, select, allowEmpty, options }) {
  return (
    <label className="onboard-field">
      <span>
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      {select ? (
        <select value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
          {allowEmpty && <option value="">Not provided</option>}
          {options.map((option) => (
            <option key={option} value={option === 'Prefer not to say' ? '' : option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          min={type === 'number' ? 1 : undefined}
          step={type === 'number' ? 1 : undefined}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
        />
      )}
    </label>
  );
}

/**
 * Single-select button grid with aria-pressed state.
 */
export function ChoiceGrid({ value, onChange, options }) {
  return (
    <div className="profile-choices" role="group" aria-label="Household type">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          className={value === option ? 'selected' : ''}
          onClick={() => onChange(option)}
        >
          <span aria-hidden="true">
            {value === option ? <Check size={14} /> : <span className="choice-radio" />}
          </span>
          {option}
        </button>
      ))}
    </div>
  );
}

/**
 * Accessible checkbox row for household facility availability.
 */
export function Facility({ title, value, onChange }) {
  return (
    <label className="facility-row">
      <span>
        <span className={`facility-check ${value ? 'checked' : ''}`} aria-hidden="true">
          {value && <Check size={13} />}
        </span>
        {title}
      </span>
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

/**
 * Summary block for the onboarding review step.
 */
export function ReviewSection({ title, items }) {
  return (
    <section className="review-section">
      <h3>{title}</h3>
      <div className="review-grid">
        {items.map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value ?? 'Not provided'}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function yesNo(value) {
  return value ? 'Yes' : 'No';
}
