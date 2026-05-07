

// ==================== ВЕСЬ СКРИПТ (все части вместе) ====================
// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let RULES = {};
let currentPackage = 'balanced';
let clanDisciplines = [];
let predatorDisciplines = [];
let currentClanData = [];
let currentPredatorData = [];
let currentClanIndex = 0;
let currentPredatorIndex = 0;
let currentClanDisciplines = [];     // какие дисциплины дал клан
let currentPredatorDisciplines = []; // какие дисциплины дал стиль охоты
let clanProvidedDisciplines = {};      // дисциплины от текущего клана
let predatorProvidedDisciplines = {};  // дисциплины от текущего стиля охоты
let selectedMerits = [];   // {category, name, points, fullDesc, mechanic}
let selectedFlaws = [];


// ==================== ЗАГРУЗКА ДАННЫХ ====================
async function loadRules() {
    try {
        const response = await fetch('rules.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error('rules.json не найден');

        RULES = await response.json();

        console.log('✅ RULES успешно загружены');
        console.log('Преимуществ:', Object.keys(RULES.advantages?.merits || {}).length);
        console.log('Недостатков:', Object.keys(RULES.flaws || {}).length);

    } catch (err) {
        console.error('❌ Ошибка загрузки rules.json:', err);
        alert('Не удалось загрузить rules.json');
    }

    // Инициализация
    renderAttributes();
    renderSkills();
    populateSelects();
}

// Запускаем загрузку при старте
window.addEventListener('load', () => {
    loadRules().then(() => {
        renderDisciplines();        // ← добавь эту строку
        preloadAllSkills();
        preloadAllAttributes();
    });
    setupEventListeners();
});
// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function initSheet() {
    populateSelects();
    renderAttributes();
    renderSkills();
    updateTrackers();
    preloadAllAttributes();
    preloadAllSkills();

        console.log("Тест точек:", document.querySelectorAll('.dot-label').length);

}

function populateSelects() {
    // === КЛАНЫ ===
    const clanSelect = document.getElementById('clan-input');
    clanSelect.innerHTML = '<option value="">Выберите клан</option>';
    
    Object.keys(RULES.clans || {}).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        clanSelect.appendChild(opt);
    });

    // === СТИЛИ ОХОТЫ ===
    const predSelect = document.getElementById('predator-input');
    predSelect.innerHTML = '<option value="">Стиль Охоты</option>';
    
    Object.keys(RULES.predator_types || {}).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        predSelect.appendChild(opt);
    });
}


function renderAttributes() {
    const container = document.getElementById('attributes-grid');
    if (!container) return;
    container.innerHTML = '';

    const categories = {
        "Физические": ["Сила", "Ловкость", "Выносливость"],
        "Социальные": ["Обаяние", "Манипуляция", "Самообладание"],
        "Ментальные": ["Интеллект", "Смекалка", "Упорство"]
    };

    Object.keys(categories).forEach(cat => {
        const col = document.createElement('div');
        col.className = 'col';  
        col.innerHTML = `<div class="cat-name">${cat}</div>`;

        categories[cat].forEach(name => {
            let dotsHTML = '';
            
            // Только точки 1–5 (как у навыков)
            for (let i = 5; i >= 1; i--) {
                dotsHTML += `
                    <input type="radio" id="a-${name}-${i}" name="${name}" 
                           value="${i}" class="dot-input" data-type="attr" 
                           style="display:none;">
                    <label for="a-${name}-${i}" class="dot-label" 
                           data-level="${i}" data-name="${name}"></label>`;
            }

            // Скрытое радио для сброса в 0
            dotsHTML += `
                <input type="radio" id="a-${name}-0" name="${name}" value="0" 
                       class="dot-input" data-type="attr" style="display:none;" checked>`;

            col.innerHTML += `
                <div class="row">
                    <span class="attr-name tooltip-trigger" data-attr="${name}">${name}</span>
                    <div class="dots">${dotsHTML}</div>
                </div>`;
        });

        container.appendChild(col);
    });
}

function renderSkills() {
    const container = document.getElementById('skills-grid');
    if (!container) return;
    container.innerHTML = '';

    const categories = {
        "Физические": ["Атлетика", "Вождение", "Воровство", "Выживание", "Драка", "Ремесло", "Скрытность", "Стрельба", "Фехтование"],
        "Социальные": ["Запугивание", "Исполнение", "Лидерство", "Обращение с животными", "Проницательность", "Убеждение", "Уличное чутьё", "Хитрость", "Этикет"],
        "Ментальные": ["Гуманитарные науки", "Естественные науки", "Медицина", "Наблюдательность", "Оккультизм", "Политика", "Расследование", "Техника", "Финансы"]
    };

    Object.keys(categories).forEach(cat => {
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `<div class="cat-name">${cat}</div>`;

        categories[cat].forEach(name => {
            let dotsHTML = '';
            for (let i = 5; i >= 1; i--) {
                dotsHTML += `
                    <input type="radio" id="sk-${name}-${i}" name="${name}" value="${i}" class="dot-input" data-type="skill" style="display:none;">
                    <label for="sk-${name}-${i}" class="dot-label" data-level="${i}" data-name="${name}"></label>`;
            }

            col.innerHTML += `
                <div class="row">
                    <div class="label-group">
                        <input type="checkbox" id="s-${name}" class="spec-checkbox" style="display:none;">
                        <label for="s-${name}" class="s-badge">S</label>
                        <span class="skill-name tooltip-trigger" data-skill="${name}">${name}</span>
                    </div>
                    <div class="dots">${dotsHTML}</div>
                </div>
                <div id="specs-${name}" class="skill-specs"></div>`;
        });

        container.appendChild(col);
    });

    // Инициализация состояния S-бейджей после рендера
    setTimeout(() => {
        document.querySelectorAll('.skill-name').forEach(el => {
            const skillName = el.getAttribute('data-skill') || el.textContent.trim();
            if (skillName) updateSBadgeState(skillName);
        });
    }, 150);
}




// ==================== ОБНОВЛЕНИЕ ВИТАЛОВ + ПОДСКАЗКИ ====================
function updateVitals() {
    // Здоровье
    const staminaInput = document.querySelector('input[name="Выносливость"]:checked');
    const stamina = staminaInput ? parseInt(staminaInput.value) : 1;
    const hp = stamina + 3;
    document.getElementById('val-hp').textContent = hp;
    document.getElementById('val-hp').setAttribute('data-tooltip', 
        `Здоровье = Выносливость(${stamina}) + 3 = ${hp}`);

    // Сила воли
    const composureInput = document.querySelector('input[name="Самообладание"]:checked');
    const resolveInput = document.querySelector('input[name="Упорство"]:checked');
    const composure = composureInput ? parseInt(composureInput.value) : 1;
    const resolve = resolveInput ? parseInt(resolveInput.value) : 1;
    const wp = composure + resolve;
    document.getElementById('val-wp').textContent = wp;
    document.getElementById('val-wp').setAttribute('data-tooltip', 
        `Сила воли = Самообладание(${composure}) + Упорство(${resolve}) = ${wp}`);

    // Человечность
    updateHumanity();
}

function updateHumanity() {
    const predatorName = document.getElementById('predator-input').value;
    let modifier = 0;
    let modifierText = "";

    if (predatorName && RULES.predator_types?.[predatorName]) {
        modifier = RULES.predator_types[predatorName].humanity || 0;
        modifierText = modifier >= 0 ? `+${modifier}` : modifier;
    }

    const humanity = 7 + modifier;
    const el = document.getElementById('val-humanity');
    
    if (el) {
        el.textContent = humanity;
        el.style.color = 'white';
        el.setAttribute('data-tooltip', 
            `Человечность = 7 + модификатор от стиля охоты(${modifierText}) = ${humanity}`);
    }
}




// ==================== ЧИСТАЯ СИСТЕМА ДИСЦИПЛИН ====================

let disciplineSources = {}; 
let selectedPowers = {};

function mergeDiscipline(name, dotsToAdd = 1, source = "") {
    if (!name) return;
    name = name.trim();

    if (!disciplineSources[name]) disciplineSources[name] = {};

    const oldTotal = Object.values(disciplineSources[name]).reduce((sum, val) => sum + val, 0);

    disciplineSources[name][source] = (disciplineSources[name][source] || 0) + dotsToAdd;

    const newTotal = Object.values(disciplineSources[name]).reduce((sum, val) => sum + val, 0);

    console.log(`🔄 Обновляем "${name}" → ${newTotal} точек`);

    // === ЖЁСТКОЕ СТИРАНИЕ ВСЕХ СПОСОБНОСТЕЙ ПРИ УМЕНЬШЕНИИ ===
    if (newTotal < oldTotal) {
        if (selectedPowers[name]) {
            console.log(`🗑️ Точек стало меньше (${oldTotal} → ${newTotal}). ПОЛНОСТЬЮ удаляем ВСЕ способности у "${name}"`);
            delete selectedPowers[name];
        }
    }

    updateDisciplineRow(name);
    updateDisciplineTotal();
    renderDisciplines();
}
// Обновление или создание строки дисциплины
function updateDisciplineRow(name) {
    if (!disciplineSources[name]) return;

    const totalDots = Object.values(disciplineSources[name]).reduce((sum, val) => sum + val, 0);
    const sourcesList = Object.keys(disciplineSources[name]).join(" + ");

    // Удаляем все старые строки с этим именем
    document.querySelectorAll('.discipline-item').forEach(item => {
        const titleEl = item.querySelector('div:first-child');
        if (titleEl && titleEl.textContent.trim() === name) {
            item.remove();
        }
    });

    // Создаём новую
    addDisciplineRow(name, totalDots, sourcesList);
}

function addDisciplineRow(name, dots = 1, sourceText = "") {
    const list = document.getElementById('disciplines-list');
    if (!list) return;

    const item = document.createElement('div');
    item.className = 'discipline-item';

    let dotsHTML = '';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= dots ? 'filled' : '';
        dotsHTML += `<div class="disc-dot ${filled}" data-level="${i}"></div>`;
    }

    const sources = sourceText.split('+').map(s => s.trim()).filter(s => s);

    item.innerHTML = `
        <div style="flex: 1; font-size:16.5px;">${name}</div>
        <div class="dots-discipline" style="display:flex; gap:9px; pointer-events:none;">${dotsHTML}</div>
        <small style="color:#777; min-width:200px; line-height:1.4; text-align:right; white-space:pre-line;">
            ${sources.join('<br>')}
        </small>
        <button class="remove-disc-btn" style="background:#222;color:#ff6666;border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:20px;">×</button>
    `;

    // Удаление всей дисциплины
    item.querySelector('.remove-disc-btn').addEventListener('click', () => {
        delete disciplineSources[name];
        delete selectedPowers[name];        // ← тоже стираем способности
        item.remove();
        updateDisciplineTotal();
        renderDisciplines();
    });

        // Принудительно обновляем способности при перерисовке строки
    if (selectedPowers[name] && Object.values(disciplineSources[name] || {}).reduce((a,b)=>a+b,0) < selectedPowers[name].length) {
        delete selectedPowers[name];
    }


    list.appendChild(item);

    // === Кнопка "+" с актуальным количеством точек ===
    const addBtn = document.createElement('button');
    addBtn.className = 'add-power-btn';
    addBtn.innerHTML = '+';
    addBtn.title = `Добавить способности (${dots} точек)`;
    addBtn.style.cssText = `margin-left:12px;background:#ff3131;color:black;border:none;width:34px;height:34px;border-radius:50%;font-size:22px;cursor:pointer;flex-shrink:0;`;

    addBtn.onclick = (e) => {
        e.stopImmediatePropagation();
        openPowerSelectionModal(name, dots);   // используем актуальное dots
    };

    // Вставляем кнопку после названия
    const nameDiv = item.querySelector('div:first-child');
    if (nameDiv) {
        nameDiv.parentNode.insertBefore(addBtn, nameDiv.nextSibling);
    }
}

