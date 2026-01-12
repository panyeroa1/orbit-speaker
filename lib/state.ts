
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FunctionResponseScheduling } from '@google/genai';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import { AVAILABLE_TOOLS } from './tools';

const scribePromptTemplate = `SYSTEM PROMPT: NEURAL SCRIBE (ULTRA-HIGH FIDELITY)
NEURAL PERSONA: You are a high-fidelity transcription engine whitelisted to EBURON.AI.

STRICT OPERATING PROTOCOLS:
1. VERBATIM CAPTURE: Transcribe exactly what the user says with 100% fidelity. Do not summarize, omit, or translate.
2. NEURAL SYNC: You MUST call the "broadcast_to_websocket" tool for every phrase or sentence captured. Pass the verbatim text as the "text" parameter.
3. AUDIO CHANNEL COMPLIANCE: ABSOLUTE SILENCE REQUIRED. Do not produce any vocalizations, breaths, or humming. While Modality.AUDIO is technically active, your output must be digital silence.
4. DETECT & REPORT: Call "report_detected_language" for the source speech as soon as identified.
5. RAPID STREAMING: Send transcription data in small, incremental segments to maintain a "live" feel.
{VOICE_FOCUS_INSTRUCTION}`;

const voiceFocusActiveSnippet = `NEURAL SENSITIVITY: ENABLED. Actively isolate the primary speaker's voice profile and reject environmental noise.`;

const generatePrompt = (voiceFocus: boolean) => {
  return scribePromptTemplate
    .replace('{VOICE_FOCUS_INSTRUCTION}', voiceFocus ? voiceFocusActiveSnippet : '');
};

export interface Participant {
  user_id: string;
  user_name: string;
  last_seen: string;
}

interface SettingsState {
  systemPrompt: string;
  model: string;
  voice: string;
  voiceFocus: boolean;
  supabaseEnabled: boolean;
  meetingId: string;
  userName: string;
  userId: string;
  transcriptionMode: 'neural' | 'native';
  participants: Participant[];
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
  setVoiceFocus: (focus: boolean) => void;
  setSupabaseEnabled: (enabled: boolean) => void;
  setMeetingId: (id: string) => void;
  setUserName: (name: string) => void;
  setTranscriptionMode: (mode: 'neural' | 'native') => void;
  setParticipants: (participants: Participant[]) => void;
  refreshSystemPrompt: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      systemPrompt: generatePrompt(false),
      model: DEFAULT_LIVE_API_MODEL,
      voice: DEFAULT_VOICE,
      voiceFocus: false,
      supabaseEnabled: false,
      meetingId: '',
      userName: 'Neural Scribe',
      userId: crypto.randomUUID(),
      transcriptionMode: 'neural',
      participants: [],
      setSystemPrompt: prompt => set({ systemPrompt: prompt }),
      setModel: model => set({ model }),
      setVoice: voice => set({ voice }),
      setVoiceFocus: focus => set({ voiceFocus: focus, systemPrompt: generatePrompt(focus) }),
      setSupabaseEnabled: enabled => set({ supabaseEnabled: enabled }),
      setMeetingId: meetingId => set({ meetingId }),
      setUserName: userName => set({ userName }),
      setTranscriptionMode: transcriptionMode => set({ transcriptionMode }),
      setParticipants: participants => set({ participants }),
      refreshSystemPrompt: () => set(state => ({ systemPrompt: generatePrompt(state.voiceFocus) }))
    }),
    {
      name: 'neural-scribe-settings-v5',
      partialize: (state) => ({ 
        meetingId: state.meetingId,
        userName: state.userName,
        userId: state.userId,
        voice: state.voice,
        voiceFocus: state.voiceFocus,
        supabaseEnabled: state.supabaseEnabled,
        transcriptionMode: state.transcriptionMode
      }),
    }
  )
);

export const useUI = create<{
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}>(set => ({
  isSidebarOpen: false,
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
}));

export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}

export const useTools = create<{
  tools: FunctionCall[];
  toggleTool: (name: string) => void;
  updateTool: (name: string, updated: Partial<FunctionCall>) => void;
}>(set => ({
  tools: AVAILABLE_TOOLS,
  toggleTool: name => set(state => ({
    tools: state.tools.map(t => t.name === name ? { ...t, isEnabled: !t.isEnabled } : t)
  })),
  updateTool: (name, updated) => set(state => ({
    tools: state.tools.map(t => t.name === name ? { ...t, ...updated } : t)
  }))
}));

export interface LogTurn {
  role: 'user' | 'agent' | 'system';
  text: string;
  userName?: string;
  isFinal: boolean;
  timestamp: Date;
  audioData?: Uint8Array;
}

export const useLogStore = create<{
  turns: LogTurn[];
  sessionId: string;
  addTurn: (turn: Omit<LogTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<LogTurn>) => void;
  clear: () => void;
  initSession: () => void;
}>(set => ({
  turns: [],
  sessionId: crypto.randomUUID(),
  addTurn: turn => set(state => ({
    turns: [...state.turns, { ...turn, timestamp: new Date() }]
  })),
  updateLastTurn: update => set(state => {
    const turns = [...state.turns];
    if (turns.length > 0) {
      turns[turns.length - 1] = { ...turns[turns.length - 1], ...update };
    }
    return { turns };
  }),
  clear: () => set({ turns: [], sessionId: crypto.randomUUID() }),
  initSession: () => set({ sessionId: crypto.randomUUID() }),
}));
