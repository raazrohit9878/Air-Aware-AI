import React from 'react';
import { Wind } from 'lucide-react';

/**
 * Render the AirAware AI brand mark and wordmark.
 */
export default function Brand({ className = '' }) {
  return (
    <div className={`brand ${className}`.trim()}>
      <div className="brand-mark" aria-hidden="true">
        <Wind size={19} />
      </div>
      <span>
        airaware<span className="brand-ai">AI</span>
      </span>
    </div>
  );
}