function renderDisciplines() {
    document.querySelectorAll('.discipline-item').forEach(item => {
        const nameEl = item.querySelector('div:first-child');
        if (!nameEl) return;
        const discName = nameEl.textContent.trim();

        // Удаляем старые кнопки и панели
        item.querySelectorAll('.add-power-btn, .powers-panel').forEach(el => el.remove());

        const currentDots = Object.values(disciplineSources[discName] || {}).reduce((a,b) => a + b, 0);

        if (currentDots < 1) return;

        // Кнопка "+"
        const addBtn = document.createElement('button');
        addBtn.className = 'add-power-btn';
        addBtn.innerHTML = '+';
        addBtn.title = `Добавить способности (${currentDots} точек)`;
        addBtn.style.cssText = `margin-left:12px;background:#ff3131;color:black;border:none;width:34px;height:34px;border-radius:50%;font-size:22px;cursor:pointer;flex-shrink:0;`;

        addBtn.onclick = (e) => {
            e.stopImmediatePropagation();
            openPowerSelectionModal(discName, currentDots);
        };

        nameEl.parentNode.insertBefore(addBtn, nameEl.nextSibling);

        // Панель способностей
        if (selectedPowers[discName] && selectedPowers[discName].length > 0) {
            const panel = document.createElement('div');
            panel.className = 'powers-panel';
            panel.style.cssText = `
                margin-left: auto; 
                background: #1a1a1a; 
                border: 1px solid #ff3131; 
                border-radius: 6px; 
                padding: 10px 14px; 
                font-size: 13.5px; 
                color: #ddd;
                min-width: 220px;
            `;
            panel.innerHTML = `
                <strong style="color:#ffae00;">Способности :</strong><br>
                ${selectedPowers[discName].map(p => `• ${p}`).join('<br>')}
            `;
            item.appendChild(panel);
        }
    });

}

// ==================== ПОДТВЕРЖДЕНИЕ ====================

function confirmClanDisciplines(clanName) {
    const disc2 = document.getElementById('clan-disc-2').value;
    const disc1 = document.getElementById('clan-disc-1').value;
    
    if (disc2) mergeDiscipline(disc2, 2, `Клан ${clanName}`);
    if (disc1) mergeDiscipline(disc1, 1, `Клан ${clanName}`);

    closeClanDiscModal();
}

function confirmPredatorDiscipline(predatorName) {
    const disc = document.getElementById('pred-disc-select').value;
    if (!disc) return alert("Выберите дисциплину!");

    mergeDiscipline(disc, 1, `Охота: ${predatorName}`);

    closePredDiscModal();
}
// ==================== МОДАЛЬНЫЕ ОКНА ДЛЯ ВЫБОРА ДИСЦИПЛИН ====================

