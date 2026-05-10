

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

let startingSheetFixed = false;
let baseLevels = {};
let sheetLockSnapshot = null;
let isApplyingCharacterData = false;
let isExperiencePurchaseInProgress = false;
let expShopMode = false;
let expShopSnapshot = null;
let expShopStartLevels = {};
let expShopDisciplineMode = 'клановая';
let startingSheetBase = null;
let expHistory = [];
let lastAutoExperienceBonus = null;


function getTypeBonuses(type) {
    const byType = {
        childe: { meritsBonus: 0, flawsBonus: 0, humanityMod: 0 },
        neonate: { meritsBonus: 0, flawsBonus: 0, humanityMod: 0 },
        ancilla: { meritsBonus: 2, flawsBonus: 2, humanityMod: -1 },
        elder: { meritsBonus: 0, flawsBonus: 0, humanityMod: -2 },
        methuselah: { meritsBonus: 0, flawsBonus: 0, humanityMod: -3 },
        antediluvian: { meritsBonus: 0, flawsBonus: 0, humanityMod: -4 }
    };

    return byType[type] || { meritsBonus: 0, flawsBonus: 0, humanityMod: 0 };
}

function getMeritsLimit() {
    const type = document.getElementById('type-input')?.value;
    return 7 + getTypeBonuses(type).meritsBonus;
}

function getFlawsLimit() {
    const type = document.getElementById('type-input')?.value;
    return 2 + getTypeBonuses(type).flawsBonus;
}

function getTypeBonuses(type) {
    const byType = {
        childe: { meritsBonus: 0, flawsBonus: 0, humanityMod: 0 },
        neonate: { meritsBonus: 0, flawsBonus: 0, humanityMod: 0 },
        ancilla: { meritsBonus: 2, flawsBonus: 2, humanityMod: -1 },
        elder: { meritsBonus: 0, flawsBonus: 0, humanityMod: -2 },
        methuselah: { meritsBonus: 0, flawsBonus: 0, humanityMod: -3 },
        antediluvian: { meritsBonus: 0, flawsBonus: 0, humanityMod: -4 }
    };

    return byType[type] || { meritsBonus: 0, flawsBonus: 0, humanityMod: 0 };
}

function getMeritsLimit() {
    const type = document.getElementById('type-input')?.value;
    return 7 + getTypeBonuses(type).meritsBonus;
}

function getFlawsLimit() {
    const type = document.getElementById('type-input')?.value;
    return 2 + getTypeBonuses(type).flawsBonus;
}

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
        return;
    }

    // ←←← ИСПРАВЛЕНИЕ: сначала рендерим, потом заполняем подсказки
    renderAttributes();
    renderSkills();

    await new Promise(r => setTimeout(r, 50)); // маленький таймаут

    preloadAllSkills();
    preloadAllAttributes();

    populateSelects();
}
// ==================== ЗАПУСК ====================

async function initializeApp() {
    try {
        console.log("🚀 Инициализация приложения...");

        await loadRules();
        
        // Ждём, пока RULES загрузятся и DOM готов
        await new Promise(r => setTimeout(r, 100));

       
        renderDisciplines();
        setupEventListeners();
        setupSaveButton();
        setupSheetLockGuards();
        setupExpShopDotEditing();

        // Дополнительные настройки
        setupGenerationHint();
        setupExperienceListener();
        updateBloodPotencyAndBonuses();
        updateExperienceBonus();
        applySheetLockState();
        updateExpPurchasedStyles();

        console.log("✅ Приложение полностью инициализировано");
    } catch (err) {
        console.error("❌ Ошибка инициализации:", err);
    }
}

// Один единственный load listener
window.addEventListener('load', initializeApp);

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

            dotsHTML += `
                <input type="radio" id="sk-${name}-0" name="${name}" value="0" class="dot-input" data-type="skill" style="display:none;" checked>`;

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
    const type = document.getElementById('type-input')?.value;
    const baseHumanity = parseInt(document.getElementById('base-humanity')?.value || '7') || 7;

    const typeMod = getTypeBonuses(type).humanityMod || 0;
    let predatorMod = 0;

    if (predatorName && RULES.predator_types?.[predatorName]) {
        predatorMod = RULES.predator_types[predatorName].humanity || 0;
    }

    const humanity = Math.max(0, baseHumanity + typeMod + predatorMod);
    const el = document.getElementById('val-humanity');

    if (el) {
        el.textContent = humanity;
        el.style.color = 'white';
        el.setAttribute('data-tooltip',
            `Человечность = старт(${baseHumanity}) + тип(${typeMod >= 0 ? '+' : ''}${typeMod}) + стиль охоты(${predatorMod >= 0 ? '+' : ''}${predatorMod}) = ${humanity}`);
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
    item.dataset.disciplineName = name;

    let dotsHTML = '';
    const baseDots = getBaseDisciplineLevel(name);
    const shopStartDots = expShopMode
        ? getDisciplineTotal(name, expShopSnapshot?.disciplines || {})
        : dots;
    for (let i = 1; i <= 5; i++) {
        const filled = i <= dots ? 'filled' : '';
        const expClass = filled && i > shopStartDots ? 'exp-pending' : filled && i > baseDots ? 'exp-purchased' : '';
        const priceTitle = expShopMode ? ` title="До ${i}: ${getDisciplinePreviewCost(name, i)} XP"` : '';
        dotsHTML += `<div class="disc-dot ${filled} ${expClass}" data-level="${i}"${priceTitle}></div>`;
    }

    const sources = sourceText.split('+').map(s => s.trim()).filter(s => s);

    item.innerHTML = `
        <div style="flex: 1; font-size:16.5px;">${name}</div>
        <div class="dots-discipline" style="display:flex; gap:9px;">${dotsHTML}</div>
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
        if (expShopMode) renderExpShopPanel();
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

function renderShopAvailableDisciplines() {
    if (!expShopMode) return;

    const list = document.getElementById('disciplines-list');
    if (!list) return;

    Object.keys(RULES.disciplines || {}).sort().forEach(name => {
        if (disciplineSources[name]) return;

        const item = document.createElement('div');
        item.className = 'discipline-item xp-shop-discipline-option';
        item.dataset.disciplineName = name;

        let dotsHTML = '';
        for (let i = 1; i <= 5; i++) {
            const priceTitle = expShopMode ? ` title="До ${i}: ${getDisciplinePreviewCost(name, i)} XP"` : '';
            dotsHTML += `<div class="disc-dot" data-level="${i}"${priceTitle}></div>`;
        }

        item.innerHTML = `
            <div style="flex: 1; font-size:16.5px; color:#777;">${name}</div>
            <div class="dots-discipline" style="display:flex; gap:9px;">${dotsHTML}</div>
            <small style="color:#664400; min-width:200px; line-height:1.4; text-align:right;">доступно в магазине<br>${expShopDisciplineMode} • ×${getDisciplineMultiplier(name)}</small>
        `;

        list.appendChild(item);
    });
}

function renderDisciplines() {
    document.querySelectorAll('.xp-shop-discipline-option').forEach(item => item.remove());

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

    renderShopAvailableDisciplines();
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
        applyPredatorChoiceItems(predName);
        return;
    }

    const clanName = document.getElementById('clan-input')?.value || '';
    let options = [...predData.disciplines.increase.options];
    if (clanName !== 'Тремер' && predData.disciplines.increase.restriction?.includes('тремер')) {
        options = options.filter(option => option !== 'Кровавое чародейство');
    }
    if (options.length === 0) {
        alert(`Для стиля «${predName}» нет доступной дисциплины с текущим кланом.`);
        applyPredatorChoiceItems(predName);
        return;
    }

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
                const xpPrice = lvl * 3;

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
                    <div style="color:#666;font-size:13px;">Уровень ${lvl}${expShopMode ? ` • ${xpPrice} XP` : ''}</div>
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
                        ${expShopMode ? `<p style="margin:0 0 12px;color:#ff9500;font-weight:bold;">Цена: ${xpPrice} XP</p>` : ''}
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
            if (expShopMode) renderExpShopPanel();
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
    const predData = RULES.predator_types?.[predatorName];
    const hasDisciplines = predData?.disciplines?.increase?.options && predData.disciplines.increase.options.length > 0;
    if (hasDisciplines) {
        setTimeout(() => openPredatorDisciplineModal(predatorName), 250);
    } else {
        setTimeout(() => applyPredatorChoiceItems(predatorName), 250);
    }

    updateTrackers();
    updateSBadgeState(skillName);
}


// ==================== ИКОНКИ КЛАНОВ ====================




// Временные данные для иконок (можно расширить в rules.json позже)
const CLAN_ICONS = {
    "Бруха": "/static/emojis/brujah.png",
    "Вентру": "/static/emojis/ventrue.png",
    "Гангрел": "/static/emojis/gangrel.png",
    "Малкавиан": "/static/emojis/malkavian.png",
    "Носферату": "/static/emojis/nosferatu.png",
    "Тореадор": "/static/emojis/toreador.png",
    "Тремер": "/static/emojis/tremere.png",
    "Каитиф": "/static/emojis/caitiff.png",
    "Слабокровные": "/static/emojis/thin_blood.png"
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
        { name: "Бруха", image: "/static/clan_gallery/brujah_full.png", desc: "Бунтари и идеалисты." },
        { name: "Вентру", image: "/static/clan_gallery/ventrue_full.png", desc: "Аристократы и правители." },
        { name: "Гангрел", image: "/static/clan_gallery/gangrel_full.png", desc: "Дикие дети природы." },
        { name: "Малкавиан", image: "/static/clan_gallery/malkavian_full.png", desc: "Безумные пророки." },
        { name: "Носферату", image: "/static/clan_gallery/nosferatu_full.png", desc: "Отверженные хранители тайн." },
        { name: "Тореадор", image: "/static/clan_gallery/toreador_full.png", desc: "Художники и ценители красоты." },
        { name: "Тремер", image: "/static/clan_gallery/tremere_full.png", desc: "Маги и учёные крови." },
        { name: "Каитиф", image: "/static/clan_gallery/caitiff_full.png", desc: "Независимые и скрытные." },
        { name: "Слабокровные", image: "/static/clan_gallery/thinblood_full.png", desc: "Самые молодые и слабые вампиры." }
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
        { name: "Бестия",       desc: "Насильственный стиль. Быстрое и грубое нападение.", image: "/static/predator_gallery/Бестия.png" },
        { name: "Джентльмен",   desc: "Изысканный и расчётливый подход к охоте.", image: "/static/predator_gallery/Джентльмен.png" },
        { name: "Идол",         desc: "Питание через поклонение и обожание.", image: "/static/predator_gallery/Идол.png" },
        { name: "Искуситель",   desc: "Соблазнение и манипуляция жертвой.", image: "/static/predator_gallery/Искуситель.png" },
        { name: "Морфей",       desc: "Охота через сны и воздействие на спящих.", image: "/static/predator_gallery/Морфей.png" },
        { name: "Налётчик",     desc: "Стремительные налёты и быстрый отход.", image: "/static/predator_gallery/Налётчик.png" },
        { name: "Семьянин",     desc: "Питание от членов семьи или близкого круга.", image: "/static/predator_gallery/Семьянин.png" },
        { name: "Суррогатчик",  desc: "Использование посредников и суррогатов.", image: "/static/predator_gallery/Суррогатчик.png" },
        { name: "Тусовщик",     desc: "Охота на вечеринках и в тусовках.", image: "/static/predator_gallery/Тусовщик.png" },
        { name: "Фермер",       desc: "Содержание «фермы» из смертных доноров.", image: "/static/predator_gallery/Фермер.png" }
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
        data.advantages.forEach(a => html += `• ${formatPredatorTraitLine(a, true)}<br>`);
    }

    if (data.disadvantages && data.disadvantages.length) {
        html += `<hr style="border-color:#333;margin:20px 0;">
                 <strong style="color:#ff6666;">Недостатки:</strong><br>`;
        data.disadvantages.forEach(d => html += `• ${formatPredatorTraitLine(d, false)}<br>`);
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


// Универсальная функция сворачивания
function toggleHint(boxId) {
    const box = document.getElementById(boxId);
    if (!box) return;
    box.classList.toggle('collapsed');
}

// ==================== КЛАН ====================
function loadClanHint() {
    const clanName = document.getElementById('clan-input').value.trim();
    const box = document.getElementById('clan-hint-box');
    const content = document.getElementById('clan-hint-content');
    
    if (!clanName || !box || !content) {
        if (box) box.style.display = 'none';
        return;
    }

    const clan = RULES.clans?.[clanName];
    if (!clan) {
        box.style.display = 'none';
        return;
    }

    // Короткая строка при свёрнутом состоянии
    box.dataset.short = `Клан: ${clanName}`;

    let html = `
        <div style="color:#ddd; line-height:1.65; font-size:14.8px;">
            ${clan.description || 'Описание отсутствует'}
        </div>
    `;

    if (clan.types) html += `<hr style="border-color:#333;margin:15px 0;"><strong style="color:#ffae00;">Типичные представители:</strong><br><span style="color:#ccc;">${clan.types}</span>`;
    if (clan.disciplines?.length) {
        html += `<hr style="border-color:#333;margin:15px 0;"><strong style="color:#ffae00;">Дисциплины:</strong><br>`;
        clan.disciplines.forEach(d => html += `• ${d}<br>`);
    }
    if (clan.bane) html += `<hr style="border-color:#333;margin:15px 0;"><strong style="color:#ff6666;">Проклятие:</strong> ${clan.bane}`;

    content.innerHTML = html;
    box.style.display = 'block';
}

// ==================== СТИЛЬ ОХОТЫ ====================
// ==================== СТИЛЬ ОХОТЫ ====================
function loadPredatorHint() {
    const name = document.getElementById('predator-input').value;
    const box = document.getElementById('predator-hint-box');
    const content = document.getElementById('predator-hint-content');
    
    if (!name || !box || !content) {
        if (box) box.style.display = 'none';
        return;
    }

    box.dataset.short = `Стиль Охоты: ${name}`;

    const pred = RULES.predator_types?.[name];
    if (!pred) {
        box.style.display = 'none';
        return;
    }

    let html = `<div style="color:#ddd; line-height:1.6;">${pred.description || 'Описание отсутствует'}</div>`;

    // Специализация
    if (pred.specialty?.options && pred.specialty.options.length) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffae00;">Специализация:</strong><br>
                 ${pred.specialty.options.join(', ')}`;
    }

    // Дисциплина
    if (pred.disciplines?.increase?.options && pred.disciplines.increase.options.length) {
        const value = pred.disciplines.increase.value || 1;
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffae00;">Дисциплина (+${value}):</strong><br>
                 ${pred.disciplines.increase.options.join(', ')}`;
    }

    // Преимущества
    if (pred.advantages && pred.advantages.length) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffcc00;">Преимущества:</strong><br>`;
        pred.advantages.forEach(a => {
            html += `• ${formatPredatorTraitLine(a, true)}<br>`;
        });
    }

    // Недостатки
    if (pred.disadvantages && pred.disadvantages.length) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ff6666;">Недостатки:</strong><br>`;
        pred.disadvantages.forEach(d => {
            html += `• ${formatPredatorTraitLine(d, false)}<br>`;
        });
    }

    // Человечность
    if (pred.humanity !== undefined) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffae00;">Человечность:</strong> 
                 <span style="color:#ffd700;">${pred.humanity > 0 ? '+' : ''}${pred.humanity}</span>`;
    }

    if (pred.blood_potency) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ffae00;">Сила Крови:</strong> 
                 <span style="color:#ffd700;">+${pred.blood_potency}</span>`;
    }

    if (pred.restriction) {
        const restrictions = Array.isArray(pred.restriction) ? pred.restriction : [pred.restriction];
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#ff6666;">Ограничения:</strong><br>
                 ${restrictions.map(r => `• ${r}`).join('<br>')}`;
    }

    if (pred.notes?.length) {
        html += `<hr style="border-color:#333;margin:15px 0;">
                 <strong style="color:#aaa;">Заметки:</strong><br>
                 ${pred.notes.map(n => `• ${n}`).join('<br>')}`;
    }

    content.innerHTML = html;
    box.style.display = 'block';
}

// ==================== ПОКОЛЕНИЕ + ТИП ====================
function updateBloodPotencyAndBonuses() {
    const type = document.getElementById('type-input').value;
    const genValue = document.getElementById('generation-input').value;
    const generation = parseInt(genValue) || 13;
    
    const box = document.getElementById('generation-hint-box');
    const content = document.getElementById('generation-hint-content');
    
    if (!box || !content) return;

    let shortText = `Поколение: ${genValue || '?'}`;
    if (type) shortText += ` — ${type === 'childe' ? 'Птенец' : type === 'neonate' ? 'Неонат' : type === 'ancilla' ? 'Анцилла' : type === 'elder' ? 'Старейшина' : type}`;

    box.dataset.short = shortText;

    let hintHTML = '';

    if (type === 'childe') {
        hintHTML = `<strong>Птенец (Childe)</strong><br>• Становление ≤ 15 лет назад<br>• <strong>Сила Крови: 0</strong><br>• +0 опыта`;
    } else if (type === 'neonate') {
        const potency = (generation <= 13) ? 1 : 0;
        hintHTML = `<strong>Неонат (Neonate)</strong><br>• Становление после 1940 г.<br>• <strong>Сила Крови: ${potency}</strong><br>• +15 опыта`;
    } else if (type === 'ancilla') {
        const potency = (generation <= 11) ? 2 : 1;
        hintHTML = `<strong>Анцилла (Ancilla)</strong><br>• Становление 1780–1940 гг.<br>• <strong>Сила Крови: ${potency}</strong><br>• +2 Преимущества к лимиту • +2 Недостатка к лимиту<br>• −1 Человечность<br>• +35 опыта`;
    } else if (type === 'elder' || type === 'methuselah' || type === 'antediluvian') {
        hintHTML = `<strong>Старейшина / Матузалем</strong><br>• Очень старый вампир<br>• <strong>Сила Крови: 3+</strong>`;
    }

    content.innerHTML = hintHTML || 'Выберите Поколение и Тип';
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

    if (startingSheetFixed) {
        guide?.classList.remove('error');
        if (warning) warning.style.display = 'none';
        return;
    }
    
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
    if (expShopMode) renderExpShopPanel();
});

function addSpecLine(skillName, value = '') {
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
        ${expShopMode ? '<span style="color:#ff9500;font-weight:bold;align-self:center;white-space:nowrap;">3 XP</span>' : ''}
        <button title="Добавить ещё" style="background:#222;color:#ffae00;">+</button>
        <button title="Удалить" style="background:#222;color:#ff6666;">×</button>
    `;

    const input = line.querySelector('input[type="text"]');
    if (input) {
        input.value = value;
        input.addEventListener('input', () => {
            if (expShopMode) renderExpShopPanel();
        });
    }

    // Кнопка "+"
    line.querySelectorAll('button')[0].addEventListener('click', () => addSpecLine(skillName));

    // Кнопка "×" — исправленный обработчик
    line.querySelectorAll('button')[1].addEventListener('click', () => {
        line.remove();
        setTimeout(() => {
            updateSBadgeState(skillName);
            if (expShopMode) renderExpShopPanel();
        }, 10);
    });

    container.appendChild(line);
    updateSBadgeState(skillName);
    if (expShopMode) renderExpShopPanel();
}

