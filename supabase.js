// supabase.js — Полная версия с динамической кнопкой + исправленные дисциплины

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
    updateAuthButton();
}

// ==================== ДИНАМИЧЕСКАЯ КНОПКА ====================
function updateAuthButton() {
    const btn = document.getElementById('auth-button');
    if (!btn) return;

    if (currentUser) {
        btn.innerHTML = `👤 ${currentUser.email.split('@')[0]}<br><small style="opacity:0.7">Выйти</small>`;
        btn.style.background = '#333';
        btn.onclick = logout;
    } else {
        btn.textContent = '🔑 Войти через Google';
        btn.style.background = '#4285F4';
        btn.onclick = loginWithGoogle;
    }
}
function loginWithGoogle() {
    supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
    });
}

async function logout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    updateAuthButton();
    alert("👋 Вы вышли");
}

// ==================== ПОЛНОЕ СОХРАНЕНИЕ ====================
function getFullCharacterData() {
    const data = {
        version: "1.0.18",
        timestamp: new Date().toISOString(),
        name: document.getElementById('char-name').value.trim() || "Без имени",
        clan: document.getElementById('clan-input')?.value || "",
        predator: document.getElementById('predator-input')?.value || "",
        skillPackage: document.getElementById('skill-package').value,
        attributes: {},
        skills: {},
        disciplines: JSON.parse(JSON.stringify(disciplineSources || {})),   // глубокая копия
        selectedPowers: JSON.parse(JSON.stringify(selectedPowers || {})),
        merits: [...(selectedMerits || [])],
        flaws: [...(selectedFlaws || [])]
    };

    // Атрибуты
    document.querySelectorAll('.dot-input[data-type="attr"]:checked').forEach(inp => {
        if (+inp.value > 0) data.attributes[inp.name] = +inp.value;
    });

    // Навыки + специализации
    document.querySelectorAll('.dot-input[data-type="skill"]:checked').forEach(inp => {
        const val = +inp.value;
        if (val > 0) {
            const skillName = inp.name;
            data.skills[skillName] = { dots: val, specs: [] };
            const container = document.getElementById('specs-' + skillName);
            if (container) {
                container.querySelectorAll('input[type="text"]').forEach(s => {
                    if (s.value.trim()) data.skills[skillName].specs.push(s.value.trim());
                });
            }
        }
    });

    console.log("💾 Сохраняем дисциплины:", Object.keys(data.disciplines));
    return data;
}

// ==================== ПОЛНАЯ ЗАГРУЗКА ====================
// ==================== ПОЛНАЯ ЗАГРУЗКА В ЛИСТ ====================
// ==================== ПОЛНАЯ ЗАГРУЗКА ====================
function loadFullCharacter(d) {
    console.log("🔄 Загружаем персонажа... Дисциплины:", Object.keys(d.disciplines || {}));

    // Основная информация
    if (d.name) document.getElementById('char-name').value = d.name;
    if (d.clan) document.getElementById('clan-input').value = d.clan;
    if (d.predator) document.getElementById('predator-input').value = d.predator;
    if (d.skillPackage) document.getElementById('skill-package').value = d.skillPackage;

    // Атрибуты
    Object.keys(d.attributes || {}).forEach(name => {
        const radio = document.querySelector(`input[name="${name}"][value="${d.attributes[name]}"]`);
        if (radio) radio.checked = true;
    });

    // Навыки + специализации
    Object.keys(d.skills || {}).forEach(skill => {
        const s = d.skills[skill];
        const radio = document.querySelector(`input[name="${skill}"][value="${s.dots}"]`);
        if (radio) radio.checked = true;

        const container = document.getElementById('specs-' + skill);
        if (container && s.specs?.length) {
            container.innerHTML = '';
            container.style.display = 'flex';
            document.getElementById('s-' + skill).checked = true;

            s.specs.forEach(text => {
                const line = document.createElement('div');
                line.className = 'skill-spec-line';
                line.innerHTML = `<input type="text" value="${text}" style="flex:1;"> 
                                  <button>+</button><button>×</button>`;
                container.appendChild(line);
            });
        }
    });

    // === ДИСЦИПЛИНЫ — ИСПРАВЛЕННАЯ ВЕРСИЯ ===
    if (d.disciplines) {
        disciplineSources = JSON.parse(JSON.stringify(d.disciplines));
    }
    if (d.selectedPowers) {
        selectedPowers = JSON.parse(JSON.stringify(d.selectedPowers));
    }

    // Полная очистка и перерисовка списка дисциплин
    const list = document.getElementById('disciplines-list');
    if (list) list.innerHTML = '';

    renderDisciplines();           // ← Это обязательно!

    // Преимущества и недостатки
    if (d.merits) selectedMerits = [...d.merits];
    if (d.flaws) selectedFlaws = [...d.flaws];

    renderSelectedMeritsFlaws();
    updateTrackers();
    updateVitals();

    console.log("✅ Загрузка завершена. Дисциплины:", Object.keys(disciplineSources));
}