function openClanDisciplineModal(clanName) {
    const clanData = RULES.clans?.[clanName];
    if (!clanData || !clanData.disciplines || clanData.disciplines.length < 2) {
        alert("Для клана " + clanName + " нет данных по дисциплинам.");
        return;
    }

    const modalHTML = `
    <div id="clan-disc-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.97);z-index:20000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#111;border:3px solid #ff3131;padding:40px;width:960px;border-radius:10px;max-width:95%; display:flex; gap:30px;">
            <div style="flex:1;">
                <h2 style="color:#ff3131;text-align:center;margin:0 0 20px;">${clanName}</h2>
                <p style="text-align:center;color:#ccc;margin-bottom:30px;">Выбери стартовые дисциплины клана</p>
                
                <div style="margin-bottom:25px;">
                    <label style="display:block;color:#ffae00;margin-bottom:8px;font-weight:bold;">Дисциплина на <span style="color:#ff3131">2 точки</span>:</label>
                    <select id="clan-disc-2" style="width:100%;padding:12px;background:#000;color:white;border:1px solid #555;font-size:16px;" onchange="showDisciplineHint(this.value)">
                        ${clanData.disciplines.map(d => `<option value="${d}">${d}</option>`).join('')}
                    </select>
                </div>
                
                <div style="margin-bottom:35px;">
                    <label style="display:block;color:#ffae00;margin-bottom:8px;font-weight:bold;">Дисциплина на <span style="color:#ff3131">1 точку</span>:</label>
                    <select id="clan-disc-1" style="width:100%;padding:12px;background:#000;color:white;border:1px solid #555;font-size:16px;" onchange="showDisciplineHint(this.value)">
                        ${clanData.disciplines.map(d => `<option value="${d}">${d}</option>`).join('')}
                    </select>
                </div>
                
                <div style="text-align:center;">
                    <button onclick="confirmClanDisciplines('${clanName}')" 
                            style="background:#ff3131;color:black;padding:15px 45px;border:none;font-size:18px;border-radius:6px;cursor:pointer;margin-right:15px;">
                         Подтвердить
                    </button>
                    <button onclick="closeClanDiscModal()" 
                            style="background:#333;color:white;padding:15px 35px;border:none;font-size:18px;border-radius:6px;cursor:pointer;">
                        Отмена
                    </button>
                </div>
            </div>

            <div id="discipline-hint-panel" style="width:380px; background:#0a0a0a; border:1px solid #333; border-radius:8px; padding:20px; color:#ddd; font-size:14.5px; line-height:1.6; overflow-y:auto; max-height:520px;">
                <p style="color:#666; text-align:center; font-style:italic;">Выберите дисциплину слева</p>
            </div>
        </div>
    </div>`;

    document.getElementById('clan-disc-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function openPredatorDisciplineModal(predName) {
    const predData = RULES.predator_types?.[predName];
    if (!predData) return;

    const hasDisciplines = predData.disciplines?.increase?.options?.length > 0;
    if (!hasDisciplines) {
        console.log(`ℹ️ Для ${predName} нет дисциплин`);
        return;
    }

    const options = predData.disciplines.increase.options;
    const value = predData.disciplines.increase.value || 1;

    const modalHTML = `
    <div id="pred-disc-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.97);z-index:20000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#111;border:3px solid #ff3131;padding:40px;width:620px;border-radius:10px;">
            <h2 style="color:#ff3131;text-align:center;margin:0 0 25px;">${predName}</h2>
            <p style="text-align:center;color:#ccc;margin-bottom:25px;">Выбери дисциплину (+${value} точка)</p>
            
            <select id="pred-disc-select" style="width:100%;padding:14px;background:#000;color:white;border:1px solid #555;font-size:17px;margin-bottom:30px;">
                ${options.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
            
            <div style="text-align:center;">
                <button onclick="confirmPredatorDiscipline('${predName}')" 
                        style="background:#ff3131;color:black;padding:14px 40px;border:none;font-size:17px;border-radius:6px;margin-right:12px;">
                    Подтвердить
                </button>
                <button onclick="closePredDiscModal()" 
                        style="background:#333;color:white;padding:14px 35px;border:none;font-size:17px;border-radius:6px;">
                    Отмена
                </button>
            </div>
        </div>
    </div>`;

    document.getElementById('pred-disc-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeClanDiscModal() {
    document.getElementById('clan-disc-modal')?.remove();
}

function closePredDiscModal() {
    document.getElementById('pred-disc-modal')?.remove();
}

// Подсказка по дисциплине в модальном окне
function showDisciplineHint(discName) {
    const panel = document.getElementById('discipline-hint-panel');
    if (!panel) return;

    if (!discName) {
        panel.innerHTML = `<p style="color:#666;text-align:center;font-style:italic;">Выберите дисциплину</p>`;
        return;
    }

    const disc = RULES.disciplines?.[discName];
    if (!disc) {
        panel.innerHTML = `<p style="color:#ffae00;">Дисциплина не найдена: <strong>${discName}</strong></p>`;
        return;
    }

    let html = `
        <h3 style="color:#ff3131; margin:0 0 12px;">${discName}</h3>
        <div style="color:#ddd; line-height:1.65;">
            ${disc.description || 'Описание отсутствует'}
        </div>
    `;

    if (disc.system) {
        html += `
            <div style="margin-top:15px; background:#1a1a1a; padding:10px; border-radius:6px; font-size:13.5px;">
                <strong>Тип:</strong> ${disc.system.type || '—'}<br>
                <strong>Маскарад:</strong> ${disc.system.masquerade || '—'}
            </div>
        `;
    }

    panel.innerHTML = html;
}

// ==================== СБРОС + ОТКРЫТИЕ ГАЛЕРЕИ ====================
function resetClanDisciplines() {
    console.log("=== СБРОС КЛАНА ЗАПУЩЕН ===");
    console.log("Текущие disciplineSources:", JSON.parse(JSON.stringify(disciplineSources)));

    const huntBackup = {};

    Object.keys(disciplineSources).forEach(disc => {
        Object.keys(disciplineSources[disc]).forEach(src => {
            if (src.includes("Охота")) {
                if (!huntBackup[disc]) huntBackup[disc] = {};
                huntBackup[disc][src] = disciplineSources[disc][src];
                console.log(`   ✅ НАЙДЕНО ОТ ОХОТЫ: ${disc} ← ${src} (${disciplineSources[disc][src]} точек)`);
            }
        });
    });

    console.log("💾 huntBackup:", JSON.parse(JSON.stringify(huntBackup)));

    // Очищаем
    disciplineSources = {};
    clanProvidedDisciplines = {};

    // Восстанавливаем
    Object.keys(huntBackup).forEach(disc => {
        disciplineSources[disc] = { ...huntBackup[disc] };
        const total = Object.values(disciplineSources[disc]).reduce((a,b) => a+b, 0);
        const text = Object.keys(disciplineSources[disc]).join(" + ");
        console.log(`   🔥 ВОССТАНОВЛЕНО: ${disc} → ${total} (${text})`);
    });

    console.log("Итоговые disciplineSources после восстановления:", JSON.parse(JSON.stringify(disciplineSources)));

    // Перерисовка
    const list = document.getElementById('disciplines-list');
    if (list) list.innerHTML = '';

    Object.keys(disciplineSources).forEach(name => {
        if (disciplineSources[name]) {
            const total = Object.values(disciplineSources[name]).reduce((a,b)=>a+b,0);
            const text = Object.keys(disciplineSources[name]).join(" + ");
            addDisciplineRow(name, total, text);
        }
    });

    updateDisciplineTotal();
    renderDisciplines();
}

// ==================== СБРОС ОХОТЫ (оставляем Клан) ====================
function resetPredatorDisciplines() {
    console.log("🗑️ СБРОС ОХОТЫ — сохраняем только КЛАН");

    const clanBackup = {};

    Object.keys(disciplineSources).forEach(disc => {
        const sources = disciplineSources[disc];
        Object.keys(sources).forEach(src => {
            if (src.includes("Клан")) {
                if (!clanBackup[disc]) clanBackup[disc] = {};
                clanBackup[disc][src] = sources[src];
            }
        });
    });

    disciplineSources = {};
    predatorProvidedDisciplines = {};

    Object.keys(clanBackup).forEach(disc => {
        disciplineSources[disc] = { ...clanBackup[disc] };
        const total = Object.values(disciplineSources[disc]).reduce((a, b) => a + b, 0);
        const text = Object.keys(disciplineSources[disc]).join(" + ");
        
        console.log(`   ✅ Восстановлено от Клана: ${disc} → ${total} (${text})`);
    });

    const list = document.getElementById('disciplines-list');
    if (list) list.innerHTML = '';

    Object.keys(disciplineSources).forEach(name => {
        if (disciplineSources[name]) {
            const total = Object.values(disciplineSources[name]).reduce((a,b)=>a+b,0);
            const text = Object.keys(disciplineSources[name]).join(" + ");
            addDisciplineRow(name, total, text);
        }
    });

    resetPredatorSpecialties();

    document.querySelectorAll('#pred-disc-modal, #spec-choice-modal').forEach(m => m.remove());

    updateDisciplineTotal();
    renderDisciplines();
}

// Сброс специализаций от предыдущего стиля охоты
// ==================== СБРОС ТОЛЬКО СПЕЦИАЛИЗАЦИЙ ОТ ОХОТЫ ====================
// ==================== СБРОС ТОЛЬКО ОТ ОХОТЫ (включая точку) ====================
function resetPredatorSpecialties() {
    console.log("🔄 Сбрасываем специализации + автоматические точки от предыдущей охоты");

    let removedCount = 0;

    document.querySelectorAll('.skill-spec-line').forEach(line => {
        const input = line.querySelector('input[type="text"]');
        if (input && input.value.includes('(от охоты)')) {
            const skillName = line.closest('.skill-specs').id.replace('specs-', '');
            
            // Удаляем строку специализации
            line.remove();
            removedCount++;

            // Сбрасываем точку в навыке (если она была добавлена автоматически)
            const radios = document.querySelectorAll(`input[name="${skillName}"]`);
            const currentDot = document.querySelector(`input[name="${skillName}"]:checked`);
            
            if (currentDot && parseInt(currentDot.value) === 1) {
                // Сбрасываем на 0
                radios.forEach(r => r.checked = false);
                const zeroRadio = document.querySelector(`input[name="${skillName}"][value="0"]`);
                if (zeroRadio) zeroRadio.checked = true;
            }
        }
    });

    // Обновляем всё
    document.querySelectorAll('.spec-checkbox').forEach(checkbox => {
        const skillName = checkbox.id.replace('s-', '');
        const container = document.getElementById('specs-' + skillName);
        
        if (container && container.children.length === 0) {
            checkbox.checked = false;
        }
        updateSBadgeState(skillName);
    });

    updateTrackers();

    console.log(`✅ Удалено ${removedCount} специализаций + автоматические точки от охоты`);
}





function updateAllDisciplineRows() {
    const list = document.getElementById('disciplines-list');
    if (list) list.innerHTML = '';

    Object.keys(disciplineSources).forEach(name => {
        if (disciplineSources[name]) {
            const total = Object.values(disciplineSources[name]).reduce((a,b)=>a+b,0);
            const text = Object.keys(disciplineSources[name]).join(" + ");
            addDisciplineRow(name, total, text);
        }
    });
}

function openPowerSelectionModal(discName, maxLevel) {
    const disc = RULES.disciplines?.[discName];
    if (!disc?.powers) {
        alert(`Нет способностей для ${discName}`);
        return;
    }

    let selected = [...(selectedPowers[discName] || [])];

    const modalHTML = `
    <div id="power-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.97);z-index:25000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#111;border:3px solid #ff3131;padding:30px;width:1100px;border-radius:12px;max-width:96%;max-height:92vh;display:flex;gap:25px;">
            
            <div style="flex:1;">
                <h2 style="color:#ff3131;text-align:center;margin:0 0 20px;">
                    ${discName} — Выбор способностей 
                    <span id="power-count" style="color:#ffae00;">(${selected.length}/${maxLevel})</span>
                </h2>
                <div id="power-list" style="overflow-y:auto;padding:10px;height:65vh;display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px;"></div>
            </div>

            <div id="power-hint-panel" style="width:420px; background:#0a0a0a; border:1px solid #333; border-radius:8px; padding:25px; color:#ddd; font-size:14.8px; line-height:1.65; overflow-y:auto; max-height:75vh;">
                <p style="color:#666; text-align:center; font-style:italic;">Выберите способность слева, чтобы увидеть описание</p>
            </div>
        </div>
        
        <div style="position:absolute; bottom:40px; left:50%; transform:translateX(-50%); display:flex; gap:15px;">
            <button id="power-confirm-btn" style="background:#ff3131;color:black;padding:14px 40px;border:none;border-radius:8px;font-size:16px;">Подтвердить</button>
            <button id="power-cancel-btn" style="background:#333;color:white;padding:14px 40px;border:none;border-radius:8px;font-size:16px;">Отмена</button>
        </div>
    </div>`;

    document.getElementById('power-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const listContainer = document.getElementById('power-list');
    const hintPanel = document.getElementById('power-hint-panel');

    function renderPowerCards() {
        listContainer.innerHTML = '';
        
        for (let lvl = 1; lvl <= maxLevel; lvl++) {
            if (!disc.powers[lvl]) continue;

            Object.keys(disc.powers[lvl]).forEach(powerName => {
                const power = disc.powers[lvl][powerName];
                const isSelected = selected.includes(powerName);

                const card = document.createElement('div');
                card.style.cssText = `
                    background:#1a1a1a; 
                    padding:16px; 
                    border-radius:8px; 
                    border:2px solid ${isSelected ? '#ff3131' : '#444'};
                    cursor: pointer;
                    transition: all 0.2s;
                `;

                card.innerHTML = `
                    <div style="color:#ffae00;font-weight:bold;">${powerName}</div>
                    <div style="color:#666;font-size:13px;">Уровень ${lvl}</div>
                    <div style="color:#ccc;margin-top:8px;line-height:1.5;">${power.description ? power.description.substring(0, 140) + '...' : 'Нет описания'}</div>
                `;

                card.addEventListener('click', () => {
                    if (isSelected) {
                        selected = selected.filter(p => p !== powerName);
                    } else if (selected.length < maxLevel) {
                        selected.push(powerName);
                    }
                    renderPowerCards();
                    document.getElementById('power-count').textContent = `(${selected.length}/${maxLevel})`;
                });

                card.addEventListener('mouseenter', () => {
                    let html = `
                        <h3 style="color:#ff3131; margin:0 0 12px;">${powerName} <span style="color:#666;font-size:14px;">(Уровень ${lvl})</span></h3>
                        <div style="line-height:1.65;">${power.description || 'Описание отсутствует'}</div>
                    `;
                    if (power.pool) html += `<p style="margin-top:12px;"><strong>Бросок:</strong> ${power.pool}</p>`;
                    if (power.cost) html += `<p><strong>Стоимость:</strong> ${power.cost}</p>`;
                    if (power.duration) html += `<p><strong>Длительность:</strong> ${power.duration}</p>`;

                    hintPanel.innerHTML = html;
                });

                listContainer.appendChild(card);
            });
        }
    }

    renderPowerCards();

    // Надёжное назначение кнопок
    const confirmBtn = document.getElementById('power-confirm-btn');
    const cancelBtn = document.getElementById('power-cancel-btn');

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            selectedPowers[discName] = selected;
            closePowerModal();
            renderDisciplines();
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = closePowerModal;
    }
}

function closePowerModal() {
    const modal = document.getElementById('power-modal');
    if (modal) modal.remove();
}

// ==================== МОДАЛЬНЫЙ ВЫБОР СПЕЦИАЛЬНОСТИ ====================
function showSpecialtyChoiceModal(predatorName, options, predData) {
    let html = `
    <div id="spec-choice-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:26000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#111;border:3px solid #ff3131;padding:35px 40px;width:520px;border-radius:12px;">
            <h3 style="color:#ff3131;text-align:center;margin:0 0 25px;">Выберите специализацию для «${predatorName}»</h3>
            
            <div style="display:flex;flex-direction:column;gap:12px;">`;

    options.forEach((opt, i) => {
        html += `
            <button onclick="applyPredatorSpecialty('${predatorName}', '${opt.replace(/'/g, "\\'")}'); closeSpecChoiceModal();" 
                    style="padding:14px 20px;background:#1a1a1a;border:1px solid #444;color:#ddd;font-size:15.5px;border-radius:6px;cursor:pointer;text-align:left;">
                ${opt}
            </button>`;
    });

    html += `</div>
            <button onclick="closeSpecChoiceModal()" 
                    style="margin-top:25px;width:100%;padding:12px;background:#333;color:white;border:none;border-radius:6px;cursor:pointer;">
                Отмена
            </button>
        </div>
    </div>`;

    document.getElementById('spec-choice-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
}

function closeSpecChoiceModal() {
    document.getElementById('spec-choice-modal')?.remove();
}

function applyPredatorSpecialty(predatorName, selectedOption) {
    const match = selectedOption.match(/(.+?)\s*\((.+?)\)/);
    let skillName = selectedOption;
    let specText = "";

    if (match) {
        skillName = match[1].trim();
        specText = match[2].trim();
    }

    // Добавляем точку (если ещё нет)
    const firstDot = document.querySelector(`input[name="${skillName}"][value="1"]`);
    if (firstDot) {
        const current = document.querySelector(`input[name="${skillName}"]:checked`);
        if (!current || parseInt(current.value) === 0) {
            firstDot.checked = true;
        }
    }

    // Добавляем/открываем специализацию
    const container = document.getElementById('specs-' + skillName);
    if (container) {
        container.style.display = 'flex';
        
        // Если ещё нет ни одной строки — создаём
        if (container.children.length === 0) {
            addSpecLine(skillName);
        }

        const input = container.querySelector('input[type="text"]');
        if (input && specText) {
            input.value = specText + " (от охоты)";
        }
    }

    // Активируем чекбокс
    const specCheckbox = document.getElementById(`s-${skillName}`);
    if (specCheckbox) specCheckbox.checked = true;

    console.log(`✅ Применена специализация от охоты: ${skillName} (${specText})`);

    closeSpecChoiceModal();
    setTimeout(() => openPredatorDisciplineModal(predatorName), 250);

    updateTrackers();
    updateSBadgeState(skillName);
}


// ==================== ИКОНКИ КЛАНОВ ====================




// Временные данные для иконок (можно расширить в rules.json позже)
const CLAN_ICONS = {
    "Бруха": "static/emojis/brujah.png",
    "Вентру": "static/emojis/ventrue.png",
    "Гангрел": "static/emojis/gangrel.png",
    "Малкавиан": "static/emojis/malkavian.png",
    "Носферату": "static/emojis/nosferatu.png",
    "Тореадор": "static/emojis/toreador.png",
    "Тремер": "static/emojis/tremere.png",
    "Каитиф": "static/emojis/caitiff.png",
    "Слабокровные": "static/emojis/thin_blood.png"
};

// Окрашивание иконки в фирменный красный цвет
async function tintImageToRed(imgUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imgUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue; // пропускаем прозрачные пиксели
                data[i] = 255;     // Red
                data[i + 1] = Math.floor(data[i + 1] * 0.1); // Green → почти 0
                data[i + 2] = Math.floor(data[i + 2] * 0.1); // Blue → почти 0
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
    });
}

// Кэш окрашенных иконок
const tintedCache = {};

// Получение окрашенной иконки
async function getTintedEmoji(url) {
    if (tintedCache[url]) return tintedCache[url];
    const tinted = await tintImageToRed(url);
    if (tinted) tintedCache[url] = tinted;
    return tinted;
}

// Обновление иконки клана
async function updateClanIcon() {
    const clanName = document.getElementById('clan-input').value;
    const container = document.getElementById('clan-icon-container');
    if (!container) return;

    if (!clanName) {
        container.innerHTML = '';
        return;
    }

    const tintedUrl = await getTintedEmoji(CLAN_ICONS[clanName]);
    if (tintedUrl) {
        container.innerHTML = `<img src="${tintedUrl}" class="clan-icon" alt="${clanName}">`;
    } else {
        container.innerHTML = `<span style="font-size:32px; color:#666;">🧛</span>`;
    }
}

// Рендер иконки (вспомогательная)
async function renderClanIcon(clanName) {
    const tintedUrl = await getTintedEmoji(CLAN_ICONS[clanName]);
    return tintedUrl 
        ? `<img src="${tintedUrl}" class="clan-icon" alt="${clanName}">` 
        : `<span style="font-size:32px; color:#ff3131;">❌</span>`;
}

// ==================== ГАЛЕРЕЯ КЛАНОВ ====================

// Открытие галереи кланов
function openClanGallery() {
    const modal = document.getElementById('clan-modal');
    const gallery = document.getElementById('clan-gallery');
    if (!modal || !gallery) return;

    gallery.innerHTML = '';

    currentClanData = [
        { name: "Бруха", image: "static/clan_gallery/brujah_full.png", desc: "Бунтари и идеалисты." },
        { name: "Вентру", image: "static/clan_gallery/ventrue_full.png", desc: "Аристократы и правители." },
        { name: "Гангрел", image: "static/clan_gallery/gangrel_full.png", desc: "Дикие дети природы." },
        { name: "Малкавиан", image: "static/clan_gallery/malkavian_full.png", desc: "Безумные пророки." },
        { name: "Носферату", image: "static/clan_gallery/nosferatu_full.png", desc: "Отверженные хранители тайн." },
        { name: "Тореадор", image: "static/clan_gallery/toreador_full.png", desc: "Художники и ценители красоты." },
        { name: "Тремер", image: "static/clan_gallery/tremere_full.png", desc: "Маги и учёные крови." },
        { name: "Каитиф", image: "static/clan_gallery/caitiff_full.png", desc: "Независимые и скрытные." },
        { name: "Слабокровные", image: "static/clan_gallery/thinblood_full.png", desc: "Самые молодые и слабые вампиры." }
    ];

    currentClanIndex = 0;

    currentClanData.forEach((c, index) => {
        const div = document.createElement('div');
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <img src="${c.image}" style="width:100%; max-height:60vh; object-fit:contain; border-radius:8px; border:2px solid #550000;">
            <h3 style="color:#ff3131; margin:12px 0 6px; text-align:center;">${c.name}</h3>
            <p style="color:#ddd; font-size:14px; padding:0 10px;">${c.desc}</p>
        `;
        div.onclick = () => {
            currentClanIndex = index;
            showSingleClan(c);
        };
        gallery.appendChild(div);
    });

    modal.style.display = 'block';
}


// ==================== КНОПКИ ГАЛЕРЕЙ ====================

function resetAndOpenClanGallery() {
    resetClanDisciplines();        // очищаем старые дисциплины клана
    openClanGallery();
}

function resetAndOpenPredatorGallery() {
    resetPredatorDisciplines();    // очищаем старые дисциплины охоты
    openPredatorGallery();
}

async function showSingleClan(clan) {
    const gallery = document.getElementById('clan-gallery');
    const data = RULES.clans?.[clan.name] || {};

    let html = `
        <div style="text-align:center; padding:20px; max-width:1100px; margin:0 auto; position:relative;">
            
            <!-- Блок с изображением и стрелками -->
            <div style="position:relative; display:inline-block;">
                
                <button onclick="prevClan()" 
                        style="position:absolute; left: -50px; top: 50%; transform: translateY(-50%); 
                               background: rgba(0,0,0,0.85); color: #ff3131; border: 2px solid #ff3131; 
                               width: 70px; height: 70px; border-radius: 50%; font-size: 32px; 
                               cursor: pointer; z-index: 25; box-shadow: 0 0 25px rgba(255,49,49,0.6);">
                    ←
                </button>

                <button onclick="nextClan()" 
                        style="position:absolute; right: -50px; top: 50%; transform: translateY(-50%); 
                               background: rgba(0,0,0,0.85); color: #ff3131; border: 2px solid #ff3131; 
                               width: 70px; height: 70px; border-radius: 50%; font-size: 32px; 
                               cursor: pointer; z-index: 25; box-shadow: 0 0 25px rgba(255,49,49,0.6);">
                    →
                </button>

                <img src="${clan.image}" style="max-width:100%; max-height:65vh; border:4px solid #ff3131; border-radius:12px; box-shadow:0 0 40px rgba(255,49,49,0.6);">
            </div>

            <h2 style="color:#ff3131; margin:25px 0 15px;">${clan.name}</h2>

            <div style="background:#1a1a1a; border:1px solid #ff3131; border-radius:8px; padding:25px; text-align:left; font-size:15px; line-height:1.7;">
    `;

    if (data.description) html += `<p style="color:#ddd;">${data.description}</p>`;

    if (data.types) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ffae00;">Типичные представители:</strong><br>
                 <span style="color:#ccc;">${data.types}</span>`;
    }

    if (data.disciplines && data.disciplines.length) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ffae00;">Дисциплины:</strong><br>`;
        data.disciplines.forEach(d => {
            const desc = data.discipline_description?.[d] || '';
            html += `• <strong>${d}</strong> — ${desc}<br>`;
        });
    }

    if (data.bane) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ff6666;">Проклятие:</strong> 
                 <span style="color:#ff9999;">${data.bane}</span>`;
    }

    if (data.playstyle) html += `<hr style="border-color:#333;margin:20px 0;"><strong style="color:#ffae00;">Стиль игры:</strong><br>${data.playstyle}`;
    if (data.conflict) html += `<hr style="border-color:#333;margin:20px 0;"><strong style="color:#ffae00;">Внутренний конфликт:</strong><br>${data.conflict}`;

    if (data.archetypes && data.archetypes.length) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ffae00;">Архетипы:</strong><br>`;
        data.archetypes.forEach(a => html += `• ${a}<br>`);
    }

    html += `
            </div>

            <div style="margin-top:25px;">
                <button onclick="selectThisClan('${clan.name}')" 
                        style="background:#ff3131; color:black; border:none; padding:16px 40px; font-size:18px; border-radius:6px; cursor:pointer; margin:0 10px;">
                    Выбрать этот клан
                </button>
                <button onclick="openClanGallery()" 
                        style="background:transparent; color:#ff3131; border:2px solid #ff3131; padding:16px 40px; font-size:18px; border-radius:6px; cursor:pointer;">
                    ← Назад к списку
                </button>
            </div>
        </div>
    `;

    gallery.innerHTML = html;
}




