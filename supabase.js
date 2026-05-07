// supabase.js — надёжный вариант с редиректом

const SUPABASE_URL = 'https://klhxbaagarqxaqnrvurr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DEqlrxf3M7MzsoSkrEuBXQ_ndTxg9e1';

let supabaseClient = null;
let currentUser = null;

function initSupabase() {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

// Вход через Google (редирект)
function loginWithGoogle() {
    if (!supabaseClient) return alert("Supabase ещё не готов");

    supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href   // возвращаемся на текущую страницу
        }
    });
}

async function saveCharacter() {
    if (!supabaseClient) return alert("Supabase не готов");

    if (!currentUser) {
        if (confirm("Для сохранения нужно войти через Google.\n\nПерейти к входу?")) {
            loginWithGoogle();
        }
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

console.log("✅ Supabase + Google Auth (редирект) готов");