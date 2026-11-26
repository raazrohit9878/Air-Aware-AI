// These options are shared across onboarding, the dashboard household form, and validation.
export const AGE_RANGE_OPTIONS = [
  'Prefer not to say',
  'Under 18',
  '18–24',
  '25–34',
  '35–44',
  '45–64',
  '65+',
];

export const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Kannada'];

export const HOUSEHOLD_TYPE_OPTIONS = [
  'Individual',
  'Family with children',
  'Family with senior citizens',
  'Working professional',
  'Student',
  'Other',
];

export const SENSITIVITY_OPTIONS = [
  { label: 'Respiratory sensitivity', column: 'respiratory_sensitivity' },
  { label: 'Asthma-related concerns', column: 'asthma_concerns' },
  { label: 'Allergies', column: 'allergies' },
  { label: 'Other air-pollution sensitivity', column: 'other_air_pollution_sensitivity' },
];

export const COMMUTE_OPTIONS = [
  'Private car',
  'Two-wheeler',
  'Public transportation',
  'Walking',
  'Cycling',
  'Work from home',
  'Mixed / varies',
];

export const OUTDOOR_ACTIVITY_TIME_OPTIONS = [
  'Morning',
  'Afternoon',
  'Evening',
  'Varies',
  'Rarely outdoors',
];

export const BUDGET_OPTIONS = [
  'Low cost first',
  'No extra budget',
  'Some flexibility',
  'Can invest in equipment',
];
