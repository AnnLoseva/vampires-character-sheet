// supabase.js — с popup-окном Google

const SUPABASE_URL = 'https://klhxbaagarqxaqnrvurr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DEqlrxf3M7MzsoSkrEuBXQ_ndTxg9e1';

let supabaseClient = null;
let currentUser = null;

function initSupabase() {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: true }
        });
        console.log("✅ Supabase подключён");
        checkUserSession();
        return true;
    }
    return false;
}

async function checkUserSession() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    if (currentUser) console.log("👤 Авторизован:", currentUser.email);
}

// Popup вход через Google
async function loginWithGoogle() {
    if (!supabaseClient) return alert("Supabase не готов");

    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
            skipBrowserRedirect: true   // важно для popup
        }
    });

    if (error) alert("Ошибка входа: " + error.message);
}

async function saveCharacter() {
    if (!supabaseClient) return alert("Supabase не готов");

    // Если не авторизован — открываем popup
    if (!currentUser) {
        alert("Для сохранения нужно войти через Google");
        loginWithGoogle();
        return;
    }

    const name = document.getElementById('char-name').value.trim() || "Без имени";

    const characterData = {
        name: name,
        clan: document.getElementById('clan-input')?.value || "",
        predator: document.getElementById('predator-input')?.value || "",
        timestamp: new Date().toISOString()
    };

    const { error } = await supabaseClient
        .from('characters')
        .insert({
            user_id: currentUser.id,
            name: name,
            clan: characterData.clan,
            predator_type: characterData.predator,
            data: characterData
        });

    if (error) alert("❌ Ошибка: " + error.message);
    else alert(`✅ "${name}" успешно сохранён!`);
}

async function showMyCharacters() {
    if (!supabaseClient) return alert("Supabase не готов");
    if (!currentUser) {
        alert("Войдите через Google");
        loginWithGoogle();
        return;
    }

    const { data, error } = await supabaseClient
        .from('characters')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) alert("❌ " + error.message);
    else if (!data || data.length === 0) alert("📭 У вас пока нет сохранённых персонажей");
    else {
        let text = "📋 Ваши персонажи:\n\n";
        data.forEach((char, i) => {
            const date = new Date(char.created_at).toLocaleDateString('ru-RU');
            text += `${i+1}. ${char.name} — ${date}\n`;
        });
        alert(text);
    }
}

// Глобальные функции
window.loginWithGoogle = loginWithGoogle;
window.saveCharacter = saveCharacter;
window.showMyCharacters = showMyCharacters;

window.addEventListener('load', () => {
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (initSupabase() || attempts > 30) clearInterval(interval);
    }, 250);
});

console.log("✅ Supabase + Google Popup готов");