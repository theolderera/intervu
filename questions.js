// Bank of 50 C++ Beginner Quiz Questions (Маҷмӯаи 50 саволи C++ барои навомузон)
const cppQuestions = [
  // --- БАХШИ 1: Асосҳо ва cout (1-10) ---
  {
    id: 1,
    category: "Асосҳои C++ & cout",
    question: "Дар забони C++ кадом функсия барои ба экран баровардани матн истифода мешавад?",
    code: null,
    options: ["cin", "cout", "print", "input"],
    correct: 1,
    explanation: "'std::cout' барои чопи маълумот ба экран истифода мешавад."
  },
  {
    id: 2,
    category: "Асосҳои C++ & cout",
    question: "Барои пайваст кардани китобхонаи стандартии вуруд ва хуруҷ (cin/cout) кадом директива навишта мешавад?",
    code: "#include <...>",
    options: ["<math.h>", "<iostream>", "<string>", "<stdlib.h>"],
    correct: 1,
    explanation: "<iostream> (Input/Output Stream) барои cin ва cout зарур аст."
  },
  {
    id: 3,
    category: "Асосҳои C++ & cout",
    question: "Дар охири аксарияти фармонҳои C++ кадом аломат гузошта мешавад?",
    code: "cout << \"Hello World\"",
    options: [": (ду нуқта)", ". (нуқта)", "; (нуқта-вергул)", ", (вергул)"],
    correct: 2,
    explanation: "Дар забони C++ ҳар як фармон (statement) бояд бо нуқта-вергул (;) хатм шавад."
  },
  {
    id: 4,
    category: "Асосҳои C++ & cout",
    question: "Кадом фармон барои ба сатри нав гузаштан дар C++ истифода мешавад?",
    code: "cout << \"C++\" << ... ;",
    options: ["endl", "new line", "break", "tab"],
    correct: 0,
    explanation: "'std::endl' ё '\\n' курсорро ба сатри нав мебарад."
  },
  {
    id: 5,
    category: "Асосҳои C++ & cout",
    question: "Шарҳи яксатра (comment) дар C++ чӣ тавр навишта мешавад?",
    code: null,
    options: ["<!-- шарҳ -->", "# шарҳ", "// шарҳ", "/* шарҳ"],
    correct: 2,
    explanation: "Ду слэш '//' барои шарҳи яксатра дар C++ хидмат мекунад."
  },
  {
    id: 6,
    category: "Асосҳои C++ & cout",
    question: "Функсияи асосӣ ва нуқтаи оғози иҷрои ҳар як барнома дар C++ кадом аст?",
    code: null,
    options: ["start()", "main()", "init()", "run()"],
    correct: 1,
    explanation: "Ҳамаи барномаҳои C++ аз функсияи 'int main()' оғоз меёбанд."
  },
  {
    id: 7,
    category: "Асосҳои C++ & cout",
    question: "Нармафзори зерин дар экран чиро чоп мекунад?",
    code: "#include <iostream>\nusing namespace std;\nint main() {\n    cout << 5 + 3;\n    return 0;\n}",
    options: ["53", "8", "5+3", "Хатогӣ (Error)"],
    correct: 1,
    explanation: "Ифодаи 5 + 3 ҳисоб карда шуда, натиҷааш 8 чоп мешавад."
  },
  {
    id: 8,
    category: "Асосҳои C++ & cout",
    question: "Оператори пайвасткунии маълумот ба cout кадом аст?",
    code: "cout ... \"Салом\";",
    options: [">>", "<<", "==", "=>"],
    correct: 1,
    explanation: "Оператори insertion '<<' маълумотро ба ҷараёни cout мефиристад."
  },
  {
    id: 9,
    category: "Асосҳои C++ & cout",
    question: "Кадом истилоҳ барои пешгирӣ аз навиштани 'std::' дар пеши cout ва cin истифода мешавад?",
    code: "using namespace ...;",
    options: ["main", "std", "iostream", "system"],
    correct: 1,
    explanation: "'using namespace std;' имкон медиҳад, ки cout ва cin-ро бе 'std::' истифода барем."
  },
  {
    id: 10,
    category: "Асосҳои C++ & cout",
    question: "Маънои фармони 'return 0;' дар охири функсияи main() чист?",
    code: "return 0;",
    options: [
      "Барнома бо муваффақият хатм шуд",
      "Барнома ба аввал меравад",
      "Экрани консолро пок мекунад",
      "Маълумотро нест мекунад"
    ],
    correct: 0,
    explanation: "Қимати 0 ба системаи амалиётӣ хабар медиҳад, ки барнома бе хатогӣ хатм шуд."
  },

  // --- БАХШИ 2: cin ва Тағйирёбандаҳо (11-20) ---
  {
    id: 11,
    category: "cin & Тағйирёбандаҳо",
    question: "Кадом функсия барои хондани маълумот аз клавиатура (вуруд) истифода мешавад?",
    code: null,
    options: ["cout", "cin", "read", "scan"],
    correct: 1,
    explanation: "'std::cin' маълумотро аз клавиатура мехонад."
  },
  {
    id: 12,
    category: "cin & Тағйирёбандаҳо",
    question: "Оператори гирифтани маълумот (extraction operator) барои cin кадом аст?",
    code: "cin ... x;",
    options: ["<<", ">>", "->", "::"],
    correct: 1,
    explanation: "Оператори '>>' маълумотро аз cin гирифта ба тағйирёбанда менависад."
  },
  {
    id: 13,
    category: "cin & Тағйирёбандаҳо",
    question: "Кадом намуди маълумот (data type) барои нигоҳдории ададҳои бутун (целые числа) истифода мешавад?",
    code: "... age = 20;",
    options: ["float", "double", "int", "char"],
    correct: 2,
    explanation: "'int' (integer) барои ададҳои бутун (масалан: -5, 0, 42) истифода мешавад."
  },
  {
    id: 14,
    category: "cin & Тағйирёбандаҳо",
    question: "Кадом намуди маълумот барои нигоҳдории ададҳои ҳақиқӣ бо нуқтаи аъшорӣ (дробные) истифода мешавад?",
    code: "... price = 15.99;",
    options: ["int", "double", "bool", "char"],
    correct: 1,
    explanation: "'double' ё 'float' барои ададҳои аъшорӣ истифода мешавад."
  },
  {
    id: 15,
    category: "cin & Тағйирёбандаҳо",
    question: "Кадом намуди маълумот барои нигоҳдории як рамз (символ) истифода мешавад?",
    code: "... grade = 'A';",
    options: ["string", "char", "bool", "int"],
    correct: 1,
    explanation: "'char' барои як рамзи дохили нохунакҳои яктагӣ ('A') истифода мешавад."
  },
  {
    id: 16,
    category: "cin & Тағйирёбандаҳо",
    question: "Кадом намуди маълумот танҳо ду қимат дошта метавонад: true ё false?",
    code: "... isStudent = true;",
    options: ["bool", "int", "char", "double"],
    correct: 0,
    explanation: "'bool' (boolean) танҳо 1 (true) ё 0 (false) мегирад."
  },
  {
    id: 17,
    category: "cin & Тағйирёбандаҳо",
    question: "Нармафзори зерин чӣ натиҷа медиҳад?",
    code: "int a = 10;\nint b = 4;\ncout << a / b;",
    options: ["2.5", "2", "2.0", "Хатогӣ"],
    correct: 1,
    explanation: "Тақсими ду адади бутун (int) аъшорро мепартояд: 10 / 4 = 2."
  },
  {
    id: 18,
    category: "cin & Тағйирёбандаҳо",
    question: "Оқибати коди зерин чист?",
    code: "int x;\nx = 5;\nx = x + 3;\ncout << x;",
    options: ["5", "3", "8", "53"],
    correct: 2,
    explanation: "Қимати аввала 5 буд, баъд 3 илова шуд ва 8 гашт."
  },
  {
    id: 19,
    category: "cin & Тағйирёбандаҳо",
    question: "Кадом номи тағйирёбанда дар C++ ҒАЛАТ аст?",
    code: null,
    options: ["myNumber", "_score", "2ndPlace", "total_sum"],
    correct: 2,
    explanation: "Номи тағйирёбанда бо рақам оғоз шуда наметавонад ('2ndPlace' хато аст)."
  },
  {
    id: 20,
    category: "cin & Тағйирёбандаҳо",
    question: "Фармони 'int a, b;' чиро ангезад?",
    code: "int a, b;",
    options: [
      "Эълони ду тағйирёбандаи бутуни a ва b",
      "Ҷамъкунии a ва b",
      "Чоп кардани a ва b",
      "Хатогии синтаксисӣ"
    ],
    correct: 0,
    explanation: "Дар як сатр бо вергул метавон якчанд тағйирёбандаи ҳамнамудро эълон кард."
  },

  // --- БАХШИ 3: Шартҳо if / else ва операторҳо (21-30) ---
  {
    id: 21,
    category: "Шартҳо (if / else)",
    question: "Оператори муқоисавии баробарӣ (эквивалентӣ) дар C++ кадом аст?",
    code: "if (x ... 10)",
    options: ["=", "==", "===", "equals"],
    correct: 1,
    explanation: "'==' барои муқоиса истифода мешавад, аломати '=' бошад барои қиматдиҳӣ."
  },
  {
    id: 22,
    category: "Шартҳо (if / else)",
    question: "Оператори муқоисавии 'НОБАРОБАР' (не равно) дар C++ кадом аст?",
    code: "if (a ... b)",
    options: ["<>", "!=", "not=", "=="],
    correct: 1,
    explanation: "'!=' маънои нобаробар буданро дорад."
  },
  {
    id: 23,
    category: "Шартҳо (if / else)",
    question: "Нармафзори зерин чиро чоп мекунад?",
    code: "int x = 7;\nif (x > 5) {\n    cout << \"Аъло\";\n} else {\n    cout << \"Боб\";\n}",
    options: ["Аъло", "Боб", "Аъло Боб", "Ҳеҷ чиз"],
    correct: 0,
    explanation: "Чун 7 > 5 (true) аст, блоги if иҷро шуда 'Аъло' чоп мешавад."
  },
  {
    id: 24,
    category: "Шартҳо (if / else)",
    question: "Оператори боқимандаи тақсим (остаток от деления) кадом аломат аст?",
    code: "int r = 13 % 5;",
    options: ["/", "%", "#", "&"],
    correct: 1,
    explanation: "Оператори '%' боқимандаро меёбад: 13 % 5 = 3."
  },
  {
    id: 25,
    category: "Шартҳо (if / else)",
    question: "Оператори мантиқии 'ВА' (Логическое И / AND) кадом аст?",
    code: "if (a > 0 ... b > 0)",
    options: ["AND", "&&", "&", "||"],
    correct: 1,
    explanation: "'&&' оператори мантиқии И (AND) мебошад."
  },
  {
    id: 26,
    category: "Шартҳо (if / else)",
    question: "Оператори мантиқии 'Ё' (Логическое ИЛИ / OR) кадом аст?",
    code: "if (x == 1 ... x == 2)",
    options: ["||", "OR", "&&", "|"],
    correct: 0,
    explanation: "'||' оператори мантиқии ИЛИ (OR) мебошад."
  },
  {
    id: 27,
    category: "Шартҳо (if / else)",
    question: "Натиҷаи коди зерин чист?",
    code: "int num = 10;\nif (num % 2 == 0) {\n    cout << \"Ҷуфт\";\n} else {\n    cout << \"Тоқ\";\n}",
    options: ["Тоқ", "Ҷуфт", "10", "0"],
    correct: 1,
    explanation: "10 % 2 == 0 аст (боқиманда 0), бинобар ин 'Ҷуфт' чоп мешавад."
  },
  {
    id: 28,
    category: "Шартҳо (if / else)",
    question: "Вақте ки якчанд шартро пайваста санҷидан хоҳем, кадом сохторро истифода мебарем?",
    code: null,
    options: ["if ... else if ... else", "repeat ... until", "switch ... for", "while ... if"],
    correct: 0,
    explanation: "'else if' имкон медиҳад, ки силсилаи шартҳоро муоина кунем."
  },
  {
    id: 29,
    category: "Шартҳо (if / else)",
    question: "Натиҷаи 15 % 4 чист?",
    code: "cout << 15 % 4;",
    options: ["3", "3.75", "1", "4"],
    correct: 0,
    explanation: "15-ро ба 4 тақсим кунем 3 солим мерасад ва боқиманда 3 мемонад (15 = 4*3 + 3)."
  },
  {
    id: 30,
    category: "Шартҳо (if / else)",
    question: "Агар a = true ва b = false бошад, натиҷаи (a && b) чист?",
    code: "bool a = true, b = false;\ncout << (a && b);",
    options: ["1 (true)", "0 (false)", "Хатогӣ", "undefined"],
    correct: 1,
    explanation: "Дар оператори '&&' агар лоақал як тараф false бошад, натиҷа false (0) мешавад."
  },

  // --- БАХШИ 4: Сиклҳо / Loops (for, while) (31-40) ---
  {
    id: 31,
    category: "Сиклҳо (for & while)",
    question: "Сохтори дурусти сикли 'for' дар C++ кадом аст?",
    code: null,
    options: [
      "for (оғоз; шарт; қадам)",
      "for (шарт; оғоз; қадам)",
      "for (қадам; шарт; оғоз)",
      "loop (1 to 10)"
    ],
    correct: 0,
    explanation: "Синтаксис: for (инициализация; условие; инкремент)."
  },
  {
    id: 32,
    category: "Сиклҳо (for & while)",
    question: "Коди зерин чанд маротиба пайваста 'C++'-ро чоп мекунад?",
    code: "for (int i = 0; i < 5; i++) {\n    cout << \"C++ \";\n}",
    options: ["4 маротиба", "5 маротиба", "6 маротиба", "Беохир"],
    correct: 1,
    explanation: "Индекси i аз 0, 1, 2, 3, 4 мегузарад (ҳамагӣ 5 маротиба)."
  },
  {
    id: 33,
    category: "Сиклҳо (for & while)",
    question: "Ифодаи 'i++' маънои чиро дорад?",
    code: "i++;",
    options: [
      "Қимати i-ро 1 адад зиёд мекунад",
      "Қимати i-ро 2 маротиба зарб мезанад",
      "Қимати i-ро 1 адад кам мекунад",
      "i-ро ба квадрат мебардорад"
    ],
    correct: 0,
    explanation: "'i++' (инкремент) ба тағйирёбанда 1 илова мекунад."
  },
  {
    id: 34,
    category: "Сиклҳо (for & while)",
    question: "Коди зерин чиро чоп мекунад?",
    code: "int sum = 0;\nfor (int i = 1; i <= 3; i++) {\n    sum += i;\n}\ncout << sum;",
    options: ["3", "6", "5", "0"],
    correct: 1,
    explanation: "sum = 1 + 2 + 3 = 6."
  },
  {
    id: 35,
    category: "Сиклҳо (for & while)",
    question: "Сикли 'while' то кай давом мекунад?",
    code: "while (шарт) { ... }",
    options: [
      "То вақте ки шарт ТОСТ (true) аст",
      "Танҳо 1 маротиба",
      "То вақте ки шарт ДУРӮҒ (false) аст",
      "Ҳамеша 10 маротиба"
    ],
    correct: 0,
    explanation: "Сикли while то вақте ки шарт true аст, такрор меёбад."
  },
  {
    id: 36,
    category: "Сиклҳо (for & while)",
    question: "Кадом фармон сиклро фавран МАНЪ (хатм) мекунад?",
    code: null,
    options: ["continue", "break", "exit", "stop"],
    correct: 1,
    explanation: "'break' иҷрои сиклро дарҳол мебурад."
  },
  {
    id: 37,
    category: "Сиклҳо (for & while)",
    question: "Кадом фармон итератсияи ҷориро гузаронида (skip) ба итератсияи навбатӣ мегузарад?",
    code: null,
    options: ["break", "continue", "skip", "next"],
    correct: 1,
    explanation: "'continue' боқимондаи бадани сиклро гузаронида ба қадами навбатӣ меравад."
  },
  {
    id: 38,
    category: "Сиклҳо (for & while)",
    question: "Нармафзори зерин чиро чоп мекунад?",
    code: "int i = 5;\nwhile (i > 2) {\n    cout << i << \" \";\n    i--;\n}",
    options: ["5 4 3 ", "5 4 3 2 ", "2 3 4 5 ", "5 5 5 "],
    correct: 0,
    explanation: "i=5 (чоп 5), i=4 (чоп 4), i=3 (чоп 3), i=2 (шарт 2>2 false мешавад ва сикл меистад)."
  },
  {
    id: 39,
    category: "Сиклҳо (for & while)",
    question: "Фарқияти сикли 'do-while' аз 'while' дар чист?",
    code: "do { ... } while (шарт);",
    options: [
      "Бадани сикл лоақал 1 маротиба ҳаракат мекунад, ҳатто агар шарт false бошад",
      "do-while зудтар кор мекунад",
      "do-while шарт надорад",
      "Ҳеҷ фарқият надорад"
    ],
    correct: 0,
    explanation: "Дар do-while шарт дар охир санҷида мешавад, бинобар ин бадани сикл лоақал 1 бор иҷро мешавад."
  },
  {
    id: 40,
    category: "Сиклҳо (for & while)",
    question: "Сикли беохир (infinite loop) кадом аст?",
    code: null,
    options: [
      "for (;;)",
      "while (true)",
      "for (int i=0; i>=0; i++)",
      "Ҳамаи посухҳои боло дурустанд"
    ],
    correct: 3,
    explanation: "Ҳамаи ин сохторҳо агар шарти баромад надошта бошанд, сикли беохир эҷод мекунанд."
  },

  // --- БАХШИ 5: Массивҳо / Arrays (41-50) ---
  {
    id: 41,
    category: "Массивҳо (Arrays)",
    question: "Индексгузории элементҳо дар массиви C++ аз кадом рақам оғоз меёбад?",
    code: "int arr[5];",
    options: ["1", "0", "-1", "Кадом рақаме хоҳем"],
    correct: 1,
    explanation: "Индекси аввалин элементи массив дар C++ ҳамеша 0 мебошад."
  },
  {
    id: 42,
    category: "Массивҳо (Arrays)",
    question: "Чӣ тавр массиви бутуни иборат аз 5 элемент эълон карда мешавад?",
    code: null,
    options: [
      "int numbers[5];",
      "array numbers = 5;",
      "int numbers = [5];",
      "numbers(5) int;"
    ],
    correct: 0,
    explanation: "Синтаксиси стандартӣ: datatype name[size];"
  },
  {
    id: 43,
    category: "Массивҳо (Arrays)",
    question: "Чӣ тавр ба элементи АВВАЛИНИ массиви 'numbers' муроҷиат мекунем?",
    code: "int numbers[5] = {10, 20, 30, 40, 50};",
    options: ["numbers[1]", "numbers[0]", "numbers.first()", "numbers(0)"],
    correct: 1,
    explanation: "'numbers[0]' элементи аввалинро (10) бармегардонад."
  },
  {
    id: 44,
    category: "Массивҳо (Arrays)",
    question: "Дар массиви зерин элементи 'numbers[3]' ба кадом рақам баробар аст?",
    code: "int numbers[] = {4, 8, 15, 16, 23, 42};",
    options: ["15", "16", "23", "8"],
    correct: 1,
    explanation: "Индексҳо: [0]=4, [1]=8, [2]=15, [3]=16."
  },
  {
    id: 45,
    category: "Массивҳо (Arrays)",
    question: "Чӣ тавр ба элементи ОХИРИНИ массиви иборат аз N элемент муроҷиат карда мешавад?",
    code: "int arr[N];",
    options: ["arr[N]", "arr[N-1]", "arr[N+1]", "arr[0]"],
    correct: 1,
    explanation: "Чун индексҳо аз 0 оғоз меёбанд, элементи охирин дар индекси N-1 ҷойгир аст."
  },
  {
    id: 46,
    category: "Массивҳо (Arrays)",
    question: "Коди зерин чиро дар экран чоп мекунад?",
    code: "int arr[3] = {5, 10, 15};\narr[1] = 99;\ncout << arr[1];",
    options: ["10", "99", "5", "15"],
    correct: 1,
    explanation: "Қимати элементи дуюм (индекси 1) ба 99 тағйир дода шуд ва чоп гардид."
  },
  {
    id: 47,
    category: "Массивҳо (Arrays)",
    question: "Нармафзори зерин кадом корро иҷро мекунад?",
    code: "int a[4] = {1, 2, 3, 4};\nfor (int i = 0; i < 4; i++) {\n    cout << a[i] << \" \";\n}",
    options: [
      "Ҳамаи элементҳои массивро ба тартиб чоп мекунад",
      "Танҳо элементи аввалро чоп мекунад",
      "Массивро чаппа (реверс) чоп мекунад",
      "Хатогӣ медиҳад"
    ],
    correct: 0,
    explanation: "Сикли for ҳамаи индексҳоро аз 0 то 3 тай карда элементҳоро чоп мекунад: 1 2 3 4."
  },
  {
    id: 48,
    category: "Массивҳо (Arrays)",
    question: "Агар массивро чунин эълон кунем: 'int scores[10] = {5, 8};', бақияи элементҳо кадом қиматро мегиранд?",
    code: "int scores[10] = {5, 8};",
    options: [
      "Бо 0 (нол) пур мешаванд",
      "Рақамҳои тасодуфӣ (Garbage values)",
      "Бо 5 пур мешаванд",
      "Хатогӣ рӯй медиҳад"
    ],
    correct: 0,
    explanation: "Вақте массив қисман инициализация мешавад, элементҳои боқимонда 0 мегиранд."
  },
  {
    id: 49,
    category: "Массивҳо (Arrays)",
    question: "Ҳосили коди зерин чист?",
    code: "int arr[3] = {10, 20, 30};\ncout << arr[0] + arr[2];",
    options: ["30", "40", "60", "102030"],
    correct: 1,
    explanation: "arr[0] = 10 ва arr[2] = 30. Ҳосили ҷамъ 10 + 30 = 40."
  },
  {
    id: 50,
    category: "Массивҳо (Arrays)",
    question: "Оператори 'sizeof(arr) / sizeof(arr[0])' чиро ҳисоб мекунад?",
    code: "int count = sizeof(arr) / sizeof(arr[0]);",
    options: [
      "Шумораи умумии элементҳои массивро",
      "Ҳаҷми хотира дар байтҳо",
      "Қимати калонтарини массивро",
      "Суммаи элементҳоро"
    ],
    correct: 0,
    explanation: "Размери умумии массив дар байтҳо бар размери як элемент тақсим шуда шумораи элементҳоро медиҳад."
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = cppQuestions;
}
