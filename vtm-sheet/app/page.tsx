'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { saveCharacter, getMyCharacters } from './actions';

export default function Home() {
  return (
    <div style={{ 
      padding: '100px', 
      textAlign: 'center', 
      fontFamily: 'Arial', 
      background: '#000', 
      color: 'white',
      minHeight: '100vh'
    }}>
      <h1>✅ VTM Лист персонажа</h1>
      <p>Сайт успешно задеплоился!</p>
      <p>Если видишь этот текст — всё работает.</p>
    </div>
  );
}
