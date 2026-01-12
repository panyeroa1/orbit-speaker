
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import cn from 'classnames';
import React, { memo, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';
import { useUI, useSettings } from '../../../lib/state';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';

const MiniVisualizer = memo(({ volume, active }: { volume: number; active: boolean }) => {
  const bars = 4;
  if (!active || volume < 0.005) return null;

  return (
    <div className="mini-viz success">
      {Array.from({ length: bars }).map((_, i) => (
        <div 
          key={i} 
          className="mini-bar" 
          style={{ 
            height: `${Math.max(2, volume * 55 * (0.65 + Math.random() * 0.35))}px`,
            transition: 'height 0.04s ease-out'
          }} 
        />
      ))}
    </div>
  );
});

function ControlTray() {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const { client, connected, connect, disconnect, setInputVolume, inputVolume } = useLiveAPIContext();
  const { toggleSidebar, isSidebarOpen } = useUI();
  const { voiceFocus, setVoiceFocus } = useSettings();

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([{
        mimeType: 'audio/pcm;rate=16000',
        data: base64,
      }]);
    };

    const onVolume = (v: number) => {
      if (connected && !muted) {
        setInputVolume(v);
      } else {
        setInputVolume(0);
      }
    };

    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData);
      audioRecorder.on('volume', onVolume);
      audioRecorder.start();
    } else {
      audioRecorder.stop();
      setInputVolume(0);
    }
    return () => {
      audioRecorder.off('data', onData);
      audioRecorder.off('volume', onVolume);
    };
  }, [connected, client, muted, audioRecorder, setInputVolume]);

  const handleMicClick = () => {
    if (connected) {
      setMuted(!muted);
    } else {
      connect();
    }
  };

  const showMicViz = connected && !muted;

  return (
    <section className="control-tray-floating">
      <div className="control-tray-content">
        <div className={cn('floating-pill', { 'focus-active': connected })}>
          <button className={cn('icon-button', { active: isSidebarOpen })} onClick={toggleSidebar}>
            <span className="material-symbols-outlined">settings</span>
          </button>

          <button className={cn('icon-button', { active: voiceFocus })} onClick={() => setVoiceFocus(!voiceFocus)}>
            <span className="material-symbols-outlined">
              {voiceFocus ? 'center_focus_strong' : 'center_focus_weak'}
            </span>
          </button>

          <button 
            className={cn('icon-button relative-btn', { 
              active: !muted && connected, 
              muted: muted && connected
            })} 
            onClick={handleMicClick}
          >
            <MiniVisualizer volume={inputVolume} active={showMicViz} />
            <span className={cn('material-symbols-outlined', { 'filled': !muted && connected })}>
              {muted || !connected ? 'mic_off' : 'mic'}
            </span>
          </button>

          <button className={cn('icon-button main-action', { connected })} onClick={connected ? disconnect : connect}>
            <span className="material-symbols-outlined filled">
              {connected ? 'stop' : 'play_arrow'}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

export default memo(ControlTray);