function restoreSpecializations(skillName, specs = []) {
    const container = document.getElementById('specs-' + skillName);
    const checkbox = document.getElementById('s-' + skillName);
    if (!container || !checkbox) return;

    container.innerHTML = '';

    const cleanSpecs = specs
        .map(spec => String(spec || '').trim())
        .filter(Boolean);

    if (cleanSpecs.length === 0) {
        container.style.display = 'none';
        checkbox.checked = false;
        updateSBadgeState(skillName);
        return;
    }

    container.style.display = 'flex';
    checkbox.checked = true;

    cleanSpecs.forEach(text => addSpecLine(skillName, text));
    updateSBadgeState(skillName);
    updateSpecUI(skillName);
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








// ==================== СПЕЦИАЛИЗАЦИИ ОТ ОХОТЫ ====================
let currentPredatorSpecialty = null;

function getTraitPoints(item) {
    return item?.points ?? item?.dots ?? item?.точки ?? 0;
}

function findTraitDefinition(rawItem, isMerit) {
    const source = isMerit
        ? (RULES.advantages?.merits || {})
        : (RULES.advantages?.flaws || RULES.flaws || {});
    const rawCategory = rawItem?.category || rawItem?.категория || '';
    const rawName = rawItem?.name || rawItem?.название_пункта || rawItem || '';
    const rawVariant = rawItem?.variant || rawItem?.вариант || '';
    const requestedPoints = getTraitPoints(rawItem);

    const categories = Object.values(source);
    const category = categories.find(cat => (cat.название || '').toLowerCase() === String(rawCategory).toLowerCase())
        || categories.find(cat => (cat.варианты || []).some(v => (v.название_пункта || '').toLowerCase() === String(rawName).toLowerCase()));

    if (!category) return null;

    const variants = category.варианты || [];
    const wantedName = rawVariant || rawName;
    let variant = variants.find(v => (v.название_пункта || '').toLowerCase() === String(wantedName).toLowerCase());

    if (!variant && requestedPoints > 0) {
        variant = variants.find(v => (v.точки || 0) === requestedPoints);
    }

    if (!variant && rawCategory && String(rawName).toLowerCase() === String(rawCategory).toLowerCase()) {
        variant = variants[0];
    }

    return variant ? { category, variant } : null;
}

function buildPredatorTrait(rawItem, isMerit, predName) {
    const resolved = findTraitDefinition(rawItem, isMerit);
    const category = resolved?.category;
    const variant = resolved?.variant;
    const details = rawItem?.details || rawItem?.уточнение || '';
    const name = rawItem?.name || variant?.название_пункта || rawItem;
    const points = getTraitPoints(rawItem) || variant?.точки || 0;

    const descParts = [];
    const baseDesc = rawItem?.desc || rawItem?.полное_описание || variant?.полное_описание || '';
    if (baseDesc) descParts.push(baseDesc);
    if (details) descParts.push(`<em>Уточнение от типа охоты:</em> ${details}`);

    return {
        category: rawItem?.category || category?.название || 'Стиль охоты',
        categoryDesc: rawItem?.categoryDesc || category?.описание || '',
        name,
        points,
        dots: points,
        desc: descParts.join('<br><br>'),
        mechanic: rawItem?.mechanic || rawItem?.механика || variant?.механика || '',
        fromPredator: true,
        predatorType: predName
    };
}

function formatPredatorTraitLine(rawItem, isMerit) {
    const resolved = findTraitDefinition(rawItem, isMerit);
    const name = rawItem?.name || resolved?.variant?.название_пункта || rawItem;
    const points = getTraitPoints(rawItem) || resolved?.variant?.точки || 0;
    const details = rawItem?.details || rawItem?.уточнение || '';
    return `${name}${points ? ` (${points})` : ''}${details ? ` — ${details}` : ''}`;
}

function isPredatorChoiceItem(item) {
    return Boolean(item?.choice_group || item?.allocation_group);
}

function addPredatorItemToSheet(rawItem, isMerit, predName) {
    const item = buildPredatorTrait(rawItem, isMerit, predName);
    const target = isMerit ? selectedMerits : selectedFlaws;
    const exists = target.some(existing =>
        existing.fromPredator &&
        existing.predatorType === predName &&
        existing.category === item.category &&
        existing.name === item.name &&
        getTraitPoints(existing) === getTraitPoints(item)
    );
    if (!exists) target.push(item);
}

function getPredatorChoiceGroups(predData) {
    const groups = {};
    [
        ...(predData.advantages || []).map(item => ({ item, isMerit: true })),
        ...(predData.disadvantages || []).map(item => ({ item, isMerit: false }))
    ].forEach(entry => {
        const groupName = entry.item?.choice_group;
        if (!groupName) return;
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(entry);
    });
    return groups;
}

function getPredatorAllocationGroups(predData) {
    const groups = {};
    [
        ...(predData.advantages || []).map(item => ({ item, isMerit: true })),
        ...(predData.disadvantages || []).map(item => ({ item, isMerit: false }))
    ].forEach(entry => {
        const groupName = entry.item?.allocation_group;
        if (!groupName) return;
        if (!groups[groupName]) {
            groups[groupName] = {
                total: parseInt(entry.item.allocation_total || 0, 10) || 0,
                entries: []
            };
        }
        groups[groupName].entries.push(entry);
    });
    return groups;
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function showPredatorChoiceModal(predName, entries) {
    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.id = 'predator-choice-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:27000;display:flex;align-items:center;justify-content:center;padding:18px;';

        modal.innerHTML = `
            <div style="width:min(620px,100%);background:#111;border:2px solid #ff3131;border-radius:10px;padding:24px;color:#eee;box-shadow:0 0 36px rgba(255,49,49,0.35);">
                <h2 style="margin:0 0 8px;text-align:center;color:#ff3131;">${escapeHTML(predName)}</h2>
                <p style="margin:0 0 18px;text-align:center;color:#aaa;line-height:1.45;">Выберите один вариант от стиля охоты</p>
                <div id="pred-choice-list" style="display:grid;gap:10px;"></div>
                <button id="pred-choice-cancel" style="margin-top:16px;width:100%;padding:11px;background:#333;color:#eee;border:none;border-radius:6px;cursor:pointer;">Отмена</button>
            </div>
        `;

        document.getElementById('predator-choice-modal')?.remove();
        document.body.appendChild(modal);

        const list = modal.querySelector('#pred-choice-list');
        entries.forEach((entry, index) => {
            const btn = document.createElement('button');
            btn.style.cssText = 'padding:14px 16px;background:#1a1a1a;color:#eee;border:1px solid #444;border-left:4px solid #ff9500;border-radius:6px;cursor:pointer;text-align:left;line-height:1.45;';
            btn.innerHTML = `
                <strong style="color:${entry.isMerit ? '#ffcc00' : '#ff6666'};">${entry.isMerit ? 'Преимущество' : 'Недостаток'}</strong><br>
                ${escapeHTML(formatPredatorTraitLine(entry.item, entry.isMerit))}
            `;
            btn.onclick = () => {
                modal.remove();
                resolve(entry);
            };
            list.appendChild(btn);
        });

        modal.querySelector('#pred-choice-cancel').onclick = () => {
            modal.remove();
            resolve(entries[0]);
        };
    });
}