// ==================== ГАЛЕРЕЯ СТИЛЕЙ ОХОТЫ ====================


// Открытие галереи стилей охоты
function openPredatorGallery() {
    const modal = document.getElementById('predator-modal');
    const gallery = document.getElementById('predator-gallery');
    gallery.innerHTML = '';

    currentPredatorData = [
        { name: "Бестия",       desc: "Насильственный стиль. Быстрое и грубое нападение.", image: "static/predator_gallery/Бестия.png" },
        { name: "Джентльмен",   desc: "Изысканный и расчётливый подход к охоте.", image: "static/predator_gallery/Джентльмен.png" },
        { name: "Идол",         desc: "Питание через поклонение и обожание.", image: "static/predator_gallery/Идол.png" },
        { name: "Искуситель",   desc: "Соблазнение и манипуляция жертвой.", image: "static/predator_gallery/Искуситель.png" },
        { name: "Морфей",       desc: "Охота через сны и воздействие на спящих.", image: "static/predator_gallery/Морфей.png" },
        { name: "Налётчик",     desc: "Стремительные налёты и быстрый отход.", image: "static/predator_gallery/Налётчик.png" },
        { name: "Семьянин",     desc: "Питание от членов семьи или близкого круга.", image: "static/predator_gallery/Семьянин.png" },
        { name: "Суррогатчик",  desc: "Использование посредников и суррогатов.", image: "static/predator_gallery/Суррогатчик.png" },
        { name: "Тусовщик",     desc: "Охота на вечеринках и в тусовках.", image: "static/predator_gallery/Тусовщик.png" },
        { name: "Фермер",       desc: "Содержание «фермы» из смертных доноров.", image: "static/predator_gallery/Фермер.png" }
    ];

    currentPredatorData.forEach(p => {
        const div = document.createElement('div');
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <img src="${p.image}" style="width:100%; max-height:60vh; object-fit:contain; border-radius:8px; border:2px solid #550000;">
            <h3 style="color:#ff3131; margin:12px 0 6px; text-align:center;">${p.name}</h3>
            <p style="color:#ddd; font-size:14px; padding:0 10px;">${p.desc}</p>
        `;
        div.onclick = () => showSinglePredator(p);
        gallery.appendChild(div);
    });

    modal.style.display = 'block';
}

// Предыдущий стиль охоты
function prevPredator() {
    currentPredatorIndex = (currentPredatorIndex - 1 + currentPredatorData.length) % currentPredatorData.length;
    showSinglePredator(currentPredatorData[currentPredatorIndex]);
}

// Следующий стиль охоты
function nextPredator() {
    currentPredatorIndex = (currentPredatorIndex + 1) % currentPredatorData.length;
    showSinglePredator(currentPredatorData[currentPredatorIndex]);
}

// Детальный просмотр одного стиля охоты
async function showSinglePredator(pred) {
    const gallery = document.getElementById('predator-gallery');
    const data = RULES.predator_types?.[pred.name] || {};

    let html = `
        <div style="text-align:center; padding:20px; max-width:1100px; margin:0 auto; position:relative;">
            <div style="position:relative; display:inline-block;">
                <button onclick="prevPredator()" style="position:absolute; left: -50px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.85); color: #ff3131; border: 2px solid #ff3131; width: 70px; height: 70px; border-radius: 50%; font-size: 32px; cursor: pointer; z-index: 25;">←</button>
                <button onclick="nextPredator()" style="position:absolute; right: -50px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.85); color: #ff3131; border: 2px solid #ff3131; width: 70px; height: 70px; border-radius: 50%; font-size: 32px; cursor: pointer; z-index: 25;">→</button>
                <img src="${pred.image}" style="max-width:100%; max-height:65vh; border:4px solid #ff3131; border-radius:12px; box-shadow:0 0 40px rgba(255,49,49,0.6);">
            </div>

            <h2 style="color:#ff3131; margin:25px 0 15px;">${pred.name}</h2>

            <div style="background:#1a1a1a; border:1px solid #ff3131; border-radius:8px; padding:25px; text-align:left; font-size:15px; line-height:1.7;">
                <p style="color:#ddd;">${data.description || 'Описание отсутствует'}</p>
    `;

    if (data.specialty?.options) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ffae00;">Специализация:</strong><br>
                 ${data.specialty.options.join(', ')}`;
    }

    if (data.advantages && data.advantages.length) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ffcc00;">Преимущества:</strong><br>`;
        data.advantages.forEach(a => html += `• ${typeof a === 'string' ? a : a.name || a}<br>`);
    }

    if (data.disadvantages && data.disadvantages.length) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ff6666;">Недостатки:</strong><br>`;
        data.disadvantages.forEach(d => html += `• ${typeof d === 'string' ? d : d.name || d}<br>`);
    }

    html += `</div>
            <div style="margin-top:25px;">
                <button onclick="selectThisPredator('${pred.name}')" 
                        style="background:#ff3131;color:black;border:none;padding:16px 40px;font-size:18px;border-radius:6px;cursor:pointer;">
                    Выбрать этот стиль охоты
                </button>
                <button onclick="openPredatorGallery()" 
                        style="background:transparent;color:#ff3131;border:2px solid #ff3131;padding:16px 40px;font-size:18px;border-radius:6px;cursor:pointer;">
                    ← Назад к списку
                </button>
            </div>
        </div>`;

    gallery.innerHTML = html;
}

// Выбор стиля охоты из галереи
function selectThisPredator(name) {
    document.getElementById('predator-input').value = name;
    closePredatorModal();
    loadPredatorHint();
    
    setTimeout(() => {
        applyPredatorType(name);   // ← главный вызов
    }, 150);
}

// Закрытие модального окна стилей охоты
function closePredatorModal() {
    document.getElementById('predator-modal').style.display = 'none';
}


// ==================== ВЫБОР И ЗАКРЫТИЕ ====================

