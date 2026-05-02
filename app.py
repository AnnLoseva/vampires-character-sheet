import json
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
app.static_folder = 'static'      # ← добавь эту строку

# Загружаем все данные один раз
with open('rules.json', 'r', encoding='utf-8') as f:
    RULES = json.load(f)

ATTRIBUTES_DATA = {
    "Физические": ["Сила", "Ловкость", "Выносливость"],
    "Социальные": ["Обаяние", "Манипуляция", "Самообладание"],
    "Ментальные": ["Интеллект", "Смекалка", "Упорство"]
}

SKILLS_DATA = {
    "Физические": ["Атлетика", "Вождение", "Воровство", "Выживание", "Драка", "Ремесло", "Скрытность", "Стрельба", "Фехтование"],
    "Социальные": ["Запугивание", "Исполнение", "Лидерство", "Обращение с животными", "Проницательность", "Убеждение", "Уличное чутьё", "Хитрость", "Этикет"],
    "Ментальные": ["Гуманитарные науки", "Естественные науки", "Медицина", "Наблюдательность", "Оккультизм", "Политика", "Расследование", "Техника", "Финансы"]
}

# ====================== API ======================
@app.route('/api/attribute/<attr>')
def get_attribute(attr):
    return jsonify(RULES["attributes"].get(attr, {}))

@app.route('/api/skill/<skill>')
def get_skill(skill):
    return jsonify(RULES["skills"].get(skill, {}))

@app.route('/api/clan_hint')
def get_clan_hint():
    clan = request.args.get('clan')
    return jsonify(RULES["clans"].get(clan, {}))

@app.route('/api/predator_hint')
def get_predator_hint():
    ptype = request.args.get('type')
    return jsonify(RULES["predator_types"].get(ptype, {}))

# ====================== ГЛАВНАЯ ======================
@app.route('/', methods=['GET', 'POST'])
def index():
    form_data = request.form.to_dict() if request.method == 'POST' else {}
    specialties = request.form.getlist('specialty')

    # Расчёт вторичных
    health = int(form_data.get('Выносливость', 1)) + 3
    willpower = int(form_data.get('Самообладание', 1)) + int(form_data.get('Упорство', 1))

      # Подготовка данных для шаблона
    clan_list = []
    for name, data in RULES.get("clans", {}).items():
        clan_list.append({
            "name": name,
            "glyph": data.get("glyph", "&#xe800;")
        })

    # Исправлено для типов охоты
    predator_list = []
    for name, data in RULES.get("predator_types", {}).items():
        predator_list.append({
            "name": name,
            "emoji": data.get("emoji", "🩸")   # если у тебя есть эмодзи в json
        })

    return render_template('index.html', 
                           attributes=ATTRIBUTES_DATA, 
                           skills=SKILLS_DATA,
                           clans=clan_list,                    # ← изменено
                           predators=predator_list,
                           rules=RULES,                        # ← весь json
                           form_data=form_data,
                           specialties=specialties,
                           hp=health,
                           wp=willpower)

if __name__ == '__main__':
    app.run(port=5000, debug=True)