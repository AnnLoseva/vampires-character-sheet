// supabase.js — с динамической кнопкой Войти / Выйти

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

function updateAuthButton() {
    let btn = document.getElementById('auth-button');
    if (!btn) {
        // Создаём кнопку, если её ещё нет
        const panel = document.querySelector('.sheet').parentElement || document.body;
        btn = document.createElement('button');
        btn.id = 'auth-button';
        btn.style.cssText = `padding:14px 20px; font-size:16px; border:none; border-radius:6px; cursor:pointer; width:100%; margin-top:12px;`;
        // Вставляем перед кнопкой "Мои персонажи" или в конец правой панели
        const rightPanel = document.querySelector('#btn-save').parentElement;
        if (rightPanel) rightPanel.insertBefore(btn, rightPanel.querySelector('button[onclick="showMyCharacters"]'));
        else document.body.appendChild(btn);
    }

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
    if (!supabaseClient) return alert("Supabase не готов");
    supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
    });
}

async function logout() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
        currentUser = null;
        updateAuthButton();
        alert("👋 Вы вышли из аккаунта");
    }
}
// ==================== СОХРАНЕНИЕ ====================
async function saveCharacter() {
    if (!supabaseClient || !currentUser) {
        if (confirm("Для сохранения нужно войти через Google.\nВойти сейчас?")) loginWithGoogle();
        return;
    }

    const name = document.getElementById('char-name').value.trim() || "Без имени";

    const fullData = {
        name, clan: document.getElementById('clan-input')?.value || "",
        predator: document.getElementById('predator-input')?.value || "",
        timestamp: new Date().toISOString(),
        attributes: {}, skills: {}, disciplines: disciplineSources,
        selectedPowers, merits: selectedMerits, flaws: selectedFlaws,
        skillPackage: document.getElementById('skill-package').value
    };

    // Собираем атрибуты и навыки
    document.querySelectorAll('.dot-input[data-type="attr"]:checked').forEach(i => {
        if (+i.value > 0) fullData.attributes[i.name] = +i.value;
    });
    document.querySelectorAll('.dot-input[data-type="skill"]:checked').forEach(i => {
        const v = +i.value;
        if (v > 0) {
            fullData.skills[i.name] = { dots: v, specs: [] };
            const cont = document.getElementById('specs-' + i.name);
            if (cont) cont.querySelectorAll('input[type="text"]').forEach(s => {
                if (s.value.trim()) fullData.skills[i.name].specs.push(s.value.trim());
            });
        }
    });

    const { error } = await supabaseClient.from('characters').insert({
        user_id: currentUser.id,
        name: name,
        data: fullData
    });

    if (error) alert("❌ " + error.message);
    else alert(`✅ "${name}" сохранён!`);
}

// ==================== ЛИЧНЫЙ КАБИНЕТ ====================
async function showMyCharacters() {
    if (!currentUser) {
        if (confirm("Войдите через Google")) loginWithGoogle();
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

// ==================== ЗАГРУЗКА ПЕРСОНАЖА ====================
window.loadCharacter = async function(id) {
    const { data, error } = await supabaseClient
        .from('characters')
        .select('data')
        .eq('id', id)
        .single();

    if (error || !data?.data) return alert("Не удалось загрузить персонажа");

    const d = data.data;

    // Заполняем основные поля
    if (d.name) document.getElementById('char-name').value = d.name;
    if (d.clan) document.getElementById('clan-input').value = d.clan;
    if (d.predator) document.getElementById('predator-input').value = d.predator;
    if (d.skillPackage) document.getElementById('skill-package').value = d.skillPackage;

    // TODO: Полная загрузка атрибутов, навыков, дисциплин и т.д. (можно расширить позже)
    alert(`✅ Персонаж "${d.name}" загружен!\n\n(Пока загружается только базовая информация)`);
    closeModal();
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

// Глобальные функции
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.saveCharacter = saveCharacter;
window.showMyCharacters = showMyCharacters;

window.addEventListener('load', () => {
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (initSupabase() || attempts > 30) clearInterval(interval);
    }, 250);
});

console.log("✅ Supabase + динамическая кнопка Войти/Выйти готов");