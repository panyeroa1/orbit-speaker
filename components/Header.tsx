
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { useSettings } from '../lib/state';

export default function Header() {
  const { meetingId } = useSettings();

  return (
    <header className="header-glass sticky-header header-minimal">
      <div className="header-brand">
        <span className="material-symbols-outlined brand-icon">description</span>
        <h2 className="brand-title">Neural Scribe</h2>
      </div>
      
      <div className="header-host-info">
        <div className="host-pill">
          <span className="material-symbols-outlined host-icon">record_voice_over</span>
          <div className="host-text-group">
            <span className="host-label">HOST SPEAKER</span>
            <span className="host-id">{meetingId || 'ISOLATED SESSION'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