function showPredatorAllocationModal(predName, group) {
    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.id = 'predator-allocation-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:27000;display:flex;align-items:center;justify-content:center;padding:18px;';

        const rows = group.entries.map((entry, index) => `
            <label style="display:grid;grid-template-columns:1fr 76px;gap:12px;align-items:center;background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:12px;">
                <span>
                    <strong style="color:${entry.isMerit ? '#ffcc00' : '#ff6666'};">${entry.isMerit ? 'Преимущество' : 'Недостаток'}</strong><br>
                    ${escapeHTML(entry.item.category || entry.item.name)}
                </span>
                <input class="pred-allocation-input" data-index="${index}" type="number" min="0" max="${group.total}" value="0" style="width:100%;background:#000;color:#ffcc66;border:1px solid #555;border-radius:4px;padding:8px;text-align:center;font-size:18px;">
            </label>
        `).join('');

        modal.innerHTML = `
            <div style="width:min(660px,100%);background:#111;border:2px solid #ff3131;border-radius:10px;padding:24px;color:#eee;box-shadow:0 0 36px rgba(255,49,49,0.35);">
                <h2 style="margin:0 0 8px;text-align:center;color:#ff3131;">${escapeHTML(predName)}</h2>
                <p style="margin:0 0 10px;text-align:center;color:#aaa;line-height:1.45;">Распределите <strong style="color:#ffcc66;">${group.total}</strong> пункт(а/ов)</p>
                <div id="pred-allocation-left" style="text-align:center;color:#ffcc66;margin-bottom:14px;">Осталось: ${group.total}</div>
                <div style="display:grid;gap:10px;">${rows}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">
                    <button id="pred-allocation-confirm" style="padding:12px;background:#ff9500;color:#111;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Применить</button>
                    <button id="pred-allocation-cancel" style="padding:12px;background:#333;color:#eee;border:none;border-radius:6px;cursor:pointer;">Отмена</button>
                </div>
            </div>
        `;

        document.getElementById('predator-allocation-modal')?.remove();
        document.body.appendChild(modal);

        const inputs = [...modal.querySelectorAll('.pred-allocation-input')];
        const leftEl = modal.querySelector('#pred-allocation-left');

        function getValues() {
            return inputs.map(input => Math.max(0, parseInt(input.value || '0', 10) || 0));
        }

        function updateLeft() {
            const used = getValues().reduce((sum, value) => sum + value, 0);
            const left = group.total - used;
            leftEl.textContent = `Осталось: ${left}`;
            leftEl.style.color = left < 0 ? '#ff6666' : '#ffcc66';
            return left;
        }

        inputs.forEach(input => input.addEventListener('input', updateLeft));
        updateLeft();

        modal.querySelector('#pred-allocation-confirm').onclick = () => {
            const left = updateLeft();
            if (left !== 0) {
                alert(left > 0 ? `Осталось распределить ${left} пункт(а/ов).` : `Распределено на ${Math.abs(left)} пункт(а/ов) больше.`);
                return;
            }
            const values = getValues();
            modal.remove();
            resolve(values);
        };

        modal.querySelector('#pred-allocation-cancel').onclick = () => {
            const values = group.entries.map((_, index) => index === group.entries.length - 1 ? group.total : 0);
            modal.remove();
            resolve(values);
        };
    });
}

async function applyPredatorChoiceItems(predName) {
    const predData = RULES.predator_types?.[predName];
    if (!predData) return;

    const choiceGroups = getPredatorChoiceGroups(predData);
    for (const groupName of Object.keys(choiceGroups)) {
        const entries = choiceGroups[groupName];
        if (!entries.length) continue;
        const selected = await showPredatorChoiceModal(predName, entries);
        addPredatorItemToSheet(selected.item, selected.isMerit, predName);
    }

    const allocationGroups = getPredatorAllocationGroups(predData);
    for (const groupName of Object.keys(allocationGroups)) {
        const group = allocationGroups[groupName];
        const values = await showPredatorAllocationModal(predName, group);

        group.entries.forEach((entry, index) => {
            const points = values[index] || 0;
            if (points > 0) {
                addPredatorItemToSheet({ ...entry.item, dots: points }, entry.isMerit, predName);
            }
        });
    }

    renderSelectedMeritsFlaws();
}

function hasPredatorChoiceItems(predData) {
    return [
        ...(predData.advantages || []),
        ...(predData.disadvantages || [])
    ].some(isPredatorChoiceItem);
}

function getCurrentBloodPotencyEstimate() {
    const type = document.getElementById('type-input')?.value;
    const generation = parseInt(document.getElementById('generation-input')?.value || '13', 10);

    if (type === 'childe') return 0;
    if (type === 'neonate') return generation <= 13 ? 1 : 0;
    if (type === 'ancilla') return generation <= 11 ? 2 : 1;
    if (type === 'elder' || type === 'methuselah' || type === 'antediluvian') return 3;
    return 0;
}

function validatePredatorRestrictions(predName) {
    const clan = document.getElementById('clan-input')?.value || '';
    const bloodPotency = getCurrentBloodPotencyEstimate();

    if ((predName === 'Суррогатчик' || predName === 'Фермер') && clan === 'Вентру') {
        alert(`${predName} недоступен для клана Вентру.`);
        return false;
    }

    if (predName === 'Фермер' && bloodPotency >= 3) {
        alert('Фермер недоступен при Силе Крови 3 и выше.');
        return false;
    }

    return true;
}

