# UI-SPEC — шартномаи тарроҳӣ / контракт дизайна

Ин файл ягона манбаи ҳақиқат барои кори UI аст. Чор нафар ҳамзамон кор мекунанд
ва ҳар кадом танҳо **як файлро** тағйир медиҳад. Номи класс ва сохтор дар ин ҷо
муайян шудаанд — ҳеҷ кас онҳоро худсарона иваз намекунад.

---

## 0. Соҳибии файлҳо (МУҲИМ)

| Соҳиб | Файл | Ҳуқуқ |
|---|---|---|
| A | `style.css` | ТАНҲО ин файл |
| B | `index.html` | ТАНҲО ин файл |
| C | `app.js` | ТАНҲО ин файл |
| D | `test/ui.test.js`, `i18n.js` | файли нав + калидҳои нави тарҷума |

Ҳеҷ кас файли дигарро нахонда тағйир намедиҳад. Агар ба шумо калиди нави
тарҷума лозим бошад — онро дар ҳисоботи худ нависед, D илова мекунад.

---

## 1. Самти тарроҳӣ

Ҳоло: неони шишагин, дурахши зиёд, контрасти паст.
Мақсад: **ҷиддӣ, оромтар, хонотар** — намуди асбоби касбии таълимӣ,
на бозии кӯдакона. Мавзӯи торик мемонад (дар проектори синфхона беҳтар аст).

Қоидаҳо:
- Дурахш (glow) кам — танҳо ҳамчун аксент, на дар ҳар унсур.
- Контраст: матни асосӣ ≥ 7:1, матни дуюмдараҷа ≥ 4.5:1 нисбат ба замина.
- Иерархияи типографӣ равшан: як ҳаҷми калон дар саҳифа, боқӣ зина ба зина.
- Ҳаракат кам ва бомаънӣ; `prefers-reduced-motion` ҳатман эҳтиром мешавад.
- Зичии маълумот дар панели муаллим бештар — ӯ 50 донишҷӯро якбора мебинад.

---

## 2. Токенҳо (танҳо A менависад, B ва C истифода мебаранд)

```css
:root {
  /* Замина */
  --bg-0: #0a0d14;   /* сафҳа */
  --bg-1: #111725;   /* корт */
  --bg-2: #1a2234;   /* сатҳи болоӣ: input, chip */
  --bg-3: #232d42;   /* hover */

  /* Марз */
  --line: rgba(255,255,255,0.09);
  --line-strong: rgba(255,255,255,0.16);

  /* Матн */
  --fg: #f1f5f9;        /* асосӣ */
  --fg-muted: #a8b4c8;  /* дуюмдараҷа — контрасти кофӣ дорад */
  --fg-dim: #7c8aa3;    /* сеюмдараҷа */

  /* Аксентҳо */
  --brand: #4f7cff;
  --brand-soft: rgba(79,124,255,0.14);
  --ok: #22c55e;   --ok-soft: rgba(34,197,94,0.14);
  --bad: #ef4444;  --bad-soft: rgba(239,68,68,0.14);
  --warn: #f59e0b; --warn-soft: rgba(245,158,11,0.14);

  /* Фазо — зинаи 4px */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px;
  --s5: 24px; --s6: 32px; --s7: 48px;

  /* Радиус */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-full: 999px;

  /* Сояҳо */
  --shadow-1: 0 1px 2px rgba(0,0,0,.4);
  --shadow-2: 0 4px 16px rgba(0,0,0,.35);
  --shadow-3: 0 12px 32px rgba(0,0,0,.45);

  /* Ҳаракат */
  --t-fast: 120ms cubic-bezier(.4,0,.2,1);
  --t-base: 200ms cubic-bezier(.4,0,.2,1);
}
```

Токенҳои кӯҳна (`--bg-primary`, `--accent-indigo`, `--text-main`, `--radius-lg`,
`--transition` ва ғ.) бояд **нигоҳ дошта шаванд** ҳамчун alias ба токенҳои нав,
то ҳеҷ чиз накафад.

---

## 3. Ҳолати фокус (ҳатмӣ, дар ҳама ҷо)

```css
:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
  border-radius: var(--r-sm);
}
```

