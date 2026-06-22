// Russian source string -> English translation.
// Keyed by the literal Russian text used in JSX so wrapping a string with
// t('...') is the only change needed at each call site. See the i18n plan
// for why this app uses source-string keys instead of semantic keys.
export const dictionary: Record<string, string> = {
  // MainScreen.tsx
  'Архив личности': 'Identity Archive',
  'Аккаунт активен. Последний персонаж доступен прямо из салона.':
    'Account active. Your latest character is available right from the salon.',
  'Войдите в систему и получите доступ к персонажам, хроникам и сохранённым данным.':
    'Sign in to access your characters, chronicles, and saved data.',
  'Архив вошёл, но персонажи не загрузились': 'Signed in, but characters failed to load',
  'Клан не указан': 'No clan set',
  'Персонажей пока нет': 'No characters yet',
  'Активный персонаж': 'Active character',
  'Листы': 'Sheets',
  'Выйти': 'Log out',
  'Создать нового персонажа': 'Create a new character',
  'Вход': 'Log in',
  'Регистрация': 'Register',
  'Имя пользователя': 'Username',
  'Пароль': 'Password',
  'Войти в аккаунт': 'Log in',
  'Создать аккаунт': 'Create account',
  'Хроника': 'Chronicle',
  'Подключитесь к игровой комнате, синхронизируйте листы и играйте в реальном времени.':
    'Connect to a game room, sync character sheets, and play in real time.',
  'Название комнаты': 'Room name',
  'Роль': 'Role',
  'Игрок': 'Player',
  'Мастер': 'Storyteller',
  'Войти в игру': 'Enter the game',
  'Библиотека': 'Library',
  'Открывайте листы персонажей и личные дневники, сохранённые во время игры.':
    'Open character sheets and personal journals saved during play.',
  'Открыть редактор': 'Open editor',
  'Дневник': 'Journal',
  'Справочник': 'Reference',
  'Имя пользователя минимум 3 символа': 'Username must be at least 3 characters',
  'Пароль минимум 6 символов': 'Password must be at least 6 characters',
  'Проверяю доступ...': 'Checking access...',
  'Создаю запись в архиве...': 'Creating archive record...',
  'Такой пользователь уже существует': 'This username is already taken',
  'Регистрация не прошла': 'Registration failed',
  'Неверный логин или пароль': 'Incorrect username or password',

  // ReferencePage.tsx / ReferenceSidebar.tsx
  'Навигация справочника': 'Reference navigation',
  'Главная': 'Home',
  'Игровой стол': 'Game table',
  'Лист': 'Sheet',
  'Правила, кланы, дисциплины, создание персонажа и материалы для мастера в одном тёмном архиве.':
    'Rules, clans, Disciplines, character creation, and Storyteller material, all in one dark archive.',
  'Поиск по справочнику': 'Search the reference',
  'Поиск по словам': 'Search by words',
  'Например: Голконда Бруха Голод': 'e.g.: Golconda Brujah Hunger',
  'Найдено разделов: {count}': 'Sections found: {count}',
  'Совпадение {current} из {total}': 'Match {current} of {total}',
  'Совпадений нет': 'No matches',
  'Переход по совпадениям': 'Jump between matches',
  'Назад': 'Back',
  'Вперёд': 'Next',
  'Сбросить': 'Clear',
  'Введите одно или несколько слов, чтобы оставить только подходящие разделы.':
    'Enter one or more words to narrow the page down to matching sections.',
  'Результаты поиска': 'Search results',
  'Раздел': 'Section',
  'Подраздел': 'Subsection',
  'Справочник загружается...': 'Reference is loading...',
  'Загружаю архив...': 'Loading the archive...',
  'Архив открыт': 'Archive opened',
  'Справочник не загрузился': 'Reference failed to load',
  'Ничего не найдено': 'Nothing found',
  'По запросу **{query}** разделы не найдены. Попробуйте другое слово или более общий термин.':
    'No sections matched **{query}**. Try a different word, or a more general term.',
  'Показаны только разделы, где найдены все слова запроса: **{query}**.':
    'Showing only sections that contain every word of the query: **{query}**.',
  'Оглавление справочника': 'Reference table of contents',
  'Оглавление': 'Contents',
  'Заголовки загружаются...': 'Headings are loading...',
}
