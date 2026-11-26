import React from 'react';
import { getSupabaseSqlEditorUrl } from '../airQualityUtils.js';

function readViteSupabaseUrl() {
  return (import.meta.env || {}).VITE_SUPABASE_URL || '';
}

function ErrorNotice({ message }) {
  const sectionTable =
    /(household|sensitivity|lifestyle|home)_profiles/i.test(message) &&
    /PGRST205|could not find (the )?table/i.test(message);
  const sectionColumn =
    /(household|sensitivity|lifestyle|home)_profiles/i.test(message) &&
    /could not find .*column|column\s+(household|sensitivity|lifestyle|home)_profiles\.[a-z_]+\s+does not exist/i.test(
      message,
    );
  const missingProfileTable =
    /PGRST205/i.test(message) ||
    (/could not find (the )?table/i.test(message) &&
      /public\.user_profiles/i.test(message) &&
      /schema cache/i.test(message));
  const missingProfileColumn =
    /could not find .*column.*user_profiles.*schema cache/i.test(message) ||
    /column\s+user_profiles\.[a-z_]+\s+does not exist/i.test(message);

  if (!sectionTable && !sectionColumn && !missingProfileTable && !missingProfileColumn) {
    return (
      <div className="auth-alert error" role="alert">
        {message}
      </div>
    );
  }

  const sectionIssue = sectionTable || sectionColumn;
  const missingTable = sectionTable || missingProfileTable;
  const file = sectionIssue
    ? 'supabase/onboarding-sections.sql'
    : missingTable
      ? 'supabase/schema.sql'
      : 'supabase/upgrade-user-profiles.sql';
  const sqlEditorUrl = getSupabaseSqlEditorUrl(readViteSupabaseUrl());

  return (
    <div className="auth-alert error" role="alert">
      <strong>
        {sectionIssue
          ? sectionTable
            ? 'Supabase onboarding table is missing.'
            : 'Supabase onboarding table needs an update.'
          : missingTable
            ? 'Supabase profile table is missing.'
            : 'Supabase profile table needs an update.'}
      </strong>
      <p>
        {sectionIssue
          ? 'Run supabase/onboarding-sections.sql in this project’s SQL Editor.'
          : missingTable
            ? 'Run supabase/schema.sql in this project’s SQL Editor.'
            : 'Run supabase/upgrade-user-profiles.sql in this project’s SQL Editor.'}{' '}
        Then reload this page.
      </p>
      <a href={sqlEditorUrl} target="_blank" rel="noopener noreferrer">
        Open this project’s SQL Editor
      </a>
      <span className="schema-file-hint">SQL file: {file}</span>
      <button type="button" onClick={() => window.location.reload()}>
        Reload after running SQL
      </button>
    </div>
  );
}

/**
 * Render form error and status alerts with helpful Supabase migration guidance.
 */
export default function FormMessages({ error, notice }) {
  return (
    <>
      {error && <ErrorNotice message={error} />}
      {notice && (
        <div className="auth-alert success" role="status">
          {notice}
        </div>
      )}
    </>
  );
}
