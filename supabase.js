// supabase.js — ультра-простая версия

const SUPABASE_URL = 'https://klhxbaagarqxanrvurr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaHhiYWFnYXJxeGFxbnJ2dXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzkwNjAsImV4cCI6MjA5MzY1NTA2MH0.Cy2496DJgJhqZkERL9h19FkiiTfkcW2pauPaJU5r5oY';

let supabaseClient = null;

function initSupabase() {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Supabase подключён успешно!");
        return true;
    }
    return false;
}

window.addEventListener('load', () => {
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (initSupabase() || attempts > 50) {
            clearInterval(interval);
            if (!supabaseClient) console.error("❌ Supabase так и не загрузился");
        }
    }, 200);
});

async function saveCharacter() {
    if (!supabaseClient) return alert("Supabase ещё не готов. Обнови страницу.");

    const name = document.getElementById('char-name').value.trim() || "Без имени";
    const characterData = {
        name: name,
        clan: document.getElementById('clan-input')?.value || "",
        predator: document.getElementById('predator-input')?.value || "",
        timestamp: new Date().toISOString()
    };

    const { error } = await supabaseClient.from('characters').insert({ name, data: characterData });
    if (error) alert("❌ " + error.message);
    else alert(`✅ "${name}" сохранён в личный кабинет!`);
}

async function showMyCharacters() {
    if (!supabaseClient) return alert("Supabase ещё не готов.");

    const { data, error } = await supabaseClient.from('characters').select('*').order('created_at', { ascending: false });
    if (error) alert("❌ " + error.message);
    else if (!data || data.length === 0) alert("📭 Пока нет сохранённых персонажей.");
    else {
        let text = "📋 Твои персонажи:\n\n";
        data.forEach((c, i) => text += `${i+1}. ${c.name || 'Без имени'} — ${new Date(c.created_at).toLocaleDateString('ru-RU')}\n`);
        alert(text);
    }
}

window.saveCharacter = saveCharacter;
window.showMyCharacters = showMyCharacters;

console.log("Supabase модуль запущен");