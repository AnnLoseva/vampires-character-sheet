// ==================== ПРОСТАЯ АВТОРИЗАЦИЯ (username + password) ====================

const SUPABASE_URL = 'https://klhxbaagarqxaqnrvurr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaHhiYWFnYXJxeGFxbnJ2dXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzkwNjAsImV4cCI6MjA5MzY1NTA2MH0.Cy2496DJgJhqZkERL9h19FkiiTfkcW2pauPaJU5r5oY';

let supabaseClient = null;
let currentUser = null;

function initSupabase() {
    if (supabaseClient) return;
    
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase подключён (простая авторизация)");
    checkUserSession();
}

async function checkUserSession() {
    // Можно добавить сохранение в localStorage позже
    updateAuthButton();
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
        
        <button onclick="handleLogin()" style="width:100%; padding:15px; margin:12px 0 8px 0; background:#ff3131; color:white; border:none; border-radius:8px; font-size:16px;">Войти</button>
        <button onclick="handleRegister()" style="width:100%; padding:15px; background:#444; color:white; border:none; border-radius:8px; font-size:16px;">Создать аккаунт</button>
        
        <button onclick="closeModal()" style="width:100%; margin-top:20px; padding:12px; background:transparent; color:#888; border:none;">Закрыть</button>
    </div>`;

    showModal(html);
}

// ==================== РЕГИСТРАЦИЯ ====================
window.handleRegister = async () => {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!username || username.length < 3) return alert("Имя пользователя минимум 3 символа");
    if (password.length < 6) return alert("Пароль минимум 6 символов");

    // Простой hash (для теста)
    const passwordHash = btoa(password); // временно, потом заменим на нормальный

    const { error } = await supabaseClient
        .from('users')
        .insert({ username, password_hash: passwordHash });

    if (error) {
        if (error.code === '23505') alert("Пользователь с таким именем уже существует");
        else alert("Ошибка регистрации: " + error.message);
    } else {
        alert(`✅ Аккаунт создан!\nЛогин: ${username}`);
        closeModal();
    }
};

// ==================== ВХОД ====================
window.handleLogin = async () => {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!username || !password) return alert("Введите логин и пароль");

    const passwordHash = btoa(password);

    const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password_hash', passwordHash)
        .single();

    if (error || !data) {
        alert("❌ Неверный логин или пароль");
    } else {
        currentUser = data;
        updateAuthButton();
        closeModal();
        alert(`✅ Добро пожаловать, ${username}!`);
    }
};

async function logout() {
    currentUser = null;
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
window.addEventListener('load', () => setTimeout(initSupabase, 600)






);


// ==================== СОХРАНЕНИЕ ПЕРСОНАЖЕЙ ====================

async function saveCharacter() {
    if (!currentUser) {
        alert("❌ Войдите в аккаунт, чтобы сохранить персонажа!");
        showAuthModal();
        return;
    }

    if (window.validateThinBloodBalance && !window.validateThinBloodBalance()) return;

    const characterData = window.getFullCharacterData ? window.getFullCharacterData() : {};

    if (!characterData.name) characterData.name = "Без имени";

    const { error: deleteError } = await supabaseClient
        .from('characters')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('name', characterData.name);

    if (deleteError) {
        console.error(deleteError);
        return alert("❌ Ошибка перезаписи старого персонажа:\n" + deleteError.message);
    }

    const { error } = await supabaseClient
        .from('characters')
        .insert({
            user_id: currentUser.id,
            name: characterData.name,
            clan: characterData.clan || null,
            data: characterData
        });

    if (error) {
        console.error(error);
        alert("❌ Ошибка сохранения:\n" + error.message);
    } else {
        alert(`✅ Персонаж "${characterData.name}" сохранён. Если такое имя уже было, старая запись перезаписана.`);
    }
}

async function showMyCharacters() {
    if (!currentUser) {
        alert("❌ Войдите в аккаунт!");
        showAuthModal();
        return;
    }

    const { data, error } = await supabaseClient
        .from('characters')
        .select('id, name, clan, created_at, data')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return alert("Ошибка загрузки списка");
    }

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
                    <button onclick="loadCharacter('${char.id}')" style="background:#ff3131; color:white; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; margin-right:8px;">Загрузить</button>
                    <button onclick="deleteCharacter('${char.id}', '${String(char.name).replace(/'/g, "\\'")}')" style="background:#330000; color:#ff6666; border:1px solid #7a2222; padding:8px 14px; border-radius:6px; cursor:pointer;">Удалить</button>
                </td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    showModal(html);
}

async function loadCharacter(id) {
    if (!currentUser) {
        alert("❌ Войдите в аккаунт!");
        showAuthModal();
        return;
    }

    const { data, error } = await supabaseClient
        .from('characters')
        .select('data')
        .eq('id', id)
        .eq('user_id', currentUser.id)
        .single();

    if (error || !data?.data) {
        console.error(error);
        return alert("Ошибка загрузки персонажа");
    }

    if (!window.applyCharacterData) {
        return alert("Лист ещё не готов к загрузке персонажа. Обновите страницу и попробуйте снова.");
    }

    window.applyCharacterData(data.data, 'личного кабинета');
    closeModal();
    alert(`✅ Персонаж «${data.data.name || 'Без имени'}» загружен!`);
}

async function deleteCharacter(id, name = 'персонажа') {
    if (!currentUser) {
        alert("❌ Войдите в аккаунт!");
        showAuthModal();
        return;
    }

    if (!confirm(`Удалить «${name}»?`)) return;

    const { error } = await supabaseClient
        .from('characters')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id);

    if (error) {
        console.error(error);
        return alert("Ошибка удаления персонажа:\n" + error.message);
    }

    await showMyCharacters();
}

// Глобальные функции
window.saveCharacter = saveCharacter;
window.showMyCharacters = showMyCharacters;
window.loadCharacter = loadCharacter;
window.deleteCharacter = deleteCharacter;
