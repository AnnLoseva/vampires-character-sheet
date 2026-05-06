'use server';

import { supabase } from '@/lib/supabase';

export async function saveCharacter(characterData: any) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase
    .from('characters')
    .upsert({
      user_id: user.id,
      name: characterData.name || 'Без имени',
      clan: characterData.clan,
      predator_type: characterData.predator,
      data: characterData
    });

  if (error) throw error;
  return { success: true };
}

export async function getMyCharacters() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  return data || [];
}