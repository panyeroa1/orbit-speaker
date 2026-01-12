
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef, useState } from 'react';
import cn from 'classnames';
import { Modality, LiveConnectConfig, LiveServerToolCall } from '@google/genai';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { logToSupabase } from '../../../lib/supabase';
import {
  useSettings,
  useLogStore,
  useTools,
} from '../../../lib/state';

export default function StreamingConsole() {
  const { client, setConfig, connected } = useLiveAPIContext();
  const { systemPrompt, supabaseEnabled, sessionId } = useSettings();
  const { tools } = useTools();
  const { turns, addTurn } = useLogStore();
  
  const [transcriptionSegments, setTranscriptionSegments] = useState<string[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  
  const clearTimeoutsRef = useRef<{ input?: number }>({});
  const historyBottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastUserTextRef = useRef<string | null>(null);

  // Robust Auto-Scroll Logic
  useEffect(() => {
    const scrollToBottom = () => {
      if (historyBottomRef.current) {
        historyBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    };

    // Use requestAnimationFrame to ensure the DOM has finished painting the new turn
    const frameId = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(frameId);
  }, [turns]);

  useEffect(() => {
    if (!connected) {
      setDetectedLanguage(null);
      setTranscriptionSegments([]);
      setIsFinalizing(false);
    }
  }, [connected]);

  useEffect(() => {
    const activeTools = tools.filter(t => t.isEnabled);
    
    const config: LiveConnectConfig = {
      responseModalities: [Modality.AUDIO], // FIXED: Typo 'responseModalalities' -> 'responseModalities'
      inputAudioTranscription: {},
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' },
        },
      },
      systemInstruction: systemPrompt || 'You are a professional scribe.',
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

  useEffect(() => {
    const handleInputTranscription = (text: string) => {
      setIsFinalizing(false);

      setTranscriptionSegments(prev => {
        const last = prev[prev.length - 1];
        if (last && text.startsWith(last)) {
          const newArr = [...prev];
          newArr[newArr.length - 1] = text;
          return newArr;
        }
        return [...prev, text].slice(-2); 
      });
      
      lastUserTextRef.current = text;
      
      if (clearTimeoutsRef.current.input) window.clearTimeout(clearTimeoutsRef.current.input);
      clearTimeoutsRef.current.input = window.setTimeout(() => {
        if (lastUserTextRef.current === text) {
           handleTurnComplete();
        }
      }, 5000);
    };

    const handleToolCall = (toolCall: LiveServerToolCall) => {
      for (const fc of toolCall.functionCalls) {
        if (fc.name === 'report_detected_language') {
          const lang = (fc.args as any).language;
          if (lang) {
            setDetectedLanguage(lang);
          }
        }
      }
    };

    const handleTurnComplete = () => {
      if (lastUserTextRef.current) {
        const finalContent = lastUserTextRef.current;
        setIsFinalizing(true);

        // Animation duration for descent is ~500ms
        setTimeout(() => {
          addTurn({ 
             role: 'user', 
             text: finalContent, 
             isFinal: true 
          });

          if (supabaseEnabled) {
            logToSupabase({
              session_id: sessionId,
              user_text: finalContent,
              agent_text: "[Log Only]",
              language: detectedLanguage || "Unknown"
            });
          }

          setTranscriptionSegments([]);
          setIsFinalizing(false);
          lastUserTextRef.current = null;
        }, 500); 
      }
    };

    client.on('inputTranscription', handleInputTranscription);
    client.on('toolcall', handleToolCall);
    client.on('turncomplete', handleTurnComplete);

    return () => {
      client.off('inputTranscription', handleInputTranscription);
      client.off('toolcall', handleToolCall);
      client.off('turncomplete', handleTurnComplete);
    };
  }, [client, sessionId, supabaseEnabled, addTurn, detectedLanguage]);

  const transcriptionText = transcriptionSegments.join(' ');
  const words = transcriptionText.split(' ').filter(w => w.length > 0);
  
  // Sentence detection logic: 1-2 sentences reached based on punctuation
  const sentenceCount = (transcriptionText.match(/[.!?]/g) || []).length;
  const hasReachedGoal = sentenceCount >= 1;

  return (
    <div className="streaming-console-v3">
      {/* 
          TRANSCRIPTION BOX 
      */}
      <section className="console-box live-stage-box">
        <header className="box-header">
          <div className="header-group">
            <span className="material-symbols-outlined box-icon">stream</span>
            <h3>Neural Input</h3>
          </div>
        </header>
        
        <div className="box-content live-input-field-area">
          <div className="live-text-area">
             <div className={cn("live-result transcribe-mode", { 
               "is-finalizing": isFinalizing,
               "sentence-reached": hasReachedGoal,
               "has-content": words.length > 0 
             })}>
                {words.map((word, idx) => (
                  <span key={`${idx}-${word}`} className="animate-word">
                    {word}{' '}
                  </span>
                ))}
                {!isFinalizing && <span className={cn("blinking-cursor", { active: connected })}></span>}
                {!transcriptionText && connected && !isFinalizing && (
                  <span className="ready-placeholder">Listening for speech...</span>
                )}
                {!connected && <span className="ready-placeholder">System Standby</span>}
             </div>
          </div>
        </div>
      </section>

      {/* HISTORY LOG */}
      <section className="console-box history-box">
        <header className="box-header">
          <div className="header-group">
            <span className="material-symbols-outlined box-icon">history</span>
            <h3>Full Transcription History</h3>
          </div>
        </header>

        <div className="box-content archive-scroll" ref={scrollContainerRef}>
          <div className="archive-list">
            {turns.length === 0 ? (
              <div className="archive-empty">Verbatim transcript log will appear here...</div>
            ) : (
              turns.map((turn, i) => (
                <div key={i} className={cn("archive-turn-v2 animate-fall", turn.role)}>
                  <div className="turn-header">
                    <span className="role-badge">VERBATIM</span>
                    <span className="turn-time">{turn.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  <div className="turn-content">{turn.text}</div>
                </div>
              ))
            )}
            {/* The anchor for auto-scrolling */}
            <div ref={historyBottomRef} className="scroll-anchor" />
          </div>
        </div>
      </section>
    </div>
  );
}
