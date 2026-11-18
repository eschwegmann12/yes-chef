/* Yes, Chef: turns plain recipe text ("1 1/2 cups rice, rinsed") into
   amounts, units, grocery names and aisles. Used by app.js. */
(function (root) {
  'use strict';
  var AISLES = { produce: 'Produce', meat: 'Meat & seafood', dairy: 'Dairy & eggs', bakery: 'Bakery', pantry: 'Pantry', frozen: 'Frozen', spices: 'Spices', other: 'Other' };
  var AISLE_KEYS = Object.keys(AISLES);
  var UNITS = {};
  [['lb', 'lb lbs pound pounds'], ['oz', 'oz ounce ounces'], ['cup', 'cup cups'], ['tbsp', 'tbsp tbsps tbs tablespoon tablespoons'],
   ['tsp', 'tsp tsps teaspoon teaspoons'], ['clove', 'clove cloves'], ['can', 'can cans'], ['jar', 'jar jars'], ['pint', 'pint pints'],
   ['quart', 'quart quarts qt'], ['head', 'head heads'], ['bunch', 'bunch bunches'], ['slice', 'slice slices'], ['stalk', 'stalk stalks'],
   ['sprig', 'sprig sprigs'], ['stick', 'stick sticks'], ['pkg', 'pkg pkgs package packages pack packs bag bags box boxes'],
   ['block', 'block blocks'], ['pinch', 'pinch pinches'], ['dash', 'dash dashes'], ['g', 'g gram grams'], ['kg', 'kg kilogram kilograms'],
   ['ml', 'ml milliliter milliliters'], ['l', 'liter liters litre litres']
  ].forEach(function (p) { p[1].split(' ').forEach(function (a) { UNITS[a] = p[0]; }); });
  var UNIT_PL = { cup: 'cups', clove: 'cloves', can: 'cans', jar: 'jars', pint: 'pints', quart: 'quarts', head: 'heads', bunch: 'bunches', slice: 'slices', stalk: 'stalks', sprig: 'sprigs', stick: 'sticks', pkg: 'pkgs', block: 'blocks', pinch: 'pinches', dash: 'dashes' };
  var VF = { '½': .5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': .25, '¾': .75, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875, '⅕': .2 };

  var RULES = [
    ['frozen', /\bfrozen\b|\bice cream/],
    ['spices', /\b(\w+ powder|seasoning|cumin|paprika|cinnamon|nutmeg|turmeric|cayenne|chili flakes|pepper flakes|bay lea|sesame seed|peppercorn|allspice|garam masala|za'atar|salt\b|black pepper|white pepper|ground ginger|dried (oregano|thyme|basil|rosemary|dill|parsley|herbs)|oregano|smoked paprika|chili powder|curry powder)/],
    ['pantry', /\b(broth|stock|bouillon|crushed tomato|diced tomato|tomato sauce|tomato paste|marinara|coconut milk|coconut cream|peanut butter|breadcrumb|panko|tortilla chip|sun-dried|fish sauce|soy sauce|egg noodle|canned)/],
    ['produce', /\b(green bean|bell pepper|jalape|poblano|serrano|butter lettuce|lettuce|green onion|scallion|sweet potato|bean sprout|snap pea|snow pea|cherry tomato|garlic|ginger|eggplant|tofu)/],
    ['bakery', /\b(tortilla|pita|bun\b|buns\b|bread|baguette|roll\b|rolls\b|naan|bagel|croissant|ciabatta|english muffin|flatbread|wrap|sourdough|brioche)/],
    ['pantry', /\b(sauce|salsa|paste|ketchup|mustard|mayo|mayonnaise|vinegar|oil|honey|syrup|sugar|flour|cornstarch|baking|rice|pasta|spaghetti|penne|linguine|fettuccine|rigatoni|orzo|noodle|macaroni|ramen|gnocchi|lentil|quinoa|couscous|oat|bean|chickpea|pesto|pickle|olive|caper|chip|nut|almond|walnut|pecan|cashew|peanut|raisin|tuna|teriyaki|sriracha|worcestershire|cocoa|chocolate|vanilla|yeast|cracker|cereal|stuffing|jam|jelly|molasses|wine|beer|tahini|hummus)/],
    ['dairy', /\b(milk|buttermilk|cream|cheese|cheddar|mozzarella|parmesan|feta|cotija|ricotta|butter|yogurt|eggs?\b|half and half|half-and-half|tzatziki|gruyere|provolone|monterey|pepper jack|queso|ghee|creme fraiche|cottage|american cheese)/],
    ['meat', /\b(chicken|beef|steak|pork|sausage|bacon|turkey|ham\b|lamb|shrimp|salmon|fish|tilapia|cod\b|halibut|scallop|crab|lobster|prosciutto|chorizo|ground|meatball|sirloin|flank|chuck|ribeye|tenderloin|brisket|pepperoni|salami|hot dog|bratwurst|veal|duck|mahi|trout)/],
    ['produce', /\b(onion|shallot|leek|lemon|lime|orange|apple|banana|berr|grape|melon|peach|pear|mango|pineapple|avocado|tomato|potato|carrot|celery|spinach|kale|arugula|cabbage|slaw|broccoli|cauliflower|zucchini|squash|cucumber|pepper|mushroom|corn|cilantro|parsley|basil|mint|dill|rosemary|thyme|chive|herb|green|sprout|asparagus|pea\b|peas\b|radish|beet|pico de gallo|salad|fruit|cherr|plum|fig\b|kiwi|bok choy|fennel|artichoke|okra|turnip|parsnip|jicama|tomatillo)/]
  ];

  function findAisle(word) {
    var w = String(word || '').toLowerCase().trim();
    if (!w) return null;
    if (AISLES[w]) return w;
    var alias = { seafood: 'meat', 'meat & seafood': 'meat', 'meat and seafood': 'meat', eggs: 'dairy', 'dairy & eggs': 'dairy', bread: 'bakery', spice: 'spices', canned: 'pantry', freezer: 'frozen', veg: 'produce', vegetables: 'produce', fruit: 'produce' };
    if (alias[w]) return alias[w];
    for (var k in AISLES) if (AISLES[k].toLowerCase() === w || k.indexOf(w) === 0) return k;
    return null;
  }

  function guessAisle(name, unit) {
    if (unit === 'can' || unit === 'jar') return 'pantry';
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(name)) return RULES[i][0];
    if (unit === 'head' || unit === 'bunch' || unit === 'clove' || unit === 'stalk' || unit === 'sprig') return 'produce';
    return 'other';
  }

  function singular(w) {
    if (/(ss|us|is|ous)$/.test(w) || w.length < 4) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (/(tomato|potato|mango)es$/.test(w)) return w.slice(0, -2);
    if (/(ch|sh|x)es$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function plural(w) {
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
    if (/(tomato|potato|mango)$/.test(w)) return w + 'es';
    if (/(ch|sh|x|s)$/.test(w)) return w + 'es';
    return w + 's';
  }
  function lastWord(s, fn) { var m = s.match(/^(.*?)(\S+)$/); return m ? m[1] + fn(m[2]) : s; }

  function readNum(s) {
    var m = s.match(/^(\d+)\s+(\d+)\/(\d+)/); if (m && +m[3]) return [+m[1] + m[2] / m[3], s.slice(m[0].length)];
    m = s.match(/^(\d+)\/(\d+)/); if (m && +m[2]) return [m[1] / m[2], s.slice(m[0].length)];
    m = s.match(/^(\d*\.?\d+)/); if (m) return [+m[1], s.slice(m[0].length)];
    return [null, s];
  }

  function parseLine(raw) {
    var s = String(raw || '').replace(/^[\s•●▪▢□☐◻·*\-–—>]+/, '').trim();
    if (!s || /^(for the|ingredients:?$)/i.test(s) || /:$/.test(s)) return null;
    var aisle = null, ov = s.match(/\s*\[([^\]]+)\]\s*$/);
    if (ov) { var k = findAisle(ov[1]); if (k) { aisle = k; s = s.slice(0, ov.index).trim(); } }
    var t = s.replace(/⁄/g, '/').replace(/(\d)?\s*([½⅓⅔¼¾⅛⅜⅝⅞⅕])/g, function (m, d, f) { return String((d ? +d : 0) + VF[f]); });
    t = t.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    var q = null, u = '', rest, r = readNum(t);
    if (r[0] != null) {
      q = r[0]; rest = r[1].trim();
      var rg = rest.match(/^(?:-|–|to)\s*/);
      if (rg) { var r2 = readNum(rest.slice(rg[0].length)); if (r2[0] != null) { q = r2[0]; rest = r2[1].trim(); } }
    } else {
      var a = t.match(/^(a|an)\s+/i); if (a) { q = 1; rest = t.slice(a[0].length); } else rest = t;
    }
    var w = rest.match(/^([a-zA-Z]+)\.?(\s+|$)/);
    if (q != null && w && UNITS[w[1].toLowerCase()]) { u = UNITS[w[1].toLowerCase()]; rest = rest.slice(w[0].length); }
    rest = rest.replace(/^of\s+/i, '');
    var parts = rest.split(','), name = parts.shift().trim(), note = parts.join(',').trim();
    var tail = name.match(/\s+(to taste|as needed|for (serving|garnish|drizzling|topping)|optional)\b.*$/i);
    if (tail) { note = (tail[0].trim() + (note ? ', ' + note : '')); name = name.slice(0, tail.index).trim(); }
    name = name.replace(/\b(extra[- ]large|large|medium|small)\s+/gi, '').trim() || name;
    var key = name.toLowerCase();
    if (!u) key = lastWord(key, singular);
    if (!key) return null;
    return { q: q, u: u, name: key, note: note, aisle: aisle || guessAisle(key, u) };
  }

  var FR = [[0, ''], [.125, '⅛'], [.25, '¼'], [1 / 3, '⅓'], [.5, '½'], [2 / 3, '⅔'], [.75, '¾'], [1, '']];
  function fmt(q) {
    if (q >= 10) return String(Math.round(q));
    var w = Math.floor(q + 1e-6), f = q - w, best = FR[0];
    FR.forEach(function (x) { if (Math.abs(f - x[0]) < Math.abs(f - best[0])) best = x; });
    if (best[0] === 1) w++;
    return ((w ? w : '') + best[1]) || '⅛';
  }
  function show(q, u, name, note) {
    var s;
    if (q != null) {
      var many = q > 1.01;
      s = fmt(q) + ' ' + (u ? (many ? (UNIT_PL[u] || u) : u) + ' ' : '') + (!u && many ? lastWord(name, plural) : name);
    } else s = name;
    return note ? s + ', ' + note : s;
  }

  function parseSteps(text) {
    var lines = String(text || '').split(/\r?\n/);
    if (lines.length === 1 && lines[0].indexOf(';') > -1) lines = lines[0].split(';');
    return lines.map(function (l) { return l.replace(/^[\s•●▪·*\-–—]+/, '').replace(/^(step\s*)?\d+\s*[\.\):\-]\s*/i, '').trim(); }).filter(Boolean);
  }
  function splitIngredients(text) {
    var lines = String(text || '').split(/\r?\n/);
    if (lines.length === 1 && lines[0].indexOf(';') > -1) lines = lines[0].split(';');
    return lines;
  }
  function parseTags(text) {
    var seen = {}, out = [];
    String(text || '').split(/[,;]/).forEach(function (t) {
      t = t.trim(); if (!t) return;
      t = t.charAt(0).toUpperCase() + t.slice(1);
      var k = t.toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(t); }
    });
    return out;
  }

  var COLOR_RULES = [
    [/tomato|marinara|salsa|bbq|chorizo|beet|red pepper|strawberr/, 'e63946'], [/salmon|shrimp|crab|lobster/, 'f28482'],
    [/beef|steak|sausage|pork|mushroom|brisket|lamb|turkey|chocolate/, '7f4f24'], [/chicken|tofu|cauliflower/, 'e9c46a'],
    [/spinach|kale|basil|pesto|broccoli|green bean|zucchini|pea|asparagus|parsley|cilantro|lettuce/, '6a994e'],
    [/avocado|cucumber|lime|green onion|scallion/, 'a7c957'], [/carrot|sweet potato|curry|squash|pumpkin|orange|bell pepper/, 'f4a261'],
    [/cheddar|cheese|corn|lemon|egg|pineapple/, 'f6bd60'], [/black bean|olive|sesame|soy/, '2b2d42'], [/cabbage|red onion|eggplant/, '9d4edd'],
    [/rice|orzo|pasta|spaghetti|noodle|potato|tortilla|pita|bun|bread|gnocchi|cream|feta|mozzarella/, 'f2e8cf']
  ];
  var FALLBACK = ['e9c46a', '81b29a', 'f4a261', 'e76f51', '2a9d8f', 'f2e8cf'];
  function colorsFor(parsed, seed) {
    var out = [];
    parsed.forEach(function (p) {
      if (out.length >= 3 || !p) return;
      for (var i = 0; i < COLOR_RULES.length; i++) if (COLOR_RULES[i][0].test(p.name)) { var c = COLOR_RULES[i][1]; if (out.indexOf(c) < 0) out.push(c); return; }
    });
    var h = 0; String(seed || '').split('').forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
    while (out.length < 3) { var f = FALLBACK[(h + out.length * 2) % FALLBACK.length]; if (out.indexOf(f) < 0) out.push(f); else h++; }
    return out;
  }

  var api = { AISLES: AISLES, AISLE_KEYS: AISLE_KEYS, parseLine: parseLine, parseSteps: parseSteps, parseTags: parseTags, splitIngredients: splitIngredients, guessAisle: guessAisle, findAisle: findAisle, show: show, fmt: fmt, colorsFor: colorsFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DP = api;
})(this);
