/**
 * Дузабонагӣ — Двуязычность (тоҷикӣ / русский)
 *
 * Ҳар сатри интерфейс дар ин ҷо ҷамъ шудааст. Дар HTML атрибути
 * `data-i18n="калид"` гузошта мешавад, дар JS функсияи `t('калид')`.
 * Матнҳои саволҳо дар questions*.js ҳамчун {tg, ru} нигоҳ дошта мешаванд
 * ва бо функсияи `L(...)` хонда мешаванд.
 */
'use strict';

const I18N = {
  tg: {
    'lang.name': 'Тоҷикӣ',
    'brand.badge': '⚡ Платформаи омӯзиши барномасозӣ',
    'brand.subtitle': 'Викторинаи интерактивӣ барои донишҷӯёни навомӯз',
    'doc.title': 'Quiz Master — Викторинаи интерактивӣ',

    /* --- Вуруд --- */
    'link.title': 'Даъватнома аз муаллим',
    'link.sub': 'Шумо ҳамчун <strong>донишҷӯ</strong> ба ҳуҷраи зерин ворид мешавед',
    'link.namelabel': 'Ном ва насаби худро нависед:',
    'link.nameph': 'Масалан: Сомонӣ Муҳаммад',
    'link.namehint': 'Муаллим шуморо бо ҳамин ном дар ҷадвали рейтинг мебинад.',
    'role.pick': 'Марҳамат! Нақши худро интихоб кунед:',
    'role.host.title': 'Муаллим (Админ)',
    'role.host.desc': 'Бозӣ эҷод кунед, линкро ба донишҷӯён фиристед ва тамоми ҷараёнро назорат кунед.',
    'role.student.title': 'Донишҷӯ',
    'role.student.desc': 'Бо коди ҳуҷра ё линки муаллим ворид шавед ва ба саволҳо ҷавоб диҳед.',
    'host.namelabel': 'Ном ва насаби шумо (Муаллим):',
    'host.nameph': 'Масалан: Устод Алиев',
    'host.passlabel': '🔒 Пароли муаллим:',
    'host.passph': 'Пароли шахсии шумо',
    'host.passhint': 'Бе пароли дуруст ҳуҷра сохта намешавад. Донишҷӯён паролро намедонанд.',
    'host.passwrong': 'Пароли нодуруст. Кӯшишҳои боқимонда: {n}',
    'host.passempty': 'Лутфан, паролро ворид кунед.',
    'host.locked': 'Аз ҳад зиёд кӯшиши нодуруст. Такрор баъди {n} сония.',
    'host.passok': 'Пароли дуруст — хуш омадед!',
    'btn.createroom': '🚀 Сохтани ҳуҷраи бозӣ',
    'student.namelabel': 'Ном ва насаби шумо (Донишҷӯ):',
    'room.codelabel': 'Коди ҳуҷра:',
    'btn.join': '🎮 Ворид шудан ба бозӣ',

    /* --- Лобби --- */
    'lobby.title': 'Ҳуҷраи интизорӣ',
    'lobby.codefor': 'Коди ҳуҷра барои донишҷӯён:',
    'btn.copylink': '🔗 Нусхабардории линк',
    'btn.copied': '✓ Линк нусхабардорӣ шуд!',
    'lobby.linkhint': 'Ҳар кас бо ин линк ворид шавад, <strong>худкор ҳамчун донишҷӯ</strong> дохил мешавад — нақши муаллимро интихоб карда наметавонад.',
    'conn.connecting': 'Пайвастшавӣ...',
    'conn.joining': 'Пайвастшавӣ ба ҳуҷра...',
    'conn.active': 'Пайваст фаъол',
    'conn.roomlive': 'Ҳуҷра фаъол — донишҷӯён ворид шуда метавонанд',
    'settings.title': '⚙️ Танзимоти бозӣ',
    'settings.subject': 'Фан',
    'settings.duration': 'Вақт барои ҳар савол',
    'settings.count': 'Шумораи саволҳо',
    'settings.order': 'Тартиби саволҳо',
    'settings.next': 'Гузариш ба саволи навбатӣ',
    'seg.sec': 'сон',
    'seg.all': 'Ҳама',
    'seg.sequential': 'Пайдарпай',
    'seg.random': 'Тасодуфӣ',
    'seg.manual': 'Дастӣ',
    'seg.auto': 'Худкор',
    'participants.title': 'Иштирокчиён',
    'lobby.empty': 'Ҳанӯз касе ворид нашудааст.',
    'btn.start': '▶️ ОҒОЗИ БОЗӢ',
    'student.waiting': 'Мунтазири оғози бозӣ аз тарафи муаллим бошед...',

    /* --- Викторина --- */
    'q.counter': 'Саволи {n} аз {t}',

    /* --- Дастрасӣ (танҳо барои screen reader) --- */
    'a11y.welcome': 'Вуруд ба бозӣ',
    'a11y.options': 'Вариантҳои ҷавоб',
    'a11y.option': 'Варианти {l}: {x}',
    'a11y.answered': 'Ҷавоб доданд: {n} аз {t}',
    'admin.title': '🛡️ Панели назорат',
    'stat.online': 'Онлайн',
    'stat.answered': 'Ҷавоб дод',
    'stat.correct': 'Дуруст',
    'dist.title': 'Тақсимоти ҷавобҳо',
    'monitor.title': 'Донишҷӯён (вақти воқеӣ)',
    'th.student': 'Донишҷӯ',
    'th.answer': 'Ҷавоб',
    'th.score': 'Бал',
    'btn.revealnow': '👁️ Ҳозир кушодан',
    'btn.next': 'Навбатӣ ➔',
    'btn.tolb': '🏁 Ҷадвали рейтинг',
    'btn.end': '⏹️ Анҷом',
    'chip.waiting': 'интизор',
    'tag.correct': 'ҶАВОБИ ДУРУСТ',
    'monitor.empty': 'Ҳанӯз донишҷӯ нест',
    'ans.accepted': 'Ҷавоби шумо қабул шуд.',
    'ans.acceptedsub': 'Дурустии ҷавоб пас аз тамом шудани вақт нишон дода мешавад — сабр кунед.',
    'rev.none': 'Шумо ҷавоб надодед.',
    'rev.good': 'Офарин! Ҷавоб дуруст аст.',
    'rev.bad': 'Ҷавоб нодуруст.',
    'rev.right': 'Ҷавоби дуруст: <b>{l}</b>',
    'rev.points': '+{p} бал',
    'rev.rank': ' · Ҷои {r} · {s} бал',
    'rev.explain': '💡 Шарҳ:',

    /* --- Рейтинг --- */
    'lb.title': 'Ҷадвали рейтинг ва ғолибон',
    'lb.sub': 'Натиҷаҳои финалии викторина',
    'th.place': 'Ҷой',
    'th.points': 'Балҳо',
    'th.rightans': 'Ҷавобҳои дуруст',
    'lb.you': 'шумо',
    'lb.points': '{p} бал',
    'lb.myline': '{p} бал · {c} ҷавоби дуруст аз {t}',
    'lb.empty': 'Маълумот нест',
    'report.title': '📋 Ҳисоботи муфассали синф',
    'report.hint': 'Ҳар нуқта як савол: сабз — дуруст, сурх — нодуруст, хокистарӣ — ҷавоб надод.',
    'th.accuracy': 'Дақиқӣ',
    'th.avgtime': 'Вақти миёна',
    'th.answers': 'Ҷавобҳо',
    'th.right': 'Дуруст',
    'report.empty': 'Донишҷӯ нест',
    'btn.csv': '⬇️ Боргирии ҳисобот (CSV)',
    'btn.newgame': '🔄 Бозии нав',

    /* --- Паёмҳо --- */
    'msg.badname': 'Лутфан, номи худро дуруст нависед!',
    'msg.badroom': 'Лутфан, коди ҳуҷраро ворид кунед!',
    'msg.joined': '{n} ворид шуд',
    'msg.kicked': '{n} хориҷ шуд',
    'msg.newcode': 'Коди ҳуҷра нав карда шуд: {c}',
    'msg.csvok': 'Ҳисобот боргирӣ шуд',
    'msg.nostudents': 'Ҳанӯз ягон донишҷӯ ворид нашудааст. Ба ҳар ҳол оғоз кунем?',
    'msg.endconfirm': 'Бозиро ҳозир анҷом диҳем?',
    'msg.kickconfirm': 'Ин донишҷӯро аз ҳуҷра берун кунем: {n}?',
    'msg.roomfull': 'Ҳуҷра пур аст — шумораи донишҷӯён ба ҳадди ниҳоӣ расид.',
    'msg.cleared': 'Маълумоти бозӣ аз ин дастгоҳ тоза шуд.',
    'msg.nolink': 'Ин линк нопурра аст. Линки навро аз муаллим пурсед.',
    'kick.title': 'Шумо аз ҳуҷра хориҷ шудед',
    'kick.sub': 'Барои бозгашт бо муаллим тамос гиред.',
    'net.lost': 'Алоқа бо сервер канда шуд — барқарорсозӣ...',
    'net.rebuild': 'Ҳуҷра аз нав сохта мешавад...',
    'net.issue': 'Мушкили шабака — барқарорсозӣ...',
    'net.restored': 'Алоқа барқарор шуд ✓',
    'net.notfound': 'Ҳуҷра ёфт нашудааст — кӯшиш идома дорад...',
    'net.failed': 'Пайваст барқарор намешавад. Интернетро санҷед ё саҳифаро нав кунед.',
    'net.weak': 'Пайваст бо муаллим суст аст — барқарорсозӣ...',
    'net.ok': 'Пайваст барқарор шуд',
    'net.hostback': 'Пайваст бо муаллим барқарор шуд',
    'net.hostlost': 'Пайваст бо муаллим қатъ шуд — барқарорсозӣ...',
    'net.cut': 'Алоқа канда шуд — барқарорсозӣ...',
    'q.timeup': '⏰ <strong>Вақт тамом шуд.</strong> Шумо ҷавоб надодед — мунтазири натиҷа бошед...',
    'q.waitreveal': '⏳ Вақт тамом — муаллим натиҷаро мекушояд...',
    'title.question': 'Саволи {n}',
    'csv.name': 'Ном',
    'csv.score': 'Бал',
    'csv.right': 'Дуруст',
    'csv.answered': 'Ҷавобдода',
    'csv.acc': 'Дақиқӣ %',
    'csv.avgtime': 'Вақти миёна (с)',
    'csv.q': 'С',
    'unit.sec': 'с',
    'title.kick': 'Хориҷ кардан',
    'title.sound': 'Овоз',
    'title.live': 'Ҳолати воқеӣ'
  },

  ru: {
    'lang.name': 'Русский',
    'brand.badge': '⚡ Платформа обучения программированию',
    'brand.subtitle': 'Интерактивная викторина для начинающих',
    'doc.title': 'Quiz Master — Интерактивная викторина',

    'link.title': 'Приглашение от учителя',
    'link.sub': 'Вы входите в комнату как <strong>студент</strong>',
    'link.namelabel': 'Напишите своё имя и фамилию:',
    'link.nameph': 'Например: Сомони Мухаммад',
    'link.namehint': 'Учитель увидит вас в таблице рейтинга под этим именем.',
    'role.pick': 'Добро пожаловать! Выберите свою роль:',
    'role.host.title': 'Учитель (Админ)',
    'role.host.desc': 'Создайте игру, отправьте ссылку студентам и контролируйте весь процесс.',
    'role.student.title': 'Студент',
    'role.student.desc': 'Войдите по коду комнаты или ссылке учителя и отвечайте на вопросы.',
    'host.namelabel': 'Ваше имя и фамилия (Учитель):',
    'host.nameph': 'Например: Устод Алиев',
    'host.passlabel': '🔒 Пароль учителя:',
    'host.passph': 'Ваш личный пароль',
    'host.passhint': 'Без правильного пароля комнату создать нельзя. Студенты пароль не знают.',
    'host.passwrong': 'Неверный пароль. Осталось попыток: {n}',
    'host.passempty': 'Пожалуйста, введите пароль.',
    'host.locked': 'Слишком много неудачных попыток. Повторите через {n} сек.',
    'host.passok': 'Пароль верный — добро пожаловать!',
    'btn.createroom': '🚀 Создать игровую комнату',
    'student.namelabel': 'Ваше имя и фамилия (Студент):',
    'room.codelabel': 'Код комнаты:',
    'btn.join': '🎮 Войти в игру',

    'lobby.title': 'Комната ожидания',
    'lobby.codefor': 'Код комнаты для студентов:',
    'btn.copylink': '🔗 Скопировать ссылку',
    'btn.copied': '✓ Ссылка скопирована!',
    'lobby.linkhint': 'Любой, кто войдёт по этой ссылке, <strong>автоматически становится студентом</strong> — роль учителя выбрать невозможно.',
    'conn.connecting': 'Подключение...',
    'conn.joining': 'Подключение к комнате...',
    'conn.active': 'Связь активна',
    'conn.roomlive': 'Комната активна — студенты могут входить',
    'settings.title': '⚙️ Настройки игры',
    'settings.subject': 'Предмет',
    'settings.duration': 'Время на вопрос',
    'settings.count': 'Количество вопросов',
    'settings.order': 'Порядок вопросов',
    'settings.next': 'Переход к следующему вопросу',
    'seg.sec': 'сек',
    'seg.all': 'Все',
    'seg.sequential': 'По порядку',
    'seg.random': 'Случайно',
    'seg.manual': 'Вручную',
    'seg.auto': 'Авто',
    'participants.title': 'Участники',
    'lobby.empty': 'Пока никто не вошёл.',
    'btn.start': '▶️ НАЧАТЬ ИГРУ',
    'student.waiting': 'Ожидайте начала игры от учителя...',

    'q.counter': 'Вопрос {n} из {t}',

    /* --- Доступность (только для программ чтения с экрана) --- */
    'a11y.welcome': 'Вход в игру',
    'a11y.options': 'Варианты ответа',
    'a11y.option': 'Вариант {l}: {x}',
    'a11y.answered': 'Ответили: {n} из {t}',
    'admin.title': '🛡️ Панель управления',
    'stat.online': 'Онлайн',
    'stat.answered': 'Ответили',
    'stat.correct': 'Верно',
    'dist.title': 'Распределение ответов',
    'monitor.title': 'Студенты (в реальном времени)',
    'th.student': 'Студент',
    'th.answer': 'Ответ',
    'th.score': 'Баллы',
    'btn.revealnow': '👁️ Открыть сейчас',
    'btn.next': 'Далее ➔',
    'btn.tolb': '🏁 Таблица рейтинга',
    'btn.end': '⏹️ Завершить',
    'chip.waiting': 'ждём',
    'tag.correct': 'ПРАВИЛЬНЫЙ ОТВЕТ',
    'monitor.empty': 'Студентов пока нет',
    'ans.accepted': 'Ваш ответ принят.',
    'ans.acceptedsub': 'Правильность ответа будет показана после окончания времени — подождите.',
    'rev.none': 'Вы не ответили.',
    'rev.good': 'Молодец! Ответ правильный.',
    'rev.bad': 'Ответ неверный.',
    'rev.right': 'Правильный ответ: <b>{l}</b>',
    'rev.points': '+{p} баллов',
    'rev.rank': ' · Место {r} · {s} баллов',
    'rev.explain': '💡 Пояснение:',

    'lb.title': 'Таблица рейтинга и победители',
    'lb.sub': 'Итоговые результаты викторины',
    'th.place': 'Место',
    'th.points': 'Баллы',
    'th.rightans': 'Правильных ответов',
    'lb.you': 'вы',
    'lb.points': '{p} баллов',
    'lb.myline': '{p} баллов · {c} правильных из {t}',
    'lb.empty': 'Нет данных',
    'report.title': '📋 Подробный отчёт по классу',
    'report.hint': 'Каждая точка — один вопрос: зелёная — верно, красная — неверно, серая — без ответа.',
    'th.accuracy': 'Точность',
    'th.avgtime': 'Среднее время',
    'th.answers': 'Ответы',
    'th.right': 'Верно',
    'report.empty': 'Студентов нет',
    'btn.csv': '⬇️ Скачать отчёт (CSV)',
    'btn.newgame': '🔄 Новая игра',

    'msg.badname': 'Пожалуйста, напишите своё имя правильно!',
    'msg.badroom': 'Пожалуйста, введите код комнаты!',
    'msg.joined': '{n} вошёл',
    'msg.kicked': '{n} удалён',
    'msg.newcode': 'Код комнаты обновлён: {c}',
    'msg.csvok': 'Отчёт скачан',
    'msg.nostudents': 'Пока никто не вошёл. Всё равно начать?',
    'msg.endconfirm': 'Завершить игру сейчас?',
    'msg.kickconfirm': 'Удалить этого студента из комнаты: {n}?',
    'msg.roomfull': 'Комната заполнена — достигнут лимит студентов.',
    'msg.cleared': 'Данные игры удалены с этого устройства.',
    'msg.nolink': 'Эта ссылка неполная. Попросите у учителя новую ссылку.',
    'kick.title': 'Вы удалены из комнаты',
    'kick.sub': 'Для возврата обратитесь к учителю.',
    'net.lost': 'Связь с сервером потеряна — восстановление...',
    'net.rebuild': 'Комната пересоздаётся...',
    'net.issue': 'Проблема с сетью — восстановление...',
    'net.restored': 'Связь восстановлена ✓',
    'net.notfound': 'Комната не найдена — продолжаем попытки...',
    'net.failed': 'Не удаётся подключиться. Проверьте интернет или обновите страницу.',
    'net.weak': 'Слабая связь с учителем — восстановление...',
    'net.ok': 'Связь восстановлена',
    'net.hostback': 'Связь с учителем восстановлена',
    'net.hostlost': 'Связь с учителем прервана — восстановление...',
    'net.cut': 'Связь прервана — восстановление...',
    'q.timeup': '⏰ <strong>Время вышло.</strong> Вы не ответили — ожидайте результат...',
    'q.waitreveal': '⏳ Время вышло — учитель открывает результат...',
    'title.question': 'Вопрос {n}',
    'csv.name': 'Имя',
    'csv.score': 'Баллы',
    'csv.right': 'Верно',
    'csv.answered': 'Отвечено',
    'csv.acc': 'Точность %',
    'csv.avgtime': 'Среднее время (с)',
    'csv.q': 'В',
    'unit.sec': 'с',
    'title.kick': 'Удалить',
    'title.sound': 'Звук',
    'title.live': 'В реальном времени'
  }
};

