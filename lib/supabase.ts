
import { createClient } from '@supabase/supabase-js';

// Using provided credentials for anonymous and email auth
const supabaseUrl = 'https://rcbuikbjqgykssiatxpo.supabase.co';
const supabaseAnonKey = 'sb_publishable_uTIwEo4TJBo_YkX-OWN9qQ_5HJvl4c5';

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Logs a transcription/translation pair to Supabase.
 * Table expected: 'translations' 
 */
export async function logToSupabase(data: {
  session_id: string;
  user_text: string;
  agent_text: string;
  language: string;
  user_name?: string;
}) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('translations')
      .insert([data]);

    if (error) console.error('Supabase Sync Error:', error.message);
  } catch (err) {
    console.error('Supabase unexpected error:', err);
  }
}

/**
 * Registers or updates a meeting in the database.
 * Table expected: 'meetings' (id, target_language, created_at, updated_at)
 */
export async function upsertMeeting(id: string, targetLanguage: string) {
  if (!supabase || !id) return;
  try {
    const { error } = await supabase
      .from('meetings')
      .upsert({ 
        id, 
        target_language: targetLanguage,
        updated_at: new Date().toISOString()
      });
    if (error) console.error('Supabase Meeting Sync Error:', error.message);
  } catch (err) {
    console.error('Supabase Meeting unexpected error:', err);
  }
}

/**
 * Registers a user as an active participant in a meeting.
 * Table expected: 'participants' (meeting_id, user_id, user_name, last_seen)
 */
export async function registerParticipant(meetingId: string, userId: string, userName: string) {
  if (!supabase || !meetingId || !userId) return;
  try {
    const { error } = await supabase
      .from('participants')
      .upsert({
        meeting_id: meetingId,
        user_id: userId,
        user_name: userName,
        last_seen: new Date().toISOString()
      }, { onConflict: 'meeting_id,user_id' });
    if (error) console.error('Supabase Participant Sync Error:', error.message);
  } catch (err) {
    console.error('Supabase Participant unexpected error:', err);
  }
}

/**
 * Fetches all participants for a specific meeting.
 */
export async function getMeetingParticipants(meetingId: string) {
  if (!supabase || !meetingId) return [];
  try {
    const { data, error } = await supabase
      .from('participants')
      .select('user_id, user_name, last_seen')
      .eq('meeting_id', meetingId);
    
    if (error) {
      console.error('Supabase Fetch Error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    return [];
  }
}
