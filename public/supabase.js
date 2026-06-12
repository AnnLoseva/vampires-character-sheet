// ==================== ПРОСТАЯ АВТОРИЗАЦИЯ (username + password) ====================

const SUPABASE_URL = 'https://klhxbaagarqxaqnrvurr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaHhiYWFnYXJxeGFxbnJ2dXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzkwNjAsImV4cCI6MjA5MzY1NTA2MH0.Cy2496DJgJhqZkERL9h19FkiiTfkcW2pauPaJU5r5oY';

let supabaseClient = null;
let currentUser = null;
let currentCharacterRecordId = null;
let charactersListCache = null;
let requestedCharacterLoadStarted = false;

function initSupabase() {
    if (supabaseClient) return supabaseClient;
    
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase подключён (простая авторизация)");
    checkUserSession();
    return supabaseClient;
}

function ensureSupabase() {
    if (supabaseClient) return supabaseClient;
    if (!window.supabase) {
        alert('Supabase ещё загружается. Подождите секунду и попробуйте снова.');
        return null;
    }
    return initSupabase();
}

function setButtonBusy(selector, busy, text) {
    const button = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!button) return;
    if (busy) {
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = text || 'Загрузка...';
        button.disabled = true;
        button.style.opacity = '0.65';
        button.style.cursor = 'wait';
    } else {
        if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
        button.disabled = false;
        button.style.opacity = '';
        button.style.cursor = '';
    }
}

async function checkUserSession() {
    try {
        const savedUser = localStorage.getItem('vtm-sheet-user') || localStorage.getItem('vtm-chat-user');
        if (savedUser) currentUser = JSON.parse(savedUser);
    } catch (error) {
        console.warn('Не удалось восстановить пользователя:', error);
        localStorage.removeItem('vtm-sheet-user');
        localStorage.removeItem('vtm-chat-user');
        currentUser = null;
    }
    updateAuthButton();
}

function rememberUserSession(user) {
    currentUser = user;
    localStorage.setItem('vtm-sheet-user', JSON.stringify(user));
    localStorage.setItem('vtm-chat-user', JSON.stringify({
        id: user.id,
        username: user.username,
    }));
    charactersListCache = null;
}

// ==================== UI КНОПКИ ====================
function updateAuthButton() {
    const btn = document.getElementById('auth-btn');
    if (!btn) return;

    if (currentUser) {
        btn.innerHTML = `👤 ${currentUser.username}<br><small onclick="logout()" style="cursor:pointer">Выйти</small>`;
        btn.style.background = '#28a745';
        btn.onclick = null;
    } else {
        btn.textContent = '🔑 Войти в аккаунт';
        btn.style.background = '#ff3131';
        btn.onclick = showAuthModal;
    }
}

// ==================== МОДАЛЬНОЕ ОКНО ====================
function showAuthModal() {
    const html = `
    <div style="padding:35px; max-width:420px; margin:auto; background:#1a1a1a; border:3px solid #ff3131; border-radius:12px; color:#eee;">
        <h2 style="text-align:center; color:#ff3131; margin:0 0 25px 0;">Вход / Регистрация</h2>
        
        <input id="auth-username" type="text" placeholder="Имя пользователя" style="width:100%; padding:14px; margin:10px 0; background:#222; border:none; color:white; border-radius:6px;"><br>
        <input id="auth-password" type="password" placeholder="Пароль" style="width:100%; padding:14px; margin:10px 0; background:#222; border:none; color:white; border-radius:6px;"><br>
        
        <button onclick="handleLogin(this)" style="width:100%; padding:15px; margin:12px 0 8px 0; background:#ff3131; color:white; border:none; border-radius:8px; font-size:16px;">Войти</button>
        <button onclick="handleRegister(this)" style="width:100%; padding:15px; background:#444; color:white; border:none; border-radius:8px; font-size:16px;">Создать аккаунт</button>
        
        <button onclick="closeModal()" style="width:100%; margin-top:20px; padding:12px; background:transparent; color:#888; border:none;">Закрыть</button>
    </div>`;

    showModal(html);
}

// ==================== РЕГИСТРАЦИЯ ====================
window.handleRegister = async (button) => {
    const client = ensureSupabase();
    if (!client) return;
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!username || username.length < 3) return alert("Имя пользователя минимум 3 символа");
    if (password.length < 6) return alert("Пароль минимум 6 символов");

    // Простой hash (для теста)
    const passwordHash = btoa(password); // временно, потом заменим на нормальный

    setButtonBusy(button, true, 'Создаю...');
    const { data, error } = await client
        .from('users')
        .insert({ username, password_hash: passwordHash })
        .select('id, username')
        .single();

    if (error) {
        if (error.code === '23505') alert("Пользователь с таким именем уже существует");
        else alert("Ошибка регистрации: " + error.message);
    } else {
        rememberUserSession(data);
        updateAuthButton();
        closeModal();
    }
    setButtonBusy(button, false);
};

