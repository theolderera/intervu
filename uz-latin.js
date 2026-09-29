/**
 * Ўзбекча: кирилл → лотин
 * Узбекский: кириллица → латиница
 *
 * Чаро ин файл ҳаст:
 *   Матни ӯзбекӣ дар лоиҳа ТАНҲО бо кирилл нигоҳ дошта мешавад (`uz`).
 *   Лотин (`uzl`) аз ҳамон матн худкор ҳосил мешавад. Ин маънои онро дорад,
 *   ки ду алифбо ҳеҷ гоҳ аз ҳам намераванд: як тарҷума — ду навишт.
 *
 * Стандарти лотини ӯзбекӣ (2019): ў → oʻ, ғ → gʻ, ъ → ʼ
 * Ҳарфҳои модификатор (U+02BB ва U+02BC) истифода мешаванд, на апостроф.
 */
'use strict';

const OQ = 'ʻ'; // ʻ — барои oʻ ва gʻ
const TUT = 'ʼ'; // ʼ — тутуқ белгиси

/* Ҳарфҳои дуҳарфа аввал меоянд — тартиб муҳим аст. */
const MAP = {
  'ё': 'yo', 'ж': 'j', 'ч': 'ch', 'ш': 'sh', 'ю': 'yu', 'я': 'ya', 'ц': 's',
  'ў': 'o' + OQ, 'ғ': 'g' + OQ, 'қ': 'q', 'ҳ': 'h',
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'з': 'z',
  'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'x',
  'ъ': TUT, 'ь': '', 'э': 'e', 'ы': 'i',
  'Ё': 'Yo', 'Ж': 'J', 'Ч': 'Ch', 'Ш': 'Sh', 'Ю': 'Yu', 'Я': 'Ya', 'Ц': 'S',
  'Ў': 'O' + OQ, 'Ғ': 'G' + OQ, 'Қ': 'Q', 'Ҳ': 'H',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'З': 'Z',
  'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
  'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'X',
  'Ъ': TUT, 'Ь': '', 'Э': 'E', 'Ы': 'I'
};

const IS_CYR = /[Ѐ-ӿ]/;
const IS_LETTER = /[Ѐ-ӿʻʼA-Za-z]/;

/**
 * Калимаҳое, ки қоидаи умумӣ онҳоро нодуруст мегардонад.
 * Калид — кирилл (бо ҳарфи хурд), қимат — лотини дуруст.
 */
const OVERRIDES = {
  'цикл': 'sikl',
  'циклар': 'sikllar',
  'циклни': 'siklni',
  'функция': 'funksiya',
  'функциялар': 'funksiyalar',
  'функцияни': 'funksiyani',
  'функциянинг': 'funksiyaning',
  'конструкция': 'konstruksiya',
  'операция': 'operatsiya',
  'операциялар': 'operatsiyalar',
  'информация': 'informatsiya',
  'инициализация': 'initsializatsiya',
  'компиляция': 'kompilyatsiya',
  'компилятор': 'kompilyator',
  'компиляторнинг': 'kompilyatorning',
  'директива': 'direktiva',
  'позиция': 'pozitsiya',
  'функционал': 'funksional'
};

/**
 * Танҳо ҳарфҳои кириллиро иваз мекунад.
 * Ҳар чизи дигар — код, рақам, аломат, теги HTML, {ҷойгузор}, эмодзи —
 * даст нахӯрда мемонад.
 */
function transliterateWord(word) {
  const low = word.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(OVERRIDES, low)) {
    const out = OVERRIDES[low];
    // Ҳолати ҳарфро нигоҳ медорем: Цикл → Sikl, ЦИКЛ → SIKL
    if (word === word.toUpperCase() && word !== low) return out.toUpperCase();
    if (word[0] === word[0].toUpperCase()) return out[0].toUpperCase() + out.slice(1);
    return out;
  }

  // Агар дар калима ҳарфи кириллие бошад, ки ба алифбои ӯзбекӣ дохил нест
  // (масалан ҷ, ӣ, ӯ-и тоҷикӣ), ин калима иқтибоси бегона аст — масалан
  // матне, ки барнома айнан чоп мекунад. Онро НИМА табдил додан хато мешуд,
  // бинобар ин пурра бетағйир мемонад.
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (IS_CYR.test(ch) && MAP[ch] === undefined) return word;
  }

  let res = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const mapped = MAP[ch];
    if (mapped === undefined) { res += ch; continue; }

    // «е» дар аввали калима ё пас аз ҳарфи садонок → «ye»
    if (ch === 'е' || ch === 'Е') {
      const prev = i > 0 ? word[i - 1] : '';
      const atStart = i === 0;
      const afterVowel = /[аеёиоуўэюяАЕЁИОУЎЭЮЯ]/.test(prev);
      const afterSign = prev === 'ъ' || prev === 'ь' || prev === 'Ъ' || prev === 'Ь';
      if (atStart || afterVowel || afterSign) {
        res += (ch === 'Е' ? 'Ye' : 'ye');
        continue;
      }
    }
    res += mapped;
  }

  // Калимаи пурра бо ҳарфи калон: ш → Sh нодуруст аст, SH лозим.
  // (ʻ ва ʼ ҳарфи модификатор буда, ҳолат надоранд — бетағйир мемонанд.)
  if (word === word.toUpperCase() && word !== word.toLowerCase()) {
    return res.toUpperCase();
  }
  return res;
}

/**
 * Матни пурраро мегардонад. Порчаҳои ғайрикириллӣ (код, тегҳо, {n}, эмодзи)
 * ҳамон тавр мемонанд.
 */
function toUzLatin(text) {
  if (text === null || text === undefined) return '';
  const s = String(text);
  if (!IS_CYR.test(s)) return s; // умуман кирилл нест — коре нест

  let out = '';
  let buf = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (IS_LETTER.test(ch)) { buf += ch; continue; }
    if (buf) { out += transliterateWord(buf); buf = ''; }
    out += ch;
  }
  if (buf) out += transliterateWord(buf);
  return out;
}

if (typeof window !== 'undefined') {
  window.toUzLatin = toUzLatin;
  window.UZ_LATIN_OVERRIDES = OVERRIDES;
}
if (typeof module !== 'undefined') module.exports = { toUzLatin, OVERRIDES, OQ, TUT };
