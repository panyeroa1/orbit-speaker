
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef, useState } from 'react';
import cn from 'classnames';
import { Modality, LiveConnectConfig, LiveServerToolCall } from '@google/genai';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { logToSupabase } from '../../../lib/supabase';
import { wsService } from '../../../lib/websocket-service';
import {
  useSettings,
  useLogStore,
  useTools,
} from '../../../lib/state';

const NeuralDiagnosticPill = ({ volume, tuningData }: { volume: number, tuningData: any }) => {
  if (!tuningData) return null;
  const { noiseFloor, gain, isSpeaking } = tuningData;
  const noisePercent = Math.min(100, (noiseFloor / 0.05) * 100);
  const gainValue = gain.toFixed(1);
  const signalToNoise = (volume / (noiseFloor + 0.0001)).toFixed(1);

  return (
    <div className="neural-diag-overlay">
      <div className="diag-item">
        <span className="diag-label">GAIN</span>
        <span className="diag-val">+{gainValue}x</span>
      </div>
      <div className="diag-item">
        <span className="diag-label">NOISE</span>
        <div className="diag-bar-bg">
          <div className="diag-bar-fill" style={{ width: `${noisePercent}%`, backgroundColor: noisePercent > 60 ? 'var(--danger)' : 'var(--accent)' }} />
        </div>
      </div>
      <div className="diag-item">
        <span className="diag-label">SNR</span>
        <span className={cn("diag-val", { active: isSpeaking })}>{signalToNoise}</span>
      </div>
    </div>
  );
}

