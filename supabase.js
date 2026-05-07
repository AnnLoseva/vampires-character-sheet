// supabase.js — ПОЛНАЯ сохранёнка и загрузка персонажа

const SUPABASE_URL = 'https://klhxbaagarqxaqnrvurr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DEqlrxf3M7MzsoSkrEuBXQ_ndTxg9e1';

let supabaseClient = null;
let currentUser = null;

function initSupabase() {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        checkUserSession();
        return true;
    }
    return false;
}

async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    updateAuthButton();
}

// ==================== ПОЛНОЕ СОХРАНЕНИЕ ====================
async function saveCharacter() {
    if (!currentUser) {
        if (confirm("Нужно войти через Google")) loginWithGoogle();
        return;
    }

    const fullData = getFullCharacterData();

    const { error } = await supabaseClient
        .from('characters')
        .insert({
            user_id: currentUser.id,
            name: fullData.name,
            data: fullData
        });

    if (error) alert("❌ Ошибка сохранения: " + error.message);
    else alert(`✅ "${fullData.name}" полностью сохранён!`);
}

// ==================== ПОЛНАЯ ЗАГРУЗКА ====================
window.loadCharacter = async function(id) {
    const { data, error } = await supabaseClient
        .from('characters')
        .select('data')
        .eq('id', id)
        .single();

    if (error || !data?.data) return alert("Не удалось загрузить");

    loadFullCharacter(data.data);
    closeModal();
    alert(`✅ Персонаж "${data.data.name}" полностью загружен!`);
};

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
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
        disciplines: disciplineSources || {},
        selectedPowers: selectedPowers || {},
        merits: selectedMerits || [],
        flaws: selectedFlaws || []
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

    return data;
}

function loadFullCharacter(d) {
    // Основные поля
    if (d.name) document.getElementById('char-name').value = d.name;
    if (d.clan) document.getElementById('clan-input').value = d.clan;
    if (d.predator) document.getElementById('predator-input').value = d.predator;
    if (d.skillPackage) document.getElementById('skill-package').value = d.skillPackage;

    // Атрибуты
    Object.keys(d.attributes || {}).forEach(attr => {
        const radio = document.querySelector(`input[name="${attr}"][value="${d.attributes[attr]}"]`);
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

    // Дисциплины и способности
    if (d.disciplines) disciplineSources = d.disciplines;
    if (d.selectedPowers) selectedPowers = d.selectedPowers;

    // Преимущества и недостатки
    if (d.merits) selectedMerits = d.merits;
    if (d.flaws) selectedFlaws = d.flaws;

    // Перерисовка
    renderDisciplines();
    renderSelectedMeritsFlaws();
    updateTrackers();
}

// Глобальные функции
window.loginWithGoogle = () => supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
window.saveCharacter = saveCharacter;
window.showMyCharacters = showMyCharacters;
window.loadCharacter = loadCharacter;

window.addEventListener('load', () => {
    let i = 0;
    const int = setInterval(() => { if (initSupabase() || ++i > 30) clearInterval(int); }, 250);
});