const LANG_KEY = 'quiz_lang';

let LANG = (function () {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'tg' || saved === 'ru') return saved;
  } catch (e) {}
  const cfg = (typeof QUIZ_CONFIG !== 'undefined' && QUIZ_CONFIG.defaultLang) || 'tg';
  return cfg === 'ru' ? 'ru' : 'tg';
})();

/** Матни калид бо забони ҷорӣ + ҷойгузории {vars}. */
function t(key, vars) {
  const dict = I18N[LANG] || I18N.tg;
  let s = dict[key];
  if (s === undefined) s = (I18N.tg[key] !== undefined ? I18N.tg[key] : key);
  if (vars) {
    Object.keys(vars).forEach((k) => {
      s = s.split('{' + k + '}').join(String(vars[k]));
    });
  }
  return s;
}

/**
 * Майдони дузабона аз саволҳо: {tg:'...', ru:'...'} → матн.
 * Сатри оддӣ ҳамон тавр бармегардад (мутобиқат бо бонкҳои кӯҳна).
 */
function L(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  return val[LANG] || val.tg || val.ru || '';
}

function getLang() { return LANG; }

function setLang(lang, onChange) {
  if (lang !== 'tg' && lang !== 'ru') return;
  LANG = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  applyI18n();
  if (typeof onChange === 'function') onChange(lang);
}

/** Ҳамаи элементҳои data-i18n-ро бо забони ҷорӣ пур мекунад. */
function applyI18n(root) {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope || !scope.querySelectorAll) return;

  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.innerHTML = t(el.getAttribute('data-i18n'));
  });
  scope.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
  scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });

  if (typeof document !== 'undefined') {
    if (document.documentElement) document.documentElement.lang = LANG === 'ru' ? 'ru' : 'tg';
    document.title = t('doc.title');
    document.querySelectorAll('[data-lang-btn]').forEach((b) => {
      const on = b.getAttribute('data-lang-btn') === LANG;
      b.classList.toggle('active', on);
      // Ҳолати ARIA бояд ҳамроҳи класс нав шавад — вагарна screen reader
      // пас аз иваз кардани забон ҳанӯз забони кӯҳнаро эълон мекунад.
      b.setAttribute('aria-pressed', String(on));
    });
  }
}

if (typeof window !== 'undefined') {
  window.I18N = I18N;
  window.t = t;
  window.L = L;
  window.setLang = setLang;
  window.getLang = getLang;
  window.applyI18n = applyI18n;
}
if (typeof module !== 'undefined') module.exports = { I18N, t, L, setLang, getLang, applyI18n };