export default function StreamingConsole() {
  const { client, setConfig, connected, inputVolume, tuningData } = useLiveAPIContext();
  const { systemPrompt, supabaseEnabled, userName } = useSettings();
  const { tools } = useTools();
  const { turns, addTurn, sessionId } = useLogStore();
  
  const [sourceSegments, setSourceSegments] = useState<string[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [latencyWarning, setLatencyWarning] = useState(false);
  
  const clearTimeoutsRef = useRef<{ input?: number }>({});
  const lastActivityRef = useRef<number>(Date.now());
  const historyBottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastUserTextRef = useRef<string | null>(null);

  const handleSourceInput = (text: string) => {
    handleActivity();
    setIsFinalizing(false);

    setSourceSegments(prev => {
      const last = prev[prev.length - 1];
      if (last && text.startsWith(last)) {
        const newArr = [...prev];
        newArr[newArr.length - 1] = text;
        return newArr;
      }
      return [...prev, text].slice(-3); 
    });
    
    lastUserTextRef.current = text;

    if (clearTimeoutsRef.current.input) window.clearTimeout(clearTimeoutsRef.current.input);
    clearTimeoutsRef.current.input = window.setTimeout(() => {
      if (lastUserTextRef.current === text) {
         handleTurnComplete();
      }
    }, 4000);
  };

  const handleActivity = () => {
    lastActivityRef.current = Date.now();
  };

  useEffect(() => {
    const scrollToBottom = () => {
      if (historyBottomRef.current) {
        historyBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    };
    const frameId = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(frameId);
  }, [turns]);

  useEffect(() => {
    if (!connected) {
      setLatencyWarning(false);
      return;
    }
    const interval = setInterval(() => {
      const isSpeaking = inputVolume > 0.08;
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (isSpeaking && timeSinceLastActivity > 4000) {
        setLatencyWarning(true);
      } else if (timeSinceLastActivity < 1000) {
        setLatencyWarning(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [connected, inputVolume]);

  useEffect(() => {
    if (!connected) {
      setDetectedLanguage(null);
      setSourceSegments([]);
      setIsFinalizing(false);
    }
  }, [connected]);

  useEffect(() => {
    const activeTools = tools.filter(t => t.isEnabled);
    const config: LiveConnectConfig = {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' },
        },
      },
      systemInstruction: systemPrompt,
      tools: activeTools.length > 0 ? [{ 
        functionDeclarations: activeTools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        })) 
      }] : undefined
    };
    setConfig(config);
  }, [setConfig, systemPrompt, tools]);

  const handleToolCall = (toolCall: LiveServerToolCall) => {
    handleActivity();
    for (const fc of toolCall.functionCalls) {
      if (fc.name === 'report_detected_language') {
        setDetectedLanguage((fc.args as any).language);
      }
    }
  };

  const handleTurnComplete = () => {
    handleActivity();
    if (lastUserTextRef.current) {
      const finalSource = lastUserTextRef.current;
      setIsFinalizing(true);

      setTimeout(() => {
        addTurn({ 
           role: 'user', 
           text: finalSource, 
           userName: userName,
           isFinal: true 
        });

        if (supabaseEnabled) {
          logToSupabase({
            session_id: sessionId,
            user_text: finalSource,
            agent_text: "[Source Stream Only]",
            language: detectedLanguage || "Unknown",
            user_name: userName
          });
        }

        setSourceSegments([]);
        setIsFinalizing(false);
        lastUserTextRef.current = null;
      }, 500); 
    }
  };

  useEffect(() => {
    const onInputTrans = (text: string) => handleSourceInput(text);
    client.on('inputTranscription', onInputTrans);
    client.on('audio', handleActivity);
    client.on('toolcall', handleToolCall);
    client.on('turncomplete', handleTurnComplete);
    return () => {
      client.off('inputTranscription', onInputTrans);
      client.off('audio', handleActivity);
      client.off('toolcall', handleToolCall);
      client.off('turncomplete', handleTurnComplete);
    };
  }, [client, sessionId, supabaseEnabled, addTurn, detectedLanguage, userName]);

  const sourceText = sourceSegments.join(' ');

  return (
    <div className="streaming-console-v3">
      <section className="console-box live-stage-box">
        <header className="box-header">
          <div className="header-group">
            <span className="material-symbols-outlined box-icon">graphic_eq</span>
            <h3>Neural Capture</h3>
          </div>
          <div className="header-status-group">
            {detectedLanguage && <div className="target-lang-pill">{detectedLanguage.toUpperCase()}</div>}
            {latencyWarning && (
              <div className="latency-warning-pill">
                <span className="material-symbols-outlined">bolt</span>
                <span>CAPTURING</span>
              </div>
            )}
            <div className={cn("status-dot", { connected: connected })}></div>
          </div>
        </header>
        
        <div className="box-content live-input-field-area">
          <div className="live-text-area">
             {/* Verbatim Stream */}
             <div className={cn("live-result translate-output scribe-primary", { "has-content": sourceText.length > 0 })}>
                {sourceText.split(' ').map((word, idx) => (
                  <span key={idx} className="animate-word">{word} </span>
                ))}
                {!isFinalizing && connected && <span className="blinking-cursor active"></span>}
             </div>

             {!sourceText && connected && !isFinalizing && (
               <div className="ready-placeholder">Listening for audio source...</div>
             )}
          </div>

          {connected && <NeuralDiagnosticPill volume={inputVolume} tuningData={tuningData} />}
        </div>
      </section>

      <section className="console-box history-box">
        <header className="box-header">
          <div className="header-group">
            <span className="material-symbols-outlined box-icon">history</span>
            <h3>Transcription Log</h3>
          </div>
        </header>

        <div className="box-content archive-scroll" ref={scrollContainerRef}>
          <div className="archive-list">
            {turns.length === 0 ? (
              <div className="archive-empty">Historical captures will be indexed here...</div>
            ) : (
              turns.map((turn, i) => (
                <div key={i} className={cn("archive-turn-v2 animate-fall", turn.role)}>
                  <div className="turn-header">
                    <span className="role-badge">VERBATIM</span>
                    <span className="turn-name">{turn.userName}</span>
                    <span className="turn-time">{turn.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <div className="turn-content translation-text scribe-archive">{turn.text}</div>
                </div>
              ))
            )}
            <div ref={historyBottomRef} className="scroll-anchor" />
          </div>
        </div>
      </section>
    </div>
  );
}