// ==================== ЛИЧНЫЙ КАБИНЕТ ====================
async function showMyCharacters() {
    if (!currentUser) {
        if (confirm("Войдите через Google"));
        return;
    }

    const { data, error } = await supabaseClient
        .from('characters')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) return alert("Ошибка загрузки");
    if (!data?.length) return alert("📭 У вас пока нет сохранённых персонажей");

    let html = `
    <div style="padding:20px;">
        <h2 style="color:#ff3131; text-align:center; margin:0 0 20px 0;">📋 ЛИЧНЫЙ КАБИНЕТ</h2>
        
        <table style="width:100%; border-collapse:collapse; background:#1a1a1a;">
            <thead>
                <tr style="background:#222;">
                    <th style="padding:14px; text-align:left; width:45%;">Имя персонажа</th>
                    <th style="padding:14px; text-align:center;">Дата</th>
                    <th style="padding:14px; text-align:center; width:180px;">Действия</th>
                </tr>
            </thead>
            <tbody>`;

    data.forEach(char => {
        const date = new Date(char.created_at).toLocaleDateString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        html += `
            <tr style="border-bottom:1px solid #333;">
                <td style="padding:14px; font-weight:500;">${char.name}</td>
                <td style="padding:14px; color:#888; text-align:center;">${date}</td>
                <td style="padding:14px; text-align:center;">
                    <button onclick="loadCharacter('${char.id}');closeModal()" 
                            style="background:#ff3131; color:white; border:none; padding:10px 16px; margin:0 4px; border-radius:6px; cursor:pointer; font-size:15px;">
                        📥 Загрузить
                    </button>
                    <button onclick="deleteCharacter('${char.id}')" 
                            style="background:#333; color:#ff6666; border:none; padding:10px 16px; margin:0 4px; border-radius:6px; cursor:pointer; font-size:15px;">
                        🗑 Удалить
                    </button>
                </td>
            </tr>`;
    });

    html += `</tbody></table>
        <div style="text-align:center; margin-top:25px;">
            <button onclick="closeModal()" style="padding:12px 32px; background:#444; color:white; border:none; border-radius:8px; font-size:16px; cursor:pointer;">
                Закрыть
            </button>
        </div>
    </div>`;

    showModal(html);
}

function showModal(html) {
    let modal = document.getElementById('char-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'char-modal';
        modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:30000;display:flex;align-items:center;justify-content:center;`;
        document.body.appendChild(modal);
    }
    modal.innerHTML = `<div style="background:#0f0f0f;border:3px solid #ff3131;border-radius:12px;max-width:820px;width:92%;max-height:85vh;overflow:auto;">${html}</div>`;
    modal.style.display = 'flex';
}

window.closeModal = () => {
    const m = document.getElementById('char-modal');
    if (m) m.style.display = 'none';
};


async function saveCharacter() {
    if (!supabaseClient) return alert("Supabase не готов");
    if (!currentUser) {
        if (confirm("Для сохранения нужно войти через Google")) loginWithGoogle();
        return;
    }

    const fullData = getFullCharacterData();

    const { error } = await supabaseClient.from('characters').insert({
        user_id: currentUser.id,
        name: fullData.name,
        data: fullData
    });

    if (error) alert("❌ Ошибка: " + error.message);
    else alert(`✅ "${fullData.name}" сохранён!`);
}


// ==================== ЗАГРУЗКА ПЕРСОНАЖА ====================
window.loadCharacter = async function(id) {
    if (!supabaseClient) return alert("Supabase не готов");

    const { data, error } = await supabaseClient
        .from('characters')
        .select('data')
        .eq('id', id)
        .single();

    if (error || !data?.data) {
        console.error(error);
        return alert("Не удалось загрузить персонажа");
    }

    loadFullCharacter(data.data);
    closeModal();
    alert(`✅ Персонаж "${data.data.name}" успешно загружен!`);
};




window.deleteCharacter = async function(id) {
    if (!confirm("Удалить этого персонажа навсегда?")) return;
    
    const { error } = await supabaseClient.from('characters').delete().eq('id', id);
    if (error) alert("Ошибка удаления");
    else {
        alert("Персонаж удалён");
        showMyCharacters(); // обновляем список
    }
};

// Глобальные
window.loginWithGoogle = loginWithGoogle;
window.saveCharacter = saveCharacter;
window.showMyCharacters = showMyCharacters;
window.loadCharacter = loadCharacter;

window.addEventListener('load', () => {
    let i = 0;
    const int = setInterval(() => { if (initSupabase() || ++i > 30) clearInterval(int); }, 250);
});