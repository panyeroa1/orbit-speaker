
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import cn from 'classnames';
import React, { memo, useEffect, useRef, useState } from 'react';
import { AudioRecorder, TuningData } from '../../../lib/audio-recorder';
import { useUI, useSettings } from '../../../lib/state';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { wsService } from '../../../lib/websocket-service';

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
  const { client, connected, connect, disconnect, setInputVolume, inputVolume, tuningData } = useLiveAPIContext();
  const { toggleSidebar, isSidebarOpen } = useUI();
  const { voiceFocus, transcriptionMode, setVoiceFocus } = useSettings();
  
  const recognitionRef = useRef<any>(null);
  const [isNativeTranscribing, setIsNativeTranscribing] = useState(false);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const transcript = finalTranscript || interimTranscript;
        if (transcript.trim()) {
          wsService.sendPrompt({ 
            type: 'transcription', 
            text: transcript, 
            isFinal: !!finalTranscript,
            source: 'native' 
          });
        }
      };

      recognition.onend = () => {
        if (isNativeTranscribing) {
          recognition.start();
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isNativeTranscribing]);

  useEffect(() => {
    if (transcriptionMode !== 'neural') {
       audioRecorder.stop();
       return;
    }

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

    const onTuning = (data: TuningData) => {
      // Logic for capturing tuning data handled via context hook subscription
    };

    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData);
      audioRecorder.on('volume', onVolume);
      
      // Hook the tuning data into the context-aware hook proxy (implemented in use-live-api)
      // Since useLiveApi returns the state, we can hack a quick subscription here if needed,
      // but the useLiveApi hook already manages the instance logic in some builds.
      // Here, we'll manually bridge it for consistency.
      (client as any)._audioRecorder = audioRecorder; 

      audioRecorder.start();
    } else {
      audioRecorder.stop();
      setInputVolume(0);
    }
    return () => {
      audioRecorder.off('data', onData);
      audioRecorder.off('volume', onVolume);
    };
  }, [connected, client, muted, audioRecorder, setInputVolume, transcriptionMode]);

  const handleMicClick = () => {
    if (transcriptionMode === 'native') {
      if (isNativeTranscribing) {
        recognitionRef.current?.stop();
        setIsNativeTranscribing(false);
      } else {
        recognitionRef.current?.start();
        setIsNativeTranscribing(true);
      }
      return;
    }

    if (connected) {
      setMuted(!muted);
    } else {
      connect();
    }
  };

  const showMicViz = (transcriptionMode === 'neural' && connected && !muted) || (transcriptionMode === 'native' && isNativeTranscribing);

  return (
    <section className="control-tray-floating">
      <div className="control-tray-content">
        <div className={cn('floating-pill', { 'focus-active': connected || isNativeTranscribing })}>
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
              active: showMicViz, 
              muted: (muted && connected) || (!isNativeTranscribing && transcriptionMode === 'native')
            })} 
            onClick={handleMicClick}
          >
            <MiniVisualizer volume={inputVolume || (isNativeTranscribing ? 0.2 : 0)} active={showMicViz} />
            <span className={cn('material-symbols-outlined', { 'filled': showMicViz })}>
              {showMicViz ? 'mic' : 'mic_off'}
            </span>
          </button>

          {transcriptionMode === 'neural' && (
            <button className={cn('icon-button main-action', { connected })} onClick={connected ? disconnect : connect}>
              <span className="material-symbols-outlined filled">
                {connected ? 'stop' : 'play_arrow'}
              </span>
            </button>
          )}
          
          {transcriptionMode === 'native' && (
            <div className="native-indicator">
              <span className="native-label">NATIVE API</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default memo(ControlTray);
