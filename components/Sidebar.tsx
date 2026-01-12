
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Participant, useSettings, useUI } from '../lib/state';
import c from 'classnames';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { useEffect, useState } from 'react';
import { upsertMeeting, registerParticipant, getMeetingParticipants } from '../lib/supabase';

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const { 
    voiceFocus, supabaseEnabled, meetingId, transcriptionMode, userName, userId, participants,
    setVoiceFocus, setSupabaseEnabled, setMeetingId, setTranscriptionMode, setUserName, setParticipants
  } = useSettings();
  const { connected } = useLiveAPIContext();
  
  const [copied, setCopied] = useState(false);

  // Sync Meeting & User to Supabase if enabled
  useEffect(() => {
    if (supabaseEnabled && meetingId) {
      // In Scribe mode, we just upsert the meeting ID as an active stream
      upsertMeeting(meetingId, 'Transcription Only');
      registerParticipant(meetingId, userId, userName);

      const interval = setInterval(async () => {
        const list = await getMeetingParticipants(meetingId);
        setParticipants(list as Participant[]);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [supabaseEnabled, meetingId, userId, userName, setParticipants]);

  const handleGenerateMeetingId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setMeetingId(id);
  };

  const handleCopyMeetingId = () => {
    if (!meetingId) return;
    navigator.clipboard.writeText(meetingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearId = () => {
    setMeetingId('');
  };

  return (
    <aside className={c('sidebar', { open: isSidebarOpen })}>
      <div className="sidebar-header">
        <div className="sidebar-title-group">
          <span className="material-symbols-outlined sidebar-icon">settings</span>
          <h3>Scribe Settings</h3>
        </div>
        <button onClick={toggleSidebar} className="sidebar-close-btn" aria-label="Close">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <header className="section-header">
            <span className="material-symbols-outlined">account_circle</span>
            <h4>User Profile</h4>
          </header>
          <div className="settings-card">
            <div className="setting-row vertical">
              <label className="setting-label">Source Display Name</label>
              <input 
                type="text" 
                value={userName} 
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name..."
                className="minimal-input"
              />
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <header className="section-header">
            <span className="material-symbols-outlined">hub</span>
            <h4>Session Binding</h4>
          </header>
          
          <div className="settings-card">
            <div className="setting-row vertical">
              <div className="setting-info">
                <label className="setting-label">Scribe ID</label>
                <p className="setting-desc">Used by listeners to sync transcription</p>
              </div>
              <div className="meeting-id-controls">
                <div className="meeting-id-display">
                  {meetingId || 'STANDALONE MODE'}
                </div>
                <div className="meeting-id-actions">
                  <button className="id-btn" onClick={handleGenerateMeetingId} title="Generate New ID">
                    <span className="material-symbols-outlined">refresh</span>
                  </button>
                  <button className="id-btn" onClick={handleCopyMeetingId} disabled={!meetingId} title="Copy ID">
                    <span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>
                  </button>
                  <button className="id-btn danger" onClick={handleClearId} disabled={!meetingId} title="End Session">
                    <span className="material-symbols-outlined">power_settings_new</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {participants.length > 0 && (
          <div className="sidebar-section">
            <header className="section-header">
              <span className="material-symbols-outlined">group</span>
              <h4>Listeners ({participants.length})</h4>
            </header>
            <div className="participants-list">
              {participants.map(p => (
                <div key={p.user_id} className="participant-item">
                  <span className="p-name">{p.user_name}</span>
                  <span className="p-status">Online</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-section">
          <header className="section-header">
            <span className="material-symbols-outlined">analytics</span>
            <h4>Intelligence Settings</h4>
          </header>
          
          <div className="settings-card">
            <div className="setting-row">
              <div className="setting-info">
                <label className="setting-label">Voice Focus</label>
                <p className="setting-desc">Speaker Isolation</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={voiceFocus}
                  onChange={(e) => setVoiceFocus(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <label className="setting-label">Supabase Sync</label>
                <p className="setting-desc">Persist Verbatim History</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={supabaseEnabled}
                  onChange={(e) => setSupabaseEnabled(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div className="sidebar-footer">
        <div className="footer-status">
          <div className="status-label-group">
            <div className={c('status-light', { connected })} />
            <span className="status-indicator">
              {connected ? 'SCRIBING' : 'IDLE'}
            </span>
          </div>
          <span className="version-text">v6.0.0 [EBURON.AI]</span>
        </div>
      </div>
    </aside>
  );
}
