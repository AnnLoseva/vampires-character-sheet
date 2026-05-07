// supabase.js — Полноценный Личный кабинет

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
}

// Вход через Google
function loginWithGoogle() {
    supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
    });
}

// ==================== СОХРАНЕНИЕ ====================
async function saveCharacter() {
    if (!supabaseClient) return alert("Supabase не готов");
    if (!currentUser) {
        if (confirm("Нужно войти через Google для сохранения.\nВойти сейчас?")) loginWithGoogle();
        return;
    }

    const name = document.getElementById('char-name').value.trim() || "Без имени";

    // Собираем ВСЁ состояние персонажа
    const fullData = {
        name: name,
        clan: document.getElementById('clan-input')?.value || "",
        predator: document.getElementById('predator-input')?.value || "",
        timestamp: new Date().toISOString(),
        attributes: {},
        skills: {},
        disciplines: disciplineSources,
        selectedPowers: selectedPowers,
        merits: selectedMerits,
        flaws: selectedFlaws,
        skillPackage: document.getElementById('skill-package').value
    };

    // Атрибуты
    document.querySelectorAll('.dot-input[data-type="attr"]:checked').forEach(inp => {
        if (parseInt(inp.value) > 0) fullData.attributes[inp.name] = parseInt(inp.value);
    });

    // Навыки + специализации
    document.querySelectorAll('.dot-input[data-type="skill"]:checked').forEach(inp => {
        const val = parseInt(inp.value);
        if (val > 0) {
            const skillName = inp.name;
            fullData.skills[skillName] = { dots: val, specs: [] };
            const container = document.getElementById('specs-' + skillName);
            if (container) {
                container.querySelectorAll('input[type="text"]').forEach(s => {
                    if (s.value.trim()) fullData.skills[skillName].specs.push(s.value.trim());
                });
            }
        }
    });

    const { error } = await supabaseClient
        .from('characters')
        .insert({
            user_id: currentUser.id,
            name: name,
            data: fullData
        });

    if (error) alert("❌ Ошибка: " + error.message);
    else alert(`✅ "${name}" успешно сохранён!`);
}

// ==================== ЛИЧНЫЙ КАБИНЕТ ====================
async function showMyCharacters() {
    if (!supabaseClient) return alert("Supabase не готов");
    if (!currentUser) {
        if (confirm("Войдите через Google для просмотра кабинета")) loginWithGoogle();
        return;
    }

    const { data, error } = await supabaseClient
        .from('characters')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) return alert("Ошибка: " + error.message);
    if (!data || data.length === 0) return alert("📭 У вас пока нет сохранённых персонажей.");

    let html = `
    <div style="max-height:70vh; overflow-y:auto; padding:10px;">
        <h2 style="color:#ff3131; text-align:center;">📋 Личный кабинет</h2>
        <table style="width:100%; border-collapse:collapse; margin-top:15px;">
            <thead><tr style="background:#222;">
                <th style="padding:10px; text-align:left;">Имя</th>
                <th style="padding:10px;">Дата</th>
                <th style="padding:10px; width:140px;">Действия</th>
            </tr></thead>
            <tbody>`;

    data.forEach(char => {
        const date = new Date(char.created_at).toLocaleDateString('ru-RU');
        html += `
            <tr style="border-bottom:1px solid #333;">
                <td style="padding:12px;">${char.name}</td>
                <td style="padding:12px; color:#888;">${date}</td>
                <td style="padding:12px;">
                    <button onclick="loadCharacter('${char.id}')" style="background:#ff3131; color:white; border:none; padding:6px 12px; margin-right:6px; border-radius:4px; cursor:pointer;">Загрузить</button>
                    <button onclick="deleteCharacter('${char.id}')" style="background:#444; color:#ff6666; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Удалить</button>
                </td>
            </tr>`;
    });

    html += `</tbody></table></div>`;

    showModal(html);
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function showModal(content) {
    let modal = document.getElementById('character-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'character-modal';
        modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:20000; display:flex; align-items:center; justify-content:center;`;
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div style="background:#111; padding:25px; border-radius:10px; border:2px solid #ff3131; max-width:800px; width:90%; max-height:85vh; overflow:auto;">
            ${content}
            <button onclick="closeModal()" style="margin-top:20px; padding:12px 30px; background:#333; color:white; border:none; border-radius:6px; cursor:pointer;">Закрыть</button>
        </div>`;
    modal.style.display = 'flex';
}

window.closeModal = () => {
    const m = document.getElementById('character-modal');
    if (m) m.style.display = 'none';
};

async function loadCharacter(id) {
    const { data, error } = await supabaseClient.from('characters').select('data').eq('id', id).single();
    if (error || !data) return alert("Не удалось загрузить персонажа");

    const d = data.data;
    // Здесь можно сделать полноценную загрузку всего состояния (пока просто alert)
    alert(`Загружен персонаж: ${d.name}\nКлан: ${d.clan}\nОхота: ${d.predator}`);
    closeModal();
    // В будущем здесь будет полная загрузка листа
}

async function deleteCharacter(id) {
    if (!confirm("Удалить этого персонажа?")) return;
    
    const { error } = await supabaseClient.from('characters').delete().eq('id', id);
    if (error) alert("Ошибка удаления");
    else {
        alert("Персонаж удалён");
        showMyCharacters(); // обновляем список
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

console.log("✅ Личный кабинет готов");