// ==================== ВХОД ====================
window.handleLogin = async (button) => {
    const client = ensureSupabase();
    if (!client) return;
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!username || !password) return alert("Введите логин и пароль");

    const passwordHash = btoa(password);

    setButtonBusy(button, true, 'Вхожу...');
    const { data, error } = await client
        .from('users')
        .select('id, username')
        .eq('username', username)
        .eq('password_hash', passwordHash)
        .single();

    if (error || !data) {
        alert("❌ Неверный логин или пароль");
    } else {
        rememberUserSession(data);
        updateAuthButton();
        closeModal();
    }
    setButtonBusy(button, false);
};

async function logout() {
    currentUser = null;
    currentCharacterRecordId = null;
    charactersListCache = null;
    localStorage.removeItem('vtm-sheet-user');
    localStorage.removeItem('vtm-chat-user');
    updateAuthButton();
    alert("👋 Вы вышли");
}

// Модальное окно
function showModal(html) {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:30000;display:flex;align-items:center;justify-content:center;padding:20px;';
        document.body.appendChild(modal);
    }
    modal.innerHTML = html;
    modal.style.display = 'flex';
}

window.closeModal = () => {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
};

// Автозапуск
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
} else {
    initSupabase();
}


// ==================== СОХРАНЕНИЕ ПЕРСОНАЖЕЙ ====================

async function saveCharacter() {
    const client = ensureSupabase();
    if (!client) return;
    if (!currentUser) {
        alert("❌ Войдите в аккаунт, чтобы сохранить персонажа!");
        showAuthModal();
        return;
    }

    if (window.validateThinBloodBalance && !window.validateThinBloodBalance()) return;

    const characterData = window.getFullCharacterData ? window.getFullCharacterData() : {};

    if (!characterData.name) characterData.name = "Без имени";

    setButtonBusy('[onclick="saveCharacter()"]', true, 'Сохраняю...');

    let existingId = currentCharacterRecordId;
    if (!existingId) {
        const { data: existing } = await client
            .from('characters')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('name', characterData.name)
            .limit(1)
            .maybeSingle();
        existingId = existing?.id || null;
    }

    const payload = {
        user_id: currentUser.id,
        name: characterData.name,
        clan: characterData.clan || null,
        data: characterData
    };

    const request = existingId
        ? client.from('characters').update(payload).eq('id', existingId).eq('user_id', currentUser.id).select('id').single()
        : client.from('characters').insert(payload).select('id').single();

    const { data, error } = await request;

    setButtonBusy('[onclick="saveCharacter()"]', false);

    if (error) {
        console.error(error);
        alert("❌ Ошибка сохранения:\n" + error.message);
    } else {
        currentCharacterRecordId = data?.id || existingId;
        charactersListCache = null;
        alert(`✅ Персонаж "${characterData.name}" сохранён.`);
    }
}

async function fetchMyCharacters({ force = false } = {}) {
    const client = ensureSupabase();
    if (!client || !currentUser) return [];
    if (!force && charactersListCache) return charactersListCache;

    const { data, error } = await client
        .from('characters')
        .select('id, name, clan, created_at, data')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    if (error) {
        console.error(error);
        alert("Ошибка загрузки списка");
        return [];
    }
    charactersListCache = data || [];
    return charactersListCache;
}

