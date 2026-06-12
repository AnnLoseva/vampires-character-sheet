

// ==================== ВЕСЬ СКРИПТ (все части вместе) ====================
// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let RULES = {};
let currentPackage = 'balanced';
let clanDisciplines = [];
let predatorDisciplines = [];
let currentClanData = [];
let currentPredatorData = [];
let currentGenerationData = [];
let currentClanIndex = 0;
let currentPredatorIndex = 0;
let currentGenerationIndex = 0;
let currentClanDisciplines = [];     // какие дисциплины дал клан
let currentPredatorDisciplines = []; // какие дисциплины дал стиль охоты
let clanProvidedDisciplines = {};      // дисциплины от текущего клана
let predatorProvidedDisciplines = {};  // дисциплины от текущего стиля охоты
let selectedMerits = [];   // {category, name, points, fullDesc, mechanic}
let selectedFlaws = [];
let selectedThinBloodMerits = [];
let selectedThinBloodFlaws = [];

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
let characterImageData = '';
let touchstones = [];
let inventory = [];
const THIN_BLOOD_CLAN = 'Слабокровные';
const CAITIFF_CLAN = 'Каитиф';
const THIN_BLOOD_ALCHEMY = 'Алхимия слабокровных';
const INVENTORY_CATEGORIES = ['Оружие', 'Одежда', 'Документы', 'Деньги', 'Артефакты', 'Расходники', 'Другое'];



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
    if ((currentCharType === 'mortal' || currentCharType === 'npc-mortal') && currentMortalTemplate) {
        const tpl = MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate);
        if (tpl) return tpl.merits;
    }
    const type = document.getElementById('type-input')?.value;
    return 7 + getTypeBonuses(type).meritsBonus;
}

function getFlawsLimit() {
    if ((currentCharType === 'mortal' || currentCharType === 'npc-mortal') && currentMortalTemplate) {
        const tpl = MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate);
        if (tpl) return tpl.maxFlaws;
    }
    const type = document.getElementById('type-input')?.value;
    return 2 + getTypeBonuses(type).flawsBonus;
}

function getCurrentClan() {
    return document.getElementById('clan-input')?.value?.trim() || '';
}

function isThinBloodClan(clanName = getCurrentClan()) {
    return clanName === THIN_BLOOD_CLAN;
}

function isCaitiffClan(clanName = getCurrentClan()) {
    return clanName === CAITIFF_CLAN;
}

function canUseDiscipline(name, clanName = getCurrentClan()) {
    if (isThinBloodClan(clanName)) return name === THIN_BLOOD_ALCHEMY;
    return name !== THIN_BLOOD_ALCHEMY;
}

function getStandardDisciplineNames(clanName = getCurrentClan()) {
    return Object.keys(RULES.disciplines || {})
        .filter(name => canUseDiscipline(name, clanName))
        .sort();
}

function hasThinBloodAlchemyMerit() {
    return selectedThinBloodMerits.some(item => item.name === 'Алхимик');
}

