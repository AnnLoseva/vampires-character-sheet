/* ====================================================================
   МАСТЕР ПОШАГОВОГО СОЗДАНИЯ ПЕРСОНАЖА (Vampire: the Masquerade V5)
   Весь UI живёт в этом оверлее. Источник истины — те же поля листа
   персонажа, поэтому «Перейти к листу» просто прячет оверлей.
   ==================================================================== */
(function () {
    'use strict';

    const STEP_ORDER = [
        'warning', 'identity', 'clanFilter', 'clan', 'predator', 'generation',
        'humanity', 'touchstones', 'backstory', 'appearance', 'notes',
        'attributes', 'disciplines', 'meritsFlaws', 'inventory', 'summary'
    ];
    const OPTIONAL_STEPS = new Set(['touchstones', 'backstory', 'appearance', 'notes', 'inventory']);

    let wizard = null;          // creationWizard data object
    let pendingType = null;     // chosen character type before wizard
    let activeStep = null;

    // ---------- утилиты ----------
    function el(id) { return document.getElementById(id); }
    function val(id) { return (el(id)?.value || '').trim(); }
    function setVal(id, v) { if (el(id)) el(id).value = v == null ? '' : v; }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function isNewMode() {
        return new URLSearchParams(window.location.search).get('new') === '1';
    }
    function rules() { return window.VTM_RULES || (typeof RULES !== 'undefined' ? RULES : {}); }

    function defaultWizard() {
        return {
            mode: null,
            currentStep: 'warning',
            completedSteps: [],
            skippedSteps: [],
            clanFilter: 'v5',
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            finishedAt: null
        };
    }

    function persist(extra) {
        if (!wizard) return;
        wizard.updatedAt = new Date().toISOString();
        if (window.autoSaveCharacterPatch) {
            window.autoSaveCharacterPatch(Object.assign({
                creationWizard: JSON.parse(JSON.stringify(wizard))
            }, extra || {}), { silent: true });
        }
    }

    function markCompleted(step) {
        if (!wizard) return;
        if (!wizard.completedSteps.includes(step)) wizard.completedSteps.push(step);
        wizard.skippedSteps = wizard.skippedSteps.filter(s => s !== step);
    }
    function markSkipped(step) {
        if (!wizard) return;
        if (!wizard.skippedSteps.includes(step)) wizard.skippedSteps.push(step);
        wizard.completedSteps = wizard.completedSteps.filter(s => s !== step);
    }

    // ---------- overlay show/hide ----------
    function openOverlay() {
        document.body.classList.add('cw-active');
        const overlay = getOverlay();
        overlay.classList.add('cw-open');
        overlay.style.display = 'block';
        const btn = el('cw-return-btn');
        if (btn) btn.style.display = 'none';
    }
    function hideOverlay() {
        document.body.classList.remove('cw-active');
        const overlay = el('cw-overlay');
        if (overlay) { overlay.classList.remove('cw-open'); overlay.style.display = 'none'; }
    }

    function updateReturnButton() {
        const btn = el('cw-return-btn');
        if (!btn) return;
        const overlayOpen = el('cw-overlay').classList.contains('cw-open');
        const sheetFixed = document.body.classList.contains('sheet-fixed');
        const isNpc = /char-type-npc-/.test(document.body.className);
        // Кнопка возврата к мастеру: лист не зафиксирован, не НПС, оверлей скрыт
        const show = !overlayOpen && !sheetFixed && !isNpc &&
            (isNewMode() || (wizard && wizard.mode));
        btn.style.display = show ? 'block' : 'none';
    }

    // ---------- переход к листу ----------
    function goToSheet() {
        persist();
        hideOverlay();
        updateReturnButton();
    }
    window.creationGoToSheet = goToSheet;

    window.returnToCreationWizard = function () {
        if (!wizard) {
            wizard = defaultWizard();
            wizard.mode = 'guided';
        }
        const step = wizard.currentStep && STEP_ORDER.includes(wizard.currentStep)
            ? wizard.currentStep : 'warning';
        openOverlay();
        renderStep(step);
        persist();
    };

    // ---------- навигация ----------
    function goStep(step) {
        if (!STEP_ORDER.includes(step)) return;
        renderStep(step);
        persist();
    }
    function nextStep() {
        const idx = STEP_ORDER.indexOf(activeStep);
        if (idx < STEP_ORDER.length - 1) goStep(STEP_ORDER[idx + 1]);
    }
    function prevStep() {
        const idx = STEP_ORDER.indexOf(activeStep);
        if (idx > 0) goStep(STEP_ORDER[idx - 1]);
    }

    // ---------- progress bar ----------
    function progressHtml() {
        const idx = STEP_ORDER.indexOf(activeStep);
        return '<div class="cw-progress">' + STEP_ORDER.map((s, i) => {
            let cls = '';
            if (i === idx) cls = 'current';
            else if (wizard.completedSteps.includes(s) || i < idx) cls = 'done';
            return `<span class="${cls}"></span>`;
        }).join('') + '</div>';
    }

    function shell(stepKey, title, sub, body, nav) {
        const idx = STEP_ORDER.indexOf(stepKey);
        return progressHtml()
            + `<div class="cw-step-meta">Шаг ${idx + 1} из ${STEP_ORDER.length}</div>`
            + `<h1>${esc(title)}</h1>`
            + (sub ? `<h2 class="cw-sub">${esc(sub)}</h2>` : '')
            + body
            + `<div class="cw-nav">${nav}</div>`;
    }

    function navBtn(label, handler, cls) {
        return `<button type="button" class="cw-btn ${cls || ''}" data-cw="${handler}">${esc(label)}</button>`;
    }
    const toSheetBtn = navBtn('Перейти к листу персонажа', 'toSheet', 'to-sheet');

    function bindNav(root) {
        root.querySelectorAll('[data-cw]').forEach(b => {
            b.addEventListener('click', () => handleNav(b.getAttribute('data-cw')));
        });
    }

    function handleNav(action) {
        switch (action) {
            case 'toSheet': markCurrentProgress(); goToSheet(); break;
            case 'next': if (validateAndAdvance()) {} break;
            case 'prev': prevStep(); break;
            case 'skip': markSkipped(activeStep); nextStep(); break;
            case 'start': markCompleted('warning'); nextStep(); break;
            case 'finish': finishSheet(); break;
            default:
                if (typeof STEP_ACTIONS[action] === 'function') STEP_ACTIONS[action]();
        }
    }

    function markCurrentProgress() {
        // лёгкая отметка прогресса при уходе на лист
        if (activeStep && !OPTIONAL_STEPS.has(activeStep)) {
            // не помечаем обязательные как выполненные принудительно
        }
    }

    const STEP_ACTIONS = {};

    // ---------- рендер шага ----------
    function renderStep(step) {
        activeStep = step;
        wizard.currentStep = step;
        const overlay = getOverlay();
        if (!el('cw-card')) {
            overlay.innerHTML = '<div class="cw-card" id="cw-card"></div>';
        }
        const card = el('cw-card');
        const renderer = RENDERERS[step];
        if (!renderer) return;
        card.innerHTML = renderer();
        card.scrollTop = 0;
        overlay.scrollTop = 0;
        bindNav(card);
        if (typeof AFTER_RENDER[step] === 'function') AFTER_RENDER[step]();
    }

    const AFTER_RENDER = {};
    const RENDERERS = {};

    /* ================= ШАГ 1: ПРЕДУПРЕЖДЕНИЕ ================= */
    RENDERERS.warning = () => shell('warning', 'Лёгкое создание персонажа', '',
        `<div class="cw-intro">Сейчас система проведёт тебя по основным шагам создания персонажа.
        Всё, что ты выберешь здесь, можно будет изменить после окончания опросника в полном листе.</div>`,
        navBtn('Начать', 'start', 'primary') + toSheetBtn);

    /* ================= ШАГ 2: СОЦИАЛКА + АВАТАР ================= */
    RENDERERS.identity = () => {
        const f = (id, label, req) => `
            <div class="cw-field ${req ? 'required' : ''}">
                <label for="cw-${id}">${esc(label)}${req ? '' : ' (необязательно)'}</label>
                <input type="text" id="cw-${id}" data-mirror="${id}" value="${esc(val(id))}">
            </div>`;
        const portrait = window.characterImageData
            ? `<img class="cw-portrait-preview" src="${esc(window.characterImageData)}" alt="Портрет">`
            : `<div class="cw-portrait-placeholder">Портрет персонажа</div>`;
        return shell('identity', 'Кто этот персонаж?', '',
            `<div class="cw-error" id="cw-identity-error" style="display:none"></div>
             <div class="cw-portrait-row">
                ${portrait}
                <div style="flex:1">
                    <p style="color:#888;font-size:13px;margin:0 0 10px;line-height:1.5;">Изображение персонажа (необязательно)</p>
                    <button type="button" class="cw-btn" id="cw-portrait-upload">Загрузить изображение</button>
                    ${window.characterImageData ? '<button type="button" class="cw-btn ghost" id="cw-portrait-remove" style="margin-left:8px">Удалить</button>' : ''}
                </div>
             </div>
             <div class="cw-fields">
                ${f('char-name', 'Имя', true)}
                ${f('sire-input', 'Сир')}
                ${f('concept-input', 'Концепция')}
                ${f('nature-input', 'Натура')}
                ${f('mask-input', 'Маска')}
                ${f('true-age-input', 'Истинный возраст')}
                ${f('apparent-age-input', 'Видимый возраст')}
                ${f('birth-date-input', 'Дата рождения')}
                ${f('death-date-input', 'Дата смерти')}
             </div>`,
            navBtn('Назад', 'prev') + navBtn('Дальше', 'next', 'primary')
            + navBtn('Пропустить необязательное', 'skipOptionalIdentity')
            + toSheetBtn);
    };
    AFTER_RENDER.identity = () => {
        el('cw-card').querySelectorAll('[data-mirror]').forEach(inp => {
            inp.addEventListener('input', () => {
                setVal(inp.getAttribute('data-mirror'), inp.value);
            });
        });
        const up = el('cw-portrait-upload');
        if (up) up.addEventListener('click', () => el('character-image-input')?.click());
        const rm = el('cw-portrait-remove');
        if (rm) rm.addEventListener('click', () => {
            if (typeof window.deleteCharacterImage === 'function') window.deleteCharacterImage();
            renderStep('identity');
        });
        // когда листовой uploader загрузит картинку — перерисуем шаг
        const fileInp = el('character-image-input');
        if (fileInp && !fileInp.__cwBound) {
            fileInp.__cwBound = true;
            fileInp.addEventListener('change', () => {
                setTimeout(() => { if (activeStep === 'identity') renderStep('identity'); }, 400);
            });
        }
    };
    STEP_ACTIONS.skipOptionalIdentity = () => {
        if (!val('char-name')) { showIdentityError(); return; }
        markCompleted('identity'); nextStep();
    };
    function showIdentityError() {
        const e = el('cw-identity-error');
        if (e) { e.textContent = 'Имя обязательно для заполнения.'; e.style.display = 'block'; }
    }

    /* ================= ШАГ 3: ФИЛЬТР КЛАНОВ ================= */
    RENDERERS.clanFilter = () => shell('clanFilter', 'Какие кланы показывать?', '',
        `<div class="cw-choice-grid">
            ${choiceBtn('Кланы только V5 (для новичков)', 'filterV5', wizard.clanFilter === 'v5')}
            ${choiceBtn('Кланы V5 и V20', 'filterV5V20', wizard.clanFilter === 'v5_v20')}
            ${choiceBtn('Все кланы', 'filterAll', wizard.clanFilter === 'all')}
        </div>`,
        navBtn('Назад', 'prev') + navBtn('Дальше', 'next', 'primary') + toSheetBtn);
    function choiceBtn(label, action, sel, sub) {
        return `<button type="button" class="cw-choice-btn ${sel ? 'selected' : ''}" data-cw="${action}" style="${sel ? 'border-color:#ff3131;background:#2a1111' : ''}">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
    }
    STEP_ACTIONS.filterV5 = () => { wizard.clanFilter = 'v5'; markCompleted('clanFilter'); nextStep(); };
    STEP_ACTIONS.filterV5V20 = () => { wizard.clanFilter = 'v5_v20'; markCompleted('clanFilter'); nextStep(); };
    STEP_ACTIONS.filterAll = () => { wizard.clanFilter = 'all'; markCompleted('clanFilter'); nextStep(); };

    /* ================= ШАГ 4: ГАЛЕРЕЯ КЛАНОВ ================= */
    function editionAllowed(ed) {
        if (wizard.clanFilter === 'all') return true;
        if (wizard.clanFilter === 'v5_v20') return ed === 'v5' || ed === 'v20';
        return ed === 'v5';
    }
    function clanCardData() {
        const clans = rules().clans || {};
        return Object.entries(clans)
            .filter(([, d]) => editionAllowed(d.edition || 'legacy'))
            .map(([name, d]) => ({ name, d }));
    }
    RENDERERS.clan = () => {
        const cur = getCurrentClanValue();
        const list = clanCardData();
        const cards = list.map(({ name, d }) => {
            const disc = (d.disciplines || []).join(', ');
            const bane = (d.bane || '').split(/\n+/)[0] || '';
            const desc = (d.description || '').split(/\n+/).find(Boolean) || '';
            const ed = (d.edition || 'legacy').toUpperCase().replace('LEGACY', 'Legacy');
            return `<div class="cw-tile ${cur === name ? 'selected' : ''}" data-cw="pickClan" data-clan="${esc(name)}">
                <span class="cw-tile-name">${esc(name)}</span>
                <span class="cw-tile-badge">${esc(ed)}</span>
                <span class="cw-tile-desc">${esc(desc.length > 160 ? desc.slice(0, 157) + '…' : desc)}</span>
                ${disc ? `<span class="cw-tile-meta"><b>Дисциплины:</b> ${esc(disc)}</span>` : ''}
                ${bane ? `<span class="cw-tile-meta"><b>Изъян:</b> ${esc(bane.length > 120 ? bane.slice(0, 117) + '…' : bane)}</span>` : ''}
            </div>`;
        }).join('');
        return shell('clan', 'Выбери клан', cur ? `Выбран: ${cur}` : '',
            `<div class="cw-gallery">${cards}</div>`,
            navBtn('Назад', 'prev') + navBtn('Дальше', 'next', 'primary') + toSheetBtn);
    };
    function getCurrentClanValue() { return val('clan-input'); }
    STEP_ACTIONS.pickClan = function () {}; // заменяется делегированием
    AFTER_RENDER.clan = () => {
        el('cw-card').querySelectorAll('[data-cw="pickClan"]').forEach(tile => {
            tile.addEventListener('click', () => {
                const name = tile.getAttribute('data-clan');
                if (typeof window.selectThisClan === 'function') window.selectThisClan(name);
                else setVal('clan-input', name);
                markCompleted('clan');
                // подсветка
                el('cw-card').querySelectorAll('[data-cw="pickClan"]').forEach(t => t.classList.remove('selected'));
                tile.classList.add('selected');
                const sub = el('cw-card').querySelector('h2.cw-sub');
                if (sub) sub.textContent = 'Выбран: ' + name;
                persist();
            });
        });
    };

    /* ================= ШАГ 5: ГАЛЕРЕЯ ТИПОВ ОХОТЫ ================= */
    RENDERERS.predator = () => {
        const cur = val('predator-input');
        const preds = rules().predator_types || {};
        const cards = Object.entries(preds).map(([name, d]) => {
            const desc = (d.description || '').split(/\n+/).find(Boolean) || '';
            const disc = d.disciplines && d.disciplines.increase
                ? (d.disciplines.increase.options || []).join(' / ') : '';
            const hum = typeof d.humanity === 'number' && d.humanity !== 0
                ? (d.humanity > 0 ? '+' + d.humanity : '' + d.humanity) : '0';
            const bp = d.blood_potency ? '+' + d.blood_potency : '0';
            return `<div class="cw-tile ${cur === name ? 'selected' : ''}" data-cw="pickPred" data-pred="${esc(name)}">
                <span class="cw-tile-name">${esc(name)}</span>
                <span class="cw-tile-desc">${esc(desc.length > 170 ? desc.slice(0, 167) + '…' : desc)}</span>
                ${disc ? `<span class="cw-tile-meta"><b>Дисциплина:</b> ${esc(disc)}</span>` : ''}
                <span class="cw-tile-meta"><b>Сила крови:</b> ${esc(bp)} · <b>Человечность:</b> ${esc(hum)}</span>
            </div>`;
        }).join('');
        return shell('predator', 'Выбери тип охоты', cur ? `Выбран: ${cur}` : '',
            `<div class="cw-gallery">${cards}</div>`,
            navBtn('Назад', 'prev') + navBtn('Дальше', 'next', 'primary') + toSheetBtn);
    };
    AFTER_RENDER.predator = () => {
        el('cw-card').querySelectorAll('[data-cw="pickPred"]').forEach(tile => {
            tile.addEventListener('click', () => {
                const name = tile.getAttribute('data-pred');
                if (typeof window.selectThisPredator === 'function') window.selectThisPredator(name);
                else setVal('predator-input', name);
                markCompleted('predator');
                el('cw-card').querySelectorAll('[data-cw="pickPred"]').forEach(t => t.classList.remove('selected'));
                tile.classList.add('selected');
                const sub = el('cw-card').querySelector('h2.cw-sub');
                if (sub) sub.textContent = 'Выбран: ' + name;
                persist();
            });
        });
    };

    /* ================= ШАГ 6: ГАЛЕРЕЯ ПОКОЛЕНИЙ ================= */
    const GEN_INFO = [
        { gen: 16, bp: 0, note: 'Слабокровный птенец. Сила крови 0.' },
        { gen: 15, bp: 0, note: 'Слабокровный птенец. Сила крови 0.' },
        { gen: 14, bp: 0, note: 'Слабокровный птенец. Сила крови 0.' },
        { gen: 13, bp: 1, note: 'Птенец/Неонат. Стандартный старт для игрока.' },
        { gen: 12, bp: 1, note: 'Птенец/Неонат. Сила крови 1.' },
        { gen: 11, bp: 1, note: 'Анцилла. Сила крови 1.' },
        { gen: 10, bp: 2, note: 'Анцилла. Сила крови 2.' }
    ];
    RENDERERS.generation = () => {
        const cur = val('generation-input');
        const cards = GEN_INFO.map(g => `
            <div class="cw-tile ${cur == g.gen ? 'selected' : ''}" data-cw="pickGen" data-gen="${g.gen}" data-bp="${g.bp}">
                <span class="cw-tile-name">${g.gen}-е поколение</span>
                <span class="cw-tile-meta"><b>Сила крови:</b> ${g.bp}</span>
                <span class="cw-tile-desc">${esc(g.note)}</span>
            </div>`).join('');
        return shell('generation', 'Выбери поколение', cur ? `Выбрано: ${cur}-е` : '',
            `<div class="cw-gallery">${cards}</div>`,
            navBtn('Назад', 'prev') + navBtn('Дальше', 'next', 'primary') + toSheetBtn);
    };
    AFTER_RENDER.generation = () => {
        el('cw-card').querySelectorAll('[data-cw="pickGen"]').forEach(tile => {
            tile.addEventListener('click', () => {
                const gen = tile.getAttribute('data-gen');
                const bp = parseInt(tile.getAttribute('data-bp'), 10) || 0;
                setVal('generation-input', gen);
                if (el('generation-input')) el('generation-input').dispatchEvent(new Event('change'));
                if (el('val-blood-potency')) {
                    el('val-blood-potency').value = String(bp);
                    el('val-blood-potency').dispatchEvent(new Event('change'));
                }
                if (typeof window.updateBloodPotencyAndBonuses === 'function') window.updateBloodPotencyAndBonuses();
                markCompleted('generation');
                el('cw-card').querySelectorAll('[data-cw="pickGen"]').forEach(t => t.classList.remove('selected'));
                tile.classList.add('selected');
                const sub = el('cw-card').querySelector('h2.cw-sub');
                if (sub) sub.textContent = 'Выбрано: ' + gen + '-е';
                persist();
            });
        });
    };

    /* ================= ШАГ 7: НАЧАЛЬНАЯ ЧЕЛОВЕЧНОСТЬ ================= */
    function predatorHumanityMod() {
        const p = val('predator-input');
        const pd = (rules().predator_types || {})[p];
        return pd && typeof pd.humanity === 'number' ? pd.humanity : 0;
    }
    RENDERERS.humanity = () => {
        const cur = parseInt(val('base-humanity') || '7', 10);
        const mod = predatorHumanityMod();
        const hint = mod
            ? `<div class="cw-hint">Тип охоты «${esc(val('predator-input'))}» изменяет Человечность на ${mod > 0 ? '+' + mod : mod}. Итоговое значение будет пересчитано на листе.</div>`
            : '';
        return shell('humanity', 'Начальная Человечность', '',
            hint + `<div class="cw-choice-grid" style="grid-template-columns:1fr 1fr;max-width:360px">
                ${choiceBtn('7', 'humanity7', cur === 7)}
                ${choiceBtn('8', 'humanity8', cur === 8)}
            </div>`,
            navBtn('Назад', 'prev') + navBtn('Дальше', 'next', 'primary') + toSheetBtn);
    };
    function setHumanity(v) {
        setVal('base-humanity', String(v));
        if (el('base-humanity')) el('base-humanity').dispatchEvent(new Event('change'));
        if (typeof window.updateHumanity === 'function') window.updateHumanity();
        markCompleted('humanity');
        persist();
        nextStep();
    }
    STEP_ACTIONS.humanity7 = () => setHumanity(7);
    STEP_ACTIONS.humanity8 = () => setHumanity(8);

    /* ================= ШАГИ 8-11: ОПОРЫ И ТЕКСТ ================= */
    RENDERERS.touchstones = () => {
        const ts = (window.touchstones || []);
        const rows = ts.length
            ? ts.map((t, i) => `<div class="cw-summary-row"><span class="lbl">${esc(t.name || 'Без имени')}</span><span class="val">${esc((t.description || '').slice(0, 80))}</span></div>`).join('')
            : '<p style="color:#888;font-size:14px">Опоры пока не добавлены.</p>';
        return shell('touchstones', 'Опоры (Touchstones)', 'Люди и принципы, удерживающие человечность',
            `<div class="cw-intro" style="margin-bottom:14px">Опоры — это смертные и убеждения, которые связывают персонажа с человечностью. Можно добавить несколько.</div>
             <div class="cw-summary" style="margin-bottom:16px">${rows}</div>
             <button type="button" class="cw-btn" data-cw="addTouchstone">+ Добавить опору</button>`,
            navBtn('Назад', 'prev') + navBtn('Пропустить', 'skip') + navBtn('Дальше', 'next', 'primary') + toSheetBtn);
    };
    STEP_ACTIONS.addTouchstone = () => {
        if (typeof window.addTouchstone === 'function') window.addTouchstone();
        markCompleted('touchstones');
        renderStep('touchstones');
        persist();
    };

    function textStep(step, title, sub, mirrorId, placeholder) {
        RENDERERS[step] = () => shell(step, title, sub,
            `<div class="cw-field wide">
                <label for="cw-${mirrorId}">${esc(title)}</label>
                <textarea id="cw-${mirrorId}" data-mirror="${mirrorId}" placeholder="${esc(placeholder)}">${esc(val(mirrorId))}</textarea>
             </div>`,
            navBtn('Назад', 'prev') + navBtn('Пропустить', 'skip') + navBtn('Дальше', 'next', 'primary') + toSheetBtn);
        AFTER_RENDER[step] = () => {
            const t = el('cw-' + mirrorId);
            if (t) t.addEventListener('input', () => {
                setVal(mirrorId, t.value);
                if (t.value.trim()) markCompleted(step);
            });
        };
    }
    textStep('backstory', 'Предыстория', '', 'backstory-input', 'Предыстория персонажа');
    textStep('appearance', 'Внешность', '', 'appearance-input', 'Описание внешности');
    textStep('notes', 'Заметки', '', 'notes-input', 'Личные заметки, связи, привычки, важные детали');

    /* ================= ШАГ 12: ХАРАКТЕРИСТИКИ И НАВЫКИ ================= */
    const ATTR_SCHEME = { 4: 1, 3: 3, 2: 4, 1: 1 };
    const SKILL_SCHEMES = {
        versatile: { label: 'Мастер на все руки', limits: { 3: 1, 2: 8, 1: 10 } },
        balanced: { label: 'Сбалансированный', limits: { 3: 3, 2: 5, 1: 7 } },
        specialist: { label: 'Специалист', limits: { 4: 1, 3: 3, 2: 3, 1: 3 } }
    };
    function counts(type) {
        const r = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        document.querySelectorAll(`.dot-input[data-type="${type}"]:checked`).forEach(i => {
            const v = parseInt(i.value, 10) || 0;
            if (v >= 1 && v <= 5) r[v]++;
        });
        return r;
    }
    function schemeRemaining(limits, c) {
        return Object.keys(limits).map(k => {
            const n = parseInt(k, 10);
            const used = c[n] || 0, max = limits[n] || 0;
            return { n, used, max };
        }).sort((a, b) => b.n - a.n);
    }
    function schemeComplete(limits, c) {
        return [1, 2, 3, 4, 5].every(v => (c[v] || 0) === (limits[v] || 0));
    }
    RENDERERS.attributes = () => {
        const pkg = val('skill-package');
        const pkgButtons = Object.entries(SKILL_SCHEMES).map(([id, s]) =>
            `<button type="button" class="cw-choice-btn ${pkg === id ? 'selected' : ''}" data-cw="setPkg" data-pkg="${id}" style="${pkg === id ? 'border-color:#ff3131;background:#2a1111' : ''}">${esc(s.label)}<small>${esc(formatScheme(s.limits))}</small></button>`
        ).join('');
        return shell('attributes', 'Характеристики и навыки',
            'Распредели точки прямо на листе по схеме',
            `<div class="cw-intro" style="margin-bottom:14px">Характеристики: распредели по схеме <b>${esc(formatScheme(ATTR_SCHEME))}</b>.
             Навыки: выбери способ развития и распредели согласно схеме. Точки ставятся на листе персонажа — нажми «Открыть характеристики на листе», расставь кружки, затем вернись сюда для проверки.</div>
             <div class="cw-section-title">Способ развития навыков</div>
             <div class="cw-choice-grid" style="margin-bottom:18px">${pkgButtons}</div>
             <div id="cw-attr-status"></div>
             <button type="button" class="cw-btn" data-cw="openAttrSheet">Открыть характеристики на листе</button>
             <button type="button" class="cw-btn ghost" data-cw="recheckAttr" style="margin-left:8px">Проверить заполнение</button>`,
            navBtn('Назад', 'prev') + navBtn('Дальше', 'next', 'primary') + toSheetBtn);
    };
    function formatScheme(limits) {
        return [5, 4, 3, 2, 1].filter(v => limits[v]).map(v => `${limits[v]}×${v}`).join(', ');
    }
    AFTER_RENDER.attributes = () => renderAttrStatus();
    function renderAttrStatus() {
        const box = el('cw-attr-status');
        if (!box) return;
        const ac = counts('attr');
        const attrOk = schemeComplete(ATTR_SCHEME, ac);
        const pkg = val('skill-package');
        const sc = counts('skill');
        let skillBlock = '<div class="cw-counter bad">Сначала выбери способ развития навыков.</div>';
        let skillOk = false;
        if (pkg && SKILL_SCHEMES[pkg]) {
            const limits = SKILL_SCHEMES[pkg].limits;
            skillOk = schemeComplete(limits, sc);
            skillBlock = `<div class="cw-counter">` + schemeRemaining(limits, sc).map(r =>
                `<span class="${r.used === r.max ? 'ok' : 'bad'}">×${r.n}: ${r.used}/${r.max}</span>`).join('') + `</div>`;
        }
        box.innerHTML = `<div class="cw-section-title">Характеристики</div>
            <div class="cw-counter">` + schemeRemaining(ATTR_SCHEME, ac).map(r =>
                `<span class="${r.used === r.max ? 'ok' : 'bad'}">×${r.n}: ${r.used}/${r.max}</span>`).join('') + `</div>
            <div class="cw-section-title">Навыки</div>${skillBlock}
            <p style="color:${attrOk && skillOk ? '#36d675' : '#ff9500'};font-size:13px;margin-top:10px">
            ${attrOk && skillOk ? '✓ Характеристики и навыки распределены верно.' : 'Распределение ещё не завершено.'}</p>`;
        if (attrOk && skillOk) markCompleted('attributes'); else markSkipped('attributes');
    }
    STEP_ACTIONS.setPkg = function () {};
    STEP_ACTIONS.openAttrSheet = () => {
        goToSheet();
        if (typeof window.switchSheetSection === 'function') window.switchSheetSection('mechanics');
        setTimeout(() => el('attributes-grid')?.scrollIntoView({ behavior: 'smooth' }), 100);
    };
    STEP_ACTIONS.recheckAttr = () => renderAttrStatus();
    // делегирование выбора пакета
    document.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('[data-cw="setPkg"]');
        if (!b || activeStep !== 'attributes') return;
        const pkg = b.getAttribute('data-pkg');
        setVal('skill-package', pkg);
        if (el('skill-package')) el('skill-package').dispatchEvent(new Event('change'));
        el('cw-card').querySelectorAll('[data-cw="setPkg"]').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        renderAttrStatus();
        persist();
    });

    /* ================= ШАГ 13: ДИСЦИПЛИНЫ ================= */
    function disciplineDotsTotal() {
        const src = window.disciplineSources || {};
        return Object.values(src).reduce((t, s) =>
            t + Object.values(s || {}).reduce((a, b) => a + (parseInt(b, 10) || 0), 0), 0);
    }
    RENDERERS.disciplines = () => {
        const clan = getCurrentClanValue();
        const cd = clan ? ((rules().clans || {})[clan]?.disciplines || []) : [];
        const pred = val('predator-input');
        const pd = (rules().predator_types || {})[pred];
        const predDisc = pd && pd.disciplines && pd.disciplines.increase
            ? (pd.disciplines.increase.options || []) : [];
        const allowed = Array.from(new Set([...cd, ...predDisc]));
        const total = disciplineDotsTotal();
        return shell('disciplines', 'Дисциплины', 'Распредели 3 точки по клановым дисциплинам',
            `<div class="cw-intro" style="margin-bottom:14px">Стартовому персонажу доступно <b>3 точки</b> дисциплин: одна дисциплина на 2 точки и одна на 1 (только из клановых и предоставленной типом охоты).
            Доступные дисциплины: <b>${esc(allowed.join(', ') || '—')}</b>. Точки и конкретные силы выбираются на листе.</div>
             <div id="cw-disc-status"></div>
             <button type="button" class="cw-btn" data-cw="openDiscSheet">Открыть дисциплины на листе</button>
             <button type="button" class="cw-btn ghost" data-cw="recheckDisc" style="margin-left:8px">Проверить</button>`,
            navBtn('Назад', 'prev') + navBtn('Дальше', 'next', 'primary') + toSheetBtn);
    };
    AFTER_RENDER.disciplines = () => renderDiscStatus();
    function renderDiscStatus() {
        const box = el('cw-disc-status');
        if (!box) return;
        const total = disciplineDotsTotal();
        const ok = total === 3;
        box.innerHTML = `<div class="cw-counter"><span>Распределено точек: <b>${total}</b> / 3</span>
            <span class="${ok ? 'ok' : 'bad'}">${ok ? '✓ готово' : 'нужно ровно 3'}</span></div>`;
        if (ok) markCompleted('disciplines'); else markSkipped('disciplines');
    }
    STEP_ACTIONS.openDiscSheet = () => {
        const clan = getCurrentClanValue();
        goToSheet();
        if (clan && typeof window.openClanDisciplineModal === 'function') {
            window.openClanDisciplineModal(clan);
        } else {
            setTimeout(() => el('disciplines-list')?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    };
    STEP_ACTIONS.recheckDisc = () => renderDiscStatus();

    /* ================= ШАГ 14: ПРЕИМУЩЕСТВА И НЕДОСТАТКИ ================= */
    function meritPoints() {
        return (window.selectedMerits || []).reduce((s, m) =>
            s + (typeof window.getPaidMeritPoints === 'function' ? window.getPaidMeritPoints(m) : (m.dots || 0)), 0);
    }
    function flawPoints() {
        return (window.selectedFlaws || []).reduce((s, m) =>
            m.fromPredator ? s : s + (m.dots || (typeof window.getTraitPoints === 'function' ? window.getTraitPoints(m) : 0)), 0);
    }
    function meritsLimit() { return typeof window.getMeritsLimit === 'function' ? window.getMeritsLimit() : 7; }
    function flawsLimit() { return typeof window.getFlawsLimit === 'function' ? window.getFlawsLimit() : 2; }
    RENDERERS.meritsFlaws = () => {
        return shell('meritsFlaws', 'Преимущества и недостатки', 'Распредели точки по правилам',
            `<div class="cw-intro" style="margin-bottom:14px">Распредели ровно <b>${meritsLimit()}</b> точек преимуществ и возьми ровно <b>${flawsLimit()}</b> точки недостатков (бонусы типа охоты уже учтены).</div>
             <div id="cw-mf-status"></div>
             <button type="button" class="cw-btn" data-cw="openMfSheet">Открыть список преимуществ / недостатков</button>
             <button type="button" class="cw-btn ghost" data-cw="recheckMf" style="margin-left:8px">Проверить</button>`,
            navBtn('Назад', 'prev') + navBtn('Дальше', 'next', 'primary') + toSheetBtn);
    };
    AFTER_RENDER.meritsFlaws = () => renderMfStatus();
    function renderMfStatus() {
        const box = el('cw-mf-status');
        if (!box) return;
        const mp = meritPoints(), ml = meritsLimit();
        const fp = flawPoints(), fl = flawsLimit();
        const ok = mp === ml && fp === fl;
        box.innerHTML = `<div class="cw-counter">
            <span>Преимущества: <span class="${mp === ml ? 'ok' : 'bad'}">${mp} / ${ml}</span></span>
            <span>Недостатки: <span class="${fp === fl ? 'ok' : 'bad'}">${fp} / ${fl}</span></span>
            </div><p style="color:${ok ? '#36d675' : '#ff9500'};font-size:13px">${ok ? '✓ распределено верно' : 'распределение не завершено'}</p>`;
        if (ok) markCompleted('meritsFlaws'); else markSkipped('meritsFlaws');
    }
    STEP_ACTIONS.openMfSheet = () => {
        goToSheet();
        if (typeof window.openMeritsFlawsModal === 'function') window.openMeritsFlawsModal();
    };
    STEP_ACTIONS.recheckMf = () => renderMfStatus();

    /* ================= ШАГ 15: ИНВЕНТАРЬ ================= */
    RENDERERS.inventory = () => {
        const inv = window.inventory || [];
        const rows = inv.length
            ? inv.map(it => `<div class="cw-summary-row"><span class="lbl">${esc(it.name || 'Предмет')}</span><span class="val">${esc(it.category || '')} ×${esc(it.quantity || 1)}</span></div>`).join('')
            : '<p style="color:#888;font-size:14px">Инвентарь пуст.</p>';
        return shell('inventory', 'Инвентарь', 'Необязательный шаг',
            `<div class="cw-intro" style="margin-bottom:14px">Добавь стартовые предметы: название, описание, количество, категорию, заметку. Можно пропустить.</div>
             <div class="cw-summary" style="margin-bottom:16px">${rows}</div>
             <button type="button" class="cw-btn" data-cw="addInv">+ Добавить предмет на листе</button>`,
            navBtn('Назад', 'prev') + navBtn('Пропустить', 'skip') + navBtn('Дальше', 'next', 'primary') + toSheetBtn);
    };
    STEP_ACTIONS.addInv = () => {
        goToSheet();
        if (typeof window.switchSheetSection === 'function') window.switchSheetSection('inventory');
        if (typeof window.addInventoryItem === 'function') window.addInventoryItem();
    };

    /* ================= ШАГ 16: ИТОГОВЫЙ ЭКРАН ================= */
    function mandatoryValid() {
        const ac = counts('attr');
        const pkg = val('skill-package');
        const sc = counts('skill');
        const attrOk = schemeComplete(ATTR_SCHEME, ac);
        const skillOk = pkg && SKILL_SCHEMES[pkg] && schemeComplete(SKILL_SCHEMES[pkg].limits, sc);
        const discOk = disciplineDotsTotal() === 3;
        const mfOk = meritPoints() === meritsLimit() && flawPoints() === flawsLimit();
        return {
            name: !!val('char-name'),
            clan: !!getCurrentClanValue(),
            predator: !!val('predator-input'),
            generation: !!val('generation-input'),
            attributes: attrOk,
            skills: skillOk,
            disciplines: discOk,
            meritsFlaws: mfOk
        };
    }
    RENDERERS.summary = () => {
        const v = mandatoryValid();
        const row = (lbl, value, cls) =>
            `<div class="cw-summary-row"><span class="lbl">${esc(lbl)}</span><span class="val ${cls || ''}">${esc(value)}</span></div>`;
        const yn = b => b ? { t: 'заполнены', c: 'ok' } : { t: 'ошибки', c: 'bad' };
        const inv = (window.inventory || []).length;
        const allOk = Object.values(v).every(Boolean);
        return shell('summary', 'Персонаж почти готов', '',
            `<div class="cw-summary">
                ${row('Имя', val('char-name') || '—', v.name ? '' : 'bad')}
                ${row('Клан', getCurrentClanValue() || '—', v.clan ? '' : 'bad')}
                ${row('Тип охоты', val('predator-input') || '—', v.predator ? '' : 'bad')}
                ${row('Поколение', val('generation-input') ? val('generation-input') + '-е' : '—', v.generation ? '' : 'bad')}
                ${row('Человечность', val('base-humanity') || '7', '')}
                ${row('Характеристики', yn(v.attributes).t, yn(v.attributes).c)}
                ${row('Навыки', yn(v.skills).t, yn(v.skills).c)}
                ${row('Дисциплины', yn(v.disciplines).t, yn(v.disciplines).c)}
                ${row('Преимущества и недостатки', yn(v.meritsFlaws).t, yn(v.meritsFlaws).c)}
                ${row('Инвентарь', inv ? 'заполнен' : 'пропущен', '')}
             </div>
             ${allOk ? '' : '<div class="cw-error">Не все обязательные шаги завершены. Чтобы зафиксировать лист, исправь отмеченные красным пункты.</div>'}`,
            navBtn('Открыть полный лист', 'toSheet', 'to-sheet')
            + navBtn('Вернуться и исправить', 'prev')
            + `<button type="button" class="cw-btn primary" data-cw="finish" ${allOk ? '' : 'disabled'}>Зафиксировать лист</button>`);
    };

    function finishSheet() {
        const v = mandatoryValid();
        if (!Object.values(v).every(Boolean)) {
            alert('Сначала заверши все обязательные шаги.');
            return;
        }
        wizard.finishedAt = new Date().toISOString();
        markCompleted('summary');
        hideOverlay();
        // фиксируем лист через существующий механизм (без диалогов)
        if (typeof window.fixStartingSheet === 'function') {
            try {
                window.fixStartingSheet({ silent: true });
            } catch (e) { console.error(e); }
        }
        persist({ sheetFixed: true });
        updateReturnButton();
    }

    /* ================= ВАЛИДАЦИЯ ПЕРЕХОДА «ДАЛЬШЕ» ================= */
    function validateAndAdvance() {
        if (activeStep === 'identity' && !val('char-name')) {
            showIdentityError();
            return false;
        }
        if (!OPTIONAL_STEPS.has(activeStep)) markCompleted(activeStep);
        nextStep();
        return true;
    }

    /* ================= СТАРТОВЫЕ МОДАЛКИ ВЫБОРА ТИПА ================= */
    function modalShell(title, buttonsHtml) {
        return `<div class="cw-card" style="max-width:520px;margin-top:8vh">
            <h1>${esc(title)}</h1>
            <div class="cw-choice-grid">${buttonsHtml}</div>
        </div>`;
    }
    function getOverlay() {
        let overlay = el('cw-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'cw-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            // fallback-стиль если HTML-версия без CSS
            overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:40000;background:#0a0a0a;overflow-y:auto;padding:24px 16px;font-family:"Courier New",monospace;color:#d0d0d0;';
            document.body.appendChild(overlay);
        }
        return overlay;
    }
    function showTypeChoice() {
        openOverlay();
        getOverlay().innerHTML = modalShell('Создать персонажа',
            choiceBtn('Создать вампира', 'typeVampire') +
            choiceBtn('Создать НПС', 'typeNpc'));
        bindTypeNav();
    }
    function showNpcChoice() {
        getOverlay().innerHTML = modalShell('Создать НПС',
            choiceBtn('Вампир', 'npcVampire') +
            choiceBtn('Человек', 'npcHuman'));
        bindTypeNav();
    }
    function showModeChoice() {
        getOverlay().innerHTML = modalShell('Как создать персонажа?',
            choiceBtn('Лёгкое создание персонажа', 'modeGuided') +
            choiceBtn('Чистый лист', 'modeBlank'));
        bindTypeNav();
    }
    function bindTypeNav() {
        getOverlay().querySelectorAll('[data-cw]').forEach(b => {
            b.addEventListener('click', () => typeNav(b.getAttribute('data-cw')));
        });
    }
    function applyCharMeta(meta) {
        pendingType = meta;
        if (typeof window.setCharacterType === 'function') window.setCharacterType(meta.sheetMode);
        persist({
            characterType: meta.characterType,
            characterRole: meta.characterRole,
            damageProfile: meta.damageProfile,
            sheetFixed: false,
            sheetMode: meta.sheetMode
        });
    }
    function restoreCardContainer() {
        el('cw-overlay').innerHTML = '<div class="cw-card" id="cw-card"></div>';
    }
    function typeNav(action) {
        switch (action) {
            case 'typeVampire':
                applyCharMeta({ characterType: 'vampire', characterRole: 'player', damageProfile: 'vampire', sheetMode: 'vampire' });
                showModeChoice();
                break;
            case 'typeNpc':
                showNpcChoice();
                break;
            case 'npcVampire':
                applyCharMeta({ characterType: 'vampire', characterRole: 'npc', damageProfile: 'vampire', sheetMode: 'npc-vampire' });
                startBlank(true);
                break;
            case 'npcHuman':
                applyCharMeta({ characterType: 'mortal', characterRole: 'npc', damageProfile: 'mortal', sheetMode: 'npc-mortal' });
                startBlank(true);
                break;
            case 'modeGuided':
                wizard.mode = 'guided';
                restoreCardContainer();
                renderStep('warning');
                persist();
                break;
            case 'modeBlank':
                wizard.mode = 'blank';
                wizard.currentStep = 'warning';
                startBlank(false);
                break;
        }
    }
    function startBlank(isNpc) {
        wizard.mode = wizard.mode || 'blank';
        hideOverlay();
        restoreCardContainer();
        // НПС не показывают кнопку возврата к мастеру (мастер пропущен)
        if (isNpc) { wizard.finishedAt = wizard.finishedAt || new Date().toISOString(); }
        persist();
        updateReturnButton();
    }

    /* ================= ИНИЦИАЛИЗАЦИЯ ================= */
    function readExistingWizard() {
        if (window.__loadedCharacterData && window.__loadedCharacterData.creationWizard) {
            return JSON.parse(JSON.stringify(window.__loadedCharacterData.creationWizard));
        }
        return null;
    }

    let _initDone = false;
    function init() {
        if (_initDone) return;
        _initDone = true;

        const existing = readExistingWizard();
        if (existing) wizard = Object.assign(defaultWizard(), existing);

        try {
            new MutationObserver(updateReturnButton)
                .observe(document.body, { attributes: true, attributeFilter: ['class'] });
        } catch (e) {}

        if (isNewMode()) {
            wizard = wizard || defaultWizard();
            showTypeChoice();
        } else {
            updateReturnButton();
        }
    }

    // Способ 1: событие vtm-sheet-ready (штатный путь)
    window.addEventListener('vtm-sheet-ready', init);
    if (window.__vtmSheetReady) init();

    // Способ 2: DOMContentLoaded — показываем выбор типа немедленно если ?new=1
    // (не ждём загрузки rules.json, которая может зависнуть)
    if (isNewMode()) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            setTimeout(init, 0);
        }
    }

    // Способ 3: fallback через 2 сек на случай если всё предыдущее не сработало
    setTimeout(init, 2000);

    // Обновляем кнопку возврата при загрузке существующего персонажа
    window.addEventListener('vtm-character-loaded', () => {
        const existing = readExistingWizard();
        if (existing) wizard = Object.assign(defaultWizard(), existing);
        updateReturnButton();
    });
})();