// Выбор клана из галереи
function selectThisClan(name) {
    document.getElementById('clan-input').value = name;
    closeClanModal();
    loadClanHint();        // обновляем подсказку
    updateClanIcon();      // обновляем иконку
    setTimeout(() => openClanDisciplineModal(name), 100);
}

// Закрытие модального окна кланов
function closeClanModal() {
    document.getElementById('clan-modal').style.display = 'none';
}



// Закрытие модального окна стилей охоты
function closePredatorModal() {
    document.getElementById('predator-modal').style.display = 'none';
}


// ==================== ПОДТВЕРЖДЕНИЕ И ДОБАВЛЕНИЕ ====================
// ==================== ПОДТВЕРЖДЕНИЕ КЛАНА ====================
function confirmClanDisciplines(clanName) {
    const disc2 = document.getElementById('clan-disc-2').value;
    const disc1 = document.getElementById('clan-disc-1').value;

    if (disc2) {
        mergeDiscipline(disc2, 2, `Клан ${clanName}`);
        clanProvidedDisciplines[disc2] = 2;
    }
    if (disc1) {
        mergeDiscipline(disc1, 1, `Клан ${clanName}`);
        clanProvidedDisciplines[disc1] = 1;
    }

    closeClanDiscModal();
    updateDisciplineTotal();
}

// ==================== ПОДТВЕРЖДЕНИЕ ОХОТЫ ====================
function confirmPredatorDiscipline(predatorName) {
    const disc = document.getElementById('pred-disc-select').value;
    if (!disc) return alert("Выберите дисциплину!");

    mergeDiscipline(disc, 1, `Охота: ${predatorName}`);
    predatorProvidedDisciplines[disc] = 1;

    closePredDiscModal();
    updateDisciplineTotal();
}

function closeClanDiscModal() {
    document.getElementById('clan-disc-modal')?.remove();
}


// Пересчёт суммы точек дисциплин
function updateDisciplineTotal() {
    // Счётчик отключён
}


// ==================== ПОДСКАЗКИ (ХИНТЫ) ====================

// Подсказка по клану
function loadClanHint() {
    const clanName = document.getElementById('clan-input').value.trim();
    const box = document.getElementById('clan-hint-box');
    
    if (!clanName) { 
        box.style.display = 'none'; 
        return; 
    }

    const clan = RULES.clans?.[clanName];
    if (!clan) {
        box.style.display = 'none';
        return;
    }

    let html = `
        <strong style="color:#ff3131; font-size:21px;">${clanName}</strong><br><br>
        
        <div style="color:#ddd; line-height:1.65; font-size:14.8px;">
            ${clan.description || 'Описание отсутствует'}
        </div>
    `;

    // Типы персонажей
    if (clan.types) {
        html += `<hr style="border-color:#333; margin:18px 0;">
                 <strong style="color:#ffae00;">Типичные представители:</strong><br>
                 <span style="color:#ccc;">${clan.types}</span>`;
    }

    // Дисциплины + их описание
    if (clan.disciplines && clan.disciplines.length) {
        html += `<hr style="border-color:#333; margin:18px 0;">
                 <strong style="color:#ffae00;">Дисциплины клана:</strong><br>`;
        
        clan.disciplines.forEach(d => {
            const desc = clan.discipline_description?.[d] || '';
            html += `• <strong>${d}</strong> — ${desc}<br>`;
        });
    }

    // Изъян
    if (clan.bane) {
        html += `<hr style="border-color:#333; margin:18px 0;">
                 <strong style="color:#ff6666;">Проклятие клана:</strong><br>
                 <span style="color:#ff9999;">${clan.bane}</span>`;
    }

    // Стиль игры
    if (clan.playstyle) {
        html += `<hr style="border-color:#333; margin:18px 0;">
                 <strong style="color:#ffae00;">Стиль игры:</strong><br>
                 ${clan.playstyle}`;
    }

    // Конфликт
    if (clan.conflict) {
        html += `<hr style="border-color:#333; margin:18px 0;">
                 <strong style="color:#ffae00;">Внутренний конфликт:</strong><br>
                 ${clan.conflict}`;
    }

    // Архетипы
    if (clan.archetypes && clan.archetypes.length) {
        html += `<hr style="border-color:#333; margin:18px 0;">
                 <strong style="color:#ffae00;">Архетипы:</strong><br>`;
        clan.archetypes.forEach(a => {
            html += `• ${a}<br>`;
        });
    }

    box.innerHTML = html;
    box.style.display = 'block';
}

function loadPredatorHint() {
    const name = document.getElementById('predator-input').value;
    const box = document.getElementById('predator-hint-box');
    
    if (!name) { 
        box.style.display = 'none'; 
        return; 
    }

    const pred = RULES.predator_types?.[name];
    if (!pred) {
        box.style.display = 'none';
        return;
    }

    let html = `
        <strong style="color:#ff3131; font-size:21px;">${name}</strong><br><br>
        <div style="color:#ddd; line-height:1.6;">${pred.description || 'Описание отсутствует'}</div>
    `;

    if (pred.specialty?.options) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffae00;">Специализация:</strong><br>
                 ${pred.specialty.options.join(', ')}`;
    }

    if (pred.disciplines?.increase?.options) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffae00;">Дисциплина (+1):</strong><br>
                 ${pred.disciplines.increase.options.join(', ')}`;
    }

    if (pred.humanity !== undefined) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffae00;">Человечность:</strong> 
                 <span style="color:#ffd700;">${pred.humanity > 0 ? '+' : ''}${pred.humanity}</span>`;
    }

    box.innerHTML = html;
    box.style.display = 'block';
}

// ==================== ТРЕКЕРЫ И ВАЛИДАЦИЯ ====================

const ATTR_LIMITS = { 4: 1, 3: 3, 2: 4, 1: 1 };
const SKILL_PACKAGES = {
    specialist: { 4: 1, 3: 3, 2: 3, 1: 3 },
    balanced:   { 4: 0, 3: 3, 2: 5, 1: 7 },
    versatile:  { 4: 0, 3: 1, 2: 8, 1: 10 }
};

let counts = { attr: {4:0, 3:0, 2:0, 1:0}, skill: {4:0, 3:0, 2:0, 1:0} };

// Основная функция обновления трекеров
// Основная функция обновления трекеров
function updateTrackers() {
    const packageSelect = document.getElementById('skill-package');
    
    // Если способ развития ещё не выбран
    if (!packageSelect.value) {
        document.getElementById('skill-tracker').innerHTML = 
            '<span style="color:#888; font-style:italic;">Выберите способ развития выше</span>';
        document.getElementById('spec-tracker').textContent = 'Специализации (S): 0 / 1';
        return;
    }

    counts = { 
        attr: {5:0, 4:0, 3:0, 2:0, 1:0}, 
        skill: {5:0, 4:0, 3:0, 2:0, 1:0} 
    };

    document.querySelectorAll('.dot-input:checked').forEach(input => {
        const val = parseInt(input.value);
        if (val >= 1 && val <= 5) {
            counts[input.dataset.type][val]++;
        }
    });

    const stamina = parseInt(document.querySelector('input[name="Выносливость"]:checked')?.value || 1);
    const composure = parseInt(document.querySelector('input[name="Самообладание"]:checked')?.value || 1);
    const resolve = parseInt(document.querySelector('input[name="Упорство"]:checked')?.value || 1);

    document.getElementById('val-hp').textContent = stamina + 3;
    document.getElementById('val-wp').textContent = composure + resolve;

    renderTracker('attr', ATTR_LIMITS, 'attr-tracker');
    renderTracker('skill', SKILL_PACKAGES[packageSelect.value], 'skill-tracker');

    let specCount = document.querySelectorAll('.spec-checkbox:checked').length;
    document.getElementById('spec-tracker').textContent = `Специализации (S): ${specCount} / 1`;

    checkLimits();
    updateVitals();        // ←←← ДОБАВЬ ЭТУ СТРОКУ
}

function renderTracker(type, limits, trackerId) {
    let html = `<b>${type === 'attr' ? 'Атрибуты' : 'Навыки'}:</b><br>`;
    
    for (let v of [1,2,3,4,5]) {   // ← Изменили порядок: от 1 до 5
        const limit = limits[v] !== undefined ? limits[v] : 0;
        const count = counts[type][v] || 0;
        
        let color = '';
        if (v === 5 && count > 0) color = 'color:#ff3131;';           // превышение 5-й
        else if (count > limit) color = 'color:#ff3131;';             // превышение
        else if (count < limit) color = 'color:#ffae00;';             // мало (оранжевый)
        // иначе — белый (ровно)

        html += `<span style="${color}">На ${v}: ${count} / ${limit}</span><br>`;
    }
    document.getElementById(trackerId).innerHTML = html;
}

function checkLimits() {
    const guide = document.querySelector('.guide');
    const warning = document.getElementById('global-warning');
    
    let hasOver = false;

    // Проверка обычных лимитов
    Object.keys(counts.attr).forEach(v => {
        if (counts.attr[v] > ATTR_LIMITS[v]) hasOver = true;
    });
    Object.keys(counts.skill).forEach(v => {
        if (counts.skill[v] > SKILL_PACKAGES[currentPackage][v]) hasOver = true;
    });

    // Специальное правило: любая 5-я точка = красный
    if (counts.attr[5] > 0 || counts.skill[5] > 0) {
        hasOver = true;
    }

    if (hasOver) {
        guide.classList.add('error');
        warning.style.display = 'block';
    } else {
        guide.classList.remove('error');
        warning.style.display = 'none';
    }
}
// ==================== СПЕЦИАЛЬНОСТИ ====================

// Клик по S-бейджу
document.addEventListener('click', function(e) {
    if (!e.target.classList.contains('s-badge')) return;

    const checkbox = e.target.previousElementSibling;
    if (!checkbox || checkbox.disabled) return;

    const skillName = checkbox.id.replace('s-', '');
    const container = document.getElementById('specs-' + skillName);

    if (container.style.display === 'flex') {
        // Закрываем и гасим
        container.innerHTML = '';
        container.style.display = 'none';
        checkbox.checked = false;
    } else {
        // Открываем
        container.style.display = 'flex';
        if (container.children.length === 0) {
            addSpecLine(skillName);
        }
        checkbox.checked = true;
    }

    updateSBadgeState(skillName);
});

function addSpecLine(skillName) {
    const container = document.getElementById('specs-' + skillName);
    if (!container) return;

    const currentDots = parseInt(document.querySelector(`input[name="${skillName}"]:checked`)?.value || 0);
    const currentSpecs = container.children.length;

    if (currentSpecs >= currentDots) {
        alert(`У навыка "${skillName}" только ${currentDots} точ${currentDots === 1 ? 'ка' : 'ки'}.`);
        return;
    }

    const line = document.createElement('div');
    line.className = 'skill-spec-line';
    line.innerHTML = `
        <input type="text" placeholder="Название специальности" style="flex:1;">
        <button title="Добавить ещё" style="background:#222;color:#ffae00;">+</button>
        <button title="Удалить" style="background:#222;color:#ff6666;">×</button>
    `;

    // Кнопка "+"
    line.querySelectorAll('button')[0].addEventListener('click', () => addSpecLine(skillName));

    // Кнопка "×" — исправленный обработчик
    line.querySelectorAll('button')[1].addEventListener('click', () => {
        line.remove();
        setTimeout(() => {
            updateSBadgeState(skillName);
        }, 10);
    });

    container.appendChild(line);
    updateSBadgeState(skillName);
}

function updateSpecUI(skillName = null) {
    if (skillName) {
        const container = document.getElementById('specs-' + skillName);
        const checkbox = document.getElementById('s-' + skillName);
        
        if (container && checkbox) {
            const hasLines = container.children.length > 0;
            checkbox.checked = hasLines;   // ← главное
            
            if (!hasLines) {
                container.style.display = 'none';
            }
        }
    }

    // Общий счётчик
    const total = document.querySelectorAll('.skill-spec-line').length;
    document.getElementById('spec-tracker').textContent = `Специализации (S): ${total} / 1`;
    
    checkLimits();
}

// ==================== СПЕЦИАЛИЗАЦИИ (S-БЕЙДЖ) ====================

function updateSBadgeState(skillName) {
    const badge = document.querySelector(`label[for="s-${skillName}"]`);
    const checkbox = document.getElementById(`s-${skillName}`);
    const container = document.getElementById('specs-' + skillName);
    
    if (!badge || !checkbox) return;

    const dots = parseInt(document.querySelector(`input[name="${skillName}"]:checked`)?.value || 0);
    const hasActiveSpecs = container && container.children.length > 0;

    if (dots === 0) {
        // Нет точек — полностью выключаем
        badge.style.color = '#444';
        badge.style.borderColor = '#444';
        checkbox.checked = false;
        if (container) container.style.display = 'none';
    } else {
        // Есть точки
        if (hasActiveSpecs) {
            // Зажжён
            badge.style.color = '#ff3131';
            badge.style.borderColor = '#ff3131';
            checkbox.checked = true;
        } else {
            // Должен быть серым
            badge.style.color = '#444';
            badge.style.borderColor = '#444';
            checkbox.checked = false;
        }
    }
}





// ==================== ПОДСКАЗКИ ДЛЯ НАВЫКОВ ====================
async function preloadAllSkills() {
    const skills = Object.keys(RULES.skills || {});
    console.log(`Загружаем подсказки для ${skills.length} навыков`);
    
    for (let skill of skills) {
        const data = RULES.skills[skill];
        if (!data) continue;

        let fullText = `${skill}\n\n${data.description || 'Описание отсутствует'}`;
        if (data.specialties && data.specialties.length) {
            fullText += `\n\nСпециализации: ${data.specialties.join(', ')}`;
        }

        // Название навыка
        document.querySelectorAll(`[data-skill="${skill}"]`).forEach(el => {
            el.setAttribute('data-tooltip', fullText);
        });

        // Точки
        for (let level = 1; level <= 5; level++) {
            const dotDesc = data[`dot${level}`];
            if (dotDesc) {
                const text = `${skill} ● ${level}\n${dotDesc}`;
                document.querySelectorAll(`label[data-name="${skill}"][data-level="${level}"]`)
                    .forEach(label => label.setAttribute('data-tooltip', text));
            }
        }
    }
}

async function preloadAllAttributes() {
    const attributes = ["Сила", "Ловкость", "Выносливость", "Обаяние", "Манипуляция", "Самообладание", "Интеллект", "Смекалка", "Упорство"];
    
    for (let attr of attributes) {
        const data = RULES.attributes?.[attr] || { description: "Характеристика персонажа." };
        
        let fullText = `${attr}\n\n${data.description || 'Нет описания.'}`;
        
        document.querySelectorAll(`[data-attr="${attr}"]`).forEach(el => {
            el.setAttribute('data-tooltip', fullText);
        });

        for (let level = 1; level <= 5; level++) {
            const dotDesc = data[`dot${level}`] || `Уровень ${level}`;
            document.querySelectorAll(`label[data-name="${attr}"][data-level="${level}"]`)
                .forEach(label => {
                    label.setAttribute('data-tooltip', `${attr} ● ${level}\n${dotDesc}`);
                });
        }
    }
}






// ==================== СОХРАНЕНИЕ В JPG ====================

document.getElementById('btn-save').addEventListener('click', function() {
    const area = document.getElementById('capture-area');
    const charName = document.getElementById('char-name').value.trim() || 'Kindred';
    
    const btn = this;
    const originalText = btn.textContent;
    
    btn.textContent = 'Генерируем картинку...';
    btn.disabled = true;

    // Фикс специальностей перед захватом
    const specContainers = area.querySelectorAll('.skill-specs');
    specContainers.forEach(container => {
        if (container.children.length > 0) {
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.minHeight = container.scrollHeight + 'px';
            container.style.overflow = 'visible';
        }
    });

    setTimeout(() => {
        html2canvas(area, {
            scale: 3,                    // высокое качество
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#000000',
            logging: false,
            width: area.offsetWidth,
            height: area.offsetHeight + 50,

            onclone: (clonedDoc) => {
                // Финальная подготовка специальностей в клоне
                const clonedSpecs = clonedDoc.querySelectorAll('.skill-specs');
                clonedSpecs.forEach(container => {
                    if (container.children.length > 0) {
                        container.style.display = 'flex';
                        container.style.flexDirection = 'column';
                        container.style.height = 'auto';
                        container.style.minHeight = container.scrollHeight + 'px';
                    }
                });

                // Превращаем input'ы специальностей в текст
                clonedDoc.querySelectorAll('.skill-spec-line input').forEach(input => {
                    if (input.value.trim()) {
                        const span = clonedDoc.createElement('span');
                        span.textContent = input.value.trim();
                        span.style.cssText = `
                            color: #ccc;
                            font-size: 12.5px;
                            border-bottom: 1px solid #555;
                            padding: 2px 4px;
                            display: inline-block;
                            min-width: 160px;
                        `;
                        input.parentNode.replaceChild(span, input);
                    }
                });
            }
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `V5_Sheet_${charName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_')}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.click();

            // Возвращаем кнопку в исходное состояние
            btn.textContent = originalText;
            btn.disabled = false;
        }).catch(err => {
            console.error("Ошибка html2canvas:", err);
            alert("Не удалось создать изображение.");
            btn.textContent = originalText;
            btn.disabled = false;
        });
    }, 100);
});