Ҳеҷ гоҳ `outline: none` бе ивазкунанда.

---

## 4. Классҳои шартномавӣ

Инҳо аллакай вуҷуд доранд ва **ном иваз намешаванд** — танҳо намуди онҳо
беҳтар мешавад:

`glass-card` · `btn` `btn-primary` `btn-secondary` `btn-success` `btn-danger` `btn-sm`
`input-field` `form-group` `field-hint` · `role-card` `role-cards`
`seg-control` · `participants-grid` `participant-chip` `participant-avatar`
`option-btn` `option-badge` `options-grid` · `host-options` `host-option`
`host-option-bar` `host-option-count` `correct-tag`
`answer-status` (+ `pending` `good` `bad` `neutral`) · `explanation-box`
`admin-panel` `panel-title` `panel-subtitle` `stat-row` `stat-tile` `stat-value`
`stat-label` `dist-box` `dist-row` `dist-bar` `monitor-table` `monitor-wrap`
`chip` (+ `ok` `bad` `picked` `waiting`) · `timer-box` `progress-bar-fill`
`podium-step` `ranking-table` `report-table` `qdot` `rank-badge` `my-result-card`
`toast` `toast-stack` · `lang-switch` `top-tools` `sound-toggle` `lock-badge`
`room-code-badge` `copy-link-btn` `conn-state` `spinner` `live-dot` `kick-btn`
`question-counter` `category-tag` `code-block` `question-title` `waiting-note`

**Классҳои НАВ, ки ҳар се тараф истифода мебаранд** (B онҳоро дар HTML мегузорад,
A стил менависад, C дар рендери динамикӣ):

| Класс | Маъно |
|---|---|
| `.u-visually-hidden` | танҳо барои screen reader |
| `.timer-box.is-urgent` | вақт < 6 сония — ранги хатар, пулс |
| `.option-btn.is-locked` | ҷавоб дода шуд, интизори REVEAL |
| `.host-option.is-top` | вариантеро, ки бештар интихоб кардаанд |
| `.stat-tile.is-alert` | нишондиҳанда диққат мехоҳад |
| `.skeleton` | ҷойгоҳи боркунӣ |
| `.empty-state` | ҳолати холӣ бо матн ва аломат |
| `.badge` (+ `badge-ok` `badge-bad` `badge-muted`) | нишонаи хурди ҳолат |
| `.card-section` | блоки дохилии корт бо сарлавҳа |
| `.toolbar` | сатри тугмаҳо |

---

## 5. Дастрасӣ (A11y) — ҳатмӣ

- `#timer-display` → `aria-live="off"`, вале матни `#answer-status` →
  волидайн `aria-live="polite"`.
- `#toast-stack` → `role="status"` `aria-live="polite"`.
- Тугмаҳои вариант → `<button>` бо `aria-pressed` ҳангоми интихоб.
- `#options-grid` → `role="group"` бо `aria-label`.
- Ҳар тасвири зиннатӣ (эмодзи) → `aria-hidden="true"`.
- Ҳар `input` → `<label for=...>` (аллакай ҳаст, тафтиш кунед).
- Забон: `<html lang>` аллакай аз i18n идора мешавад.
- Ҳадди ақали ҳаҷми ҳадафи ламс: **44×44px** дар мобилӣ.

---

## 6. Мобилӣ

- Синфхона = телефон дар дасти донишҷӯ. Тугмаҳои вариант бояд калон,
  дар нимаи поёни экран дастрас бошанд.
- Ягон горизонталӣ скролл дар ягон паҳно.
- Нуқтаҳои канорӣ: 480px, 768px, 1024px.
- Панели муаллим дар мобилӣ зери савол меафтад, на дар паҳлу.

---

## 7. Чизҳое, ки НАБОЯД вайрон шаванд

- Ҳамаи `id`-ҳои мавҷуда (app.js аз рӯи онҳо кор мекунад).
- Атрибутҳои `data-i18n`, `data-i18n-ph`, `data-i18n-title`, `data-lang-btn`,
  `data-val` — ҳатман дар ҷои худ мемонанд.
- Тартиби скриптҳо дар `<head>`.
- 170 тести мавҷуда бояд сабз монанд: `npm test`.