function addPredatorTraits(predName, predData) {
    selectedMerits = selectedMerits.filter(item => !item.fromPredator);
    selectedFlaws = selectedFlaws.filter(item => !item.fromPredator);

    (predData.advantages || []).forEach(adv => {
        if (!isPredatorChoiceItem(adv)) addPredatorItemToSheet(adv, true, predName);
    });

    (predData.disadvantages || []).forEach(dis => {
        if (!isPredatorChoiceItem(dis)) addPredatorItemToSheet(dis, false, predName);
    });
}

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

    addPredatorTraits(predName, predData);

    loadPredatorHint();
    renderSelectedMeritsFlaws();
    updateTrackers();

    // === НАДЁЖНАЯ ЛОГИКА ОТКРЫТИЯ ===
    const hasSpecialty = predData?.specialty?.options && predData.specialty.options.length > 0;
    const hasDisciplines = predData?.disciplines?.increase?.options && predData.disciplines.increase.options.length > 0;
    const hasPredItems = (predData.advantages?.length || 0) + (predData.disadvantages?.length || 0) > 0;
    const hasChoiceItems = hasPredatorChoiceItems(predData);

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

        if (hasChoiceItems) {
            console.log("✅ Открываем выбор преимуществ/недостатков");
            applyPredatorChoiceItems(predName);
            return;
        }

        if (hasPredItems) {
            console.log("✅ Преимущества/недостатки от охоты добавлены автоматически");
        }

        if (!hasSpecialty && !hasDisciplines && !hasPredItems) {
            console.warn(`Стиль охоты ${predName} не имеет дополнительных механик`);
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

            if (newPredator && !validatePredatorRestrictions(newPredator)) {
                this.value = '';
                loadPredatorHint();
                updateTrackers();
                return;
            }

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
        max-height: min(70vh, 520px);
        overflow-y: auto;
        z-index: 30000;
        pointer-events: none;
        box-shadow: 0 0 30px rgba(255,49,49,0.7);
        display: none;
        white-space: pre-line;
        word-wrap: break-word;
        overflow-wrap: anywhere;
    `;
    document.body.appendChild(tooltip);
    return tooltip;
}

function getTooltipTarget(start) {
    let target = start;
    while (target && target !== document && !target.hasAttribute('data-tooltip')) {
        target = target.parentElement;
    }
    return target && target.hasAttribute('data-tooltip') ? target : null;
}

function positionTooltip(target, tt) {
    const gap = 12;
    const edgePadding = 12;
    const rect = target.getBoundingClientRect();
    const ttRect = tt.getBoundingClientRect();
    const spaceAbove = rect.top - edgePadding;
    const spaceBelow = window.innerHeight - rect.bottom - edgePadding;

    const preferTop = spaceAbove >= ttRect.height + gap;
    const canFitBelow = spaceBelow >= ttRect.height + gap;
    const placeAbove = preferTop || (!canFitBelow && spaceAbove >= spaceBelow);

    const centeredLeft = rect.left + (rect.width / 2) - (ttRect.width / 2);
    const maxLeft = window.innerWidth - ttRect.width - edgePadding;
    const left = Math.min(Math.max(edgePadding, centeredLeft), Math.max(edgePadding, maxLeft));

    let top = placeAbove
        ? rect.top - ttRect.height - gap
        : rect.bottom + gap;

    const maxTop = window.innerHeight - ttRect.height - edgePadding;
    top = Math.min(Math.max(edgePadding, top), Math.max(edgePadding, maxTop));

    tt.style.left = `${left}px`;
    tt.style.top = `${top}px`;
}

function showTooltipFor(target) {
    const text = target.getAttribute('data-tooltip')?.trim();
    if (!text) return;

    const tt = createTooltip();
    tt.textContent = text;
    tt.style.left = '-9999px';
    tt.style.top = '-9999px';
    tt.style.display = 'block';
    positionTooltip(target, tt);
}

document.addEventListener('mouseover', function(e) {
    const target = getTooltipTarget(e.target);
    if (target) showTooltipFor(target);
});

document.addEventListener('focusin', function(e) {
    const target = getTooltipTarget(e.target);
    if (target) showTooltipFor(target);
});

document.addEventListener('mouseout', function(e) {
    const target = getTooltipTarget(e.target);
    if (!target || target.contains(e.relatedTarget)) return;
    if (tooltip) tooltip.style.display = 'none';
});

document.addEventListener('focusout', function() {
    if (tooltip) tooltip.style.display = 'none';
});

window.addEventListener('scroll', function() {
    if (tooltip) tooltip.style.display = 'none';
}, true);

window.addEventListener('resize', function() {
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
    if (startingSheetFixed && !expShopMode) {
        alert("Лист зафиксирован. Покупай преимущества и недостатки через магазин опыта.");
        return;
    }
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
            <strong>${name} — ${points} точек</strong>
            ${expShopMode ? `<span style="color:#ffcc00; font-weight:bold; margin-left:8px;">${tab === 0 ? points * 3 : 0} XP</span>` : ''}<br>
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
                if (expShopMode) renderExpShopPanel();
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
        const rawItem = predData.advantages?.[parseInt(cb.dataset.index, 10)] || cb.value;
        const item = buildPredatorTrait(rawItem, true, predName);
        // Проверяем, нет ли уже (включая от охоты)
        if (!selectedMerits.some(m => m.name === item.name && m.category === item.category)) {
            selectedMerits.push(item);
        }
    });

    // Недостатки
    document.querySelectorAll('.pred-flaw:checked').forEach(cb => {
        const rawItem = predData.disadvantages?.[parseInt(cb.dataset.index, 10)] || cb.value;
        const item = buildPredatorTrait(rawItem, false, predName);
        if (!selectedFlaws.some(f => f.name === item.name && f.category === item.category)) {
            selectedFlaws.push(item);
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
        if (!item.fromPredator) totalMerits += getTraitPoints(item);
        meritsContainer.appendChild(createSelectedItem(item, index, true));
    });

    const flawsContainer = document.getElementById('selected-flaws-list');
    flawsContainer.innerHTML = '';
    selectedFlaws.forEach((item, index) => {
        if (!item.fromPredator) totalFlaws += getTraitPoints(item);
        flawsContainer.appendChild(createSelectedItem(item, index, false));
    });

    renderDots('merits-dots', totalMerits, true);
    renderDots('flaws-dots', totalFlaws, false);
}





function renderDots(containerId, points, isMerit) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    const max = isMerit ? getMeritsLimit() : getFlawsLimit();   // ← главное изменение
    
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
    const points = getTraitPoints(item);
    const isFromPredator = item.fromPredator === true;
    const baseKeys = isMerit ? getBaseMeritKeys() : getBaseFlawKeys();
    const snapshotItems = isMerit ? (expShopSnapshot?.merits || []) : (expShopSnapshot?.flaws || []);
    const snapshotKeys = new Set(snapshotItems.map(getItemKey));
    const isPendingPurchase = expShopMode && !snapshotKeys.has(getItemKey(item));
    const isFromExperience = startingSheetFixed && !isFromPredator && !baseKeys.has(getItemKey(item));
    const categoryName = item.category || '';
    let displayName = item.name || item.название_пункта || '';
    
    if (categoryName && !displayName.toLowerCase().includes(categoryName.toLowerCase().slice(0, 15))) {
        displayName = `${categoryName} • ${displayName}`;
    }

    const maxDots = 5;
    let dotsHTML = '';

    for (let i = 1; i <= maxDots; i++) {
        const filled = i <= points;
        const dotColor = isPendingPurchase && filled ? '#ffcc00' : isFromExperience && filled ? '#ff9500' : '#ff3131';
        const borderColor = isPendingPurchase && filled ? '#ffe066' : isFromExperience && filled ? '#ffb733' : '#ff6666';
        const dotClass = isPendingPurchase && filled ? 'exp-pending' : isFromExperience && filled ? 'exp-purchased' : '';
        dotsHTML += `
            <div class="merit-dot ${dotClass}" style="width:18px; height:18px; border-radius:50%; 
                        background: ${filled ? dotColor : '#333'}; 
                        border: 2px solid ${filled ? borderColor : '#555'}; 
                        margin-left: 3px;"></div>`;
    }

    if (isFromPredator) {
        dotsHTML += `
            <span style="color:#ffae00; font-weight:bold; background:#1a1a1a; 
                         padding:4px 8px; border-radius:6px; border:1px solid #444; margin-left:6px; white-space:nowrap;">
                Тип охоты: ${item.predatorType || ''} • не считается
            </span>`;
    } else if (expShopMode && isPendingPurchase) {
        dotsHTML += `
            <span style="color:#ffcc00; font-weight:bold; background:#1a1a1a; 
                         padding:4px 8px; border-radius:6px; border:1px solid #665500; margin-left:6px; white-space:nowrap;">
                ${isMerit ? `${points * 3} XP` : '0 XP'}
            </span>`;
    } else if (expShopMode && isFromExperience) {
        dotsHTML += `
            <span style="color:#ff9500; font-weight:bold; background:#1a1a1a; 
                         padding:4px 8px; border-radius:6px; border:1px solid #664400; margin-left:6px; white-space:nowrap;">
                ${isMerit ? `${points * 3} XP` : '0 XP'}
            </span>`;
    }

    const div = document.createElement('div');
    div.className = 'selected-item';
    div.style.cssText = `
        background:#1a1a1a; padding:12px 14px; margin-bottom:6px; border-radius:6px;
        border-left:4px solid ${isPendingPurchase ? '#ffcc00' : isFromExperience ? '#ff9500' : isMerit ? '#ffcc00' : '#ff6666'}; 
        cursor: pointer; overflow: hidden; transition: all 0.3s;
    `;
    div.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:12px; flex:1;">
                <strong style="flex:1;">${displayName}</strong>
                <div style="display:flex; gap:3px; align-items:center;">${dotsHTML}</div>
            </div>
            ${(!isFromPredator || expShopMode) ? `
            <button class="selected-item-remove" onclick="event.stopImmediatePropagation(); ${isMerit ? `removeMerit(${index})` : `removeFlaw(${index})`}" 
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
        predData.advantages.forEach((adv, index) => {
            const name = formatPredatorTraitLine(adv, true);
            html += `<label style="display:block; margin:8px 0; color:#ddd; cursor:pointer;">
                        <input type="checkbox" class="pred-adv" value="${name}" data-index="${index}" checked> ${name}
                     </label>`;
        });
        html += `</div>`;
    }

    // Недостатки
    if (predData.disadvantages && predData.disadvantages.length > 0) {
        html += `<div><strong style="color:#ff6666; display:block; margin-bottom:12px;">Недостатки:</strong>`;
        predData.disadvantages.forEach((dis, index) => {
            const name = formatPredatorTraitLine(dis, false);
            html += `<label style="display:block; margin:8px 0; color:#ddd; cursor:pointer;">
                        <input type="checkbox" class="pred-flaw" value="${name}" data-index="${index}" checked> ${name}
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
        const rawItem = predData.advantages?.[parseInt(cb.dataset.index, 10)] || cb.value;
        const item = buildPredatorTrait(rawItem, true, predName);
        // Проверяем, нет ли уже (включая от охоты)
        if (!selectedMerits.some(m => m.name === item.name && m.category === item.category)) {
            selectedMerits.push(item);
        }
    });

    // Недостатки
    document.querySelectorAll('.pred-flaw:checked').forEach(cb => {
        const rawItem = predData.disadvantages?.[parseInt(cb.dataset.index, 10)] || cb.value;
        const item = buildPredatorTrait(rawItem, false, predName);
        if (!selectedFlaws.some(f => f.name === item.name && f.category === item.category)) {
            selectedFlaws.push(item);
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

    updateTrackers();
    renderSelectedMeritsFlaws();
    applyPredatorChoiceItems(predatorName);
}

function closePredatorSelectionModal() {
    document.getElementById('predator-selection-modal')?.remove();
}




// Проверка лимита преимуществ (игнорируем пункты от охоты)
function canAddMerit(newPoints) {
    if (expShopMode) return true;

    const currentTotal = selectedMerits.reduce((sum, item) => {
        if (item.fromPredator) return sum;        // бесплатно от охоты — не считаем
        return sum + getTraitPoints(item);
    }, 0);

    return currentTotal + newPoints <= getMeritsLimit();
}

// Проверка лимита недостатков (игнорируем пункты от охоты)
function canAddFlaw(newPoints) {
    if (expShopMode) return true;

    const currentTotal = selectedFlaws.reduce((sum, item) => {
        if (item.fromPredator) return sum;        // бесплатно от охоты — не считаем
        return sum + getTraitPoints(item);
    }, 0);

    return currentTotal + newPoints <= getFlawsLimit();
}

// Показываем предупреждение при превышении
function showLimitWarning(isMerit) {
    const meritLimit = getMeritsLimit();
    const flawLimit = getFlawsLimit();
    const msg = isMerit
        ? `❌ Максимум ${meritLimit} точек преимуществ для выбранного типа!`
        : `❌ Максимум ${flawLimit} точек недостатков для выбранного типа!`;
    
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
    if (startingSheetFixed && !expShopMode) return alert("Лист зафиксирован. Продавай преимущества через магазин опыта.");
   
    
    selectedMerits.splice(i,1); 
    renderSelectedMeritsFlaws(); 
    if (expShopMode) renderExpShopPanel();
};

window.removeFlaw = function(i) { 
    if (startingSheetFixed && !expShopMode) return alert("Лист зафиксирован. Меняй недостатки через магазин опыта.");
    
    selectedFlaws.splice(i,1); 
    renderSelectedMeritsFlaws(); 
    if (expShopMode) renderExpShopPanel();
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


// ====================== ЭКСПОРТ / ИМПОРТ JSON ======================

function getFullCharacterData() {
    const character = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        name: document.getElementById('char-name').value.trim() || "Безымянный",
        clan: document.getElementById('clan-input').value,
        predator: document.getElementById('predator-input').value,
        generation: document.getElementById('generation-input')?.value || '',
        type: document.getElementById('type-input')?.value || '',
        baseHumanity: document.getElementById('base-humanity')?.value || '7',
        freeExp: getCurrentXP(),
        expHistory: JSON.parse(JSON.stringify(expHistory || [])),
        skillPackage: document.getElementById('skill-package').value,
        sheetLock: {
            fixed: startingSheetFixed,
            baseLevels: baseLevels,
            snapshot: sheetLockSnapshot,
            baseState: startingSheetBase
        },
        
        attributes: {},
        skills: {},
        disciplines: JSON.parse(JSON.stringify(disciplineSources || {})),
        selectedPowers: JSON.parse(JSON.stringify(selectedPowers || {})),
        merits: JSON.parse(JSON.stringify(selectedMerits || [])),
        flaws: JSON.parse(JSON.stringify(selectedFlaws || []))
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

    return character;
}

window.getFullCharacterData = getFullCharacterData;

function resetCharacterSheetForLoad() {
    document.querySelectorAll('.dot-input').forEach(input => {
        input.checked = parseInt(input.value, 10) === 0;
    });
    document.querySelectorAll('.skill-specs').forEach(container => {
        container.innerHTML = '';
        container.style.display = 'none';
    });
    document.querySelectorAll('.spec-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });

    disciplineSources = {};
    selectedPowers = {};
    selectedMerits = [];
    selectedFlaws = [];
    clanProvidedDisciplines = {};
    predatorProvidedDisciplines = {};
    currentPredatorSpecialty = null;
    expShopMode = false;
    expShopSnapshot = null;
    expShopStartLevels = {};

    const list = document.getElementById('disciplines-list');
    if (list) list.innerHTML = '';
}

function applyCharacterData(d, sourceName = 'JSON') {
    console.log(`📥 Загрузка персонажа из ${sourceName}:`, d);
    isApplyingCharacterData = true;

    try {
        resetCharacterSheetForLoad();

        // Основная информация
        document.getElementById('char-name').value = d.name || 'Безымянный';
        document.getElementById('clan-input').value = d.clan || '';
        document.getElementById('predator-input').value = d.predator || '';
        if (document.getElementById('generation-input')) document.getElementById('generation-input').value = d.generation || '';
        if (document.getElementById('type-input')) document.getElementById('type-input').value = d.type || '';
        if (document.getElementById('base-humanity')) document.getElementById('base-humanity').value = d.baseHumanity || '7';
        if (document.getElementById('free-exp')) document.getElementById('free-exp').value = parseInt(d.freeExp ?? d.experience ?? 0, 10) || 0;
        expHistory = Array.isArray(d.expHistory) ? JSON.parse(JSON.stringify(d.expHistory)) : [];
        renderExpHistory();

        if (d.skillPackage) {
            document.getElementById('skill-package').value = d.skillPackage;
            currentPackage = d.skillPackage;
        }

        // Атрибуты
        Object.keys(d.attributes || {}).forEach(name => {
            const radio = document.querySelector(`input[name="${name}"][value="${d.attributes[name]}"]`);
            if (radio) radio.checked = true;
        });

        Object.keys(d.skills || {}).forEach(skill => {
            const s = d.skills[skill];
            const dots = typeof s === 'object' ? s.dots : s;
            const specs = typeof s === 'object' && Array.isArray(s.specs) ? s.specs : [];
            const radio = document.querySelector(`input[name="${skill}"][value="${dots}"]`);
            if (radio) radio.checked = true;

            restoreSpecializations(skill, specs);
        });

        // === ДИСЦИПЛИНЫ ===
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

        startingSheetFixed = Boolean(d.sheetLock?.fixed);
        baseLevels = d.sheetLock?.baseLevels ? JSON.parse(JSON.stringify(d.sheetLock.baseLevels)) : captureCurrentLevels();
        sheetLockSnapshot = d.sheetLock?.snapshot ? JSON.parse(JSON.stringify(d.sheetLock.snapshot)) : captureSheetSnapshot();
        startingSheetBase = d.sheetLock?.baseState
            ? JSON.parse(JSON.stringify(d.sheetLock.baseState))
            : JSON.parse(JSON.stringify(sheetLockSnapshot));

        renderSelectedMeritsFlaws();
        loadClanHint();
        loadPredatorHint();
        updateClanIcon();
        updateBloodPotencyAndBonuses();
        updateHumanity();
        updateTrackers();
        updateVitals();
        document.querySelectorAll('.skill-name').forEach(el => {
            const skillName = el.getAttribute('data-skill') || el.textContent.trim();
            if (skillName) updateSBadgeState(skillName);
        });
    } finally {
        isApplyingCharacterData = false;
        applySheetLockState();
        updateExpPurchasedStyles();
        renderExpHistory();
    }
}

window.applyCharacterData = applyCharacterData;

function exportToJSON() {
    const character = getFullCharacterData();

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
                applyCharacterData(d, 'JSON');

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




// Привязываем события
function setupGenerationHint() {
    const typeSelect = document.getElementById('type-input');
    const genSelect = document.getElementById('generation-input');
    const baseHumanitySelect = document.getElementById('base-humanity');

    if (typeSelect) typeSelect.addEventListener('change', () => {
        updateBloodPotencyAndBonuses();
        updateHumanity();
        renderSelectedMeritsFlaws();
    });
    if (genSelect) genSelect.addEventListener('change', updateBloodPotencyAndBonuses);
    if (baseHumanitySelect) baseHumanitySelect.addEventListener('change', updateHumanity);
}




// ==================== ОБНОВЛЕНИЕ ОПЫТА ====================
function formatExpHistoryEntry(entry) {
    if (typeof entry === 'string') return entry;
    const amount = parseInt(entry.amount || 0, 10) || 0;
    const sign = amount >= 0 ? '+' : '';
    const date = entry.timestamp ? new Date(entry.timestamp).toLocaleString('ru-RU') : '';
    const details = Array.isArray(entry.details) && entry.details.length
        ? `<div style="margin-left:10px;color:#777;">${entry.details.map(escapeHTML).join('<br>')}</div>`
        : '';
    return `${sign}${amount} XP → ${escapeHTML(entry.text || 'Операция')}${date ? ` <small style="color:#666;">${date}</small>` : ''}${details}`;
}

function renderExpHistory() {
    const logEl = document.getElementById('exp-log');
    if (!logEl) return;
    logEl.innerHTML = (expHistory || []).length
        ? expHistory.map(formatExpHistoryEntry).join('<br>')
        : '<span style="color:#666;">История опыта пуста.</span>';
}

function recordExpHistory(text, amount, details = []) {
    expHistory.unshift({
        text,
        amount,
        details,
        timestamp: new Date().toISOString()
    });
    if (expHistory.length > 80) expHistory = expHistory.slice(0, 80);
    renderExpHistory();
}

function addFreeExperience() {
    const raw = prompt('Сколько опыта добавить?');
    const amount = parseInt(raw, 10);
    if (!amount || amount < 1) return alert('Введите положительное количество опыта.');

    const freeExp = document.getElementById('free-exp');
    if (freeExp) freeExp.value = getCurrentXP() + amount;
    recordExpHistory('Добавлен свободный опыт', amount);
    renderExpShopPanel();
}

window.addFreeExperience = addFreeExperience;

function updateExperienceBonus() {
    const type = document.getElementById('type-input').value;
    const expInput = document.getElementById('free-exp');
    const infoEl = document.getElementById('exp-bonus-info');

    if (!expInput) return;

    let bonus = 0;
    let text = 'Базовый опыт';

    switch(type) {
        case 'childe':
            bonus = 0;
            text = '0 опыта (Птенец)';
            break;
        case 'neonate':
            bonus = 15;
            text = '+15 опыта (Неонат)';
            break;
        case 'ancilla':
            bonus = 35;
            text = '+35 опыта (Анцилла)';
            break;
        case 'elder':
            bonus = 50;
            text = '+50 опыта (Старейшина)';
            break;
        case 'methuselah':
            bonus = 75;
            text = '+75 опыта (Матузалем)';
            break;
        default:
            bonus = 0;
            text = '—';
    }

    const currentValue = parseInt(expInput.value) || 0;
    const canApplyAutoBonus = !startingSheetFixed && expHistory.length === 0 && (
        lastAutoExperienceBonus === null ||
        currentValue === lastAutoExperienceBonus ||
        currentValue === 0
    );

    if (canApplyAutoBonus) {
        expInput.value = bonus;
        lastAutoExperienceBonus = bonus;
    }

    if (infoEl) {
        infoEl.innerHTML = `<strong style="color:#ffcc00;">${text}</strong>`;
    }
}

// Привязываем события
function setupExperienceListener() {
    const typeSelect = document.getElementById('type-input');
    const expInput = document.getElementById('free-exp');

    if (expInput) {
        expInput.readOnly = true;
        expInput.addEventListener('keydown', e => e.preventDefault());
        expInput.addEventListener('paste', e => e.preventDefault());
    }

    if (typeSelect) {
        typeSelect.addEventListener('change', updateExperienceBonus);
    }
    
    // Также обновляем при загрузке
    window.addEventListener('load', () => {
        setTimeout(() => {
            updateExperienceBonus();
            renderExpHistory();
        }, 100);
    });
}

// Запускаем
setupExperienceListener();

// Привязываем к изменениям типа
document.getElementById('type-input').addEventListener('change', updateExperienceBonus);





// ==================== УЛУЧШЕННАЯ ГЕНЕРАЦИЯ JPG ====================
async function generateSheetImage() {
    const area = document.getElementById('capture-area');
    if (!area) return alert("Не найден #capture-area");

    const charName = (document.getElementById('char-name')?.value || 'Kindred').trim();
    const btn = document.getElementById('btn-save');
    const originalText = btn?.textContent || 'Сохранить в JPG';

    if (btn) { btn.textContent = 'Генерируем...'; btn.disabled = true; }

    try {
        if (typeof window.html2canvas !== 'function') {
            throw new Error('html2canvas не загружен');
        }

        const specContainers = area.querySelectorAll('.skill-specs');
        specContainers.forEach(c => {
            if (c.children.length > 0) c.style.display = 'flex';
        });

        await new Promise(r => setTimeout(r, 100));

        const canvas = await window.html2canvas(area, {
            scale: 3,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#0a0a0a',
            logging: false,
        });

        const link = document.createElement('a');
        link.download = `V5_${charName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_')}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.92);
        link.click();

    } catch (err) {
        console.error(err);
        alert("Ошибка генерации JPG. Проверь, что html2canvas подключён.");
    } finally {
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
}

function setupSaveButton() {
    const btn = document.getElementById('btn-save');
    if (btn) {
        btn.removeEventListener('click', generateSheetImage);
        btn.addEventListener('click', generateSheetImage);
    }
}

// ==================== ТРАТА ОПЫТА — АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ УРОВНЯ ====================

let expLog = [];

function logExp(text, cost) {
    const freeExpEl = document.getElementById('free-exp');
    if (freeExpEl) {
        let current = parseInt(freeExpEl.value) || 0;
        freeExpEl.value = Math.max(0, current - cost);
    }

    recordExpHistory(text, -cost);
}

// Вспомогательная функция кумулятивного расчёта
function calculateCumulativeCost(current, target, multiplier) {
    let total = 0;
    for (let i = current + 1; i <= target; i++) {
        total += i * multiplier;
    }
    return total;
}

// ====================== ХАРАКТЕРИСТИКА ======================
function spendOnAttribute() {
    const name = prompt("Какую характеристику хочешь повысить?");
    if (!name) return;

    // Автоматически берём текущий уровень
    const currentRadio = document.querySelector(`input[name="${name}"]:checked`);
    const current = currentRadio ? parseInt(currentRadio.value) : 0;

    const target = parseInt(prompt(`Текущий уровень: ${current}\nНовый уровень?`));
    if (!target || target <= current || target > 5) return alert("Неверный уровень");

    const cost = target * 5;
    if (!assertEnoughXP(cost)) return;

    if (confirm(`Повысить ${name} с ${current} → ${target} за ${cost} XP?`)) {
        const newRadio = document.querySelector(`input[name="${name}"][value="${target}"]`);
        if (newRadio) newRadio.checked = true;

        logExp(`${name} ${current}→${target}`, cost);
        updateVitals();
        alert(`✅ ${name} повышена!`);
    }
}

// ====================== НАВЫК ======================
function spendOnSkill() {
    const name = prompt("Какой навык хочешь повысить?");
    if (!name) return;

    const currentRadio = document.querySelector(`input[name="${name}"]:checked`);
    const current = currentRadio ? parseInt(currentRadio.value) : 0;

    const target = parseInt(prompt(`Текущий уровень: ${current}\nНовый уровень?`));
    if (!target || target <= current || target > 5) return alert("Неверный уровень");

    const cost = calculateCumulativeCost(current, target, 3);

    if (confirm(`Повысить ${name} с ${current} → ${target} за ${cost} XP?`)) {
        const newRadio = document.querySelector(`input[name="${name}"][value="${target}"]`);
        if (newRadio) newRadio.checked = true;

        logExp(`${name} ${current}→${target}`, cost);
        alert(`✅ ${name} повышен!`);
    }
}

// ====================== СПЕЦИАЛИЗАЦИЯ ======================
function spendOnSpecialty() {
    const skill = prompt("Для какого навыка добавляем специализацию?");
    if (!skill) return;
    const spec = prompt("Название специализации?");

    if (confirm(`Добавить "${spec}" за 3 XP?`)) {
        const container = document.getElementById(`specs-${skill}`);
        if (container) {
            const div = document.createElement('div');
            div.className = 'skill-spec-line';
            div.innerHTML = `• ${spec} <small>(3 XP)</small>`;
            container.appendChild(div);
            container.style.display = 'block';
        }
        logExp(`Специализация "${spec}" (${skill})`, 3);
    }
}

// ====================== ПРЕИМУЩЕСТВО ======================
function spendOnMerit() {
    const name = prompt("Какое преимущество покупаешь/повышаешь?");
    if (!name) return;
    const dots = parseInt(prompt("Сколько пунктов добавить?") || "1");

    const cost = dots * 3;

    if (confirm(`Добавить "${name}" (+${dots} пунктов) за ${cost} XP?`)) {
        logExp(`Преимущество "${name}" +${dots}`, cost);
        alert(`✅ Добавлено!`);
    }
}

// ====================== ДИСЦИПЛИНА ======================
function spendOnDiscipline() {
    const name = prompt("Название дисциплины?");
    if (!name) return;

    // Автоматически считаем текущий уровень дисциплины
    let current = 0;
    if (disciplineSources[name]) {
        current = Object.values(disciplineSources[name]).reduce((a, b) => a + b, 0);
    }

    const target = parseInt(prompt(`Текущий уровень: ${current}\nНовый уровень?`));
    if (!target || target <= current || target > 5) return;

    const isClan = confirm("Это **клановая** дисциплина?");
    const multiplier = isClan ? 5 : 7;

    const cost = calculateCumulativeCost(current, target, multiplier);

    if (confirm(`Повысить ${name} с ${current} → ${target} за ${cost} XP?`)) {
        mergeDiscipline(name, target - current, "Опыт");
        logExp(`Дисциплина ${name} ${current}→${target}`, cost);
    }
}

// ==================== КРАСИВОЕ МОДАЛЬНОЕ ОКНО ТРАТЫ ОПЫТА ====================

let expLogModal = [];

function logModal(text, cost) {
    const freeExp = document.getElementById('free-exp');
    if (freeExp) freeExp.value = Math.max(0, (parseInt(freeExp.value) || 0) - cost);

    expLogModal.unshift(`-${cost} XP → ${text}`);
    if (expLogModal.length > 8) expLogModal.pop();

    const logEl = document.getElementById('modal-log');
    if (logEl) logEl.innerHTML = expLogModal.join('<br>');
    recordExpHistory(text, -cost);
}

function openExpModal() {
    startExpShopMode();
}

function closeExpModal() {
    document.getElementById('exp-modal').style.display = 'none';
}

function getTraitKindLabel(type) {
    if (type === 'attr') return 'Характеристика';
    if (type === 'skill') return 'Навык';
    if (type === 'discipline') return 'Дисциплина';
    if (type === 'merit') return 'Преимущество';
    if (type === 'flaw') return 'Недостаток';
    if (type === 'specialty') return 'Специализация';
    if (type === 'power') return 'Сила дисциплины';
    return 'Покупка';
}

function getTraitMultiplier(type) {
    return type === 'attr' ? 5 : 3;
}

function getLevelPurchaseCost(fromLevel, toLevel, multiplier) {
    let total = 0;
    if (toLevel > fromLevel) {
        for (let level = fromLevel + 1; level <= toLevel; level++) {
            total += level * multiplier;
        }
    } else if (toLevel < fromLevel) {
        for (let level = toLevel + 1; level <= fromLevel; level++) {
            total -= level * multiplier;
        }
    }
    return total;
}

function getDisciplineTotal(name, sources = disciplineSources) {
    return Object.values(sources?.[name] || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
}

function getBaseDisciplineLevel(name) {
    return getDisciplineTotal(name, startingSheetBase?.disciplines || {});
}

function getDisciplineModeMultiplier(modeLabel) {
    const normalized = String(modeLabel || '').toLowerCase();
    if (normalized.includes('каитиф')) return 6;
    if (normalized.includes('сторон')) return 7;
    return 5;
}

function getDisciplineMultiplier(name, sources = disciplineSources) {
    const sourceText = Object.keys(sources?.[name] || {}).join(' ').toLowerCase();
    if (!sourceText && expShopMode) return getDisciplineModeMultiplier(expShopDisciplineMode);
    if (sourceText.includes('каитиф')) return 6;
    if (sourceText.includes('сторон')) return 7;
    return 5;
}

function getDisciplineCartMultiplier(name, from, to) {
    if (to > from) return getDisciplineMultiplier(name, disciplineSources);
    return getDisciplineMultiplier(name, expShopSnapshot?.disciplines || disciplineSources);
}

function getDisciplinePreviewCost(name, target) {
    const from = getDisciplineTotal(name, expShopSnapshot?.disciplines || {});
    return getLevelPurchaseCost(from, target, getDisciplineCartMultiplier(name, from, target));
}

function getExistingDisciplineModeLabel(name) {
    const sourceText = Object.keys(disciplineSources[name] || {}).join(' ').toLowerCase();
    if (sourceText.includes('каитиф')) return 'каитиф';
    if (sourceText.includes('сторон')) return 'сторонняя';
    return 'клановая';
}

function getItemKey(item) {
    return `${item?.category || ''}::${item?.name || item?.название_пункта || ''}`;
}

function getBaseMeritKeys() {
    return new Set((startingSheetBase?.merits || []).map(getItemKey));
}

function getBaseFlawKeys() {
    return new Set((startingSheetBase?.flaws || []).map(getItemKey));
}

function getPowerLevel(discName, powerName) {
    const powers = RULES.disciplines?.[discName]?.powers || {};
    for (let level = 1; level <= 5; level++) {
        if (powers[level]?.[powerName]) return level;
    }
    return 0;
}

function getPowerPurchaseCost(discName, powerName) {
    return 0;
}

function getTraitPurchaseCost(item) {
    return getTraitPoints(item) * 3;
}

function getMeritPurchaseCost(item) {
    return item?.fromPredator ? 0 : getTraitPoints(item) * 3;
}

function getExpShopCart() {
    const cart = [];
    document.querySelectorAll('.dots input.dot-input:checked').forEach(input => {
        const name = input.name;
        const current = parseInt(input.value) || 0;
        const start = expShopStartLevels[name] ?? 0;
        if (!name || current === start) return;

        const multiplier = getTraitMultiplier(input.dataset.type);
        cart.push({
            name,
            type: input.dataset.type,
            from: start,
            to: current,
            cost: getLevelPurchaseCost(start, current, multiplier)
        });
    });

    const snapshotDisciplines = expShopSnapshot?.disciplines || {};
    const allDisciplines = new Set([...Object.keys(snapshotDisciplines), ...Object.keys(disciplineSources)]);
    allDisciplines.forEach(name => {
        const from = getDisciplineTotal(name, snapshotDisciplines);
        const to = getDisciplineTotal(name, disciplineSources);
        if (from === to) return;
        const multiplier = getDisciplineCartMultiplier(name, from, to);
        cart.push({
            name,
            type: 'discipline',
            from,
            to,
            cost: getLevelPurchaseCost(from, to, multiplier)
        });
    });

    const snapshotMerits = expShopSnapshot?.merits || [];
    const currentMeritKeys = new Set(selectedMerits.map(getItemKey));
    const snapshotMeritKeys = new Set(snapshotMerits.map(getItemKey));
    selectedMerits.forEach(item => {
        const key = getItemKey(item);
        if (snapshotMeritKeys.has(key)) return;
        const points = getTraitPoints(item);
        cart.push({ name: item.name, type: 'merit', from: 0, to: points, cost: getMeritPurchaseCost(item) });
    });
    snapshotMerits.forEach(item => {
        const key = getItemKey(item);
        if (currentMeritKeys.has(key)) return;
        const points = getTraitPoints(item);
        const cost = getMeritPurchaseCost(item);
        cart.push({ name: item.name, type: 'merit', from: points, to: 0, cost: cost ? -cost : 0 });
    });

    const snapshotFlaws = expShopSnapshot?.flaws || [];
    const currentFlawKeys = new Set(selectedFlaws.map(getItemKey));
    const snapshotFlawKeys = new Set(snapshotFlaws.map(getItemKey));
    selectedFlaws.forEach(item => {
        const key = getItemKey(item);
        if (snapshotFlawKeys.has(key)) return;
        const points = getTraitPoints(item);
        cart.push({ name: item.name, type: 'flaw', from: 0, to: points, cost: 0 });
    });
    snapshotFlaws.forEach(item => {
        const key = getItemKey(item);
        if (currentFlawKeys.has(key)) return;
        const points = getTraitPoints(item);
        cart.push({ name: item.name, type: 'flaw', from: points, to: 0, cost: 0 });
    });

    const snapshotSkills = expShopSnapshot?.skills || {};
    const currentSkills = getFullCharacterData().skills || {};
    const allSkillNames = new Set([...Object.keys(snapshotSkills), ...Object.keys(currentSkills)]);
    allSkillNames.forEach(skillName => {
        const before = new Set(snapshotSkills[skillName]?.specs || []);
        const after = new Set(currentSkills[skillName]?.specs || []);
        after.forEach(spec => {
            if (!before.has(spec)) cart.push({ name: `${skillName}: ${spec}`, type: 'specialty', from: 0, to: 1, cost: 3 });
        });
        before.forEach(spec => {
            if (!after.has(spec)) cart.push({ name: `${skillName}: ${spec}`, type: 'specialty', from: 1, to: 0, cost: -3 });
        });
    });

    const snapshotPowers = expShopSnapshot?.selectedPowers || {};
    const allPowerDisciplines = new Set([...Object.keys(snapshotPowers), ...Object.keys(selectedPowers)]);
    allPowerDisciplines.forEach(discName => {
        const before = new Set(snapshotPowers[discName] || []);
        const after = new Set(selectedPowers[discName] || []);
        after.forEach(power => {
            if (!before.has(power)) cart.push({ name: `${discName}: ${power}`, type: 'power', from: 0, to: getPowerLevel(discName, power), cost: getPowerPurchaseCost(discName, power) });
        });
        before.forEach(power => {
            if (!after.has(power)) cart.push({ name: `${discName}: ${power}`, type: 'power', from: getPowerLevel(discName, power), to: 0, cost: -getPowerPurchaseCost(discName, power) });
        });
    });

    return cart;
}

function getExpShopTotal() {
    return getExpShopCart().reduce((sum, item) => sum + item.cost, 0);
}

function getCartCostLabel(cost) {
    if (cost > 0) return `-${cost} XP`;
    if (cost < 0) return `+${Math.abs(cost)} XP`;
    return '0 XP';
}

function renderExpShopPanel() {
    const rightPanel = document.querySelector('.right-panel');
    if (!rightPanel) return;

    document.querySelectorAll('#clan-hint-box, #predator-hint-box, #generation-hint-box').forEach(box => {
        box.style.display = expShopMode ? 'none' : '';
    });

    let panel = document.getElementById('xp-shop-side-panel');
    if (!expShopMode) {
        panel?.remove();
        return;
    }

    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'xp-shop-side-panel';
        panel.className = 'xp-shop-panel';
        const authBtn = document.getElementById('auth-btn');
        if (authBtn?.nextSibling) {
            rightPanel.insertBefore(panel, authBtn.nextSibling);
        } else {
            rightPanel.prepend(panel);
        }
    }

    const cart = getExpShopCart();
    const total = cart.reduce((sum, item) => sum + item.cost, 0);
    const freeXP = getCurrentXP();
    const overBudget = total > freeXP;

    const cartHTML = cart.length
        ? cart.map(item => `
            <div class="xp-cart-line">
                <span>${getTraitKindLabel(item.type)}: ${item.name} ${item.from}→${item.to}</span>
                <strong>${getCartCostLabel(item.cost)}</strong>
            </div>
        `).join('')
        : `<div style="color:#777; font-size:13px; line-height:1.45;">Выбери покупку кнопками ниже или кликай по листу. Дисциплины и преимущества появятся здесь отдельной строкой с ценой.</div>`;

    panel.innerHTML = `
        <h3 style="margin:0 0 8px; color:#ff9500; text-align:center;">Касса опыта</h3>
        <table>
            <tr><th>Покупка</th><th>Цена</th></tr>
            <tr><td>Характеристика</td><td>Новое значение × 5</td></tr>
            <tr><td>Навык</td><td>Новое значение × 3</td></tr>
            <tr><td>Новая специализация</td><td>3 XP</td></tr>
            <tr><td>Клановая дисциплина</td><td>Новое значение × 5</td></tr>
            <tr><td>Сторонняя дисциплина</td><td>Новое значение × 7</td></tr>
            <tr><td>Дисциплина каитифа</td><td>Новое значение × 6</td></tr>
            <tr><td>Сила дисциплины</td><td>Бесплатно, максимум = уровень дисциплины</td></tr>
            <tr><td>Ритуал / рецептура</td><td>Уровень × 3</td></tr>
            <tr><td>Преимущество</td><td>3 XP за пункт</td></tr>
            <tr><td>Недостаток</td><td>Бесплатно</td></tr>
            <tr><td>Сила Крови</td><td>Новое значение × 10</td></tr>
        </table>
        <label style="display:block;color:#aaa;font-size:12px;margin:10px 0 6px;">Цена новых дисциплин</label>
        <select id="xp-discipline-mode" onchange="expShopDisciplineMode=this.value; renderDisciplines(); renderExpShopPanel();" style="width:100%;margin-bottom:10px;">
            <option value="клановая" ${expShopDisciplineMode === 'клановая' ? 'selected' : ''}>Клановая ×5</option>
            <option value="сторонняя" ${expShopDisciplineMode === 'сторонняя' ? 'selected' : ''}>Сторонняя ×7</option>
            <option value="каитиф" ${expShopDisciplineMode === 'каитиф' ? 'selected' : ''}>Каитиф ×6</option>
        </select>
        <div class="xp-shop-tools">
            <button onclick="shopBuyDiscipline()">Купить / повысить дисциплину</button>
            <button onclick="shopAddMerit()">Купить преимущество / добавить недостаток</button>
            <button onclick="document.getElementById('disciplines-list')?.scrollIntoView({behavior:'smooth', block:'start'})">Точки дисциплин: кликай по строкам на листе</button>
            <button onclick="document.getElementById('skills-grid')?.scrollIntoView({behavior:'smooth', block:'start'})">Специализации: кликай S у навыков</button>
            <button onclick="document.querySelector('.merit-add-btn')?.scrollIntoView({behavior:'smooth', block:'center'})">Преимущества/недостатки: кнопка на листе ниже</button>
        </div>
        <div style="color:#aaa; font-size:12px; margin-bottom:8px;">Чек покупок и продаж</div>
        ${cartHTML}
        <div class="xp-cart-total">
            <span>Итого</span>
            <span style="color:${overBudget ? '#ff6666' : '#ffcc66'}">${getCartCostLabel(total)} / ${freeXP} XP</span>
        </div>
        ${overBudget ? `<div style="color:#ff6666; font-size:12px; margin-top:8px;">Не хватает ${total - freeXP} XP.</div>` : ''}
        <div class="xp-shop-actions">
            <button onclick="acceptExpShopPurchases()" style="background:#ff9500; color:#111;">Принять</button>
            <button onclick="cancelExpShopPurchases()" style="background:#333; color:#eee;">Отмена</button>
        </div>
    `;
}

function getDisciplineNamesForPrompt() {
    return Object.keys(RULES.disciplines || {}).sort();
}

function askDisciplineName(message = 'Название дисциплины?') {
    const known = getDisciplineNamesForPrompt();
    const hint = known.length ? `\n\nДоступные: ${known.join(', ')}` : '';
    const name = prompt(`${message}${hint}`);
    return name ? name.trim() : '';
}

function buildDisciplineSourcesAtTotal(name, target, modeLabel = 'клановая') {
    const snapshotSources = expShopMode
        ? JSON.parse(JSON.stringify(expShopSnapshot?.disciplines?.[name] || {}))
        : JSON.parse(JSON.stringify(disciplineSources?.[name] || startingSheetBase?.disciplines?.[name] || {}));
    const result = {};
    let left = target;

    Object.entries(snapshotSources).forEach(([source, value]) => {
        if (left <= 0) return;
        const dots = Math.max(0, parseInt(value, 10) || 0);
        const kept = Math.min(dots, left);
        if (kept > 0) {
            result[source] = kept;
            left -= kept;
        }
    });

    if (left > 0) {
        result[`Опыт: ${modeLabel}`] = (result[`Опыт: ${modeLabel}`] || 0) + left;
    }

    return result;
}

function setDisciplineTotal(name, target, modeLabel = 'клановая') {
    if (target === 0) {
        delete disciplineSources[name];
        delete selectedPowers[name];
    } else {
        disciplineSources[name] = buildDisciplineSourcesAtTotal(name, target, modeLabel);
    }

    if (selectedPowers[name] && selectedPowers[name].length > target) {
        selectedPowers[name] = selectedPowers[name].slice(0, target);
    }

    updateAllDisciplineRows();
    updateDisciplineTotal();
    renderDisciplines();
    renderExpShopPanel();
    return true;
}

function shopBuyDiscipline() {
    const name = askDisciplineName('Какую дисциплину купить или повысить?');
    if (!name) return;

    const current = getDisciplineTotal(name);
    const target = parseInt(prompt(`Текущий уровень: ${current}\nДо какого уровня повысить?`, String(Math.min(5, current + 1))), 10);
    if (!target || target <= current || target > 5) return alert('Неверный уровень.');

    const mode = prompt('Тип покупки: clan / out / caitiff', 'clan');
    if (!mode) return;
    const normalized = mode.toLowerCase();
    const label = normalized === 'out' ? 'сторонняя' : normalized === 'caitiff' ? 'каитиф' : 'клановая';

    setDisciplineTotal(name, target, label);
}

function shopSellDiscipline() {
    const currentNames = Object.keys(disciplineSources).filter(name => getDisciplineTotal(name) > 0);
    if (currentNames.length === 0) return alert('Нет дисциплин для продажи.');

    const name = prompt(`Какую дисциплину продать?\n\nМожно: ${currentNames.join(', ')}`);
    if (!name || !disciplineSources[name]) return;

    const current = getDisciplineTotal(name);
    const target = parseInt(prompt(`Текущий уровень: ${current}\nДо какого уровня снизить?`, String(Math.max(0, current - 1))), 10);
    if (Number.isNaN(target) || target < 0 || target >= current) return alert('Неверный уровень.');

    setDisciplineTotal(name, target, getExistingDisciplineModeLabel(name));
}

function shopAddPower() {
    const names = Object.keys(disciplineSources).filter(name => getDisciplineTotal(name) > 0);
    if (names.length === 0) return alert('Сначала купи или получи дисциплину.');

    const name = prompt(`Для какой дисциплины добавить силу?\n\nДоступные: ${names.join(', ')}`);
    if (!name || !disciplineSources[name]) return;

    openPowerSelectionModal(name, getDisciplineTotal(name));
}

function shopAddMerit() {
    openMeritsFlawsModal();
}

function shopSellMerit() {
    const removable = selectedMerits
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.fromPredator);

    if (removable.length === 0) return alert('Нет преимуществ для продажи.');

    const list = removable.map(({ item }, i) => `${i + 1}. ${item.category} — ${item.name} (${getTraitPoints(item)} XP-точ.)`).join('\n');
    const choice = parseInt(prompt(`Какое преимущество продать?\n\n${list}`), 10);
    if (!choice || !removable[choice - 1]) return;

    selectedMerits.splice(removable[choice - 1].index, 1);
    renderSelectedMeritsFlaws();
    renderExpShopPanel();
}

function startExpShopMode() {
    if (!startingSheetFixed) {
        alert("Сначала зафиксируй стартовый лист.");
        return;
    }

    if (expShopMode) {
        renderExpShopPanel();
        return;
    }

    expShopMode = true;
    expShopSnapshot = getFullCharacterData();
    expShopStartLevels = captureCurrentLevels();
    applySheetLockState();
    updateExpPurchasedStyles();
    renderDisciplines();
    renderExpShopPanel();
}

function stopExpShopMode() {
    expShopMode = false;
    expShopSnapshot = null;
    expShopStartLevels = {};
    updateExpPurchasedStyles();
    renderDisciplines();
    applySheetLockState();
    renderExpShopPanel();
}

function cancelExpShopPurchases() {
    if (expShopSnapshot) {
        applyCharacterData(expShopSnapshot, 'отмены покупок');
    }
    stopExpShopMode();
}

function acceptExpShopPurchases() {
    const cart = getExpShopCart();
    const total = cart.reduce((sum, item) => sum + item.cost, 0);

    if (cart.length === 0) {
        alert("В корзине пока нет покупок.");
        return;
    }

    if (total > 0 && !assertEnoughXP(total)) return;

    const freeExp = document.getElementById('free-exp');
    if (freeExp) freeExp.value = Math.max(0, getCurrentXP() - total);

    const lines = cart.map(item => `${getTraitKindLabel(item.type)}: ${item.name} ${item.from}→${item.to} (${getCartCostLabel(item.cost)})`);
    recordExpHistory(total >= 0 ? 'Покупки приняты' : 'Продажа принята', -total, lines);

    sheetLockSnapshot = captureSheetSnapshot();
    stopExpShopMode();
}

function setTraitLevel(name, level) {
    const radio = document.querySelector(`input[name="${name}"][value="${level}"]`);
    if (!radio) return false;
    radio.checked = true;
    updateTrackers();
    updateVitals();
    updateExpPurchasedStyles();
    renderExpShopPanel();
    return true;
}

function setupExpShopDotEditing() {
    if (window.__expShopDotEditingReady) return;
    window.__expShopDotEditingReady = true;

    document.addEventListener('click', function(e) {
        if (!expShopMode) return;

        const label = e.target.closest('label.dot-label');
        if (!label) return;

        const input = document.getElementById(label.getAttribute('for'));
        if (!input) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const name = input.name;
        const clickedValue = parseInt(input.value) || 0;
        const current = getCurrentLevel(name);

        let target = clickedValue;
        if (clickedValue === current && current > 0) target = current - 1;

        setTraitLevel(name, target);
    }, true);

    document.addEventListener('click', function(e) {
        if (!expShopMode) return;

        const dot = e.target.closest('.discipline-item .disc-dot');
        if (!dot) return;

        const item = dot.closest('.discipline-item');
        const name = item?.dataset.disciplineName || item?.querySelector('div:first-child')?.textContent?.trim();
        if (!name) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const clickedValue = parseInt(dot.dataset.level || '0', 10) || 0;
        const current = getDisciplineTotal(name);
        const mode = current > 0 ? getExistingDisciplineModeLabel(name) : expShopDisciplineMode;

        let target = clickedValue;
        if (clickedValue === current && current > 0) target = current - 1;

        setDisciplineTotal(name, target, mode);
    }, true);

    ['input', 'change'].forEach(eventName => {
        document.addEventListener(eventName, function() {
            if (!expShopMode) return;
            setTimeout(() => {
                updateTrackers();
                updateVitals();
                updateExpPurchasedStyles();
                renderSelectedMeritsFlaws();
                renderDisciplines();
                renderExpShopPanel();
            }, 0);
        });
    });
}

// ====================== ФУНКЦИИ ======================

function spendModalAttribute() {
    if (!startingSheetFixed) {
        alert("Сначала зафиксируй стартовый лист!");
        return;
    }

    const name = prompt("Какую характеристику повышаем?");
    if (!name) return;

    const current = getCurrentLevel(name);
    const target = parseInt(prompt(`Текущий: ${current}\nНовый уровень?`));
    if (!target || target <= current) return;

    const cost = target * 5;
    if (!assertEnoughXP(cost)) return;
    if (confirm(`Повысить ${name} → ${target} за ${cost} XP?`)) {
        runExperiencePurchase(() => {
            setLevel(name, target, true);   // true = за опыт
            logModal(`${name} ${current}→${target}`, cost);
        });
    }
}


function getCurrentXP() {
    return parseInt(document.getElementById('free-exp')?.value || '0') || 0;
}

function hasEnoughXP(cost) {
    return getCurrentXP() >= cost;
}

function assertEnoughXP(cost) {
    if (!hasEnoughXP(cost)) {
        alert(`Недостаточно опыта: нужно ${cost} XP, доступно ${getCurrentXP()} XP.`);
        return false;
    }
    return true;
}

function spendModalSkill() {
    if (!startingSheetFixed) return alert("Сначала зафиксируй стартовый лист!");
    const name = prompt("Какой навык повышаем?");
    if (!name) return;
    const current = getCurrentLevel(name);
    const target = parseInt(prompt(`Текущий: ${current}
Новый уровень?`));
    if (!target || target <= current || target > 5) return;
    const cost = target * 3;
    if (!assertEnoughXP(cost)) return;
    if (confirm(`Повысить навык ${name} до ${target} за ${cost} XP?`)) {
        runExperiencePurchase(() => {
            setLevel(name, target, true);
            logModal(`Навык ${name} ${current}→${target}`, cost);
        });
    }
}

function spendModalSpecialty() {
    if (!startingSheetFixed) return alert("Сначала зафиксируй стартовый лист!");
    const skill = prompt("Для какого навыка добавляем специализацию?");
    if (!skill) return;
    const spec = prompt("Название специализации?");
    if (!spec) return;
    const cost = 3;
    if (!assertEnoughXP(cost)) return;
    if (confirm(`Добавить специализацию "${spec}" для ${skill} за ${cost} XP?`)) {
        runExperiencePurchase(() => {
            const container = document.getElementById(`specs-${skill}`);
            if (container) {
                container.style.display = 'flex';
                addSpecLine(skill, `${spec} (за опыт)`);
            }
            logModal(`Специализация "${spec}" (${skill})`, cost);
        });
    }
}

function spendModalMerit() {
    if (!startingSheetFixed) return alert("Сначала зафиксируй стартовый лист!");
    const name = prompt("Какое преимущество повышаем/покупаем?");
    if (!name) return;
    const dots = parseInt(prompt("Сколько пунктов добавить?") || '1');
    if (!dots || dots < 1) return;
    const cost = dots * 3;
    if (!assertEnoughXP(cost)) return;
    if (confirm(`Добавить ${dots} п. к "${name}" за ${cost} XP?`)) {
        runExperiencePurchase(() => {
            logModal(`Преимущество "${name}" +${dots}`, cost);
        });
    }
}

function spendModalDiscipline() {
    if (!startingSheetFixed) return alert("Сначала зафиксируй стартовый лист!");
    const name = prompt("Название дисциплины?");
    if (!name) return;
    let current = 0;
    if (disciplineSources[name]) current = Object.values(disciplineSources[name]).reduce((a, b) => a + b, 0);
    const target = parseInt(prompt(`Текущий: ${current}
Новый уровень?`));
    if (!target || target <= current || target > 5) return;
    const mode = prompt('Тип дисциплины: clan / out / caitiff', 'clan');
    if (!mode) return;
    const normalized = mode.toLowerCase();
    const mult = normalized === 'out' ? 7 : normalized === 'caitiff' ? 6 : 5;
    const cost = target * mult;
    if (!assertEnoughXP(cost)) return;
    if (confirm(`Повысить дисциплину ${name} до ${target} за ${cost} XP?`)) {
        runExperiencePurchase(() => {
            mergeDiscipline(name, target - current, 'Опыт');
            logModal(`Дисциплина ${name} ${current}→${target}`, cost);
        });
    }
}

function spendModalRitual() {
    if (!startingSheetFixed) return alert("Сначала зафиксируй стартовый лист!");
    const ritualType = prompt('Что изучаем: ritual / alchemy', 'ritual');
    if (!ritualType) return;
    const level = parseInt(prompt('Уровень ритуала/рецептуры?'));
    if (!level || level < 1 || level > 5) return;
    const cost = level * 3;
    if (!assertEnoughXP(cost)) return;
    const label = ritualType.toLowerCase() === 'alchemy' ? 'Рецептура алхимии' : 'Ритуал Кровавого чародейства';
    if (confirm(`${label} ур. ${level} за ${cost} XP?`)) {
        runExperiencePurchase(() => {
            logModal(`${label} ур. ${level}`, cost);
        });
    }
}

function spendModalBloodPotency() {
    if (!startingSheetFixed) return alert("Сначала зафиксируй стартовый лист!");
    const current = parseInt(prompt('Текущая Сила Крови?', '0'));
    if (Number.isNaN(current) || current < 0) return;
    const target = parseInt(prompt(`Текущая: ${current}
Новая Сила Крови?`));
    if (!target || target <= current) return;
    const cost = target * 10;
    if (!assertEnoughXP(cost)) return;
    if (confirm(`Повысить Силу Крови до ${target} за ${cost} XP?`)) {
        runExperiencePurchase(() => {
            logModal(`Сила Крови ${current}→${target}`, cost);
        });
    }
}

// Вспомогательные функции
function getCurrentLevel(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? parseInt(checked.value) : 0;
}

// Установка уровня + окраска ВСЕХ точек, купленных за опыт
function setLevel(name, targetLevel, isFromExp = true) {
    const radios = document.querySelectorAll(`input[name="${name}"]`);

    radios.forEach(radio => {
        const value = parseInt(radio.value);
        radio.checked = (value === targetLevel);
    });

    updateTrackers();
    updateVitals();
    if (isFromExp) updateExpPurchasedStyles();
}



// ==================== ФИКСАЦИЯ СТАРТОВОГО ЛИСТА ====================

function captureCurrentLevels() {
    const levels = {};
    document.querySelectorAll('.dots input.dot-input:checked').forEach(radio => {
        if (radio.name) levels[radio.name] = parseInt(radio.value) || 0;
    });
    return levels;
}

function updateExpPurchasedStyles() {
    document.querySelectorAll('.dot-label.exp-purchased, .dot-label.exp-pending').forEach(label => {
        label.classList.remove('exp-purchased');
        label.classList.remove('exp-pending');
    });

    if (!startingSheetFixed && !Object.keys(baseLevels || {}).length) return;

    document.querySelectorAll('.dots input.dot-input').forEach(input => {
        const value = parseInt(input.value) || 0;
        if (value <= 0) return;

        const current = getCurrentLevel(input.name);
        const base = baseLevels[input.name] ?? 0;
        const shopStart = expShopMode ? (expShopStartLevels[input.name] ?? 0) : current;
        const label = document.querySelector(`label[for="${input.id}"]`);

        if (!label) return;

        if (expShopMode && value > shopStart && value <= current) {
            label.classList.add('exp-pending');
        } else if (value > base && value <= current) {
            label.classList.add('exp-purchased');
        }
    });
}

function captureSheetSnapshot() {
    return {
        name: document.getElementById('char-name')?.value || '',
        clan: document.getElementById('clan-input')?.value || '',
        predator: document.getElementById('predator-input')?.value || '',
        generation: document.getElementById('generation-input')?.value || '',
        type: document.getElementById('type-input')?.value || '',
        baseHumanity: document.getElementById('base-humanity')?.value || '7',
        skillPackage: document.getElementById('skill-package')?.value || '',
        levels: captureCurrentLevels(),
        skills: JSON.parse(JSON.stringify(getFullCharacterData().skills || {})),
        disciplines: JSON.parse(JSON.stringify(disciplineSources || {})),
        selectedPowers: JSON.parse(JSON.stringify(selectedPowers || {})),
        merits: JSON.parse(JSON.stringify(selectedMerits || [])),
        flaws: JSON.parse(JSON.stringify(selectedFlaws || []))
    };
}

function applySheetLockState() {
    document.body.classList.toggle('sheet-fixed', startingSheetFixed);
    document.body.classList.toggle('xp-shop-active', expShopMode);

    if (startingSheetFixed) {
        document.querySelector('.guide')?.classList.remove('error');
        const warning = document.getElementById('global-warning');
        if (warning) warning.style.display = 'none';
    }

    const btn = document.getElementById('fix-start-btn');
    if (btn) {
        btn.textContent = startingSheetFixed ? "Расфиксировать лист" : "Зафиксировать стартовый лист";
        btn.style.background = startingSheetFixed ? "#555" : "#ff3131";
        btn.title = startingSheetFixed
            ? "Снять фиксацию и снова редактировать лист вручную"
            : "Зафиксировать текущие значения как стартовый лист";
    }

    const lockedControls = document.querySelectorAll(
        '#capture-area input, #capture-area select, #capture-area textarea, #capture-area button, #skill-package'
    );
    lockedControls.forEach(control => {
        const shouldDisable = startingSheetFixed && !expShopMode;
        control.disabled = shouldDisable;
        control.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
    });

    if (startingSheetFixed && !expShopMode) {
        closeMeritsFlawsModal();
        document.getElementById('clan-modal')?.style.setProperty('display', 'none');
        document.getElementById('predator-modal')?.style.setProperty('display', 'none');
    }
}

function isSheetLockedTarget(target) {
    if (!startingSheetFixed || isApplyingCharacterData || isExperiencePurchaseInProgress) return false;
    if (expShopMode) return false;
    if (!target || target.closest('#exp-modal')) return false;
    return Boolean(target.closest('#capture-area') || target.closest('#skill-package'));
}

function setupSheetLockGuards() {
    if (window.__sheetLockGuardsReady) return;
    window.__sheetLockGuardsReady = true;

    ['click', 'input', 'change', 'keydown'].forEach(eventName => {
        document.addEventListener(eventName, (e) => {
            if (!isSheetLockedTarget(e.target)) return;
            e.preventDefault();
            e.stopImmediatePropagation();
        
        }, true);
    });
}

function runExperiencePurchase(callback) {
    isExperiencePurchaseInProgress = true;
    try {
        callback();
        sheetLockSnapshot = captureSheetSnapshot();
    } finally {
        isExperiencePurchaseInProgress = false;
        applySheetLockState();
    }
}

function fixStartingSheet() {
    if (startingSheetFixed) {
        if (confirm("Расфиксировать лист?\nПосле этого поля снова можно будет менять вручную.")) {
            startingSheetFixed = false;
            applySheetLockState();
            alert("Лист расфиксирован. Ручное редактирование снова доступно.");
        }
        return;
    }

    if (!confirm("Зафиксировать текущие значения как стартовый лист?\nПосле этого лист нельзя будет менять вручную: только через магазин опыта или после расфиксации.")) {
        return;
    }

    const hasExistingStartBase = startingSheetBase && Object.keys(startingSheetBase.levels || {}).length > 0;
    if (!hasExistingStartBase) {
        baseLevels = captureCurrentLevels();
        sheetLockSnapshot = captureSheetSnapshot();
        startingSheetBase = JSON.parse(JSON.stringify(sheetLockSnapshot));
    } else {
        sheetLockSnapshot = captureSheetSnapshot();
    }
    startingSheetFixed = true;
    applySheetLockState();
    updateExpPurchasedStyles();

    alert("Стартовый лист зафиксирован. Теперь повышения проходят через магазин опыта.");
}
