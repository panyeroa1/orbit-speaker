
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import './WelcomeScreen.css';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { useSettings } from '../../../lib/state';

interface WelcomeScreenProps {
  onLaunch?: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onLaunch }) => {
  const { connect, connected } = useLiveAPIContext();

  const handleLaunch = async () => {
    if (onLaunch) {
      onLaunch();
    }
    if (!connected) {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
        }
      }
      connect().catch(console.error);
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="title-container">
          <span className="welcome-icon">graphic_eq</span>
          <div className="title-text">
            <h2>Neural Scribe</h2>
            <p className="subtitle">High-Fidelity Audio Capture</p>
          </div>
        </div>
        <p className="welcome-description">
          A high-performance neural engine for verbatim audio transcription. 
          Broadcasts real-time linguistic data to connected listeners and Supabase storage.
        </p>
        
        <button className="launch-button" onClick={handleLaunch}>
          <span className="material-symbols-outlined filled">sensors</span>
          <span>Start Scribe Session</span>
        </button>

        <div className="example-prompts-section">
          <h5 className="prompts-title">Capabilities</h5>
          <div className="example-prompts">
            <div className="prompt-card">
              Zero-latency verbatim capture using Gemini 2.5 Flash.
            </div>
            <div className="prompt-card">
              WebSocket & Supabase integration for session binding.
            </div>
            <div className="prompt-card">
              Neural speaker isolation and environmental noise rejection.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
