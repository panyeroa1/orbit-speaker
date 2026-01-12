
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import './PopUp.css';

interface PopUpProps {
  onClose: () => void;
}

const PopUp: React.FC<PopUpProps> = ({ onClose }) => {
  return (
    <div className="popup-overlay">
      <div className="popup-content onboarding-card">
        <div className="onboarding-header">
          <span className="material-symbols-outlined brand-icon">graphic_eq</span>
          <h2>Neural Scribe</h2>
          <p className="subtitle">High-Fidelity Neural Capture</p>
        </div>
        
        <div className="onboarding-steps">
          <div className="step-item">
            <div className="step-icon">
              <span className="material-symbols-outlined">sensors</span>
            </div>
            <div className="step-text">
              <h3>Source Broadcast</h3>
              <p>Bind your session with a Scribe ID to broadcast verbatim transcription to remote listeners.</p>
            </div>
          </div>

          <div className="step-item">
            <div className="step-icon accent">
              <span className="material-symbols-outlined">bolt</span>
            </div>
            <div className="step-text">
              <h3>Connect Engine</h3>
              <p>Ignite the neural link to begin real-time verbatim capture. Your audio remains private and processed in-stream.</p>
            </div>
          </div>

          <div className="step-item">
            <div className="step-icon">
              <span className="material-symbols-outlined">verbatim</span>
            </div>
            <div className="step-text">
              <h3>Verbatim Precision</h3>
              <p>The engine ignores filler words and captures core linguistic data with ultra-high fidelity.</p>
            </div>
          </div>

          <div className="step-item">
            <div className="step-icon">
              <span className="material-symbols-outlined">cloud_sync</span>
            </div>
            <div className="step-text">
              <h3>Cloud Persistence</h3>
              <p>Enable Supabase sync in the sidebar to permanently archive your transcription history.</p>
            </div>
          </div>
        </div>

        <div className="onboarding-footer">
          <button className="primary-onboarding-btn" onClick={onClose}>
            Initialize Scribe
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopUp;