async function showMyCharacters() {
    const client = ensureSupabase();
    if (!client) return;
    if (!currentUser) {
        alert("❌ Войдите в аккаунт!");
        showAuthModal();
        return;
    }

    showModal(`<div style="padding:28px; width:min(420px,92vw); background:#111; border:2px solid #ff3131; border-radius:10px; color:#eee; text-align:center;">Загружаю персонажей...</div>`);
    const data = await fetchMyCharacters({ force: true });

    if (!data || data.length === 0) {
        return alert("У вас пока нет сохранённых персонажей.");
    }

    let html = `<div style="position:relative;padding:24px; width:min(980px,96vw); max-height:86vh; overflow:auto; background:#111; border:2px solid #ff3131; border-radius:10px; color:#eee;">
        <button onclick="closeModal()" title="Закрыть" style="position:absolute; top:12px; right:16px; background:none; border:none; color:#ff3131; font-size:32px; cursor:pointer; line-height:1;">×</button>
        <h2 style="color:#ff3131; text-align:center; margin:0 0 18px;">📋 Мои персонажи (${data.length})</h2>
        <table style="width:100%; border-collapse:collapse; background:#111;">
            <thead><tr style="background:#222;">
                <th style="padding:12px; text-align:left;">Картинка</th>
                <th style="padding:12px; text-align:left;">Имя</th>
                <th style="padding:12px; text-align:center;">Клан</th>
                <th style="padding:12px; text-align:center;">Создан</th>
                <th style="padding:12px; text-align:center;">Действия</th>
            </tr></thead><tbody>`;

    data.forEach(char => {
        const date = new Date(char.created_at).toLocaleString('ru-RU');
        const image = char.data?.characterImage || '';
        html += `
            <tr style="border-bottom:1px solid #333;">
                <td style="padding:12px;">
                    ${image ? `<img src="${image}" alt="" style="width:58px;height:76px;object-fit:cover;border-radius:6px;border:1px solid #333;">` : `<div style="width:58px;height:76px;border:1px dashed #444;border-radius:6px;color:#666;display:flex;align-items:center;justify-content:center;font-size:11px;">нет</div>`}
                </td>
                <td style="padding:12px;">${char.name}</td>
                <td style="padding:12px; text-align:center; color:#aaa;">${char.clan || '—'}</td>
                <td style="padding:12px; text-align:center; color:#aaa;">${date}</td>
                <td style="padding:12px; text-align:center; white-space:nowrap;">
                    <button onclick="loadCharacter('${char.id}', this)" style="background:#ff3131; color:white; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; margin-right:8px;">Загрузить</button>
                    <button onclick="deleteCharacter('${char.id}', '${String(char.name).replace(/'/g, "\\'")}')" style="background:#330000; color:#ff6666; border:1px solid #7a2222; padding:8px 14px; border-radius:6px; cursor:pointer;">Удалить</button>
                </td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    showModal(html);
}

async function loadCharacter(id, button = null) {
    const client = ensureSupabase();
    if (!client) return;
    if (!currentUser) {
        alert("❌ Войдите в аккаунт!");
        showAuthModal();
        return;
    }

    setButtonBusy(button, true, 'Загружаю...');
    const { data, error } = await client
        .from('characters')
        .select('id, data')
        .eq('id', id)
        .eq('user_id', currentUser.id)
        .single();

    if (error || !data?.data) {
        console.error(error);
        setButtonBusy(button, false);
        return alert("Ошибка загрузки персонажа");
    }

    if (!window.applyCharacterData) {
        return alert("Лист ещё не готов к загрузке персонажа. Обновите страницу и попробуйте снова.");
    }

    currentCharacterRecordId = data.id;
    window.applyCharacterData(data.data, 'личного кабинета');
    closeModal();
    setButtonBusy(button, false);
}

async function loadRequestedCharacter() {
    const params = new URLSearchParams(window.location.search);
    const characterId = params.get('characterId');
    if (!characterId || requestedCharacterLoadStarted) return;

    const isMasterView = params.get('role') === 'master';
    if (!currentUser && !isMasterView) {
        console.warn('Автозагрузка персонажа пропущена: пользователь не вошёл в аккаунт.');
        return;
    }
    if (!window.applyCharacterData) return;

    const client = ensureSupabase();
    if (!client) return;
    requestedCharacterLoadStarted = true;

    let request = client
        .from('characters')
        .select('id, user_id, data')
        .eq('id', characterId);

    if (!isMasterView && currentUser) request = request.eq('user_id', currentUser.id);

    const { data, error } = await request.single();
    if (error || !data?.data) {
        requestedCharacterLoadStarted = false;
        console.error('Не удалось автоматически загрузить выбранного персонажа:', error);
        alert('Не удалось открыть выбранного персонажа. Возможно, у вас нет доступа к этому листу.');
        return;
    }

    const ownsCharacter = Boolean(currentUser && data.user_id === currentUser.id);
    currentCharacterRecordId = ownsCharacter ? data.id : null;
    window.applyCharacterData(data.data, isMasterView && !ownsCharacter ? 'игрового стола (просмотр мастера)' : 'игрового стола');

    if (ownsCharacter) {
        const room = params.get('room');
        localStorage.setItem(`vtm-chat-character:${currentUser.id}`, data.id);
        localStorage.setItem(`vtm-home-character:${currentUser.id}`, data.id);
        if (room) localStorage.setItem(`vtm-chat-character:${currentUser.id}:${room}`, data.id);
    }
}

window.addEventListener('vtm-sheet-ready', loadRequestedCharacter);
if (window.__vtmSheetReady) queueMicrotask(loadRequestedCharacter);

async function deleteCharacter(id, name = 'персонажа') {
    const client = ensureSupabase();
    if (!client) return;
    if (!currentUser) {
        alert("❌ Войдите в аккаунт!");
        showAuthModal();
        return;
    }

    if (!confirm(`Удалить «${name}»?`)) return;

    const { error } = await client
        .from('characters')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id);

    if (error) {
        console.error(error);
        return alert("Ошибка удаления персонажа:\n" + error.message);
    }

    if (currentCharacterRecordId === id) currentCharacterRecordId = null;
    charactersListCache = null;
    await showMyCharacters();
}

// Глобальные функции
window.saveCharacter = saveCharacter;
window.showMyCharacters = showMyCharacters;
window.loadCharacter = loadCharacter;
window.deleteCharacter = deleteCharacter;
