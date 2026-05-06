'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { saveCharacter, getMyCharacters } from './actions';

export default function VampireSheet() {
  const [characters, setCharacters] = useState<any[]>([]);

  // Анонимная авторизация
  useEffect(() => {
    supabase.auth.signInAnonymously().catch(console.error);
  }, []);

  // Загружаем список моих персонажей
  const loadMyCharacters = async () => {
    const data = await getMyCharacters();
    setCharacters(data);
    if (data.length > 0) {
      alert(`Загружено ${data.length} твоих персонажей`);
    }
  };

  // Сохранение текущего листа
  const handleSave = async () => {
    // Отправляем сообщение в iframe, чтобы он вернул текущие данные персонажа
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    
    if (!iframe) {
      alert("iframe не найден");
      return;
    }

    // Просим iframe отдать текущие данные
    iframe.contentWindow?.postMessage({ type: 'GET_CHARACTER_DATA' }, '*');

    // Ждём ответ от iframe
    const handler = async (event: MessageEvent) => {
      if (event.data?.type === 'CHARACTER_DATA') {
        const charData = event.data.data;
        
        try {
          await saveCharacter(charData);
          alert(`Персонаж "${charData.name || 'Без имени'}" успешно сохранён в Supabase!`);
          loadMyCharacters(); // обновляем список
        } catch (err: any) {
          alert("Ошибка сохранения: " + err.message);
        }

        window.removeEventListener('message', handler);
      }
    };

    window.addEventListener('message', handler);
  };

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
      <iframe 
        src="/sheet.html" 
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="VTM Character Sheet"
      />

      {/* Кнопки управления */}
      <div style={{
        position: 'absolute',
        top: '15px',
        right: '15px',
        zIndex: 10000,
        display: 'flex',
        gap: '10px'
      }}>
        <button 
          onClick={handleSave}
          style={{
            padding: '14px 24px',
            background: '#ff3131',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(255,49,49,0.4)'
          }}
        >
          💾 Сохранить в Supabase
        </button>

        <button 
          onClick={loadMyCharacters}
          style={{
            padding: '14px 20px',
            background: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          📋 Мои персонажи ({characters.length})
        </button>
      </div>
    </div>
  );
}