// ==================== СПЕЦИАЛИЗАЦИИ ОТ ОХОТЫ ====================
let currentPredatorSpecialty = null;

function applyPredatorType(predName) {
    console.log("🎯 Применяем стиль охоты:", predName);

    // Очистка всех модалок
    document.querySelectorAll('#pred-disc-modal, #spec-choice-modal, #predator-selection-modal, #power-modal').forEach(m => m.remove());

    if (!predName) return;

    const predData = RULES.predator_types?.[predName];
    if (!predData) {
        console.warn("Нет данных для стиля:", predName);
        return;
    }

    // Сброс старого
    resetPredatorDisciplines();
    resetPredatorSpecialties();

    // Удаляем старые пункты от охоты
    selectedMerits = selectedMerits.filter(item => !item.fromPredator);
    selectedFlaws = selectedFlaws.filter(item => !item.fromPredator);

    // Добавляем новые
    if (predData.advantages?.length) {
        predData.advantages.forEach(adv => {
            const name = typeof adv === 'string' ? adv : (adv.name || adv);
            selectedMerits.push({
                category: "Стиль Охоты",
                name: name,
                points: 0,
                desc: `Бесплатно от «${predName}»`,
                mechanic: "",
                fromPredator: true,
                predatorType: predName
            });
        });
    }

    if (predData.disadvantages?.length) {
        predData.disadvantages.forEach(dis => {
            const name = typeof dis === 'string' ? dis : (dis.name || dis);
            selectedFlaws.push({
                category: "Стиль Охоты",
                name: name,
                points: 0,
                desc: `Бесплатно от «${predName}»`,
                mechanic: "",
                fromPredator: true,
                predatorType: predName
            });
        });
    }

    loadPredatorHint();
    renderSelectedMeritsFlaws();
    updateTrackers();

    // === НАДЁЖНАЯ ЛОГИКА ОТКРЫТИЯ ===
    const hasSpecialty = predData?.specialty?.options && predData.specialty.options.length > 0;
    const hasDisciplines = predData?.disciplines?.increase?.options && predData.disciplines.increase.options.length > 0;
    const hasPredItems = (predData.advantages?.length || 0) + (predData.disadvantages?.length || 0) > 0;

    setTimeout(() => {
        console.log(`Для ${predName} → specialty: ${hasSpecialty} (${predData.specialty?.options?.length || 0} вариантов), disciplines: ${hasDisciplines}, predItems: ${hasPredItems}`);

        if (hasSpecialty) {
            const options = predData.specialty.options;
            if (options.length > 1) {
                console.log("✅ Открываем выбор специализации");
                showSpecialtyChoiceModal(predName, options, predData);
                return;
            } else if (options.length === 1) {
                applyPredatorSpecialty(predName, options[0]);
                return;
            }
        }

        if (hasDisciplines) {
            console.log("✅ Открываем дисциплины");
            openPredatorDisciplineModal(predName);
            return;
        }

        if (hasPredItems) {
            console.log("✅ Открываем окно преимуществ/недостатков");
            showPredatorMeritsFlawsSelection(predName, predData);
        }



                    // После всех if (в конце applyPredatorType)
            if (!hasSpecialty && !hasDisciplines && !hasPredItems) {
                console.warn(`Стиль охоты ${predName} не имеет ни одной механики — показываем хотя бы окно merits/flaws`);
                showPredatorMeritsFlawsSelection(predName, predData); // или alert
}
    }, 250);
}

// ==================== ОБРАБОТЧИКИ ====================
function setupEventListeners() {
    // Пакет навыков
    const skillPackage = document.getElementById('skill-package');
    if (skillPackage) {
        skillPackage.addEventListener('change', (e) => {
            currentPackage = e.target.value;
            updateTrackers();
        });
    }

    // === КЛАН ===
    const clanSelect = document.getElementById('clan-input');
    if (clanSelect) {
        clanSelect.addEventListener('change', function() {
            const newClan = this.value.trim();

            console.log(`🔄 Смена клана на: ${newClan}`);

            resetClanDisciplines();           // ←←← ВАЖНО!

            if (newClan) {
                loadClanHint();
                updateClanIcon();
                setTimeout(() => openClanDisciplineModal(newClan), 100);
            } else {
                loadClanHint();
                updateClanIcon();
            }

            updateDisciplineTotal();
            renderDisciplines();
        });
    }

    // === СТИЛЬ ОХОТЫ ===
    const predatorSelect = document.getElementById('predator-input');
    if (predatorSelect) {
        predatorSelect.addEventListener('change', function() {
            const newPredator = this.value.trim();
            console.log(`🔄 Смена стиля охоты на: ${newPredator}`);

            resetPredatorDisciplines();       // ←←← ВАЖНО!

            loadPredatorHint();

            if (newPredator) {
                setTimeout(() => applyPredatorType(newPredator), 50);
            } else {
                updateTrackers();
            }
        });
    }
}



// ==================== ГЛОБАЛЬНЫЕ ПОДСКАЗКИ (исправленная версия) ====================
let tooltip = null;

function createTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement('div');
    tooltip.style.cssText = `
        position: fixed;
        background: #111111;
        color: #e0e0e0;
        padding: 14px 18px;
        border: 2px solid #ff3131;
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.55;
        max-width: 420px;
        z-index: 30000;
        pointer-events: none;
        box-shadow: 0 0 30px rgba(255,49,49,0.7);
        display: none;
        white-space: pre-line;
        word-wrap: break-word;
    `;
    document.body.appendChild(tooltip);
    return tooltip;
}

// Более надёжный обработчик
document.addEventListener('mouseover', function(e) {
    let target = e.target;
    
    // Ищем ближайший элемент с data-tooltip
    while (target && !target.hasAttribute('data-tooltip')) {
        target = target.parentElement;
    }

    if (target && target.hasAttribute('data-tooltip')) {
        const text = target.getAttribute('data-tooltip').trim();
        if (!text) return;

        const tt = createTooltip();
        tt.textContent = text;
        tt.style.display = 'block';

        const rect = target.getBoundingClientRect();
        let left = rect.left + window.scrollX + 20;
        let top = rect.top + window.scrollY - tt.offsetHeight - 15;

        if (top < 20) top = rect.bottom + window.scrollY + 15;

        tt.style.left = left + 'px';
        tt.style.top = top + 'px';
    }
});

