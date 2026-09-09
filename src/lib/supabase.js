import { createClient } from '@supabase/supabase-js';

const projectUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(projectUrl && publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(projectUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

/**
 * Uses an existing session when available and otherwise creates a privacy-safe
 * guest session. This lets rooms be protected with RLS without requiring an
 * account form before a call starts.
 */
export async function ensureGuestSession() {
  if (!supabase) return null;

  const { data: current, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (current.session) return current.session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

export async function syncRoom(roomId, displayName) {
  if (!supabase) return;
  try {
    await ensureGuestSession();
    const { error } = await supabase
      .from('call_rooms')
      .upsert(
        { slug: roomId, created_by_name: displayName.slice(0, 40) },
        { onConflict: 'slug', ignoreDuplicates: true }
      );
    if (error) throw error;
  } catch (error) {
    // Calls never depend on analytics/persistence. Socket.IO remains the
    // signaling and chat transport if Supabase has not been provisioned yet.
    console.warn('Supabase room sync skipped:', error.message);
  }
}

export async function persistChatMessage(roomId, senderName, body) {
  if (!supabase) return;
  try {
    await ensureGuestSession();
    const { data: room, error: roomError } = await supabase
      .from('call_rooms')
      .select('id')
      .eq('slug', roomId)
      .maybeSingle();
    if (roomError || !room) return;

    const { error } = await supabase.from('call_messages').insert({
      room_id: room.id,
      sender_name: senderName.slice(0, 40),
      body: body.slice(0, 1000)
    });
    if (error) throw error;
  } catch (error) {
    console.warn('Supabase message persistence skipped:', error.message);
  }
}