function rebuildDisciplineListFromSources() {
    const list = document.getElementById('disciplines-list');
    if (!list) return;

    list.innerHTML = '';
    Object.keys(disciplineSources || {}).forEach(name => {
        const total = Object.values(disciplineSources[name]).reduce((a, b) => a + b, 0);
        addDisciplineRow(name, total, Object.keys(disciplineSources[name]).join(' + '));
    });
    renderDisciplines();
    updateDisciplineTotal();
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
        setupDiceRollsFromLockedSheet();
        setupSheetLockGuards();
        setupExpShopDotEditing();
        setupSheetTabs();
        setupInventoryEditor();
        setupCharacterDetails();
        renderInventory();

        // Дополнительные настройки
        setupGenerationHint();
        setupExperienceListener();
        updateBloodPotencyAndBonuses();
        updateExperienceBonus();
        applySheetLockState();
        renderThinBloodMeritsFlaws();
        updateExpPurchasedStyles();

        // Инициализация типа персонажа
        const savedType = localStorage.getItem('vtm-char-type') || 'vampire';
        const savedMortalTpl = localStorage.getItem('vtm-mortal-template');
        if (savedMortalTpl) currentMortalTemplate = savedMortalTpl;
        setCharacterType(savedType);

        // Обновлять морталь-трекер при смене характеристик/навыков
        document.addEventListener('change', function(e) {
            if (
                (currentCharType === 'mortal' || currentCharType === 'npc-mortal') &&
                currentMortalTemplate &&
                (e.target.closest('#attributes-grid') || e.target.closest('#skills-grid'))
            ) {
                renderMortalAttrTracker();
            }
        });

        window.__vtmSheetReady = true;
        window.dispatchEvent(new CustomEvent('vtm-sheet-ready'));
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

    groupClansBySection(buildClanSelectData()).forEach(group => {
        const optGroup = document.createElement('optgroup');
        optGroup.label = group.title;

        group.clans.forEach(clan => {
            const opt = document.createElement('option');
            opt.value = clan.name;
            opt.textContent = clan.name;
            optGroup.appendChild(opt);
        });

        clanSelect.appendChild(optGroup);
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

function enforceClanSpecificRules() {
    const clanName = getCurrentClan();

    if (isThinBloodClan(clanName)) {
        Object.keys(disciplineSources || {}).forEach(name => {
            if (name !== THIN_BLOOD_ALCHEMY) {
                delete disciplineSources[name];
                delete selectedPowers[name];
            }
        });
        if (!hasThinBloodAlchemyMerit()) {
            delete disciplineSources[THIN_BLOOD_ALCHEMY];
            delete selectedPowers[THIN_BLOOD_ALCHEMY];
        }
    } else {
        selectedThinBloodMerits = [];
        selectedThinBloodFlaws = [];
        delete disciplineSources[THIN_BLOOD_ALCHEMY];
        delete selectedPowers[THIN_BLOOD_ALCHEMY];
    }

    rebuildDisciplineListFromSources();

    renderThinBloodMeritsFlaws();
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

    // Сила крови
    updateBloodPotencyVital();
}

function updateBloodPotencyVital() {
    const predatorName = document.getElementById('predator-input')?.value || '';
    const base = getCurrentBloodPotencyEstimate();
    let predBonus = 0;
    if (predatorName && RULES?.predator_types?.[predatorName]) {
        predBonus = RULES.predator_types[predatorName].blood_potency || 0;
    }
    const total = base + predBonus;
    const el = document.getElementById('val-blood-potency');
    if (!el) return;
    el.textContent = total;
    let tip = `Сила крови: ${base} (от поколения/типа)`;
    if (predBonus) tip += ` + ${predBonus} (${predatorName})`;
    tip += ` = ${total}`;
    el.setAttribute('data-tooltip', tip);
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
        <button type="button" class="show-master-btn" style="background:#111;color:#ffae00;border:1px solid #553500;border-radius:6px;padding:7px 10px;cursor:pointer;">Показать мастеру</button>
    `;

    // Удаление всей дисциплины
    item.querySelector('.remove-disc-btn').addEventListener('click', () => {
        if (startingSheetFixed && !expShopMode) return alert("Лист зафиксирован. Дисциплины сейчас нельзя менять.");
        delete disciplineSources[name];
        delete selectedPowers[name];        // ← тоже стираем способности
        item.remove();
        updateDisciplineTotal();
        renderDisciplines();
        if (expShopMode) renderExpShopPanel();
    });

    item.querySelector('.show-master-btn')?.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        const powers = (selectedPowers[name] || []).map(power => typeof power === 'string' ? power : power.name || power.название || '').filter(Boolean);
        showMasterItem('Дисциплина', name, powers.length ? `Способности: ${powers.join(', ')}` : 'Способности не выбраны', `${dots} точек${sourceText ? ` · ${sourceText}` : ''}`);
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
        if (startingSheetFixed && !expShopMode) return alert("Лист зафиксирован. Способности дисциплин сейчас нельзя менять.");
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
    if (isThinBloodClan()) return;

    getStandardDisciplineNames().forEach(name => {
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
    if (disc1 && disc2 && disc1 === disc2) {
        return alert("Выберите две разные дисциплины.");
    }
    
    if (disc2) mergeDiscipline(disc2, 2, `Клан ${clanName}`);
    if (disc1) mergeDiscipline(disc1, 1, `Клан ${clanName}`);

    closeClanDiscModal();
}

function confirmPredatorDiscipline(predatorName) {
    const disc = document.getElementById('pred-disc-select').value;
    if (!disc) return alert("Выберите дисциплину!");
    if (!canUseDiscipline(disc) || isThinBloodClan()) return alert('Эта дисциплина недоступна текущему клану.');

    mergeDiscipline(disc, 1, `Охота: ${predatorName}`);

    closePredDiscModal();
}
// ==================== МОДАЛЬНЫЕ ОКНА ДЛЯ ВЫБОРА ДИСЦИПЛИН ====================

function openClanDisciplineModal(clanName) {
    const clanData = RULES.clans?.[clanName];
    if (isThinBloodClan(clanName)) return;

    const disciplineOptions = isCaitiffClan(clanName)
        ? getStandardDisciplineNames(clanName)
        : (clanData?.disciplines || []).filter(name => canUseDiscipline(name, clanName));

    if (!clanData || disciplineOptions.length < 2) {
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
                        ${disciplineOptions.map(d => `<option value="${d}">${d}</option>`).join('')}
                    </select>
                </div>
                
                <div style="margin-bottom:35px;">
                    <label style="display:block;color:#ffae00;margin-bottom:8px;font-weight:bold;">Дисциплина на <span style="color:#ff3131">1 точку</span>:</label>
                    <select id="clan-disc-1" style="width:100%;padding:12px;background:#000;color:white;border:1px solid #555;font-size:16px;" onchange="showDisciplineHint(this.value)">
                        ${disciplineOptions.map(d => `<option value="${d}">${d}</option>`).join('')}
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

    if (isThinBloodClan()) {
        applyPredatorChoiceItems(predName);
        return;
    }

    const hasDisciplines = predData.disciplines?.increase?.options?.length > 0;
    if (!hasDisciplines) {
        console.log(`ℹ️ Для ${predName} нет дисциплин`);
        applyPredatorChoiceItems(predName);
        return;
    }

    const clanName = document.getElementById('clan-input')?.value || '';
    let options = [...predData.disciplines.increase.options].filter(name => canUseDiscipline(name));
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
                ${disc.system.resonance ? `<br><strong>Резонанс:</strong> ${disc.system.resonance}` : ''}
                ${disc.system.limitations ? `<br><strong>Ограничения:</strong> ${disc.system.limitations}` : ''}
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
                    <div style="color:#666;font-size:13px;">Уровень ${lvl}</div>
                    <div style="color:#ccc;margin-top:8px;line-height:1.5;">${power.description ? power.description.substring(0, 180) + (power.description.length > 180 ? '...' : '') : 'Нет описания'}</div>
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
                    if (power.effect) html += `<p style="margin-top:12px;"><strong>Эффект:</strong> ${power.effect}</p>`;
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

const CLAN_GALLERY_IMAGE_OVERRIDES = {
    "Вентру": "/static/clan_gallery/ventrue_full.png",
    "Каитиф": "/static/clan_gallery/caitiff_full.png"
};

const CLAN_GALLERY_SECTIONS = [
    {
        title: "5 версия",
        names: [
            "Бруха",
            "Вентру",
            "Гангрел",
            "Малкавиан",
            "Носферату",
            "Тореадор",
            "Тремер",
            "Каитиф",
            "Слабокровные"
        ]
    },
    {
        title: "20 версия",
        names: [
            "Ассамиты",
            "Джованни",
            "Ласомбра",
            "Последователи Сета",
            "Равнос",
            "Цимисхи"
        ]
    },
    {
        title: "Линии крови",
        names: []
    }
];

const CLAN_GALLERY_DESCRIPTIONS = {
    "Бруха": "Бунтари и идеалисты.",
    "Вентру": "Аристократы и правители.",
    "Гангрел": "Дикие дети природы.",
    "Малкавиан": "Безумные пророки.",
    "Носферату": "Отверженные хранители тайн.",
    "Тореадор": "Художники и ценители красоты.",
    "Тремер": "Маги и учёные крови.",
    "Каитиф": "Независимые и скрытные.",
    "Слабокровные": "Самые молодые и слабые вампиры.",
    "Каппадокийцы": "Некроманты, мистики смерти и хранители забытых тайн.",
    "Киасиды": "Странные учёные, фейская кровь и холодная одержимость знаниями.",
    "Кровные Братья": "Синхронная линия крови, созданная как единый боевой организм.",
    "Ламии": "Воительницы смерти, телохранительницы и служительницы мрачных культов.",
    "Лианнан": "Древняя кровь дикой земли, искусства и кровавого вдохновения.",
    "Нагараджа": "Пожиратели плоти, некроманты и изгнанные охотники за тайнами.",
    "Нойады": "Северная кровь, древние духи и шаманские традиции ночи.",
    "Предвестники Черепов": "Мстительные некроманты, несущие память о погибшей крови.",
    "Салюбри": "Исцелители, воины и проклятые носители третьего глаза.",
    "Самеди": "Разлагающиеся некроманты, духи кладбищ и мастера жуткого выживания."
};

const CLAN_GALLERY_SUPPLEMENTAL = [
    { name: "Каппадокийцы", image: "/static/clan_gallery/cappadocians_full.png" },
    { name: "Киасиды", image: "/static/clan_gallery/kyasid_full.png" },
    { name: "Кровные Братья", image: "/static/clan_gallery/blood_brothers_full.png" },
    { name: "Ламии", image: "/static/clan_gallery/lamia_full.png" },
    { name: "Лианнан", image: "/static/clan_gallery/liannan_full.png" },
    { name: "Нагараджа", image: "/static/clan_gallery/nagaraja_full.png" },
    { name: "Нойады", image: "/static/clan_gallery/noiad_full.png" },
    { name: "Предвестники Черепов", image: "/static/clan_gallery/harbingers_of_skulls_full.png" },
    { name: "Салюбри", image: "/static/clan_gallery/salubri_full.png" },
    { name: "Самеди", image: "/static/clan_gallery/samedi_full.png" }
];

const CLAN_SECTION_BY_NAME = CLAN_GALLERY_SECTIONS.reduce((sections, group) => {
    group.names.forEach(name => {
        sections[name] = group.title;
    });
    return sections;
}, {});

function getClanSectionTitle(name) {
    return CLAN_SECTION_BY_NAME[name] || "Линии крови";
}

function groupClansBySection(clans) {
    return CLAN_GALLERY_SECTIONS
        .map(section => ({
            title: section.title,
            clans: clans.filter(clan => getClanSectionTitle(clan.name) === section.title)
        }))
        .filter(section => section.clans.length);
}

function getClanGalleryDescription(name, data) {
    if (CLAN_GALLERY_DESCRIPTIONS[name]) return CLAN_GALLERY_DESCRIPTIONS[name];

    const firstParagraph = (data.description || '').split(/\n+/).find(Boolean) || '';
    const firstSentence = firstParagraph.match(/^.*?[.!?]/u)?.[0] || firstParagraph;

    if (!firstSentence) return "Описание появится в правилах.";
    return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}...` : firstSentence;
}

function buildClanGalleryData() {
    const rulesGalleryData = Object.entries(RULES.clans || {})
        .map(([name, data]) => ({
            name,
            image: CLAN_GALLERY_IMAGE_OVERRIDES[name] || data.gallery_image,
            desc: getClanGalleryDescription(name, data)
        }))
        .filter(clan => clan.image);

    const clansWithImages = new Set(rulesGalleryData.map(clan => clan.name));
    const supplementalGalleryData = CLAN_GALLERY_SUPPLEMENTAL
        .filter(clan => !clansWithImages.has(clan.name))
        .map(clan => ({
            ...clan,
            desc: getClanGalleryDescription(clan.name, clan)
        }));

    return [...rulesGalleryData, ...supplementalGalleryData];
}

function buildClanSelectData() {
    const galleryData = buildClanGalleryData();
    const namesWithGalleryData = new Set(galleryData.map(clan => clan.name));
    const rulesOnlyData = Object.keys(RULES.clans || {})
        .filter(name => !namesWithGalleryData.has(name))
        .map(name => ({ name }));

    return [...galleryData, ...rulesOnlyData];
}

// Открытие галереи кланов
function openClanGallery() {
    if (startingSheetFixed && !expShopMode) return;
    const modal = document.getElementById('clan-modal');
    const gallery = document.getElementById('clan-gallery');
    if (!modal || !gallery) return;

    gallery.innerHTML = '';

    currentClanData = buildClanGalleryData();

    currentClanIndex = 0;

    groupClansBySection(currentClanData).forEach(group => {
        const heading = document.createElement('div');
        heading.style.gridColumn = '1 / -1';
        heading.innerHTML = `
            <div style="display:flex; align-items:center; gap:18px; margin:22px 0 4px;">
                <div style="height:1px; flex:1; background:linear-gradient(90deg, transparent, #6f1515);"></div>
                <h3 style="margin:0; color:#ff3131; letter-spacing:4px; text-transform:uppercase; font-size:22px; text-align:center;">
                    ${group.title}
                </h3>
                <div style="height:1px; flex:1; background:linear-gradient(90deg, #6f1515, transparent);"></div>
            </div>
        `;
        gallery.appendChild(heading);

        group.clans.forEach(c => {
            const index = currentClanData.indexOf(c);
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
    });

    modal.style.display = 'block';
}


// ==================== КНОПКИ ГАЛЕРЕЙ ====================

function resetAndOpenClanGallery() {
    if (startingSheetFixed && !expShopMode) return;
    resetClanDisciplines();        // очищаем старые дисциплины клана
    openClanGallery();
}

function resetAndOpenPredatorGallery() {
    if (startingSheetFixed && !expShopMode) return;
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
    if (startingSheetFixed && !expShopMode) return;
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
    enforceClanSpecificRules();
    if (!isThinBloodClan(name)) {
        setTimeout(() => openClanDisciplineModal(name), 100);
    }
}

// Закрытие модального окна кланов
function closeClanModal() {
    document.getElementById('clan-modal').style.display = 'none';
}



// Закрытие модального окна стилей охоты
function closePredatorModal() {
    document.getElementById('predator-modal').style.display = 'none';
}


// ==================== ГАЛЕРЕЯ ПОКОЛЕНИЙ ====================

const GENERATION_GROUPS = [
    {
        key: 'ancilla',
        title: 'АНЦИЛЛЫ',
        subtitle: 'Старшая Кровь',
        motto: 'Они пережили тех, кто считал себя бессмертными',
        accent: '#c9a84c',
        image: '/static/generation_gallery/ancilla.png',
        icon: '♛',
        age: '1780–1940 гг.',
        potency: 'Сила Крови 2',
        gens: '10–11 поколение',
        traits: ['Опытные манипуляторы', 'Политическое влияние', 'Контроль Голода', 'Посредники между старейшинами и молодыми'],
        philosophy: ['власть требует терпения', 'контроль важнее эмоций', 'влияние сильнее силы'],
        archetypes: ['Княжеский советник', 'Древний манипулятор', 'Хозяин домена', 'Хранитель традиций'],
        options: [
            { value: '11', label: '11 — Анцилла (Сила Крови 2)' },
            { value: '10', label: '10 — Анцилла (Сила Крови 2)' },
            { value: '9',  label: '9 — Анцилла (Сила Крови 2)' },
            { value: '8',  label: '8 — Анцилла (Сила Крови 2)' },
        ]
    },
    {
        key: 'childe',
        title: 'ПТЕНЦЫ',
        subtitle: 'Первые Ночи',
        motto: 'Они ещё помнят, как были людьми',
        accent: '#7a7aaa',
        image: '/static/generation_gallery/childe.png',
        icon: '◈',
        age: 'менее 15 лет назад',
        potency: 'Сила Крови 0–1',
        gens: '12–16 поколение',
        traits: ['Мало опыта', 'Слабый контроль Голода', 'Современные взгляды', 'Высокая адаптивность'],
        philosophy: ['страх неизвестного', 'поиск себя', 'борьба с голодом', 'сохранить человечность'],
        archetypes: ['Случайная жертва', 'Потерянный студент', 'Молодой анарх', 'Новообращённый хищник'],
        options: [
            { value: '12', label: '12 — Птенец / Неонат (Сила Крови 1)' },
            { value: '13', label: '13 — Птенец / Неонат (Сила Крови 1)' },
            { value: '14', label: '14 — Птенец Слабокровный (Сила Крови 0)' },
            { value: '15', label: '15 — Птенец Слабокровный (Сила Крови 0)' },
            { value: '16', label: '16 — Птенец Слабокровный (Сила Крови 0)' },
        ]
    },
    {
        key: 'neonate',
        title: 'НЕОНАТЫ',
        subtitle: 'Молодая Кровь',
        motto: 'Они уже поняли, что мир принадлежит хищникам',
        accent: '#cc3333',
        image: '/static/generation_gallery/neonate.png',
        icon: '✦',
        age: 'после 1940 года',
        potency: 'Сила Крови 1',
        gens: '12–13 поколение',
        traits: ['Понимают современный мир', 'Умеют скрываться среди людей', 'Практический опыт', 'Ещё не настоящая элита'],
        philosophy: ['свобода', 'адаптация', 'амбиции', 'выживание'],
        archetypes: ['Городской хищник', 'Молодой манипулятор', 'Неоновый анарх', 'Восходящий каннит'],
        options: [
            { value: '12', label: '12 — Неонат (Сила Крови 1)' },
            { value: '13', label: '13 — Неонат (Сила Крови 1)' },
        ]
    }
];

function openGenerationGallery() {
    if (startingSheetFixed && !expShopMode) return;
    const modal = document.getElementById('generation-modal');
    const gallery = document.getElementById('generation-gallery');
    if (!modal || !gallery) return;

    gallery.innerHTML = '';
    currentGenerationData = GENERATION_GROUPS;
    currentGenerationIndex = 0;

    currentGenerationData.forEach((g, index) => {
        const div = document.createElement('div');
        div.style.cursor = 'pointer';
        div.innerHTML = buildGenerationCard(g);
        div.onclick = () => {
            currentGenerationIndex = index;
            showSingleGeneration(g.key);
        };
        gallery.appendChild(div);
    });

    modal.style.display = 'block';
}

function buildGenerationCard(g) {
    return `
    <div style="
        border: 2px solid #550000;
        border-radius: 8px;
        padding: 0 0 16px;
        background: #0d0d0d;
        overflow: hidden;
        transition: border-color 0.2s, box-shadow 0.2s;
    "
    onmouseover="this.style.borderColor='${g.accent}'; this.style.boxShadow='0 0 30px ${g.accent}44';"
    onmouseout="this.style.borderColor='#550000'; this.style.boxShadow='none';">
        <img src="${g.image}" style="width:100%; max-height:60vh; object-fit:contain; background:#050505;">
        <h3 style="color:${g.accent}; margin:12px 0 6px; text-align:center; font-family:'Courier New', monospace; letter-spacing:3px;">${g.title}</h3>
        <p style="color:#ddd; font-size:14px; padding:0 10px; text-align:center; margin:0 0 8px;">${g.subtitle}</p>
        <p style="color:#aaa; font-size:13px; padding:0 14px; text-align:center; margin:0;">${g.gens} · ${g.potency}</p>
    </div>`;
}

function prevGeneration() {
    if (!currentGenerationData || currentGenerationData.length === 0) return;
    currentGenerationIndex = (currentGenerationIndex - 1 + currentGenerationData.length) % currentGenerationData.length;
    showSingleGeneration(currentGenerationData[currentGenerationIndex].key);
}

function nextGeneration() {
    if (!currentGenerationData || currentGenerationData.length === 0) return;
    currentGenerationIndex = (currentGenerationIndex + 1) % currentGenerationData.length;
    showSingleGeneration(currentGenerationData[currentGenerationIndex].key);
}

function showSingleGeneration(key) {
    const g = GENERATION_GROUPS.find(x => x.key === key);
    if (!g) return;
    const gallery = document.getElementById('generation-gallery');
    const nextIndex = GENERATION_GROUPS.findIndex(x => x.key === key);
    if (nextIndex !== -1) currentGenerationIndex = nextIndex;

    const optionButtons = g.options.map(o => `
        <button onclick="selectThisGeneration('${o.value}', '${g.key}')" style="
            display: block; width: 100%;
            background: #141414; border: 1px solid ${g.accent}55;
            color: #eee; padding: 14px 20px; border-radius: 6px;
            font-family: 'Courier New', monospace; font-size: 15px;
            cursor: pointer; text-align: left; margin-bottom: 10px;
            transition: all 0.15s;
        "
        onmouseover="this.style.background='#2a1a1a'; this.style.borderColor='${g.accent}';"
        onmouseout="this.style.background='#141414'; this.style.borderColor='${g.accent}55';">
            ${o.label}
        </button>
    `).join('');

    const traits = g.traits.map(t => `<li style="color:#ccc; margin-bottom:6px;">${t}</li>`).join('');
    const philosophy = g.philosophy.map(p => `
        <div style="background:#111; border:1px solid #222; border-radius:6px; padding:8px 12px; font-size:13px; color:#aaa; text-align:center;">${p}</div>
    `).join('');
    const archetypes = g.archetypes.map(a => `<li style="color:#aaa; margin-bottom:4px;">${a}</li>`).join('');

    gallery.innerHTML = `
    <div style="max-width: 1100px; margin: 0 auto; text-align: center; padding: 10px 0 30px;">

        <div style="position:relative; display:inline-block;">
            <button onclick="prevGeneration()" style="position:absolute; left:-50px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.85); color:${g.accent}; border:2px solid ${g.accent}; width:70px; height:70px; border-radius:50%; font-size:32px; cursor:pointer; z-index:25; box-shadow:0 0 25px ${g.accent}66;">←</button>
            <button onclick="nextGeneration()" style="position:absolute; right:-50px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.85); color:${g.accent}; border:2px solid ${g.accent}; width:70px; height:70px; border-radius:50%; font-size:32px; cursor:pointer; z-index:25; box-shadow:0 0 25px ${g.accent}66;">→</button>
            <img src="${g.image}" style="max-width:100%; max-height:65vh; border:4px solid ${g.accent}; border-radius:12px; box-shadow:0 0 40px ${g.accent}66;">
        </div>

        <h2 style="color: ${g.accent}; font-family: 'Courier New', monospace; letter-spacing: 5px; font-size: 28px; margin: 25px 0 4px;">${g.title}</h2>
        <div style="color: #888; font-size: 12px; letter-spacing: 4px; margin-bottom: 24px;">${g.subtitle.toUpperCase()}</div>

        <div style="display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin-bottom: 28px;">
            <div style="background:#0d0d0d; border:1px solid ${g.accent}33; border-radius:8px; padding:12px 20px;">
                <div style="color:#555; font-size:10px; letter-spacing:2px; margin-bottom:4px;">ПОКОЛЕНИЕ</div>
                <div style="color:#ddd; font-size:15px;">${g.gens}</div>
            </div>
            <div style="background:#0d0d0d; border:1px solid ${g.accent}33; border-radius:8px; padding:12px 20px;">
                <div style="color:#555; font-size:10px; letter-spacing:2px; margin-bottom:4px;">СТАНОВЛЕНИЕ</div>
                <div style="color:#ddd; font-size:15px;">${g.age}</div>
            </div>
            <div style="background:#0d0d0d; border:1px solid ${g.accent}55; border-radius:8px; padding:12px 20px;">
                <div style="color:#555; font-size:10px; letter-spacing:2px; margin-bottom:4px;">СИЛА КРОВИ</div>
                <div style="color:${g.accent}; font-size:15px; font-weight:bold;">${g.potency}</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; text-align: left;">
            <div style="background:#0d0d0d; border:1px solid #1e1e1e; border-radius:8px; padding:18px 20px;">
                <div style="color:${g.accent}; font-size:11px; letter-spacing:2px; margin-bottom:12px;">ОСОБЕННОСТИ</div>
                <ul style="list-style:disc; padding-left:18px; margin:0;">${traits}</ul>
            </div>
            <div style="background:#0d0d0d; border:1px solid #1e1e1e; border-radius:8px; padding:18px 20px;">
                <div style="color:${g.accent}; font-size:11px; letter-spacing:2px; margin-bottom:12px;">ТИПАЖИ</div>
                <ul style="list-style:disc; padding-left:18px; margin:0;">${archetypes}</ul>
            </div>
        </div>

        <div style="background:#0d0d0d; border:1px solid #1e1e1e; border-radius:8px; padding:18px 20px; margin-bottom:28px; text-align:left;">
            <div style="color:${g.accent}; font-size:11px; letter-spacing:2px; margin-bottom:12px;">ФИЛОСОФИЯ</div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">${philosophy}</div>
        </div>

        <div style="background:#0d0d0d; border:1px solid ${g.accent}33; border-radius:8px; padding:20px 24px; margin-bottom:28px; text-align:left;">
            <div style="color:${g.accent}; font-size:11px; letter-spacing:2px; margin-bottom:16px;">ВЫБЕРИТЕ ПОКОЛЕНИЕ</div>
            ${optionButtons}
        </div>

        <div style="color:#555; font-size:13px; font-style:italic; margin-bottom:24px; border-top:1px solid #1e1e1e; padding-top:20px;">
            «${g.motto}»
        </div>

        <button onclick="openGenerationGallery()" style="
            background: transparent; color: ${g.accent}; border: 2px solid ${g.accent};
            padding: 14px 36px; font-size: 16px; border-radius: 6px;
            cursor: pointer; font-family: 'Courier New', monospace; letter-spacing: 2px;
        ">← Назад к списку</button>
    </div>`;
}

function selectThisGeneration(value, typeKey) {
    // Выставляем поколение
    const genSel = document.getElementById('generation-input');
    if (genSel) {
        genSel.value = value;
        genSel.dispatchEvent(new Event('change'));
    }

    // Выставляем тип — ключ группы совпадает с value в type-input
    if (typeKey) {
        const typeSel = document.getElementById('type-input');
        if (typeSel) {
            typeSel.value = typeKey;
            typeSel.dispatchEvent(new Event('change'));
        }
    }

    closeGenerationModal();
}

function closeGenerationModal() {
    const modal = document.getElementById('generation-modal');
    if (modal) modal.style.display = 'none';
}

// ==================== ТИП ПЕРСОНАЖА ====================

const MORTAL_TEMPLATES = [
    {
        id: 'weak',
        name: 'Слабый смертный',
        short: 'Рядовой обыватель без особых способностей',
        detail:
`Характеристики: две по 2 пункта, остальные по 1 пункту.
Навыки: три по 2 пункта, пять по 1 пункту.
Преимущества: нет.`,
        attrs: { total: 11, budget: [{v:2,n:2},{v:1,n:'все остальные'}] },
        skills: { total: 11, budget: [{v:2,n:3},{v:1,n:5}] },
        merits: 0, maxFlaws: 0, specs: 0,
        attrLimits:  { 5:0, 4:0, 3:0, 2:2, 1:7 },
        skillLimits: { 5:0, 4:0, 3:0, 2:3, 1:5 },
    },
    {
        id: 'average',
        name: 'Обычный смертный',
        short: 'Среднестатистический человек',
        detail:
`Характеристики: две по 3 пункта, три по 2 пункта, остальные по 1 пункту.
Навыки: три по 3 пункта, четыре по 2 пункта, пять по 1 пункту.
Преимущества: до 3 пунктов (недостатков не больше чем на 2 пункта).`,
        attrs: { total: 18, budget: [{v:3,n:2},{v:2,n:3},{v:1,n:'остальные'}] },
        skills: { total: 21, budget: [{v:3,n:3},{v:2,n:4},{v:1,n:5}] },
        merits: 3, maxFlaws: 2, specs: 0,
        attrLimits:  { 5:0, 4:0, 3:2, 2:3, 1:4 },
        skillLimits: { 5:0, 4:0, 3:3, 2:4, 1:5 },
    },
    {
        id: 'gifted',
        name: 'Одарённый смертный',
        short: 'Человек с выдающимися талантами',
        detail:
`Характеристики: одна — 4 пункта, две по 3 пункта, две по 2 пункта, остальные по 1 пункту.
Навыки: два по 4 пункта (одна специализация на любой из них), четыре по 3 пункта, четыре по 2 пункта, четыре по 1 пункту.
Преимущества: до 10 пунктов (недостатков не больше чем на 4 пункта).`,
        attrs: { total: 23, budget: [{v:4,n:1},{v:3,n:2},{v:2,n:2},{v:1,n:'остальные'}] },
        skills: { total: 30, budget: [{v:4,n:2},{v:3,n:4},{v:2,n:4},{v:1,n:4}] },
        merits: 10, maxFlaws: 4, specs: 1,
        attrLimits:  { 5:0, 4:1, 3:2, 2:2, 1:4 },
        skillLimits: { 5:0, 4:2, 3:4, 2:4, 1:4 },
    },
    {
        id: 'formidable',
        name: 'Отчаянный смертный',
        short: 'Исключительный человек, опасный противник',
        detail:
`Характеристики: две по 5 пунктов, две по 4 пункта, две по 3 пункта, остальные по 2 пункта.
Навыки: один — 5 пунктов, три по 4 пункта, пять по 3 пункта, шесть по 2 пункта; три специализации.
Преимущества: до 15 пунктов (нет недостатков).`,
        attrs: { total: 39, budget: [{v:5,n:2},{v:4,n:2},{v:3,n:2},{v:2,n:'остальные'}] },
        skills: { total: 44, budget: [{v:5,n:1},{v:4,n:3},{v:3,n:5},{v:2,n:6}] },
        merits: 15, maxFlaws: 0, specs: 3,
        attrLimits:  { 5:2, 4:2, 3:2, 2:3, 1:0 },
        skillLimits: { 5:1, 4:3, 3:5, 2:6, 1:0 },
    },
];

let currentCharType = 'vampire';
let currentMortalTemplate = null;

function setCharacterType(type) {
    currentCharType = type;
    localStorage.setItem('vtm-char-type', type);

    // Сбрасываем все классы char-type-*
    document.body.classList.forEach(cls => {
        if (cls.startsWith('char-type-')) document.body.classList.remove(cls);
    });
    document.body.classList.add('char-type-' + type);

    // Синхронизируем select переключателя
    const charTypeSelect = document.getElementById('char-type-select');
    if (charTypeSelect) charTypeSelect.value = type;

    // Рендерим нужный трекер
    if (type === 'mortal' || type === 'npc-mortal') {
        renderMortalTemplates();
    }

    // Обновляем label у поля Сира для смертных
    updateSireLabel(type);
}

function updateSireLabel(type) {
    const label = document.querySelector('[for="sire-input"], label[data-for="sire-input"]');
    // Ищем span с "Сир" в header-label
    document.querySelectorAll('.header-label').forEach(el => {
        if (el.textContent.includes('Сир')) {
            // Меняем placeholder инпута
            const input = document.getElementById('sire-input');
            if (!input) return;
            if (type === 'mortal' || type === 'npc-mortal' || type === 'npc-ghost') {
                input.placeholder = 'Связи / Наставник';
            } else {
                input.placeholder = 'Сир';
            }
        }
    });
}

function renderMortalTemplates() {
    const sel = document.getElementById('mortal-template-select');
    if (sel) sel.value = currentMortalTemplate || '';
    renderMortalTemplateDetail();
    renderMortalAttrTracker();
}

function selectMortalTemplate(id) {
    currentMortalTemplate = id || null;
    localStorage.setItem('vtm-mortal-template', id || '');
    const sel = document.getElementById('mortal-template-select');
    if (sel) sel.value = id || '';
    renderMortalTemplateDetail();
    renderMortalAttrTracker();
    updateTrackers();
}

function renderMortalTemplateDetail() {
    const detail = document.getElementById('mortal-template-detail');
    if (!detail) return;
    if (!currentMortalTemplate) { detail.style.display = 'none'; return; }
    const tpl = MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate);
    if (!tpl) { detail.style.display = 'none'; return; }
    detail.style.display = 'block';
    detail.textContent = tpl.detail;
}

function renderMortalAttrTracker() {
    const container = document.getElementById('mortal-attr-tracker');
    if (!container) return;
    if (!currentMortalTemplate) { container.innerHTML = ''; return; }
    const tpl = MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate);
    if (!tpl) { container.innerHTML = ''; return; }

    // Считаем потраченные атрибуты и навыки
    let attrSpent = 0;
    document.querySelectorAll('#attributes-grid input[type="radio"]:checked').forEach(r => {
        attrSpent += parseInt(r.value) || 0;
    });
    let skillSpent = 0;
    document.querySelectorAll('#skills-grid input[type="radio"]:checked').forEach(r => {
        skillSpent += parseInt(r.value) || 0;
    });

    const attrOk = attrSpent <= tpl.attrs.total;
    const skillOk = skillSpent <= tpl.skills.total;

    const meritsEl = tpl.merits > 0
        ? `<div class="mortal-tracker-row"><span>Преимущества</span><span>до ${tpl.merits} пт${tpl.maxFlaws ? ` (недост. ≤ ${tpl.maxFlaws})` : ''}</span></div>`
        : '';
    const specsEl = tpl.specs > 0
        ? `<div class="mortal-tracker-row"><span>Специализации</span><span>${tpl.specs}</span></div>`
        : '';

    container.innerHTML = `
        <div class="mortal-tracker-row">
            <span>Характеристики</span>
            <span class="${attrOk ? 'ok' : 'bad'}">${attrSpent} / ${tpl.attrs.total}</span>
        </div>
        <div class="mortal-tracker-row">
            <span>Навыки</span>
            <span class="${skillOk ? 'ok' : 'bad'}">${skillSpent} / ${tpl.skills.total}</span>
        </div>
        ${meritsEl}
        ${specsEl}
    `;
}

window.setCharacterType = setCharacterType;
window.selectMortalTemplate = selectMortalTemplate;

// ==================== МОДАЛЬНОЕ ОКНО АРХЕТИПОВ ====================
let _archetypeTargetFieldId = null;
let _archetypeCurrentName = null;

function openArchetypeModal(fieldId) {
    _archetypeTargetFieldId = fieldId;
    _archetypeCurrentName = null;
    closeArchetypeDetail();

    const modal = document.getElementById('archetype-modal');
    if (!modal) return;

    // Subtitle — показываем для какого поля
    const fieldLabel = fieldId === 'nature-input' ? 'натуры' : 'маски';
    const subtitle = document.getElementById('archetype-modal-subtitle');
    if (subtitle) subtitle.textContent = `Выберите архетип ${fieldLabel} — нажмите на карточку, чтобы прочитать описание`;

    // Сбросить поиск
    const searchEl = document.getElementById('archetype-search');
    if (searchEl) searchEl.value = '';

    renderArchetypeList('');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeArchetypeModal() {
    const modal = document.getElementById('archetype-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    closeArchetypeDetail();
}

function renderArchetypeList(filter) {
    const list = document.getElementById('archetype-list');
    if (!list) return;

    const archetypes = RULES?.archetypes || {};
    const needle = filter.trim().toLowerCase();
    const entries = Object.entries(archetypes).filter(([name, data]) => {
        if (!needle) return true;
        return name.toLowerCase().includes(needle) || (data.short || '').toLowerCase().includes(needle);
    });

    list.innerHTML = entries.map(([name, data]) => `
        <button
            class="archetype-card"
            onclick="showArchetypeDetail('${name.replace(/'/g, "\\'")}')"
            style="text-align:left;background:#1a1a1a;border:1px solid #333;border-radius:7px;padding:11px 14px;cursor:pointer;font-family:'Courier New',Courier,monospace;color:#eee;transition:border-color 0.15s,background 0.15s;"
            onmouseover="this.style.borderColor='#ff3131';this.style.background='#221111'"
            onmouseout="this.style.borderColor='#333';this.style.background='#1a1a1a'"
        >
            <div style="font-size:14px;font-weight:bold;color:#fff7ed;margin-bottom:4px;">${name}</div>
            <div style="font-size:12px;color:#b0a090;line-height:1.4;">${data.short || ''}</div>
        </button>
    `).join('');

    if (entries.length === 0) {
        list.innerHTML = '<p style="color:#666;font-size:14px;grid-column:1/-1;">Архетипы не найдены</p>';
    }
}

window.filterArchetypes = function(value) {
    renderArchetypeList(value);
    closeArchetypeDetail();
};

function showArchetypeDetail(name) {
    const data = RULES?.archetypes?.[name];
    if (!data) return;

    _archetypeCurrentName = name;

    const detail = document.getElementById('archetype-detail');
    const nameEl = document.getElementById('archetype-detail-name');
    const textEl = document.getElementById('archetype-detail-text');
    if (!detail || !nameEl || !textEl) return;

    nameEl.textContent = name;
    textEl.textContent = data.long || data.short || '';
    detail.style.display = 'block';

    // Прокрутить к деталям
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeArchetypeDetail() {
    const detail = document.getElementById('archetype-detail');
    if (detail) detail.style.display = 'none';
    _archetypeCurrentName = null;
}

window.closeArchetypeModal = closeArchetypeModal;
window.closeArchetypeDetail = closeArchetypeDetail;
window.openArchetypeModal = openArchetypeModal;

window.selectArchetype = function() {
    if (!_archetypeCurrentName || !_archetypeTargetFieldId) return;
    const input = document.getElementById(_archetypeTargetFieldId);
    if (input) {
        input.value = _archetypeCurrentName;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeArchetypeModal();
};

// Закрывать по клику на фон
document.addEventListener('click', function(e) {
    const modal = document.getElementById('archetype-modal');
    if (modal && modal.style.display !== 'none' && e.target === modal) {
        closeArchetypeModal();
    }
});

// Закрывать по Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('archetype-modal');
        if (modal && modal.style.display !== 'none') closeArchetypeModal();
    }
});


// ==================== ПОДТВЕРЖДЕНИЕ И ДОБАВЛЕНИЕ ====================
// ==================== ПОДТВЕРЖДЕНИЕ КЛАНА ====================
function confirmClanDisciplines(clanName) {
    const disc2 = document.getElementById('clan-disc-2').value;
    const disc1 = document.getElementById('clan-disc-1').value;
    if (disc1 && disc2 && disc1 === disc2) {
        return alert("Выберите две разные дисциплины.");
    }

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
    updateClanBaneField();
    
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

    // Обновить показатель Силы крови в виталах
    updateBloodPotencyVital();
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
    const isMortal = (currentCharType === 'mortal' || currentCharType === 'npc-mortal');
    const packageSelect = document.getElementById('skill-package');

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

    if (isMortal) {
        // Режим смертного: используем лимиты шаблона
        const tpl = currentMortalTemplate ? MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate) : null;
        if (tpl) {
            renderTracker('attr', tpl.attrLimits, 'attr-tracker');
            renderTracker('skill', tpl.skillLimits, 'skill-tracker');
            const specCount = document.querySelectorAll('.spec-checkbox:checked').length;
            document.getElementById('spec-tracker').textContent = `Специализации (S): ${specCount} / ${tpl.specs}`;
        } else {
            document.getElementById('attr-tracker').innerHTML =
                '<span style="color:#888; font-style:italic;">Выберите шаблон смертного</span>';
            document.getElementById('skill-tracker').innerHTML = '';
            document.getElementById('spec-tracker').textContent = 'Специализации (S): 0 / 0';
        }
        renderMortalAttrTracker();
    } else {
        // Режим вампира
        if (!packageSelect.value) {
            document.getElementById('skill-tracker').innerHTML =
                '<span style="color:#888; font-style:italic;">Выберите способ развития выше</span>';
            document.getElementById('spec-tracker').textContent = 'Специализации (S): 0 / 1';
        } else {
            renderTracker('attr', ATTR_LIMITS, 'attr-tracker');
            renderTracker('skill', SKILL_PACKAGES[packageSelect.value], 'skill-tracker');
            const specCount = document.querySelectorAll('.spec-checkbox:checked').length;
            document.getElementById('spec-tracker').textContent = `Специализации (S): ${specCount} / 1`;
        }
    }

    checkLimits();
    updateVitals();
}

function renderTracker(type, limits, trackerId) {
    let html = `<b>${type === 'attr' ? 'Атрибуты' : 'Навыки'}:</b><br>`;
    
    for (let v of [1,2,3,4,5]) {   // ← Изменили порядок: от 1 до 5
        const limit = limits[v] !== undefined ? limits[v] : 0;
        const count = counts[type][v] || 0;
        
        let color = '';
        if (count > limit) color = 'color:#ff3131;';      // превышение (в т.ч. 5-й при лимите 0)
        else if (count < limit) color = 'color:#ffae00;'; // недобор
        // иначе — белый (ровно в лимит)

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
    const isMortal = (currentCharType === 'mortal' || currentCharType === 'npc-mortal');

    if (isMortal) {
        // Проверка лимитов по шаблону смертного
        if (currentMortalTemplate) {
            const tpl = MORTAL_TEMPLATES.find(t => t.id === currentMortalTemplate);
            if (tpl) {
                Object.keys(counts.attr).forEach(v => {
                    if (counts.attr[v] > (tpl.attrLimits[v] || 0)) hasOver = true;
                });
                Object.keys(counts.skill).forEach(v => {
                    if (counts.skill[v] > (tpl.skillLimits[v] || 0)) hasOver = true;
                });
            }
        }
    } else {
        // Проверка обычных лимитов вампира (5-й уровень запрещён: ATTR_LIMITS[5] = undefined → 0)
        Object.keys(counts.attr).forEach(v => {
            if (counts.attr[v] > (ATTR_LIMITS[v] ?? 0)) hasOver = true;
        });
        Object.keys(counts.skill).forEach(v => {
            if (counts.skill[v] > (SKILL_PACKAGES[currentPackage]?.[v] ?? 0)) hasOver = true;
        });
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
        <input type="text" class="dice-roll-specialty-input" data-skill="${skillName}" placeholder="Название специальности" style="flex:1;">
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

// ==================== БРОСКИ КУБИКОВ СО СТАРТОВОГО ЛИСТА ====================

const DICE_TABLE_ROOM = 'campaign-666';
const DICE_TABLE_CHANNEL = 'vtm-table-rolls';
const DICE_TABLE_STORAGE_PREFIX = 'vtm-table-rolls:';
const DICE_SUPABASE_URL = 'https://klhxbaagarqxaqnrvurr.supabase.co';
const DICE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaHhiYWFnYXJxeGFxbnJ2dXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzkwNjAsImV4cCI6MjA5MzY1NTA2MH0.Cy2496DJgJhqZkERL9h19FkiiTfkcW2pauPaJU5r5oY';
const DICE_ATTRIBUTES = ["Сила", "Ловкость", "Выносливость", "Обаяние", "Манипуляция", "Самообладание", "Интеллект", "Смекалка", "Упорство"];
const DICE_SKILLS = ["Атлетика", "Вождение", "Воровство", "Выживание", "Драка", "Ремесло", "Скрытность", "Стрельба", "Фехтование", "Запугивание", "Исполнение", "Лидерство", "Обращение с животными", "Проницательность", "Убеждение", "Уличное чутьё", "Хитрость", "Этикет", "Гуманитарные науки", "Естественные науки", "Медицина", "Наблюдательность", "Оккультизм", "Политика", "Расследование", "Техника", "Финансы"];
let pendingDicePool = null;
let diceRollChannel = null;
let diceSupabaseClient = null;
let diceRealtimeChannel = null;
let diceRollStorageWarningShown = false;

function setupDiceRollsFromLockedSheet() {
    if (window.__diceRollsReady) return;
    window.__diceRollsReady = true;

    if ('BroadcastChannel' in window) {
        diceRollChannel = new BroadcastChannel(DICE_TABLE_CHANNEL);
    }

    document.addEventListener('click', (e) => {
        const target = e.target;
        const attrNameEl = target.closest?.('.attr-name');
        const skillNameEl = target.closest?.('.skill-name');
        const specLine = target.closest?.('.skill-spec-line');
        const disciplineItem = target.closest?.('.discipline-item:not(.xp-shop-discipline-option)');
        const dotLabel = target.closest?.('.dot-label');
        const dotRow = dotLabel?.closest?.('.row');
        const attrDot = dotLabel && dotRow?.querySelector('.attr-name') ? dotLabel : null;
        const skillDot = dotLabel && dotRow?.querySelector('.skill-name') ? dotLabel : null;
        const disciplineDot = target.closest?.('.discipline-item:not(.xp-shop-discipline-option) .disc-dot');
        const editableInsideDiscipline = disciplineItem && target.closest?.('button, input, select, textarea');

        if (!attrNameEl && !skillNameEl && !specLine && !disciplineItem && !attrDot && !skillDot && !disciplineDot) return;
        if (editableInsideDiscipline) return;
        if (startingSheetFixed && !expShopMode) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const attrRow = attrDot?.closest('.row');
            const skillRow = skillDot?.closest('.row');
            if (attrNameEl || attrDot) {
                const attrEl = attrNameEl || attrRow?.querySelector('.attr-name');
                const attrName = attrEl?.getAttribute('data-attr') || attrEl?.textContent.trim();
                openDiceRollModal({ first: makeDicePart('attr', attrName) });
                return;
            }
            if (skillNameEl || skillDot) {
                const skillEl = skillNameEl || skillRow?.querySelector('.skill-name');
                const skillName = skillEl?.getAttribute('data-skill') || skillEl?.textContent.trim();
                openDiceRollModal({ second: makeDicePart('skill', skillName) });
                return;
            }
            if (specLine) {
                const input = specLine.querySelector('input[type="text"]');
                const skillName = input?.dataset.skill || findSkillNameForSpecLine(specLine);
                const specName = input?.value.trim() || 'Специальность';
                openDiceRollModal({
                    second: makeDicePart('skill', skillName),
                    modifier: 1,
                    modifierLabel: specName
                });
                return;
            }
            const disciplineName = disciplineItem?.dataset.disciplineName || disciplineDot?.closest('.discipline-item')?.dataset.disciplineName || disciplineItem?.querySelector('div:first-child')?.textContent.trim();
            if (disciplineName) openDiceRollModal({ first: makeDicePart('discipline', disciplineName) });
            return;
        }
        return;
    }, true);
}

function getSheetRoom() {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || localStorage.getItem('vtm-table-room') || 'campaign-666';
}

function getSheetUser() {
    try {
        return JSON.parse(localStorage.getItem('vtm-chat-user') || localStorage.getItem('vtm-sheet-user') || 'null');
    } catch {
        return null;
    }
}

function getSheetRealtimeChannel() {
    if (window.__sheetRealtimeChannel) return window.__sheetRealtimeChannel;
    if (!window.supabase) return null;
    const client = window.supabase.createClient(DICE_SUPABASE_URL, DICE_SUPABASE_ANON_KEY);
    const channel = client.channel(`table-room:${getSheetRoom()}`);
    channel.subscribe();
    window.__sheetRealtimeChannel = channel;
    return channel;
}

function showMasterItem(kind, title, body = '', meta = '') {
    const channel = getSheetRealtimeChannel();
    if (!channel) return alert('Realtime ещё не готов. Открой игровой стол и попробуй снова.');
    const user = getSheetUser();
    const character = getFullCharacterData();
    channel.send({
        type: 'broadcast',
        event: 'master-reveal',
        payload: {
            room: getSheetRoom(),
            kind,
            title,
            body,
            meta,
            characterName: character.name || 'Безымянный',
            userId: user?.id || '',
            username: user?.username || 'Игрок',
            createdAt: new Date().toISOString()
        }
    });
    alert('Показано мастеру.');
}

window.showMasterItem = showMasterItem;

function findSkillNameForSpecLine(line) {
    const container = line.closest?.('.skill-specs');
    return container?.id?.replace('specs-', '') || '';
}

function getSkillDots(skillName) {
    const checked = document.querySelector(`input[name="${CSS.escape(skillName)}"]:checked`);
    return Math.max(0, parseInt(checked?.value || '0', 10) || 0);
}

function getAttributeDots(attrName) {
    const checked = document.querySelector(`input[name="${CSS.escape(attrName)}"]:checked`);
    return Math.max(0, parseInt(checked?.value || '0', 10) || 0);
}

function getDisciplineDots(disciplineName) {
    return Object.values(disciplineSources?.[disciplineName] || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function makeDicePart(type, name) {
    return `${type}:${name}`;
}

function escapeDiceHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseDicePart(value) {
    const [type, ...rest] = String(value || '').split(':');
    return { type, name: rest.join(':') };
}

function getDicePartLabel(type) {
    if (type === 'attr') return 'Характеристика';
    if (type === 'skill') return 'Навык';
    if (type === 'discipline') return 'Дисциплина';
    return 'Параметр';
}

function getDicePartDots(partValue) {
    const { type, name } = parseDicePart(partValue);
    if (!name) return 0;
    if (type === 'attr') return getAttributeDots(name);
    if (type === 'skill') return getSkillDots(name);
    if (type === 'discipline') return getDisciplineDots(name);
    return 0;
}

function getDicePartName(partValue) {
    return parseDicePart(partValue).name || '';
}

function getDicePoolOptions(selectedValue = '') {
    const sections = [
        {
            label: 'Характеристики',
            items: DICE_ATTRIBUTES.map(name => ({ value: makeDicePart('attr', name), label: `${name} (${getAttributeDots(name)})` }))
        },
        {
            label: 'Навыки',
            items: DICE_SKILLS.map(name => ({ value: makeDicePart('skill', name), label: `${name} (${getSkillDots(name)})` }))
        },
        {
            label: 'Дисциплины',
            items: Object.keys(disciplineSources || {})
                .sort()
                .map(name => ({ value: makeDicePart('discipline', name), label: `${name} (${getDisciplineDots(name)})` }))
        }
    ];

    return `
        <option value="">— не выбрано —</option>
        ${sections
            .filter(section => section.items.length > 0)
            .map(section => `
                <optgroup label="${section.label}">
                    ${section.items.map(item => `<option value="${escapeDiceHtml(item.value)}" ${item.value === selectedValue ? 'selected' : ''}>${escapeDiceHtml(item.label)}</option>`).join('')}
                </optgroup>
            `).join('')}
    `;
}

function getDiceRoom() {
    try {
        return new URLSearchParams(window.location.search).get('room') || DICE_TABLE_ROOM;
    } catch {
        return DICE_TABLE_ROOM;
    }
}

function openDiceRollModal(pool = {}) {
    pendingDicePool = {
        first: pool.first || '',
        second: pool.second || '',
        modifier: Number(pool.modifier || 0),
        modifierLabel: pool.modifierLabel || ''
    };

    const modal = getDiceRollModal();
    modal.querySelector('#dice-roll-part-1').innerHTML = getDicePoolOptions(pendingDicePool.first);
    modal.querySelector('#dice-roll-part-2').innerHTML = getDicePoolOptions(pendingDicePool.second);
    modal.querySelector('#dice-roll-modifier').value = String(pendingDicePool.modifier);
    modal.querySelector('#dice-roll-modifier-label').value = pendingDicePool.modifierLabel;
    modal.querySelector('#dice-roll-result').innerHTML = '';
    updateDiceRollPoolPreview();
    modal.style.display = 'flex';
}

function getDiceRollModal() {
    let modal = document.getElementById('dice-roll-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'dice-roll-modal';
    modal.innerHTML = `
        <div class="dice-roll-dialog">
            <button type="button" class="dice-roll-close" onclick="closeDiceRollModal()" title="Закрыть">×</button>
            <div class="dice-roll-label">Бросок кубиков</div>
            <h2 id="dice-roll-title">Собрать пул</h2>
            <p id="dice-roll-subtitle">Выбери два параметра и добавь модификатор, если он нужен.</p>
            <div class="dice-roll-builder">
                <label>
                    <span>Первый параметр</span>
                    <select id="dice-roll-part-1" onchange="updateDiceRollPoolPreview()"></select>
                </label>
                <label>
                    <span>Второй параметр</span>
                    <select id="dice-roll-part-2" onchange="updateDiceRollPoolPreview()"></select>
                </label>
                <label>
                    <span>Доп. кубики</span>
                    <input id="dice-roll-modifier" type="number" min="-20" max="20" value="0" oninput="updateDiceRollPoolPreview()">
                </label>
                <label>
                    <span>Источник модификатора</span>
                    <input id="dice-roll-modifier-label" type="text" placeholder="специальность, кровь, сложность..." oninput="updateDiceRollPoolPreview()">
                </label>
            </div>
            <div id="dice-roll-pool-preview"></div>
            <div id="dice-roll-result"></div>
            <div class="dice-roll-actions">
                <button type="button" onclick="closeDiceRollModal()">Отмена</button>
                <button type="button" class="dice-roll-primary" onclick="confirmDiceRoll()">Бросить</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    return modal;
}

function readDiceRollPool() {
    const first = document.getElementById('dice-roll-part-1')?.value || '';
    const second = document.getElementById('dice-roll-part-2')?.value || '';
    const modifier = parseInt(document.getElementById('dice-roll-modifier')?.value || '0', 10) || 0;
    const modifierLabel = document.getElementById('dice-roll-modifier-label')?.value?.trim() || '';
    const firstDots = getDicePartDots(first);
    const secondDots = getDicePartDots(second);
    const diceCount = Math.max(0, firstDots + secondDots + modifier);
    const parts = [first, second]
        .filter(Boolean)
        .map(part => getDicePartDots(part));
    const modifierName = modifierLabel || (modifier > 0 ? 'модификатор' : 'штраф');
    const poolName = [
        ...[first, second].filter(Boolean).map(getDicePartName),
        modifier ? modifierName : ''
    ].filter(Boolean).join(' + ');

    return {
        first,
        second,
        modifier,
        modifierLabel,
        firstDots,
        secondDots,
        diceCount,
        poolName: poolName || 'Свободный бросок',
        poolType: parts.join(' + ') || 'Свободный пул'
    };
}

function updateDiceRollPoolPreview() {
    const preview = document.getElementById('dice-roll-pool-preview');
    if (!preview) return;

    const pool = readDiceRollPool();
    const modifierText = pool.modifier
        ? ` ${pool.modifier > 0 ? '+' : '-'} ${Math.abs(pool.modifier)}${pool.modifierLabel ? ` (${pool.modifierLabel})` : ''}`
        : '';

    preview.innerHTML = `
        <strong>${pool.diceCount}к10</strong>
        <span>${escapeDiceHtml(`${pool.firstDots} + ${pool.secondDots}${modifierText}`)}</span>
    `;
}

function closeDiceRollModal() {
    const modal = document.getElementById('dice-roll-modal');
    if (modal) modal.style.display = 'none';
    pendingDicePool = null;
}

function rollD10Pool(count) {
    return Array.from({ length: count }, () => {
        const value = Math.floor(Math.random() * 10) + 1;
        let kind = 'fail';
        if (value === 1) kind = 'botch';
        if (value >= 6) kind = 'success';
        if (value === 10) kind = 'critical';
        return { value, kind };
    });
}

function countV5Successes(dice) {
    const criticals = dice.filter(die => die.value === 10).length;
    const regularSuccesses = dice.filter(die => die.value >= 6 && die.value < 10).length;
    return regularSuccesses + Math.floor(criticals / 2) * 4 + (criticals % 2);
}

function renderDicePreview(dice, successes) {
    return `
        <div class="dice-roll-dice">
            ${dice.map(die => `<span class="dice-roll-die dice-roll-${die.kind}">${die.value}</span>`).join('')}
        </div>
        <div class="dice-roll-successes">Успехов: ${successes}</div>
    `;
}

function confirmDiceRoll() {
    if (!pendingDicePool) return;

    const pool = readDiceRollPool();
    if (!pool.first && !pool.second) {
        alert('Выбери хотя бы один параметр для броска.');
        return;
    }
    if (pool.diceCount < 1) {
        alert('В пуле нет кубиков. Выбери параметры с точками или добавь модификатор.');
        return;
    }

    const dice = rollD10Pool(pool.diceCount);
    const successes = countV5Successes(dice);
    const roll = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        room: getDiceRoom(),
        characterName: document.getElementById('char-name')?.value?.trim() || 'Безымянный',
        poolName: pool.poolName,
        poolType: pool.poolType,
        diceCount: pool.diceCount,
        dice,
        successes,
        createdAt: new Date().toISOString()
    };

    publishDiceRoll(roll);
    document.getElementById('dice-roll-result').innerHTML = renderDicePreview(dice, successes);
}

function getDiceSupabaseClient() {
    if (diceSupabaseClient) return diceSupabaseClient;
    if (!window.supabase?.createClient) return null;
    diceSupabaseClient = window.supabase.createClient(DICE_SUPABASE_URL, DICE_SUPABASE_ANON_KEY);
    return diceSupabaseClient;
}

function getDiceRealtimeChannel(room) {
    const client = getDiceSupabaseClient();
    if (!client) return null;
    if (diceRealtimeChannel) return diceRealtimeChannel;

    diceRealtimeChannel = client.channel(`table-rolls:${room}`);
    diceRealtimeChannel.subscribe();
    return diceRealtimeChannel;
}

function broadcastDiceRoll(roll) {
    const channel = getDiceRealtimeChannel(roll.room);
    channel?.send({
        type: 'broadcast',
        event: 'roll',
        payload: roll
    });
}

function cacheDiceRollLocally(roll) {
    const storageKey = `${DICE_TABLE_STORAGE_PREFIX}${roll.room}`;
    let history = [];

    try {
        history = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!Array.isArray(history)) history = [];
    } catch {
        history = [];
    }

    history = [roll, ...history.filter(item => item.id !== roll.id)].slice(0, 80);
    localStorage.setItem(storageKey, JSON.stringify(history));
    localStorage.setItem('vtm-table-last-roll', JSON.stringify(roll));
    diceRollChannel?.postMessage(roll);
}

async function publishDiceRoll(roll) {
    const client = getDiceSupabaseClient();

    if (!client) {
        console.error('Supabase client is unavailable for table rolls.');
        broadcastDiceRoll(roll);
        cacheDiceRollLocally(roll);
        return;
    }

    const { error } = await client
        .from('table_rolls')
        .insert({
            id: roll.id,
            room: roll.room,
            character_name: roll.characterName,
            pool_name: roll.poolName,
            pool_type: roll.poolType,
            dice_count: roll.diceCount,
            dice: roll.dice,
            successes: roll.successes,
            created_at: roll.createdAt
        });

    if (error) {
        console.error('Не удалось отправить бросок на общий стол:', error);
        if (!diceRollStorageWarningShown) {
            diceRollStorageWarningShown = true;
            alert('Бросок отправлен онлайн, но не сохранился в общую историю. Нужно создать таблицу table_rolls в Supabase.');
        }
        broadcastDiceRoll(roll);
        cacheDiceRollLocally(roll);
        return;
    }

    broadcastDiceRoll(roll);
}

window.openDiceRollModal = openDiceRollModal;
window.closeDiceRollModal = closeDiceRollModal;
window.confirmDiceRoll = confirmDiceRoll;
window.updateDiceRollPoolPreview = updateDiceRollPoolPreview;

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

function getInputValue(id) {
    return document.getElementById(id)?.value?.trim() || '';
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

function updateClanBaneField() {
    const clanName = document.getElementById('clan-input')?.value?.trim() || '';
    const bane = clanName ? (RULES.clans?.[clanName]?.bane || '') : '';
    setInputValue('clan-bane-input', bane);
}

function renderCharacterImage() {
    const image = document.getElementById('character-image-preview');
    const placeholder = document.getElementById('character-image-placeholder');
    if (!image || !placeholder) return;

    if (characterImageData) {
        image.src = characterImageData;
        image.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        image.removeAttribute('src');
        image.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

function readImageAsCompressedDataURL(file, maxSize = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('Выберите файл изображения.'));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error('Не удалось обработать изображение.'));
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

async function uploadCharacterImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        characterImageData = await readImageAsCompressedDataURL(file);
        renderCharacterImage();
    } catch (err) {
        alert(err.message || 'Ошибка загрузки изображения.');
    } finally {
        event.target.value = '';
    }
}

function deleteCharacterImage() {
    characterImageData = '';
    renderCharacterImage();
}

function renderTouchstones() {
    const list = document.getElementById('touchstones-list');
    if (!list) return;

    list.innerHTML = '';
    touchstones.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'touchstone-item';
        row.innerHTML = `
            <div>
                ${item.image ? `<img class="touchstone-image" src="${item.image}" alt="Изображение опоры">` : `<div class="touchstone-placeholder">Изображение опоры</div>`}
                <input type="file" accept="image/*" style="display:none;" data-touchstone-file="${index}">
            </div>
            <textarea data-touchstone-text="${index}" placeholder="Опора или принцип">${escapeHTML(item.text || '')}</textarea>
            <div class="touchstone-actions">
                <button type="button" data-touchstone-upload="${index}">Загрузить</button>
                <button type="button" data-touchstone-remove-image="${index}">Удалить фото</button>
                <button type="button" data-touchstone-delete="${index}">Удалить</button>
            </div>
        `;
        list.appendChild(row);
    });

    list.querySelectorAll('[data-touchstone-text]').forEach(textarea => {
        textarea.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.touchstoneText, 10);
            if (touchstones[index]) touchstones[index].text = e.target.value;
        });
    });

    list.querySelectorAll('[data-touchstone-upload]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.touchstoneUpload, 10);
            list.querySelector(`[data-touchstone-file="${index}"]`)?.click();
        });
    });

    list.querySelectorAll('[data-touchstone-file]').forEach(input => {
        input.addEventListener('change', async (e) => {
            const index = parseInt(e.target.dataset.touchstoneFile, 10);
            const file = e.target.files?.[0];
            if (!file || !touchstones[index]) return;
            try {
                touchstones[index].image = await readImageAsCompressedDataURL(file, 700, 0.8);
                renderTouchstones();
            } catch (err) {
                alert(err.message || 'Ошибка загрузки изображения.');
            }
        });
    });

    list.querySelectorAll('[data-touchstone-remove-image]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.touchstoneRemoveImage, 10);
            if (touchstones[index]) touchstones[index].image = '';
            renderTouchstones();
        });
    });

    list.querySelectorAll('[data-touchstone-delete]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.touchstoneDelete, 10);
            touchstones.splice(index, 1);
            renderTouchstones();
        });
    });

    applySheetLockState();
}

function switchSheetSection(sectionName) {
    document.querySelectorAll('[data-sheet-section]').forEach(section => {
        section.classList.toggle('active', section.dataset.sheetSection === sectionName);
    });
    document.querySelectorAll('[data-sheet-tab]').forEach(button => {
        button.classList.toggle('active', button.dataset.sheetTab === sectionName);
    });
    localStorage.setItem('vtm-sheet-section', sectionName);
}

function setupSheetTabs() {
    const saved = localStorage.getItem('vtm-sheet-section');
    switchSheetSection(['social', 'mechanics', 'inventory'].includes(saved) ? saved : 'social');
}

window.switchSheetSection = switchSheetSection;

function createInventoryItem(seed = {}) {
    const now = new Date().toISOString();
    return {
        id: seed.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: seed.name || '',
        description: seed.description || '',
        quantity: Math.max(0, parseInt(seed.quantity ?? 1, 10) || 0),
        category: INVENTORY_CATEGORIES.includes(seed.category) ? seed.category : 'Другое',
        note: seed.note || '',
        createdAt: seed.createdAt || seed.created_at || now,
        updatedAt: seed.updatedAt || seed.updated_at || now,
        order: Number.isFinite(Number(seed.order)) ? Number(seed.order) : 0,
        collapsed: Boolean(seed.collapsed)
    };
}

function normalizeInventory(items) {
    return Array.isArray(items)
        ? items.map((item, index) => createInventoryItem({ ...item, order: item?.order ?? index })).sort((a, b) => a.order - b.order)
        : [];
}

function updateInventoryCardSummary(id) {
    const item = inventory.find(entry => entry.id === id);
    const card = document.querySelector(`[data-inventory-id="${CSS.escape(id)}"]`);
    if (!item || !card) return;
    const title = card.querySelector('[data-inventory-title]');
    const summary = card.querySelector('[data-inventory-summary]');
    if (title) title.textContent = item.name || 'Без названия';
    if (summary) summary.textContent = `${item.category} · ${item.quantity} шт.`;
}

function updateInventoryItem(id, patch, shouldRender = false) {
    inventory = inventory.map(item => item.id === id
        ? { ...item, ...patch, updatedAt: new Date().toISOString() }
        : item
    );
    if (shouldRender) renderInventory();
    else updateInventoryCardSummary(id);
}

function addInventoryItem() {
    inventory = [createInventoryItem({ name: 'Новый предмет' }), ...inventory];
    renderInventory();
}

function deleteInventoryItem(id) {
    const item = inventory.find(entry => entry.id === id);
    if (!confirm(`Удалить «${item?.name || 'предмет'}»?`)) return;
    inventory = inventory.filter(entry => entry.id !== id);
    renderInventory();
}

function changeInventoryQuantity(id, delta) {
    const item = inventory.find(entry => entry.id === id);
    if (!item) return;
    updateInventoryItem(id, { quantity: Math.max(0, (parseInt(item.quantity, 10) || 0) + delta) });
    const input = document.querySelector(`[data-inventory-id="${CSS.escape(id)}"] [data-inventory-field="quantity"]`);
    if (input) input.value = String(inventory.find(entry => entry.id === id)?.quantity ?? 0);
}

function moveInventoryItem(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceIndex = inventory.findIndex(item => item.id === sourceId);
    const targetIndex = inventory.findIndex(item => item.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const next = [...inventory];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    inventory = next.map((item, index) => ({ ...item, order: index, updatedAt: new Date().toISOString() }));
    renderInventory();
}

function setupInventoryEditor() {
    const list = document.getElementById('inventory-list');
    if (!list || list.dataset.inventoryEditorReady === 'true') return;
    list.dataset.inventoryEditorReady = 'true';
    list.addEventListener('input', event => {
        const target = event.target;
        const field = target?.dataset?.inventoryField;
        const card = target?.closest?.('[data-inventory-id]');
        if (!field || !card) return;
        const id = card.dataset.inventoryId;
        if (field === 'quantity') {
            updateInventoryItem(id, { quantity: Math.max(0, parseInt(target.value || '0', 10) || 0) });
            return;
        }
        updateInventoryItem(id, { [field]: target.value });
    });
    list.addEventListener('change', event => {
        const target = event.target;
        const field = target?.dataset?.inventoryField;
        const card = target?.closest?.('[data-inventory-id]');
        if (!field || !card) return;
        updateInventoryItem(card.dataset.inventoryId, { [field]: target.value }, field === 'category');
    });
    list.addEventListener('click', event => {
        const target = event.target;
        const toggle = target?.closest?.('[data-inventory-toggle]');
        const showMaster = target?.closest?.('[data-inventory-show-master]');
        if (showMaster) {
            const id = showMaster.dataset.inventoryShowMaster;
            const item = inventory.find(entry => entry.id === id);
            if (!item) return;
            showMasterItem('Инвентарь', item.name || 'Без названия', item.description || item.note || 'Описание не указано', `${item.category} · ${item.quantity} шт.`);
            return;
        }
        if (toggle && !target.closest('button, input, select, textarea')) {
            updateInventoryItem(toggle.dataset.inventoryToggle, { collapsed: !inventory.find(entry => entry.id === toggle.dataset.inventoryToggle)?.collapsed }, true);
        }
    });
    list.addEventListener('dragstart', event => {
        const handle = event.target?.closest?.('[data-inventory-drag-handle]');
        const card = event.target?.closest?.('[data-inventory-id]');
        if (!handle || !card) {
            event.preventDefault();
            return;
        }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', card.dataset.inventoryId);
        card.classList.add('dragging');
    });
    list.addEventListener('dragend', event => {
        event.target?.closest?.('[data-inventory-id]')?.classList.remove('dragging');
        list.querySelectorAll('.drag-over').forEach(item => item.classList.remove('drag-over'));
    });
    list.addEventListener('dragover', event => {
        const card = event.target?.closest?.('[data-inventory-id]');
        if (!card) return;
        event.preventDefault();
        list.querySelectorAll('.drag-over').forEach(item => {
            if (item !== card) item.classList.remove('drag-over');
        });
        card.classList.add('drag-over');
        event.dataTransfer.dropEffect = 'move';
    });
    list.addEventListener('drop', event => {
        const card = event.target?.closest?.('[data-inventory-id]');
        if (!card) return;
        event.preventDefault();
        const sourceId = event.dataTransfer.getData('text/plain');
        card.classList.remove('drag-over');
        moveInventoryItem(sourceId, card.dataset.inventoryId);
    });
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    const count = document.getElementById('inventory-count');
    if (!list) return;
    const filter = document.getElementById('inventory-filter')?.value || 'Все';
    const visible = filter === 'Все' ? inventory : inventory.filter(item => item.category === filter);
    if (count) count.textContent = `${visible.length} из ${inventory.length} предметов`;
    if (!visible.length) {
        list.innerHTML = `<p class="inventory-empty">Инвентарь пуст. Добавь первый предмет кнопкой выше.</p>`;
        return;
    }
    list.innerHTML = visible.map(item => {
        const categoryOptions = INVENTORY_CATEGORIES.map(category => (
            `<option value="${category}" ${item.category === category ? 'selected' : ''}>${category}</option>`
        )).join('');
        return `
            <article class="inventory-card" data-inventory-id="${item.id}" draggable="true">
                <div class="inventory-card-head" data-inventory-toggle="${item.id}">
                    <button type="button" class="inventory-drag-handle" data-inventory-drag-handle title="Перетащить предмет">☰</button>
                    <div class="inventory-card-title">
                        <strong data-inventory-title>${escapeHTML(item.name || 'Без названия')}</strong>
                        <span data-inventory-summary>${escapeHTML(item.category)} · ${item.quantity} шт.</span>
                    </div>
                </div>
                <div class="inventory-card-fields">
                    <label>Название
                        <input value="${escapeHTML(item.name)}" data-inventory-field="name">
                    </label>
                    <label>Категория
                        <select data-inventory-field="category">${categoryOptions}</select>
                    </label>
                    <label>Количество
                        <div class="inventory-quantity">
                            <button type="button" onclick="changeInventoryQuantity('${item.id}', -1)">−</button>
                            <input type="number" min="0" value="${item.quantity}" data-inventory-field="quantity">
                            <button type="button" onclick="changeInventoryQuantity('${item.id}', 1)">+</button>
                        </div>
                    </label>
                </div>
                <div class="inventory-description ${item.collapsed ? 'collapsed' : ''}">
                    <label>Описание
                        <textarea data-inventory-field="description">${escapeHTML(item.description)}</textarea>
                    </label>
                </div>
                <div class="inventory-note ${item.collapsed ? 'collapsed' : ''}">
                    <label>Заметка
                        <textarea data-inventory-field="note">${escapeHTML(item.note)}</textarea>
                    </label>
                </div>
                <div class="inventory-card-actions">
                    <button type="button" onclick="updateInventoryItem('${item.id}', { collapsed: ${!item.collapsed} }, true)">${item.collapsed ? 'Раскрыть описание' : 'Свернуть описание'}</button>
                    <button type="button" data-inventory-show-master="${item.id}">Показать мастеру</button>
                    <button type="button" class="danger" onclick="deleteInventoryItem('${item.id}')">Удалить</button>
                </div>
            </article>
        `;
    }).join('');
}

window.addInventoryItem = addInventoryItem;
window.updateInventoryItem = updateInventoryItem;
window.deleteInventoryItem = deleteInventoryItem;
window.changeInventoryQuantity = changeInventoryQuantity;
window.renderInventory = renderInventory;

function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function setupAutoResizeTextareas() {
    ['backstory-input', 'appearance-input', 'notes-input'].forEach(id => {
        const textarea = document.getElementById(id);
        if (!textarea || textarea.dataset.autoResizeReady === 'true') return;
        textarea.dataset.autoResizeReady = 'true';
        textarea.style.overflow = 'hidden';
        textarea.addEventListener('input', () => autoResizeTextarea(textarea));
        autoResizeTextarea(textarea);
    });
}

function expandTextareasForCapture(area) {
    const replacements = [];
    area.querySelectorAll('textarea').forEach(textarea => {
        autoResizeTextarea(textarea);

        const replacement = document.createElement('div');
        const computed = window.getComputedStyle(textarea);
        replacement.className = 'capture-textarea-replacement';
        replacement.textContent = textarea.value || textarea.placeholder || '';
        replacement.style.cssText = `
            width: ${textarea.offsetWidth}px;
            min-height: ${Math.max(textarea.scrollHeight, textarea.offsetHeight)}px;
            box-sizing: border-box;
            padding: ${computed.padding};
            border: ${computed.border};
            border-radius: ${computed.borderRadius};
            background: ${computed.backgroundColor};
            color: ${computed.color};
            font: ${computed.font};
            line-height: ${computed.lineHeight};
            text-align: ${computed.textAlign};
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            word-break: break-word;
        `;
        textarea.style.display = 'none';
        textarea.parentNode.insertBefore(replacement, textarea.nextSibling);
        replacements.push({ textarea, replacement });
    });
    return () => {
        replacements.forEach(({ textarea, replacement }) => {
            textarea.style.display = '';
            replacement.remove();
        });
        autoResizeTextarea(document.getElementById('backstory-input'));
    };
}

function stabilizeImagesForCapture(area) {
    const states = [];
    area.querySelectorAll('.touchstone-image, .character-portrait-preview').forEach(img => {
        const rect = img.getBoundingClientRect();
        states.push({
            img,
            width: img.style.width,
            height: img.style.height,
            minWidth: img.style.minWidth,
            minHeight: img.style.minHeight,
            maxWidth: img.style.maxWidth,
            maxHeight: img.style.maxHeight,
            objectFit: img.style.objectFit,
            aspectRatio: img.style.aspectRatio
        });

        img.style.width = `${Math.round(rect.width)}px`;
        img.style.height = `${Math.round(rect.height)}px`;
        img.style.minWidth = `${Math.round(rect.width)}px`;
        img.style.minHeight = `${Math.round(rect.height)}px`;
        img.style.maxWidth = `${Math.round(rect.width)}px`;
        img.style.maxHeight = `${Math.round(rect.height)}px`;
        img.style.objectFit = 'cover';
        img.style.aspectRatio = 'auto';
    });

    return () => {
        states.forEach(({ img, width, height, minWidth, minHeight, maxWidth, maxHeight, objectFit, aspectRatio }) => {
            img.style.width = width;
            img.style.height = height;
            img.style.minWidth = minWidth;
            img.style.minHeight = minHeight;
            img.style.maxWidth = maxWidth;
            img.style.maxHeight = maxHeight;
            img.style.objectFit = objectFit;
            img.style.aspectRatio = aspectRatio;
        });
    };
}

function addTouchstone() {
    touchstones.push({ text: '', image: '' });
    renderTouchstones();
}

function setupCharacterDetails() {
    updateClanBaneField();
    renderCharacterImage();
    renderTouchstones();
    setupAutoResizeTextareas();
}

window.uploadCharacterImage = uploadCharacterImage;
window.deleteCharacterImage = deleteCharacterImage;
window.addTouchstone = addTouchstone;

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
                enforceClanSpecificRules();
                if (!isThinBloodClan(newClan)) {
                    setTimeout(() => openClanDisciplineModal(newClan), 100);
                }
            } else {
                loadClanHint();
                updateClanIcon();
                enforceClanSpecificRules();
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
    if (startingSheetFixed && !expShopMode) return alert("Лист зафиксирован. Преимущества и недостатки меняются только через расфиксацию или магазин опыта.");
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
        if (catKey === 'СЛАБОКРОВНЫЕ') return;
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
    selectedMerits = selectedMerits.filter(item => item.category !== 'Достоинства слабокровных' && item.category !== 'СЛАБОКРОВНЫЕ');
    selectedFlaws = selectedFlaws.filter(item => item.category !== 'Недостатки слабокровных' && item.category !== 'СЛАБОКРОВНЫЕ');

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
            <button type="button" class="selected-item-show-master" style="background:#111; color:#ffae00; border:1px solid #553500; border-radius:6px; padding:6px 9px; cursor:pointer;">Показать мастеру</button>
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

    div.querySelector('.selected-item-show-master')?.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        showMasterItem(isMerit ? 'Преимущество' : 'Недостаток', displayName, item.mechanic || item.desc || item.полное_описание || 'Описание не указано', `${item.category || ''}${points ? ` · ${points} точек` : ''}`);
    });

    return div;
}

function getThinBloodCategory(isMerit) {
    return isMerit
        ? RULES.advantages?.merits?.['СЛАБОКРОВНЫЕ']
        : (RULES.advantages?.flaws?.['СЛАБОКРОВНЫЕ'] || RULES.flaws?.['СЛАБОКРОВНЫЕ']);
}

function buildThinBloodTrait(raw, isMerit) {
    const category = getThinBloodCategory(isMerit) || {};
    return {
        category: category.название || (isMerit ? 'Достоинства слабокровных' : 'Недостатки слабокровных'),
        categoryDesc: category.описание || '',
        name: raw.название_пункта || raw.name || '',
        points: parseInt(raw.точки || raw.points || 1, 10) || 1,
        desc: raw.полное_описание || raw.desc || '',
        mechanic: raw.механика || raw.mechanic || '',
        thinBlood: true
    };
}

function syncThinBloodAlchemy() {
    if (!isThinBloodClan()) return;

    if (hasThinBloodAlchemyMerit()) {
        if (!disciplineSources[THIN_BLOOD_ALCHEMY]) disciplineSources[THIN_BLOOD_ALCHEMY] = {};
        disciplineSources[THIN_BLOOD_ALCHEMY]['Достоинство слабокровного: Алхимик'] = 1;
    } else {
        if (disciplineSources[THIN_BLOOD_ALCHEMY]) {
            delete disciplineSources[THIN_BLOOD_ALCHEMY]['Достоинство слабокровного: Алхимик'];
            if (Object.keys(disciplineSources[THIN_BLOOD_ALCHEMY]).length === 0) {
                delete disciplineSources[THIN_BLOOD_ALCHEMY];
                delete selectedPowers[THIN_BLOOD_ALCHEMY];
            }
        }
    }
    rebuildDisciplineListFromSources();
}

function createThinBloodSelectedItem(item, index, isMerit) {
    const div = createSelectedItem(item, index, isMerit);
    const button = div.querySelector('.selected-item-remove');
    if (button) {
        button.setAttribute('onclick', `event.stopImmediatePropagation(); ${isMerit ? `removeThinBloodMerit(${index})` : `removeThinBloodFlaw(${index})`}`);
    }
    return div;
}

function renderThinBloodMeritsFlaws() {
    const section = document.getElementById('thin-blood-traits-section');
    if (!section) return;

    const shouldShow = isThinBloodClan();
    section.style.display = shouldShow ? 'block' : 'none';
    if (!shouldShow) return;

    selectedThinBloodMerits = selectedThinBloodMerits.filter(item => item.name !== 'Склонность к Дисциплине');

    const meritsContainer = document.getElementById('selected-thin-blood-merits-list');
    const flawsContainer = document.getElementById('selected-thin-blood-flaws-list');
    const balance = document.getElementById('thin-blood-balance');

    meritsContainer.innerHTML = '';
    flawsContainer.innerHTML = '';

    selectedThinBloodMerits.forEach((item, index) => {
        meritsContainer.appendChild(createThinBloodSelectedItem(item, index, true));
    });
    selectedThinBloodFlaws.forEach((item, index) => {
        flawsContainer.appendChild(createThinBloodSelectedItem(item, index, false));
    });

    const meritCount = selectedThinBloodMerits.length;
    const flawCount = selectedThinBloodFlaws.length;
    const isBalanced = meritCount === flawCount && meritCount <= 3;
    balance.innerHTML = `Выбрано: достоинства ${meritCount}/3, недостатки ${flawCount}/3. Нужно равное количество, максимум 3.`;
    balance.style.color = isBalanced ? '#78d878' : '#ffcc66';

    syncThinBloodAlchemy();
}

function validateThinBloodBalance({ silent = false } = {}) {
    if (!isThinBloodClan()) return true;
    const meritCount = selectedThinBloodMerits.length;
    const flawCount = selectedThinBloodFlaws.length;
    const ok = meritCount === flawCount && meritCount <= 3 && flawCount <= 3;
    if (!ok && !silent) {
        alert('У слабокровных количество слабокровных преимуществ и недостатков должно быть равным, максимум 3 и 3.');
    }
    return ok;
}

function openThinBloodTraitsModal(tab = 0) {
    if (!isThinBloodClan()) return alert('Этот раздел доступен только слабокровным.');
    if (startingSheetFixed && !expShopMode) return alert("Лист зафиксирован. Достоинства и недостатки слабокровных сейчас нельзя менять.");

    const html = `
    <div id="thin-blood-traits-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.96); z-index:12000; overflow:auto; padding:20px;">
        <div style="max-width:980px; margin:30px auto; background:#111; padding:25px; border-radius:8px; border:2px solid #a14600; position:relative;">
            <button onclick="closeThinBloodTraitsModal()" style="position:absolute; top:18px; right:25px; font-size:36px; color:#ffae00; background:none; border:none; cursor:pointer; z-index:10; line-height:1;">×</button>
            <h2 style="text-align:center; color:#ffae00; margin-bottom:20px;">Слабокровные особенности</h2>
            <div style="display:flex; margin-bottom:20px; border-bottom:1px solid #333;">
                <button onclick="renderThinBloodTraitChoices(0)" id="tab-thin-merits" style="flex:1; padding:12px; background:${tab === 0 ? '#222' : '#111'}; border:none; color:white; font-weight:bold;">Преимущества</button>
                <button onclick="renderThinBloodTraitChoices(1)" id="tab-thin-flaws" style="flex:1; padding:12px; background:${tab === 1 ? '#222' : '#111'}; border:none; color:white; font-weight:bold;">Недостатки</button>
            </div>
            <div id="thin-blood-traits-list"></div>
        </div>
    </div>`;

    document.getElementById('thin-blood-traits-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    renderThinBloodTraitChoices(tab);
}

function closeThinBloodTraitsModal() {
    document.getElementById('thin-blood-traits-modal')?.remove();
}

function renderThinBloodTraitChoices(tab) {
    const container = document.getElementById('thin-blood-traits-list');
    if (!container) return;

    document.getElementById('tab-thin-merits').style.background = tab === 0 ? '#222' : '#111';
    document.getElementById('tab-thin-flaws').style.background = tab === 1 ? '#222' : '#111';

    const isMerit = tab === 0;
    const category = getThinBloodCategory(isMerit);
    const selected = isMerit ? selectedThinBloodMerits : selectedThinBloodFlaws;
    const other = isMerit ? selectedThinBloodFlaws : selectedThinBloodMerits;
    const titleColor = isMerit ? '#ffcc00' : '#ff6666';

    if (!category?.варианты?.length) {
        container.innerHTML = `<p style="color:#777;text-align:center;padding:40px;">Данные не найдены.</p>`;
        return;
    }

    container.innerHTML = `
        <p style="color:#aaa;line-height:1.5;margin-top:0;">${category.описание || ''}</p>
        <p style="color:#ffcc66;">Баланс: достоинства ${selectedThinBloodMerits.length}/3, недостатки ${selectedThinBloodFlaws.length}/3.</p>
    `;

    category.варианты.forEach((raw, index) => {
        if (isMerit && raw.название_пункта === 'Склонность к Дисциплине') return;
        const item = buildThinBloodTrait(raw, isMerit);
        const alreadyTaken = selected.some(existing => existing.name === item.name);
        const limitReached = selected.length >= 3;
        const wouldOverrunBalance = selected.length >= other.length + 1;
        const disabled = alreadyTaken || limitReached || wouldOverrunBalance;
        const reason = alreadyTaken
            ? 'Уже выбрано'
            : limitReached
                ? 'Максимум 3'
                : wouldOverrunBalance
                    ? 'Сначала уравновесь другой стороной'
                    : 'Добавить';

        const div = document.createElement('div');
        div.style.cssText = `
            background:#1a1a1a; padding:16px; margin-bottom:10px; border-radius:6px;
            border:1px solid ${disabled ? '#333' : '#664400'}; opacity:${disabled ? 0.55 : 1};
        `;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
                <div>
                    <strong style="color:${titleColor};">${escapeHTML(item.name)}</strong>
                    <div style="color:#aaa; margin-top:8px; line-height:1.45;">${escapeHTML(item.desc)}</div>
                    ${item.mechanic ? `<div style="color:#ddd; margin-top:8px; line-height:1.45;"><strong>Механика:</strong> ${escapeHTML(item.mechanic)}</div>` : ''}
                </div>
                <button ${disabled ? 'disabled' : ''} style="min-width:120px; padding:9px 12px; border-radius:5px; border:1px solid #a14600; background:${disabled ? '#222' : '#2a1805'}; color:#ffcc66; cursor:${disabled ? 'not-allowed' : 'pointer'};">${reason}</button>
            </div>
        `;
        div.querySelector('button').onclick = () => addThinBloodTrait(index, isMerit);
        container.appendChild(div);
    });
}

function addThinBloodTrait(index, isMerit) {
    if (startingSheetFixed && !expShopMode) return alert("Лист зафиксирован. Достоинства и недостатки слабокровных сейчас нельзя менять.");
    const category = getThinBloodCategory(isMerit);
    const raw = category?.варианты?.[index];
    if (!raw) return;

    const selected = isMerit ? selectedThinBloodMerits : selectedThinBloodFlaws;
    const other = isMerit ? selectedThinBloodFlaws : selectedThinBloodMerits;
    const item = buildThinBloodTrait(raw, isMerit);

    if (selected.some(existing => existing.name === item.name)) return alert('Уже выбрано.');
    if (selected.length >= 3) return alert('Можно взять максимум 3 слабокровных преимущества и 3 недостатка.');
    if (selected.length >= other.length + 1) return alert('Сначала уравновесь другую сторону: количество должно быть равным.');

    selected.push(item);
    renderThinBloodMeritsFlaws();
    renderThinBloodTraitChoices(isMerit ? 0 : 1);
}

window.removeThinBloodMerit = function(index) {
    if (startingSheetFixed && !expShopMode) return alert("Лист зафиксирован. Достоинства слабокровных сейчас нельзя менять.");
    selectedThinBloodMerits.splice(index, 1);
    renderThinBloodMeritsFlaws();
};

window.removeThinBloodFlaw = function(index) {
    if (startingSheetFixed && !expShopMode) return alert("Лист зафиксирован. Недостатки слабокровных сейчас нельзя менять.");
    selectedThinBloodFlaws.splice(index, 1);
    renderThinBloodMeritsFlaws();
};

window.openThinBloodTraitsModal = openThinBloodTraitsModal;
window.closeThinBloodTraitsModal = closeThinBloodTraitsModal;
window.renderThinBloodTraitChoices = renderThinBloodTraitChoices;
window.validateThinBloodBalance = validateThinBloodBalance;


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
    if (startingSheetFixed && !expShopMode) return alert("Лист зафиксирован. Преимущества сейчас нельзя менять.");
    selectedMerits.splice(i,1); 
    renderSelectedMeritsFlaws(); 
    if (expShopMode) renderExpShopPanel();
};

window.removeFlaw = function(i) { 
    if (startingSheetFixed && !expShopMode) return alert("Лист зафиксирован. Недостатки сейчас нельзя менять.");
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
        sire: getInputValue('sire-input'),
        concept: getInputValue('concept-input'),
        nature: getInputValue('nature-input'),
        mask: getInputValue('mask-input'),
        trueAge: getInputValue('true-age-input'),
        apparentAge: getInputValue('apparent-age-input'),
        birthDate: getInputValue('birth-date-input'),
        deathDate: getInputValue('death-date-input'),
        clanBane: getInputValue('clan-bane-input'),
        characterImage: characterImageData || '',
        touchstones: JSON.parse(JSON.stringify(touchstones || [])),
        inventory: normalizeInventory(inventory),
        appearance: getInputValue('appearance-input'),
        backstory: getInputValue('backstory-input'),
        notes: getInputValue('notes-input'),
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
        flaws: JSON.parse(JSON.stringify(selectedFlaws || [])),
        thinBloodMerits: JSON.parse(JSON.stringify(selectedThinBloodMerits || [])),
        thinBloodFlaws: JSON.parse(JSON.stringify(selectedThinBloodFlaws || []))
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
    selectedThinBloodMerits = [];
    selectedThinBloodFlaws = [];
    clanProvidedDisciplines = {};
    predatorProvidedDisciplines = {};
    currentPredatorSpecialty = null;
    characterImageData = '';
    touchstones = [];
    inventory = [];
    expShopMode = false;
    expShopSnapshot = null;
    expShopStartLevels = {};

    const list = document.getElementById('disciplines-list');
    if (list) list.innerHTML = '';
    renderCharacterImage();
    renderTouchstones();
    renderInventory();
}

function applyCharacterData(d, sourceName = 'JSON') {
    console.log(`📥 Загрузка персонажа из ${sourceName}:`, d);
    isApplyingCharacterData = true;

    try {
        resetCharacterSheetForLoad();

        // Основная информация
        document.getElementById('char-name').value = d.name || 'Безымянный';
        document.getElementById('clan-input').value = d.clan || '';
        setInputValue('sire-input', d.sire);
        setInputValue('concept-input', d.concept);
        setInputValue('nature-input', d.nature);
        setInputValue('mask-input', d.mask);
        setInputValue('true-age-input', d.trueAge);
        setInputValue('apparent-age-input', d.apparentAge);
        setInputValue('birth-date-input', d.birthDate);
        setInputValue('death-date-input', d.deathDate);
        characterImageData = d.characterImage || d.image || d.portrait || '';
        touchstones = Array.isArray(d.touchstones)
            ? JSON.parse(JSON.stringify(d.touchstones))
            : [];
        inventory = normalizeInventory(d.inventory);
        setInputValue('appearance-input', d.appearance);
        setInputValue('backstory-input', d.backstory);
        setInputValue('notes-input', d.notes);
        autoResizeTextarea(document.getElementById('backstory-input'));
        renderCharacterImage();
        renderTouchstones();
        renderInventory();
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
        selectedThinBloodMerits = Array.isArray(d.thinBloodMerits) ? [...d.thinBloodMerits] : [];
        selectedThinBloodFlaws = Array.isArray(d.thinBloodFlaws) ? [...d.thinBloodFlaws] : [];
        enforceClanSpecificRules();

        startingSheetFixed = Boolean(d.sheetLock?.fixed);
        const savedBaseLevels = d.sheetLock?.baseLevels;
        baseLevels = (savedBaseLevels && Object.keys(savedBaseLevels).length > 0)
            ? JSON.parse(JSON.stringify(savedBaseLevels))
            : captureCurrentLevels();
        sheetLockSnapshot = d.sheetLock?.snapshot ? JSON.parse(JSON.stringify(d.sheetLock.snapshot)) : captureSheetSnapshot();
        startingSheetBase = d.sheetLock?.baseState
            ? JSON.parse(JSON.stringify(d.sheetLock.baseState))
            : JSON.parse(JSON.stringify(sheetLockSnapshot));

        renderSelectedMeritsFlaws();
        renderThinBloodMeritsFlaws();
        loadClanHint();
        if (d.clanBane && !getInputValue('clan-bane-input')) setInputValue('clan-bane-input', d.clanBane);
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
    if (!validateThinBloodBalance()) return;
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
    let restoreTextareaHeights = null;
    let restoreImageStyles = null;

    try {
        if (typeof window.html2canvas !== 'function') {
            throw new Error('html2canvas не загружен');
        }
        restoreTextareaHeights = expandTextareasForCapture(area);
        restoreImageStyles = stabilizeImagesForCapture(area);

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
        if (restoreImageStyles) restoreImageStyles();
        if (restoreTextareaHeights) restoreTextareaHeights();
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

// ==================== ГЕНЕРАЦИЯ PDF (только раздел социалки) ====================
// ---- Helpers for text PDF ----
function _pdfDots(n, max) {
    n = Math.min(Math.max(parseInt(n) || 0, 0), max || 5);
    return '●'.repeat(n) + '○'.repeat((max || 5) - n);
}

function _pdfEsc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _pdfField(label, value) {
    if (!value) return '';
    return `<tr>
        <td style="color:#555;padding:3px 10px 3px 0;white-space:nowrap;vertical-align:top;font-weight:600;">${_pdfEsc(label)}</td>
        <td style="padding:3px 0;vertical-align:top;">${_pdfEsc(value)}</td>
    </tr>`;
}

function _pdfSection(title, content) {
    return `<div style="margin-bottom:22px;">
        <div style="font-size:13pt;font-weight:bold;color:#8b0000;border-bottom:2px solid #8b0000;padding-bottom:4px;margin-bottom:10px;letter-spacing:1px;">${_pdfEsc(title)}</div>
        ${content}
    </div>`;
}

function _pdfTextBlock(title, text) {
    if (!text) return '';
    return `<div style="margin-bottom:18px;">
        <div style="font-size:10pt;font-weight:bold;color:#8b0000;margin-bottom:4px;letter-spacing:1px;">${_pdfEsc(title)}</div>
        <div style="font-size:9.5pt;line-height:1.5;white-space:pre-wrap;color:#1a1a1a;">${_pdfEsc(text)}</div>
    </div>`;
}

function buildPDFHTML(d) {
    const ATTR_CATS = {
        'Физические': ['Сила','Ловкость','Выносливость'],
        'Социальные': ['Обаяние','Манипуляция','Самообладание'],
        'Ментальные': ['Интеллект','Смекалка','Упорство'],
    };
    const SKILL_CATS = {
        'Физические': ['Атлетика','Вождение','Воровство','Выживание','Драка','Ремесло','Скрытность','Стрельба','Фехтование'],
        'Социальные': ['Запугивание','Исполнение','Лидерство','Обращение с животными','Проницательность','Убеждение','Уличное чутьё','Хитрость','Этикет'],
        'Ментальные': ['Гуманитарные науки','Естественные науки','Медицина','Наблюдательность','Оккультизм','Политика','Расследование','Техника','Финансы'],
    };

    const base = `font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#111;line-height:1.45;`;

    // --- PAGE BREAK helper ---
    const pb = `<div style="page-break-before:always;"></div>`;

    // ============================================================
    // SECTION 1: SOCIAL
    // ============================================================
    const infoRows = [
        _pdfField('Имя', d.charName),
        _pdfField('Сир', d.sire),
        _pdfField('Концепция', d.concept),
        _pdfField('Натура', d.nature),
        _pdfField('Маска', d.mask),
        _pdfField('Истинный возраст', d.trueAge),
        _pdfField('Видимый возраст', d.apparentAge),
        _pdfField('Дата рождения', d.birthDate),
        _pdfField('Дата смерти', d.deathDate),
        _pdfField('Клан', d.clan),
        _pdfField('Стиль охоты', d.predator),
        _pdfField('Поколение', d.generation),
        _pdfField('Тип', d.type),
    ].join('');

    const social = `
        <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:20pt;font-weight:bold;color:#8b0000;letter-spacing:2px;">${_pdfEsc(d.charName)}</div>
            <div style="font-size:9pt;color:#666;margin-top:2px;">Vampire: the Masquerade V5 — Лист персонажа</div>
        </div>

        ${_pdfSection('ОСНОВНАЯ ИНФОРМАЦИЯ', `<table style="width:100%;border-collapse:collapse;">${infoRows}</table>`)}

        ${d.clanBane ? _pdfSection('ИЗЪЯН КЛАНА', `<div style="font-size:9.5pt;line-height:1.5;color:#1a1a1a;white-space:pre-wrap;">${_pdfEsc(d.clanBane)}</div>`) : ''}

        ${d.touchstones.length ? _pdfSection('ОПОРЫ И ПРИНЦИПЫ',
            d.touchstones.map((t, i) => t.text ? `<div style="margin-bottom:6px;"><span style="color:#8b0000;font-weight:bold;">${i+1}.</span> ${_pdfEsc(t.text)}</div>` : '').join('')
        ) : ''}

        ${_pdfTextBlock('ВНЕШНОСТЬ', d.appearance)}
        ${_pdfTextBlock('ПРЕДЫСТОРИЯ', d.backstory)}
        ${_pdfTextBlock('ЗАМЕТКИ', d.notes)}
    `;

    // ============================================================
    // SECTION 2: MECHANICS
    // ============================================================

    // Attributes columns
    const attrColsHTML = Object.entries(ATTR_CATS).map(([cat, names]) => `
        <div style="flex:1;">
            <div style="font-weight:bold;color:#8b0000;margin-bottom:6px;font-size:9pt;">${_pdfEsc(cat)}</div>
            ${names.map(name => `
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:9.5pt;">
                    <span>${_pdfEsc(name)}</span>
                    <span style="font-size:8pt;letter-spacing:1px;">${_pdfDots(d.attrs[name])}</span>
                </div>
            `).join('')}
        </div>
    `).join('');

    // Skills columns
    const skillColsHTML = Object.entries(SKILL_CATS).map(([cat, names]) => `
        <div style="flex:1;">
            <div style="font-weight:bold;color:#8b0000;margin-bottom:6px;font-size:9pt;">${_pdfEsc(cat)}</div>
            ${names.map(name => {
                const val = d.skills[name] || 0;
                return `
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:9.5pt;">
                        <span>${_pdfEsc(name)}</span>
                        <span style="font-size:8pt;letter-spacing:1px;">${_pdfDots(val)}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `).join('');

    // Vitals
    const vitalsHTML = `
        <div style="display:flex;gap:30px;flex-wrap:wrap;margin-top:6px;">
            <div><span style="color:#555;font-weight:600;">Здоровье:</span> ${_pdfEsc(d.hp)}</div>
            <div><span style="color:#555;font-weight:600;">Сила воли:</span> ${_pdfEsc(d.wp)}</div>
            <div><span style="color:#555;font-weight:600;">Человечность:</span> ${_pdfEsc(d.humanity)}</div>
            <div><span style="color:#555;font-weight:600;">Сила крови:</span> ${_pdfEsc(d.bloodPotency)}</div>
        </div>
    `;

    // Disciplines
    let discHTML = '';
    const discEntries = Object.entries(d.disciplines);
    if (discEntries.length) {
        discHTML = discEntries.map(([name, info]) => `
            <div style="margin-bottom:8px;">
                <span style="font-weight:bold;">${_pdfEsc(name)}</span>
                <span style="margin-left:8px;font-size:8pt;letter-spacing:1px;">${_pdfDots(info.dots)}</span>
                ${info.powers.length ? `<div style="font-size:9pt;color:#444;margin-left:14px;margin-top:2px;">${info.powers.map(p => `• ${_pdfEsc(p)}`).join('  ')}</div>` : ''}
            </div>
        `).join('');
    }

    // Merits / Flaws
    const meritRows = d.selectedMerits.map(m =>
        `<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:9.5pt;"><span>${_pdfEsc(m.name)}</span><span style="color:#555;">${'●'.repeat(m.points || 0)}</span></div>`
    ).join('');
    const flawRows = d.selectedFlaws.map(f =>
        `<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:9.5pt;"><span>${_pdfEsc(f.name)}</span><span style="color:#555;">${'●'.repeat(f.points || 0)}</span></div>`
    ).join('');

    const mechanics = `
        ${_pdfSection('ХАРАКТЕРИСТИКИ', `<div style="display:flex;gap:24px;">${attrColsHTML}</div>`)}
        ${_pdfSection('НАВЫКИ', `<div style="display:flex;gap:24px;">${skillColsHTML}</div>`)}
        ${_pdfSection('ВИТАЛЫ', vitalsHTML)}
        ${discHTML ? _pdfSection('ДИСЦИПЛИНЫ', discHTML) : ''}
        ${meritRows || flawRows ? _pdfSection('ПРЕИМУЩЕСТВА И НЕДОСТАТКИ', `
            ${meritRows ? `<div style="margin-bottom:12px;"><div style="font-weight:bold;color:#555;margin-bottom:4px;">Преимущества</div>${meritRows}</div>` : ''}
            ${flawRows ? `<div><div style="font-weight:bold;color:#555;margin-bottom:4px;">Недостатки</div>${flawRows}</div>` : ''}
        `) : ''}
    `;

    // ============================================================
    // SECTION 3: INVENTORY
    // ============================================================
    let invHTML = '';
    if (d.inventory.length) {
        invHTML = d.inventory.map(item => `
            <div style="margin-bottom:10px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;">
                <div style="font-weight:bold;font-size:10pt;">${_pdfEsc(item.name || 'Без названия')}
                    <span style="font-weight:normal;color:#666;font-size:9pt;"> — ${_pdfEsc(item.category)} · ${item.quantity} шт.</span>
                </div>
                ${item.description ? `<div style="font-size:9pt;color:#444;margin-top:3px;white-space:pre-wrap;">${_pdfEsc(item.description)}</div>` : ''}
                ${item.note ? `<div style="font-size:9pt;color:#888;margin-top:2px;font-style:italic;white-space:pre-wrap;">${_pdfEsc(item.note)}</div>` : ''}
            </div>
        `).join('');
    } else {
        invHTML = `<div style="color:#888;font-style:italic;">Инвентарь пуст.</div>`;
    }

    const inventory_section = `
        <div style="font-size:15pt;font-weight:bold;color:#8b0000;margin-bottom:16px;letter-spacing:1px;">ИНВЕНТАРЬ</div>
        ${invHTML}
    `;

    return `<div style="${base}padding:0;margin:0;background:#fff;">
        <div style="padding:0;">${social}</div>
        ${pb}
        <div style="padding:0;">${mechanics}</div>
        ${pb}
        <div style="padding:0;">${inventory_section}</div>
    </div>`;
}

function getSheetPdfFileName() {
    const rawName = (document.getElementById('char-name')?.value || 'Kindred').trim() || 'Kindred';
    return `V5_${rawName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_')}.pdf`;
}

function getSelectText(id) {
    const select = document.getElementById(id);
    if (!select) return '';
    return select.options?.[select.selectedIndex]?.textContent?.trim() || select.value || '';
}

function getInputValue(id) {
    return (document.getElementById(id)?.value || '').trim();
}

function getTextValue(id) {
    return (document.getElementById(id)?.textContent || '').trim();
}

function getCheckedDots(name, fallback = 0) {
    return parseInt(document.querySelector(`input[name="${name}"]:checked`)?.value || String(fallback), 10) || 0;
}

function getSheetPdfData() {
    const attrGroups = {
        'Физические': ['Сила', 'Ловкость', 'Выносливость'],
        'Социальные': ['Обаяние', 'Манипуляция', 'Самообладание'],
        'Ментальные': ['Интеллект', 'Смекалка', 'Упорство']
    };
    const skillGroups = {
        'Физические': ['Атлетика', 'Вождение', 'Воровство', 'Выживание', 'Драка', 'Ремесло', 'Скрытность', 'Стрельба', 'Фехтование'],
        'Социальные': ['Запугивание', 'Исполнение', 'Лидерство', 'Обращение с животными', 'Проницательность', 'Убеждение', 'Уличное чутьё', 'Хитрость', 'Этикет'],
        'Ментальные': ['Гуманитарные науки', 'Естественные науки', 'Медицина', 'Наблюдательность', 'Оккультизм', 'Политика', 'Расследование', 'Техника', 'Финансы']
    };

    const disciplines = Object.keys(disciplineSources || {}).map(name => ({
        name,
        dots: Object.values(disciplineSources[name] || {}).reduce((sum, value) => sum + Number(value || 0), 0),
        powers: (selectedPowers[name] || []).map(power => typeof power === 'string' ? power : power.name || power.название || '').filter(Boolean)
    })).filter(item => item.dots > 0);

    return {
        name: getInputValue('char-name') || 'Kindred',
        info: [
            ['Сир', getInputValue('sire-input')],
            ['Концепция', getInputValue('concept-input')],
            ['Натура', getInputValue('nature-input')],
            ['Маска', getInputValue('mask-input')],
            ['Истинный возраст', getInputValue('true-age-input')],
            ['Видимый возраст', getInputValue('apparent-age-input')],
            ['Дата рождения', getInputValue('birth-date-input')],
            ['Дата смерти', getInputValue('death-date-input')],
            ['Клан', getSelectText('clan-input')],
            ['Стиль охоты', getSelectText('predator-input')],
            ['Поколение', getSelectText('generation-input')],
            ['Тип', getSelectText('type-input')]
        ],
        clanBane: getInputValue('clan-bane-input'),
        touchstones: (touchstones || []).map(item => item.text || '').filter(Boolean),
        appearance: getInputValue('appearance-input'),
        backstory: getInputValue('backstory-input'),
        notes: getInputValue('notes-input'),
        attrGroups,
        skillGroups,
        attrValues: Object.values(attrGroups).flat().reduce((acc, name) => ({ ...acc, [name]: getCheckedDots(name, 1) }), {}),
        skillValues: Object.values(skillGroups).flat().reduce((acc, name) => ({ ...acc, [name]: getCheckedDots(name, 0) }), {}),
        vitals: [
            ['Здоровье', getTextValue('val-hp')],
            ['Сила воли', getTextValue('val-wp')],
            ['Человечность', getTextValue('val-humanity')],
            ['Сила крови', getTextValue('val-blood-potency')],
            ['Свободный опыт', getInputValue('free-exp')]
        ],
        disciplines,
        merits: (selectedMerits || []).map(item => ({ name: item.name, points: item.points || 0 })),
        flaws: (selectedFlaws || []).map(item => ({ name: item.name, points: item.points || 0 })),
        thinBloodMerits: (selectedThinBloodMerits || []).map(item => ({ name: item.name, points: item.points || 0 })),
        thinBloodFlaws: (selectedThinBloodFlaws || []).map(item => ({ name: item.name, points: item.points || 0 })),
        inventory: (inventory || []).map(item => ({
            name: item.name || 'Без названия',
            category: item.category || 'Другое',
            quantity: item.quantity || 1,
            description: item.description || '',
            note: item.note || ''
        }))
    };
}

async function addPdfFont(pdf) {
    const toBase64 = (buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
    };

    const [regular, bold] = await Promise.all([
        fetch('/fonts/Arial.ttf').then(response => {
            if (!response.ok) throw new Error('Не удалось загрузить шрифт PDF');
            return response.arrayBuffer();
        }),
        fetch('/fonts/ArialBold.ttf').then(response => {
            if (!response.ok) throw new Error('Не удалось загрузить жирный шрифт PDF');
            return response.arrayBuffer();
        })
    ]);

    pdf.addFileToVFS('Arial.ttf', toBase64(regular));
    pdf.addFileToVFS('ArialBold.ttf', toBase64(bold));
    pdf.addFont('Arial.ttf', 'VTMArial', 'normal');
    pdf.addFont('ArialBold.ttf', 'VTMArial', 'bold');
    pdf.setFont('VTMArial', 'normal');
}

function drawPdfSheet(pdf, data) {
    const page = {
        w: pdf.internal.pageSize.getWidth(),
        h: pdf.internal.pageSize.getHeight(),
        margin: 28
    };
    const colors = {
        bg: [10, 10, 10],
        sheet: [0, 0, 0],
        panel: [8, 8, 8],
        line: [46, 46, 46],
        text: [220, 220, 220],
        muted: [130, 130, 130],
        red: [255, 49, 49],
        white: [255, 255, 255],
        gold: [255, 174, 0]
    };
    let y = page.margin;

    const setColor = (color) => pdf.setTextColor(color[0], color[1], color[2]);
    const fillPage = () => {
        pdf.setFillColor(...colors.bg);
        pdf.rect(0, 0, page.w, page.h, 'F');
        pdf.setFillColor(...colors.sheet);
        pdf.setDrawColor(...colors.line);
        pdf.rect(20, 18, page.w - 40, page.h - 36, 'FD');
        y = page.margin + 8;
    };
    const addPage = () => {
        pdf.addPage();
        fillPage();
    };
    const ensureSpace = (height) => {
        if (y + height > page.h - page.margin) addPage();
    };
    const text = (value, x, yy, options = {}) => {
        pdf.setFont('VTMArial', options.bold ? 'bold' : 'normal');
        pdf.setFontSize(options.size || 9);
        setColor(options.color || colors.text);
        pdf.text(String(value || ''), x, yy, options.align ? { align: options.align } : undefined);
    };
    const wrapped = (value, x, yy, width, options = {}) => {
        pdf.setFont('VTMArial', options.bold ? 'bold' : 'normal');
        pdf.setFontSize(options.size || 9);
        const lines = pdf.splitTextToSize(String(value || ''), width);
        setColor(options.color || colors.text);
        pdf.text(lines, x, yy);
        return lines.length * (options.lineHeight || 11);
    };
    const section = (title) => {
        ensureSpace(28);
        y += 10;
        text(title.toUpperCase(), page.w / 2, y, { size: 14, bold: true, color: colors.white, align: 'center' });
        y += 8;
        pdf.setDrawColor(...colors.line);
        pdf.line(page.margin + 12, y, page.w - page.margin - 12, y);
        y += 14;
    };
    const panel = (x, yy, w, h) => {
        pdf.setFillColor(...colors.panel);
        pdf.setDrawColor(...colors.line);
        pdf.roundedRect(x, yy, w, h, 3, 3, 'FD');
    };
    const field = (label, value, x, yy, w, h = 27) => {
        panel(x, yy, w, h);
        text(label, x + 8, yy + 10, { size: 6.8, bold: true, color: colors.muted });
        wrapped(value || ' ', x + 8, yy + 22, w - 16, { size: 8.6, lineHeight: 9.8, color: colors.white });
    };
    const dots = (count, x, yy, max = 5) => {
        for (let i = 1; i <= max; i++) {
            pdf.setDrawColor(...colors.red);
            if (i <= count) {
                pdf.setFillColor(...colors.red);
                pdf.circle(x + (i - 1) * 9, yy, 3.1, 'FD');
            } else {
                pdf.circle(x + (i - 1) * 9, yy, 3.1, 'S');
            }
        }
    };
    const dotText = (count, max = 5) => '●'.repeat(Math.max(0, count)) + '○'.repeat(Math.max(0, max - count));
    const blockText = (title, value) => {
        if (!value) return;
        const width = page.w - page.margin * 2 - 28;
        const lines = pdf.splitTextToSize(value, width);
        const height = Math.max(46, 28 + lines.length * 10);
        ensureSpace(height + 8);
        panel(page.margin + 14, y, width + 14, height);
        text(title, page.margin + 24, y + 14, { size: 8, bold: true, color: colors.red });
        wrapped(value, page.margin + 24, y + 29, width - 6, { size: 8.5, lineHeight: 10.5 });
        y += height + 8;
    };

    fillPage();

    text(data.name, page.w / 2, y + 14, { size: 20, bold: true, color: colors.red, align: 'center' });
    text('Vampire: the Masquerade V5 - лист персонажа', page.w / 2, y + 30, { size: 8, color: colors.muted, align: 'center' });
    y += 46;

    section('Социальное');
    const fieldW = (page.w - page.margin * 2 - 24) / 3;
    data.info.forEach(([label, value], index) => {
        const x = page.margin + 14 + (index % 3) * (fieldW + 8);
        if (index > 0 && index % 3 === 0) y += 35;
        field(label, value, x, y, fieldW, 29);
    });
    y += 43;
    blockText('Изъян клана', data.clanBane);
    if (data.touchstones.length) blockText('Опоры и принципы', data.touchstones.map((item, index) => `${index + 1}. ${item}`).join('\n'));
    blockText('Внешность', data.appearance);
    blockText('Предыстория', data.backstory);
    blockText('Заметки персонажа', data.notes);
}

async function generateSheetPDF() {
    if (typeof window.jspdf === 'undefined') return alert('jsPDF не загружен');
    const { jsPDF } = window.jspdf;
    const btn = document.getElementById('btn-pdf');
    const originalText = btn?.textContent || 'Скачать PDF';
    if (btn) { btn.textContent = 'Скачиваем PDF…'; btn.disabled = true; }

    try {
        const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
        await addPdfFont(pdf);
        drawPdfSheet(pdf, getSheetPdfData());
        pdf.save(getSheetPdfFileName());
    } catch (err) {
        console.error(err);
        alert('Ошибка генерации PDF: ' + err.message);
    } finally {
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
}

window.generateSheetPDF = generateSheetPDF;

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
    if (!canUseDiscipline(name) || isThinBloodClan()) return alert('Эта дисциплина недоступна текущему клану.');

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

function shouldShowCartCost(item) {
    return item.type !== 'power';
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
                ${shouldShowCartCost(item) ? `<strong>${getCartCostLabel(item.cost)}</strong>` : ''}
            </div>
        `).join('')
        : `<div style="color:#777; font-size:13px; line-height:1.45;">Кликай по листу. Покупки и продажи появятся здесь отдельными строками.</div>`;

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
    if (isThinBloodClan()) return [];
    return getStandardDisciplineNames();
}

function askDisciplineName(message = 'Название дисциплины?') {
    const known = getDisciplineNamesForPrompt();
    if (known.length === 0) {
        alert('Для текущего клана покупка дисциплин здесь недоступна.');
        return '';
    }
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

    const lines = cart.map(item => {
        const costText = shouldShowCartCost(item) ? ` (${getCartCostLabel(item.cost)})` : '';
        return `${getTraitKindLabel(item.type)}: ${item.name} ${item.from}→${item.to}${costText}`;
    });
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
    if (!canUseDiscipline(name) || isThinBloodClan()) return alert('Эта дисциплина недоступна текущему клану.');
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
        sire: getInputValue('sire-input'),
        concept: getInputValue('concept-input'),
        nature: getInputValue('nature-input'),
        mask: getInputValue('mask-input'),
        trueAge: getInputValue('true-age-input'),
        apparentAge: getInputValue('apparent-age-input'),
        birthDate: getInputValue('birth-date-input'),
        deathDate: getInputValue('death-date-input'),
        clanBane: getInputValue('clan-bane-input'),
        characterImage: characterImageData || '',
        touchstones: JSON.parse(JSON.stringify(touchstones || [])),
        inventory: normalizeInventory(inventory),
        appearance: getInputValue('appearance-input'),
        backstory: getInputValue('backstory-input'),
        notes: getInputValue('notes-input'),
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
        flaws: JSON.parse(JSON.stringify(selectedFlaws || [])),
        thinBloodMerits: JSON.parse(JSON.stringify(selectedThinBloodMerits || [])),
        thinBloodFlaws: JSON.parse(JSON.stringify(selectedThinBloodFlaws || []))
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

    const lockedControls = document.querySelectorAll('#clan-input, #predator-input, #generation-input, #type-input, #base-humanity, .locked-origin-control');
    lockedControls.forEach(control => {
        const shouldDisable = startingSheetFixed && !expShopMode;
        control.disabled = shouldDisable;
        control.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
    });

    if (startingSheetFixed && !expShopMode) {
        closeMeritsFlawsModal();
        document.getElementById('clan-modal')?.style.setProperty('display', 'none');
        document.getElementById('predator-modal')?.style.setProperty('display', 'none');
        document.getElementById('generation-modal')?.style.setProperty('display', 'none');
    }
}

function isSheetLockedTarget(target) {
    if (!startingSheetFixed || isApplyingCharacterData || isExperiencePurchaseInProgress) return false;
    if (expShopMode) return false;
    if (!target || target.closest('#exp-modal')) return false;
    if (target.closest('.show-master-btn, .selected-item-show-master, [data-inventory-show-master]')) return false;
    const dotLabel = target.closest('.dot-label');
    const dotRow = dotLabel?.closest('.row');
    if ((dotLabel && (dotRow?.querySelector('.attr-name') || dotRow?.querySelector('.skill-name'))) || target.closest('.discipline-item:not(.xp-shop-discipline-option) .disc-dot')) return false;
    if (target.closest('#clan-input, #predator-input, #generation-input, #type-input, #base-humanity, .locked-origin-control, .dot-label, .dot-input, .disc-dot, .s-badge, .add-power-btn, .remove-disc-btn, .merit-add-btn, .selected-item-remove')) return true;
    if (target.closest('.skill-spec-line button, .skill-spec-line input')) return true;
    if (target.closest('.attr-name, .skill-name, .skill-spec-line')) return false;
    const disciplineItem = target.closest('.discipline-item:not(.xp-shop-discipline-option)');
    if (!disciplineItem) return false;
    return !target.closest('button, input, select, textarea');
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

    if (!validateThinBloodBalance()) return;

    if (!confirm("Зафиксировать текущие значения как стартовый лист?\nПосле этого лист нельзя будет менять вручную: только через магазин опыта или после расфиксации.")) {
        return;
    }

    const hasExistingStartBase = startingSheetBase && Object.keys(startingSheetBase.levels || {}).length > 0;
    if (!hasExistingStartBase) {
        baseLevels = captureCurrentLevels();
        sheetLockSnapshot = captureSheetSnapshot();
        startingSheetBase = JSON.parse(JSON.stringify(sheetLockSnapshot));
    } else {
        // Если baseLevels пустой (старые данные без sheetLock или первая фиксация),
        // захватываем текущие уровни как базу, иначе оставляем как есть (XP-история)
        if (!Object.keys(baseLevels || {}).length) {
            baseLevels = captureCurrentLevels();
        }
        sheetLockSnapshot = captureSheetSnapshot();
    }
    startingSheetFixed = true;
    applySheetLockState();
    updateExpPurchasedStyles();

    alert("Стартовый лист зафиксирован. Теперь повышения проходят через магазин опыта.");
}
