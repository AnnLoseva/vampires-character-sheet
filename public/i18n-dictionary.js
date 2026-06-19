// Russian source string -> English translation, for the legacy character-sheet app
// (old-sheet.html + main.js + creation-wizard.js). Keyed by the literal Russian text
// so wrapping a string with t('...') (or marking an element data-i18n="...") is the
// only change needed at each call site. Falls back to the Russian source when a key
// is missing, so an incomplete dictionary degrades gracefully instead of breaking.
window.VTM_I18N = {
  'Не удалось загрузить rules.json': 'Failed to load rules.json',
  'Клан': 'Clan',
  'Охота': 'Hunt',
  'Опыт': 'Experience',
  'Сир': 'Sire',
  'Связи / Наставник': 'Contacts / Mentor',
};