document.addEventListener('mouseout', function() {
    if (tooltip) tooltip.style.display = 'none';
});

// ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ СТРЕЛОК ====================
window.prevClan = function() {
    if (!currentClanData || currentClanData.length === 0) return;
    currentClanIndex = (currentClanIndex - 1 + currentClanData.length) % currentClanData.length;
    showSingleClan(currentClanData[currentClanIndex]);
};

window.nextClan = function() {
    if (!currentClanData || currentClanData.length === 0) return;
    currentClanIndex = (currentClanIndex + 1) % currentClanData.length;
    showSingleClan(currentClanData[currentClanIndex]);
};

         // Синхронизация специализаций при изменении точек
    document.querySelectorAll('.dot-input[data-type="skill"]').forEach(dot => {
        dot.addEventListener('change', () => {
            const skillName = dot.getAttribute('name');
            if (skillName) {
                updateSBadgeState(skillName);
                updateSpecUI(skillName);
            }
        });
    });

    // Инициализация S-бейджей после полной загрузки
    setTimeout(() => {
        document.querySelectorAll('.skill-name').forEach(el => {
            const skillName = el.getAttribute('data-skill') || el.textContent.trim();
            if (skillName) updateSBadgeState(skillName);
        });
    }, 300);

//<!-- ==================== ОБРАБОТЧИКИ ТОЧЕК ==================== -->

// ==================== ОБРАБОТЧИКИ ТОЧЕК (атрибуты + навыки) ====================

// Главный обработчик кликов по точкам + сброс в 0
document.addEventListener('click', function(e) {
    const label = e.target.closest('label.dot-label');
    if (!label) return;

    const inputId = label.getAttribute('for');
    const input = document.getElementById(inputId);
    if (!input) return;

    const name = input.name;
    const clickedValue = parseInt(input.value);
    const currentChecked = document.querySelector(`input[name="${name}"]:checked`);
    const currentValue = currentChecked ? parseInt(currentChecked.value) : 0;

    // === СБРОС В 0 ===
    if (clickedValue === currentValue && currentValue > 0) {
        document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
            radio.checked = false;
        });

        // Активируем 0
        const zeroRadio = document.querySelector(`input[name="${name}"][value="0"]`);
        if (zeroRadio) zeroRadio.checked = true;

        e.preventDefault();

        // Для навыков — удаляем специальности
        if (input.dataset.type === 'skill') {
            const specContainer = document.getElementById('specs-' + name);
            if (specContainer) {
                specContainer.innerHTML = '';
                specContainer.style.display = 'none';
            }

            const checkbox = document.getElementById('s-' + name);
            if (checkbox) checkbox.checked = false;

            updateSBadgeState(name);
            updateSpecUI(name);
        }

        updateTrackers();
        return;
    }
});

// Дополнительный обработчик change
document.addEventListener('change', function(e) {
    if (e.target.classList.contains('dot-input')) {
        const name = e.target.name;
        updateTrackers();

        if (e.target.dataset.type === 'skill') {
            const level = parseInt(e.target.value || 0);
            if (level === 0) {
                const specContainer = document.getElementById('specs-' + name);
                if (specContainer) {
                    specContainer.innerHTML = '';
                    specContainer.style.display = 'none';
                }
                const cb = document.getElementById('s-' + name);
                if (cb) cb.checked = false;
            }
            updateSBadgeState(name);
            updateSpecUI(name);
        }
    }
});


// ==================== ПРЕИМУЩЕСТВА И НЕДОСТАТКИ ====================

function openMeritsFlawsModal() {
    document.getElementById('merits-flaws-modal').style.display = 'block';
    switchMeritsTab(0); // по умолчанию открываем Преимущества
}

function closeMeritsFlawsModal() {
    document.getElementById('merits-flaws-modal').style.display = 'none';
}

function switchMeritsTab(tab) {
    document.getElementById('tab-merits').style.background = tab === 0 ? '#222' : '#111';
    document.getElementById('tab-flaws').style.background = tab === 1 ? '#222' : '#111';
    renderCategories(tab);
}

function renderCategories(tab) {
    const container = document.getElementById('merits-list');
    container.innerHTML = '';
    const search = document.getElementById('merits-search').value.toLowerCase().trim();

    let source = tab === 0 
        ? (RULES.advantages?.merits || {}) 
        : (RULES.advantages?.flaws || RULES.flaws || {});

    if (Object.keys(source).length === 0) {
        container.innerHTML = `<p style="color:#ff6666; text-align:center; padding:60px 20px;">
            Данные не загружены
        </p>`;
        return;
    }

    Object.keys(source).forEach(catKey => {
        const category = source[catKey];
        const catName = category.название || catKey;
        const description = category.описание || "Нет описания";

        if (search && !catName.toLowerCase().includes(search)) return;

        const count = category.варианты ? category.варианты.length : 0;

        const div = document.createElement('div');
        div.style.cssText = `
            background:#1a1a1a; padding:16px; margin-bottom:10px; border-radius:6px; 
            border:1px solid #444; cursor:pointer; font-size:16px;
        `;

        div.innerHTML = `
            <strong>${catName}</strong> 
            <span style="color:#666; font-size:14px;">(${count} вариантов)</span>
            <div style="margin-top:8px; font-size:14px; color:#aaa; line-height:1.4;">
                ${description}
            </div>
        `;

        div.onclick = () => renderVariantsInCategory(category, tab);
        container.appendChild(div);
    });

    if (container.children.length === 0) {
        container.innerHTML = `<p style="color:#666; text-align:center; padding:60px;">Ничего не найдено</p>`;
    }
}


function renderVariantsInCategory(category, tab) {
    const container = document.getElementById('merits-list');
    container.innerHTML = `
        <button onclick="switchMeritsTab(${tab})" 
                style="margin-bottom:15px; background:#333; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">
            ← Назад к категориям
        </button>
        <h3 style="color:#ffae00; margin-bottom:15px;">${category.название}</h3>
    `;

    category.варианты.forEach(variant => {
        const name = variant.название_пункта;
        const points = variant.точки || 0;

        const alreadyTaken = tab === 0 
            ? selectedMerits.some(m => m.name === name)
            : selectedFlaws.some(f => f.name === name);

        const div = document.createElement('div');
        div.style.cssText = `
            background:#222; 
            padding:14px; 
            border-radius:6px; 
            margin-bottom:10px; 
            border:2px solid ${alreadyTaken ? '#555' : '#ff3131'}; 
            cursor: ${alreadyTaken ? 'default' : 'pointer'};
            opacity: ${alreadyTaken ? '0.6' : '1'};
        `;

        div.innerHTML = `
            <strong>${name} — ${points} точек</strong><br>
            <small style="color:#aaa;">${variant.полное_описание || ''}</small><br>
            <small style="color:#ffae00;">${variant.механика || ''}</small>
        `;

        // Клик только если ещё не взято
        if (!alreadyTaken) {
            div.addEventListener('click', () => {
                const canAdd = tab === 0 ? canAddMerit(points) : canAddFlaw(points);
                
                if (!canAdd) {
                    showLimitWarning(tab === 0);
                    return;
                }

                const item = {
                    category: category.название,
                    categoryDesc: category.описание || '',
                    name: name,
                    points: points,
                    desc: variant.полное_описание || '',
                    mechanic: variant.механика || ''
                };

                if (tab === 0) selectedMerits.push(item);
                else selectedFlaws.push(item);

                renderSelectedMeritsFlaws();
                closeMeritsFlawsModal();
            });
        }

        container.appendChild(div);
    });
}


function confirmPredatorSelection(predName) {
    const predData = RULES.predator_types?.[predName];
    if (!predData) return;

    // Преимущества
    document.querySelectorAll('.pred-adv:checked').forEach(cb => {
        const name = cb.value;
        // Проверяем, нет ли уже (включая от охоты)
        if (!selectedMerits.some(m => m.name === name)) {
            selectedMerits.push({
                category: "Стиль Охоты",
                name: name,
                points: 0,
                desc: `Бесплатно от стиля охоты «${predName}»`,
                mechanic: "",
                fromPredator: true,
                predatorType: predName
            });
        }
    });

    // Недостатки
    document.querySelectorAll('.pred-flaw:checked').forEach(cb => {
        const name = cb.value;
        if (!selectedFlaws.some(f => f.name === name)) {
            selectedFlaws.push({
                category: "Стиль Охоты",
                name: name,
                points: 0,
                desc: `Бесплатно от стиля охоты «${predName}»`,
                mechanic: "",
                fromPredator: true,
                predatorType: predName
            });
        }
    });

    closePredatorSelectionModal();
    renderSelectedMeritsFlaws();
}

// Отображение выбранных
function renderSelectedMeritsFlaws() {
    let totalMerits = 0;
    let totalFlaws = 0;

    const meritsContainer = document.getElementById('selected-merits-list');
    meritsContainer.innerHTML = '';
    selectedMerits.forEach((item, index) => {
        if (!item.fromPredator) totalMerits += item.points || 0;
        meritsContainer.appendChild(createSelectedItem(item, index, true));
    });

    const flawsContainer = document.getElementById('selected-flaws-list');
    flawsContainer.innerHTML = '';
    selectedFlaws.forEach((item, index) => {
        if (!item.fromPredator) totalFlaws += item.points || 0;
        flawsContainer.appendChild(createSelectedItem(item, index, false));
    });

    renderDots('merits-dots', totalMerits, true);
    renderDots('flaws-dots', totalFlaws, false);
}





function renderDots(containerId, points, isMerit) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    const max = isMerit ? 7 : 2;   // ← главное изменение
    
    for (let i = 1; i <= max; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = `
            width: 22px; 
            height: 22px; 
            border-radius: 50%; 
            background: ${i <= points ? '#ff3131' : '#333'};
            border: 2px solid ${i <= points ? '#ff6666' : '#555'};
            box-shadow: ${i <= points ? '0 0 8px #ff3131' : 'none'};
        `;
        container.appendChild(dot);
    }
}

function createSelectedItem(item, index, isMerit) {
    const points = item.points || item.точки || 0;
    const isFromPredator = item.fromPredator === true;
    const categoryName = item.category || '';
    let displayName = item.name || item.название_пункта || '';
    
    if (categoryName && !displayName.toLowerCase().includes(categoryName.toLowerCase().slice(0, 15))) {
        displayName = `${categoryName} • ${displayName}`;
    }

    const maxDots = 5;
    let dotsHTML = '';

        if (isFromPredator) {
        dotsHTML = `
            <span style="color:#ffae00; font-weight:bold; background:#1a1a1a; 
                         padding:4px 10px; border-radius:6px; border:1px solid #444;">
                0 точек • Тип охоты: ${item.predatorType || ''}
            </span>`;
    } else {
        // обычные точки (до 5)
        for (let i = 1; i <= 5; i++) {
            dotsHTML += `
                <div style="width:18px; height:18px; border-radius:50%; 
                            background: ${i <= points ? '#ff3131' : '#333'}; 
                            border: 2px solid ${i <= points ? '#ff6666' : '#555'}; 
                            margin-left: 3px;"></div>`;
        }
    }

    const div = document.createElement('div');
    div.className = 'selected-item';
    div.style.cssText = `
        background:#1a1a1a; padding:12px 14px; margin-bottom:6px; border-radius:6px;
        border-left:4px solid ${isMerit ? '#ffcc00' : '#ff6666'}; 
        cursor: pointer; overflow: hidden; transition: all 0.3s;
    `;
    div.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:12px; flex:1;">
                <strong style="flex:1;">${displayName}</strong>
                <div style="display:flex; gap:3px; align-items:center;">${dotsHTML}</div>
            </div>
            ${!isFromPredator ? `
            <button onclick="event.stopImmediatePropagation(); ${isMerit ? `removeMerit(${index})` : `removeFlaw(${index})`}" 
                    style="background:none; border:none; color:#ff3131; font-size:22px; cursor:pointer; padding:0 8px;">×</button>` : ''}
        </div>
        
        <!-- Раскрывающаяся часть -->
        <div class="detail-content" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid #333; color:#ccc; font-size:14.5px; line-height:1.55;">
            ${item.categoryDesc ? `
            <div style="margin-bottom:16px;">
                <strong style="color:#ffae00;">Раздел «${item.category}»:</strong><br>
                ${item.categoryDesc}
            </div>` : ''}
            
            <div>
                <strong style="color:#ffae00;">Описание пункта:</strong><br>
                ${item.desc || item.полное_описание || '—'}
            </div>
            
            ${item.mechanic ? `
            <div style="margin-top:16px;">
                <strong style="color:#ffae00;">Механика:</strong><br>
                ${item.mechanic}
            </div>` : ''}
        </div>
    `;

    div.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        const content = this.querySelector('.detail-content');
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });

    return div;
}


// Окно выбора преимуществ и недостатков от стиля охоты
function showPredatorMeritsFlawsSelection(predName, predData) {
    let html = `
    <div id="predator-selection-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:13000; display:flex; align-items:center; justify-content:center;">
        <div style="background:#111; border:2px solid #ff3131; border-radius:10px; width:90%; max-width:820px; max-height:85vh; overflow:auto; padding:25px; position:relative;">
            <button onclick="closePredatorSelectionModal()" 
                    style="position:absolute; top:15px; right:20px; font-size:32px; color:#ff3131; background:none; border:none; cursor:pointer;">×</button>
            
            <h2 style="color:#ff3131; text-align:center; margin:0 0 10px;">${predName}</h2>
            <p style="text-align:center; color:#aaa; margin-bottom:20px;">Выберите, что добавить от этого стиля охоты</p>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:25px;">`;

    // Преимущества
    if (predData.advantages && predData.advantages.length > 0) {
        html += `<div><strong style="color:#ffcc00; display:block; margin-bottom:12px;">Преимущества:</strong>`;
        predData.advantages.forEach(adv => {
            const name = typeof adv === 'string' ? adv : (adv.name || adv);
            html += `<label style="display:block; margin:8px 0; color:#ddd; cursor:pointer;">
                        <input type="checkbox" class="pred-adv" value="${name}" checked> ${name}
                     </label>`;
        });
        html += `</div>`;
    }

    // Недостатки
    if (predData.disadvantages && predData.disadvantages.length > 0) {
        html += `<div><strong style="color:#ff6666; display:block; margin-bottom:12px;">Недостатки:</strong>`;
        predData.disadvantages.forEach(dis => {
            const name = typeof dis === 'string' ? dis : (dis.name || dis);
            html += `<label style="display:block; margin:8px 0; color:#ddd; cursor:pointer;">
                        <input type="checkbox" class="pred-flaw" value="${name}" checked> ${name}
                     </label>`;
        });
        html += `</div>`;
    }

    html += `</div>
            <div style="margin-top:30px; text-align:center;">
                <button id="pred-confirm-btn" 
                        style="background:#ff3131; color:black; padding:14px 40px; border:none; border-radius:6px; font-size:17px; margin-right:15px;">
                    Применить выбранное
                </button>
                <button onclick="closePredatorSelectionModal()" 
                        style="background:#333; color:white; padding:14px 35px; border:none; border-radius:6px; font-size:17px;">
                    Отмена
                </button>
            </div>
        </div>
    </div>`;

    document.getElementById('predator-selection-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
        const btn = document.getElementById('pred-confirm-btn');
        if (btn) btn.onclick = () => confirmPredatorSelection(predName);
    }, 100);
}


function confirmPredatorSelection(predName) {
    const predData = RULES.predator_types?.[predName];
    if (!predData) return;

    // Преимущества
    document.querySelectorAll('.pred-adv:checked').forEach(cb => {
        const name = cb.value;
        // Проверяем, нет ли уже (включая от охоты)
        if (!selectedMerits.some(m => m.name === name)) {
            selectedMerits.push({
                category: "Стиль Охоты",
                name: name,
                points: 0,
                desc: `Бесплатно от стиля охоты «${predName}»`,
                mechanic: "",
                fromPredator: true,
                predatorType: predName
            });
        }
    });

    // Недостатки
    document.querySelectorAll('.pred-flaw:checked').forEach(cb => {
        const name = cb.value;
        if (!selectedFlaws.some(f => f.name === name)) {
            selectedFlaws.push({
                category: "Стиль Охоты",
                name: name,
                points: 0,
                desc: `Бесплатно от стиля охоты «${predName}»`,
                mechanic: "",
                fromPredator: true,
                predatorType: predName
            });
        }
    });

    closePredatorSelectionModal();
    renderSelectedMeritsFlaws();
}





function confirmPredatorDiscipline(predatorName) {
    const disc = document.getElementById('pred-disc-select').value;
    if (!disc) return alert("Выберите дисциплину!");

    // Добавляем дисциплину
    mergeDiscipline(disc, 1, `Охота: ${predatorName}`);
    predatorProvidedDisciplines[disc] = 1;

    closePredDiscModal();

    // === НОВОЕ: После выбора дисциплины показываем окно преимуществ/недостатков ===
    const predData = RULES.predator_types?.[predatorName];
    if (predData && ((predData.advantages && predData.advantages.length) || 
                     (predData.disadvantages && predData.disadvantages.length))) {
        
        setTimeout(() => {
            showPredatorMeritsFlawsSelection(predatorName, predData);
        }, 400);   // небольшая задержка, чтобы модал дисциплины успел закрыться
    } else {
        updateTrackers();
        renderSelectedMeritsFlaws();
    }
}

function closePredatorSelectionModal() {
    document.getElementById('predator-selection-modal')?.remove();
}




// Проверка лимита преимуществ (игнорируем пункты от охоты)
function canAddMerit(newPoints) {
    const currentTotal = selectedMerits.reduce((sum, item) => {
        if (item.fromPredator) return sum;        // бесплатно от охоты — не считаем
        return sum + (item.points || 0);
    }, 0);

    return currentTotal + newPoints <= 7;
}

// Проверка лимита недостатков (игнорируем пункты от охоты)
function canAddFlaw(newPoints) {
    const currentTotal = selectedFlaws.reduce((sum, item) => {
        if (item.fromPredator) return sum;        // бесплатно от охоты — не считаем
        return sum + (item.points || 0);
    }, 0);

    return currentTotal + newPoints <= 2;
}

// Показываем предупреждение при превышении
function showLimitWarning(isMerit) {
    const msg = isMerit 
        ? "❌ Максимум 7 точек преимуществ!" 
        : "❌ Максимум 2 точки недостатков!";
    
    const warning = document.createElement('div');
    warning.style.cssText = `
        position:fixed; top:20px; left:50%; transform:translateX(-50%);
        background:#330000; color:#ff6666; padding:12px 24px; border-radius:6px;
        border:2px solid #ff3131; z-index:99999; font-weight:bold;
    `;
    warning.textContent = msg;
    document.body.appendChild(warning);

    setTimeout(() => warning.remove(), 2500);
}

function createMeritItem(item, index, isMerit) {
    const div = document.createElement('div');
    div.style.cssText = 'background:#1f1f1f; padding:12px 16px; border-radius:6px; border-left:4px solid #ff3131; display:flex; justify-content:space-between; align-items:center;';
    div.innerHTML = `
        <div style="flex:1">
            <strong>${item.category} — ${item.name}</strong> 
            <span style="color:#ffae00">(${item.points} т.)</span><br>
            <small style="color:#ccc">${item.desc}</small>
        </div>
        <button onclick="${isMerit ? `removeMerit(${index})` : `removeFlaw(${index})`}" 
                style="background:#330000; color:#ff6666; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:18px;">×</button>
    `;
    return div;
}

window.removeMerit = function(i) { 
    selectedMerits.splice(i,1); 
    renderSelectedMeritsFlaws(); 
};

window.removeFlaw = function(i) { 
    selectedFlaws.splice(i,1); 
    renderSelectedMeritsFlaws(); 
};

// Поиск
document.getElementById('merits-search').addEventListener('input', () => {
    const activeTab = document.getElementById('tab-merits').style.backgroundColor === 'rgb(34, 34, 34)' ? 0 : 1;
    renderCategories(activeTab);
});



// ==================== ГЛОБАЛЬНЫЕ ОКНА ДЛЯ ОХОТЫ ====================
window.showPredatorMeritsFlawsSelection = showPredatorMeritsFlawsSelection;
window.confirmPredatorSelection = confirmPredatorSelection;
window.closePredatorSelectionModal = closePredatorSelectionModal;

// ==================== ЗАПУСК ====================
window.onload = () => {
    loadRules().then(() => {
        setTimeout(() => {
            preloadAllSkills();
            preloadAllAttributes();
        }, 100);
        renderSkills();
        renderAttributes();
    });
    setupEventListeners();
};


// ====================== ЭКСПОРТ / ИМПОРТ JSON ======================

function exportToJSON() {
    const character = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        name: document.getElementById('char-name').value.trim() || "Безымянный",
        clan: document.getElementById('clan-input').value,
        predator: document.getElementById('predator-input').value,
        skillPackage: document.getElementById('skill-package').value,
        
        attributes: {},
        skills: {},
        disciplines: disciplineSources,
        selectedPowers: selectedPowers,
        merits: selectedMerits,
        flaws: selectedFlaws
    };

    // Атрибуты
    document.querySelectorAll('.dot-input[data-type="attr"]:checked').forEach(input => {
        if (parseInt(input.value) > 0) {
            character.attributes[input.name] = parseInt(input.value);
        }
    });

    // Навыки + специализации
    document.querySelectorAll('.dot-input[data-type="skill"]:checked').forEach(input => {
        const val = parseInt(input.value);
        if (val > 0) {
            const skillName = input.name;
            character.skills[skillName] = { dots: val, specs: [] };

            const container = document.getElementById('specs-' + skillName);
            if (container) {
                container.querySelectorAll('input[type="text"]').forEach(inp => {
                    if (inp.value.trim()) character.skills[skillName].specs.push(inp.value.trim());
                });
            }
        }
    });

    const dataStr = JSON.stringify(character, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `V5_${character.name.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_')}.json`;
    link.click();

    URL.revokeObjectURL(url);
}


// ====================== ИМПОРТ ИЗ JSON (ПОЛНАЯ ЗАГРУЗКА) ======================
function importFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                const d = JSON.parse(ev.target.result);
                console.log("📥 Импорт JSON:", d);

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

                // === ДИСЦИПЛИНЫ (точно как в loadFullCharacter) ===
                if (d.disciplines) {
                    disciplineSources = JSON.parse(JSON.stringify(d.disciplines));
                }
                if (d.selectedPowers) {
                    selectedPowers = JSON.parse(JSON.stringify(d.selectedPowers));
                }

                // Полная перерисовка дисциплин
                const list = document.getElementById('disciplines-list');
                if (list) list.innerHTML = '';

                Object.keys(disciplineSources).forEach(name => {
                    const total = Object.values(disciplineSources[name]).reduce((a, b) => a + b, 0);
                    const sourcesText = Object.keys(disciplineSources[name]).join(" + ");
                    addDisciplineRow(name, total, sourcesText);
                });

                renderDisciplines();   // кнопки "+" и панели способностей

                // Преимущества и недостатки
                if (d.merits) selectedMerits = [...d.merits];
                if (d.flaws) selectedFlaws = [...d.flaws];

                renderSelectedMeritsFlaws();
                updateTrackers();
                updateVitals();

                alert(`✅ Персонаж «${d.name || 'Без имени'}» полностью загружен из JSON!`);

            } catch (err) {
                alert('Ошибка при чтении JSON: ' + err.message);
                console.error(err);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}