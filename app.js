/* Yes, Chef app: shared recipes, personal weekly plan + grocery list. */
(function () {
  'use strict';
  var C = window.DP_CONFIG || {};
  var P = window.DP;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var LS = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var DEFAULT_TAGS = ['Vegetarian', 'Seafood', 'Low-carb', 'Spicy', 'Freezer-friendly'];

  var configured = C.SUPABASE_URL && C.SUPABASE_KEY && !/PASTE_/.test(C.SUPABASE_URL + C.SUPABASE_KEY);
  var sb = null;
  if (configured && window.supabase) {
    try { sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } }); } catch (e) { sb = null; }
  }

  var USER = null, RECIPES = [], S = norm(), F = 'all', Q = '', M = null, dirty = false, saveTimer = null, confirmNew = false, signup = false, deferredInstall = null;

  function norm(d) { d = d || {}; return { plan: Array.isArray(d.plan) ? d.plan : [], chk: Array.isArray(d.chk) ? d.chk : [], extra: Array.isArray(d.extra) ? d.extra : [] }; }
  var LOGIN_DOMAIN = '@yes-chef.example';
  function handle() { return USER ? (USER.email || '').replace(LOGIN_DOMAIN, '') : ''; }
  function userName() { if (!USER) return ''; var m = USER.user_metadata || {}; return m.name || handle(); }
  function planKey() { return 'dp-plan-' + (USER ? USER.id : 'x'); }

  /* ---------- recipes ---------- */
  function prep(r) {
    var parsed = P.splitIngredients(r.ingredients).map(P.parseLine).filter(Boolean);
    return {
      id: r.id, name: r.name || 'Untitled', minutes: r.minutes || null, servings: Math.max(1, +r.servings || 2),
      tags: P.parseTags(r.tags), ingredients: r.ingredients || '', stepsText: r.steps || '', steps: P.parseSteps(r.steps),
      by: r.added_by_name || '', created: r.created_at, ing: parsed, colors: P.colorsFor(parsed, r.id || r.name), raw: r
    };
  }
  function byId(id) { for (var i = 0; i < RECIPES.length; i++) if (RECIPES[i].id === id) return RECIPES[i]; return null; }
  function inPlan(id) { for (var i = 0; i < S.plan.length; i++) if (S.plan[i].id === id) return S.plan[i]; return null; }
  function allTags() { var seen = {}, out = []; DEFAULT_TAGS.concat.apply(DEFAULT_TAGS.slice(), RECIPES.map(function (r) { return r.tags; })).forEach(function (t) { var k = t.toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(t); } }); return out; }
  function usedTags() { var seen = {}, out = []; RECIPES.forEach(function (r) { r.tags.forEach(function (t) { var k = t.toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(t); } }); }); return out; }
  function meta(r) { return [r.minutes ? r.minutes + ' min' : '', r.tags.slice(0, 2).join(' · ')].filter(Boolean).join(' · '); }

  function hash(s) { var h = 7; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function plate(r) {
    var c = r.colors.map(function (x) { return '#' + x; }), h = hash(r.id || r.name), b = '', k, a, d, x, y;
    for (k = 0; k < 3; k++) {
      a = (h % 360 + k * 120) * Math.PI / 180; d = 12 + (h >> (k * 3)) % 6; x = (50 + Math.cos(a) * d).toFixed(1); y = (50 + Math.sin(a) * d).toFixed(1);
      b += '<ellipse cx="' + x + '" cy="' + y + '" rx="' + (13 + (h >> (k * 4)) % 5) + '" ry="' + (10 + (h >> (k * 5)) % 5) + '" transform="rotate(' + ((h >> (k * 2)) % 180) + ' ' + x + ' ' + y + ')" fill="' + c[k] + '"/>';
    }
    for (k = 0; k < 6; k++) { a = ((h >> k) % 360) * Math.PI / 180 + k * 1.7; d = 5 + k * 4; b += '<circle cx="' + (50 + Math.cos(a) * d).toFixed(1) + '" cy="' + (50 + Math.sin(a) * d).toFixed(1) + '" r="1.7" fill="' + c[(k + 1) % 3] + '"/>'; }
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="53" cy="56" rx="45" ry="43" fill="#000" opacity=".13"/><circle cx="50" cy="50" r="46" fill="#fff"/><circle cx="50" cy="50" r="45.5" fill="none" stroke="#e5ded5"/><circle cx="50" cy="50" r="35" fill="#f6f2ed"/>' + b + '<path d="M19 31a37 37 0 0 1 22-15" stroke="#fff" stroke-width="3" fill="none" opacity=".9" stroke-linecap="round"/></svg>';
  }

  /* ---------- grocery math ---------- */
  function groceries() {
    var m = {}, order = [];
    S.plan.forEach(function (p) {
      var r = byId(p.id); if (!r) return;
      var k = p.sv / r.servings;
      r.ing.forEach(function (g) {
        if (/^(water|ice|ice water|hot water|warm water|cold water)$/.test(g.name)) return;
        var key = g.name + '|' + g.u;
        if (!m[key]) { m[key] = { key: key, q: null, u: g.u, n: g.name, a: g.aisle }; order.push(key); }
        if (g.q != null) m[key].q = (m[key].q || 0) + g.q * k;
      });
    });
    return order.map(function (k) { return m[k]; });
  }
  function leftCount() {
    var chk = {}; S.chk.forEach(function (k) { chk[k] = 1; });
    return groceries().filter(function (x) { return !chk[x.key]; }).length + S.extra.filter(function (x) { return !x.c; }).length;
  }

  /* ---------- rendering ---------- */
  function renderRecipes() {
    var tags = usedTags();
    if (F !== 'all' && F !== 'quick' && tags.indexOf(F) < 0) F = 'all';
    var filters = [['all', 'All'], ['quick', 'Under 30 min']].concat(tags.map(function (t) { return [t, t]; }));
    $('#chips').innerHTML = filters.map(function (f) { return '<button class="chip" data-act="filter" data-f="' + esc(f[0]) + '" aria-pressed="' + (F === f[0]) + '">' + esc(f[1]) + '</button>'; }).join('');
    var q = Q.trim().toLowerCase();
    var list = RECIPES.filter(function (r) {
      var okF = F === 'all' || (F === 'quick' ? r.minutes && r.minutes <= 30 : r.tags.indexOf(F) > -1);
      var okQ = !q || r.name.toLowerCase().indexOf(q) > -1 || r.ingredients.toLowerCase().indexOf(q) > -1;
      return okF && okQ;
    });
    if (!RECIPES.length) { $('#grid').innerHTML = '<div class="empty" style="grid-column:1/-1"><h3>No recipes yet</h3><p>Tap “+ Add recipe” to add your first one.</p></div>'; return; }
    $('#grid').innerHTML = list.length ? list.map(function (r) {
      var on = !!inPlan(r.id);
      return '<article class="card"><button class="open" data-act="open" data-id="' + r.id + '">' + plate(r) + '<h3>' + esc(r.name) + '</h3><div class="meta">' + esc(meta(r)) + '</div></button><button class="btn ' + (on ? 'on' : '') + '" data-act="toggle" data-id="' + r.id + '">' + (on ? 'In this week ✓' : 'Add to week') + '</button></article>';
    }).join('') : '<div class="empty" style="grid-column:1/-1"><h3>No matches</h3><p>Try another search or filter.</p></div>';
  }

  function stepper(id, sv, act) {
    return '<span class="step" role="group" aria-label="Servings"><button data-act="' + act + '" data-id="' + id + '" data-d="-1" aria-label="Fewer servings">−</button><span>' + sv + ' serving' + (sv === 1 ? '' : 's') + '</span><button data-act="' + act + '" data-id="' + id + '" data-d="1" aria-label="More servings">+</button></span>';
  }

  function renderPlan() {
    var rows = S.plan.map(function (p) {
      var r = byId(p.id); if (!r) return '';
      return '<div class="row ' + (p.done ? 'done' : '') + '">' + plate(r) + '<div><h3>' + esc(r.name) + '</h3><div class="meta">' + esc(meta(r)) + '</div></div>' +
        '<div class="acts">' + stepper(r.id, p.sv, 'sv') + '<button class="btn" data-act="open" data-id="' + r.id + '">Cook</button><button class="btn ghost" data-act="done" data-id="' + r.id + '">' + (p.done ? 'Undo' : 'Cooked') + '</button><button class="x" data-act="toggle" data-id="' + r.id + '" aria-label="Remove ' + esc(r.name) + '">×</button></div></div>';
    }).join('');
    $('#plan').innerHTML = rows ? rows + '<p class="note">Change servings and the grocery list updates. Your plan is just yours — recipes are shared.</p>'
      : '<div class="empty"><h3>Nothing planned yet</h3><p>Pick a few dinners and your grocery list builds itself.</p><a class="btn" href="#recipes">Browse recipes</a></div>';
  }

  function renderGro() {
    var g = groceries(), chk = {}; S.chk.forEach(function (k) { chk[k] = 1; });
    var h = '';
    if (!g.length && !S.extra.length) {
      $('#gro').innerHTML = '<div class="empty"><h3>Your list is empty</h3><p>Plan some dinners and the ingredients show up here, sorted by aisle.</p></div>' + addForm();
      return;
    }
    P.AISLE_KEYS.forEach(function (a) {
      var items = g.filter(function (x) { return x.a === a; }).sort(function (x, y) { return ((chk[x.key] ? 1 : 0) - (chk[y.key] ? 1 : 0)) || x.n.localeCompare(y.n); });
      if (!items.length) return;
      h += '<h3 class="aisle">' + P.AISLES[a] + '</h3>' + items.map(function (x) {
        return '<label class="item ' + (chk[x.key] ? 'c' : '') + '"><input type="checkbox" data-act="chk" data-k="' + esc(x.key) + '"' + (chk[x.key] ? ' checked' : '') + '><span>' + esc(P.show(x.q, x.u, x.n)) + '</span></label>';
      }).join('');
    });
    if (S.extra.length) h += '<h3 class="aisle">Also need</h3>' + S.extra.map(function (x, i) {
      return '<label class="item ' + (x.c ? 'c' : '') + '"><input type="checkbox" data-act="xchk" data-i="' + i + '"' + (x.c ? ' checked' : '') + '><span>' + esc(x.n) + '</span><button class="x" data-act="xdel" data-i="' + i + '" aria-label="Remove ' + esc(x.n) + '">×</button></label>';
    }).join('');
    h += addForm() + '<div class="gbar"><button class="btn" data-act="copy">Copy list</button><button class="btn ghost" data-act="uncheck">Uncheck all</button><button class="btn ghost" data-act="newweek">' + (confirmNew ? 'Tap again to clear' : 'Start a new week') + '</button></div><p class="note">Water isn’t listed. Check the pantry before you go.</p>';
    $('#gro').innerHTML = h;
  }
  function addForm() { return '<form class="add" data-act="xadd"><input id="xin" placeholder="Add something else (milk, coffee…)" aria-label="Add grocery item" enterkeyhint="done"><button class="btn" type="submit">Add</button></form>'; }

  function header() {
    var n = S.plan.length, left = leftCount(), a = $('#nPlan'), b = $('#nGro');
    a.hidden = !n; a.textContent = n; b.hidden = !left; b.textContent = left;
    $('#acct').textContent = (userName()[0] || '?').toUpperCase();
  }

  function renderInstall() {
    var box = $('#install');
    var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    if (standalone || LS.get('dp-hide-install')) { box.innerHTML = ''; return; }
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    box.innerHTML = '<div class="install"><div><b>Put Yes, Chef on your home screen</b><div class="mute">' +
      (deferredInstall ? 'Install it like any other app.' : ios ? 'In Safari, tap the Share button, then “Add to Home Screen.”' : 'In your browser menu, choose “Install app” or “Add to Home screen.”') +
      '</div></div>' + (deferredInstall ? '<button class="btn" data-act="install">Install</button>' : '') + '<button class="x" data-act="hideinstall" aria-label="Dismiss">×</button></div>';
  }

  /* ---------- sheets ---------- */
  function openSheet(html) { $('#sheet').innerHTML = html; $('#ov').hidden = false; $('#sheet').scrollTop = 0; document.body.style.overflow = 'hidden'; }
  function closeSheet() { M = null; $('#ov').hidden = true; $('#sheet').innerHTML = ''; document.body.style.overflow = ''; }

  function renderView() {
    var r = byId(M.id); if (!r) { closeSheet(); return; }
    var p = inPlan(r.id), sv = p ? p.sv : M.sv, k = sv / r.servings;
    openSheet('<div class="sh">' + plate(r) + '<div><h2 id="mt">' + esc(r.name) + '</h2><div class="meta">' + esc([r.minutes ? r.minutes + ' min' : ''].concat(r.tags).filter(Boolean).join(' · ')) + '</div></div><button class="x" data-act="close" aria-label="Close">×</button></div>' +
      '<div class="sbar">' + stepper(r.id, sv, 'msv') + (r.by ? '<span class="meta">Added by ' + esc(r.by) + '</span>' : '') + '</div>' +
      '<h3>Ingredients</h3><ul class="ing">' + r.ing.map(function (g) { return '<li>' + esc(P.show(g.q == null ? null : g.q * k, g.u, g.name, g.note)) + '</li>'; }).join('') + '</ul>' +
      (r.steps.length ? '<h3>Steps</h3><ol class="steps">' + r.steps.map(function (s, i) { return '<li data-act="stepdone" data-i="' + i + '" class="' + (M.done[i] ? 'd' : '') + '">' + esc(s) + '</li>'; }).join('') + '</ol><p class="note">Tap a step to cross it off.</p>' : '') +
      '<div class="sbar"><button class="btn ' + (p ? 'on' : '') + '" data-act="toggle" data-id="' + r.id + '">' + (p ? 'In this week ✓' : 'Add to week') + '</button><button class="btn ghost" data-act="edit" data-id="' + r.id + '">Edit recipe</button></div>');
  }

  function renderEdit() {
    var r = M.id ? byId(M.id) : null, cur = {};
    (r ? r.tags : []).forEach(function (t) { cur[t.toLowerCase()] = 1; });
    openSheet('<div class="sh"><span></span><h2 id="mt">' + (r ? 'Edit recipe' : 'New recipe') + '</h2><button class="x" data-act="close" aria-label="Close">×</button></div>' +
      '<form id="rf" class="rf" novalidate>' +
      '<label>Recipe name<input name="name" required maxlength="100" value="' + esc(r ? r.name : '') + '" placeholder="e.g. Grandma’s chili"></label>' +
      '<div class="two"><label>Total time (min)<input name="minutes" type="number" inputmode="numeric" min="1" max="600" value="' + (r && r.minutes ? r.minutes : '') + '" placeholder="30"></label>' +
      '<label>Serves<input name="servings" type="number" inputmode="numeric" min="1" max="20" value="' + (r ? r.servings : 2) + '"></label></div>' +
      '<fieldset><legend>Tags</legend><div class="chips wrap">' + allTags().map(function (t) { return '<button type="button" class="chip" data-act="ftag" data-t="' + esc(t) + '" aria-pressed="' + !!cur[t.toLowerCase()] + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
      '<input name="moretags" placeholder="New tags, separated by commas" aria-label="New tags"></fieldset>' +
      '<label>Ingredients <span class="hint">One per line. You can paste straight from a recipe website.</span><textarea name="ingredients" rows="8" placeholder="1 lb chicken thighs&#10;2 cups jasmine rice&#10;3 cloves garlic, minced&#10;1 can black beans">' + esc(r ? r.ingredients : '') + '</textarea></label>' +
      '<div id="prev" class="prev"></div>' +
      '<label>Steps <span class="hint">One per line.</span><textarea name="steps" rows="7" placeholder="Cook the rice.&#10;Brown the chicken, 6 min per side.">' + esc(r ? r.stepsText : '') + '</textarea></label>' +
      '<p class="msg" id="rfMsg" role="status"></p>' +
      '<div class="sbar" style="margin-top:0"><button class="btn" type="submit" id="rfSave">' + (r ? 'Save changes' : 'Save recipe') + '</button><button class="btn ghost" type="button" data-act="close">Cancel</button>' +
      (r ? '<button class="btn danger" type="button" data-act="del" data-id="' + r.id + '">Delete</button>' : '') + '</div></form>' +
      (r ? '' : '<div class="imp"><h3>Adding a bunch at once?</h3><p>Fill in the spreadsheet template, one recipe per row, save it as CSV, then import it here.</p><div class="sbar"><a class="btn ghost" href="recipe-template.csv" download>Get the template</a><label class="btn ghost">Import CSV<input type="file" accept=".csv,text/csv" id="csv" hidden></label></div><p class="msg" id="impMsg" role="status"></p></div>'));
    preview();
  }

  function preview() {
    var ta = document.querySelector('#rf [name=ingredients]'); if (!ta) return;
    var h = '';
    ta.value.split('\n').forEach(function (l, i) {
      var p = P.parseLine(l); if (!p) return;
      h += '<li><span>' + esc(P.show(p.q, p.u, p.name, p.note)) + '</span><select data-act="aisle" data-line="' + i + '" aria-label="Aisle for ' + esc(p.name) + '">' +
        P.AISLE_KEYS.map(function (k) { return '<option value="' + k + '"' + (k === p.aisle ? ' selected' : '') + '>' + P.AISLES[k] + '</option>'; }).join('') + '</select></li>';
    });
    $('#prev').innerHTML = h ? '<div class="hint">How it’ll appear on the grocery list. Fix any aisle that’s wrong:</div><ul>' + h + '</ul>' : '';
  }

  function renderAccount() {
    openSheet('<div class="sh"><span></span><h2 id="mt">Hi, ' + esc(userName()) + '</h2><button class="x" data-act="close" aria-label="Close">×</button></div>' +
      '<p class="mute">Username: ' + esc(handle()) + '</p><p>Recipes are shared with everyone who has an account. Your weekly plan and grocery list are just yours.</p>' +
      '<div class="menu"><button class="btn ghost" data-act="refresh">Refresh recipes</button><button class="btn danger" data-act="signout">Sign out</button></div>');
  }

  function render() { renderRecipes(); renderPlan(); renderGro(); header(); if (M && M.mode === 'view') renderView(); }

  function show() {
    var v = location.hash.slice(1); if (['recipes', 'plan', 'groceries'].indexOf(v) < 0) v = 'recipes';
    ['recipes', 'plan', 'groceries'].forEach(function (x) { $('#v-' + x).hidden = x !== v; });
    Array.prototype.forEach.call(document.querySelectorAll('.tabs a'), function (a) { if (a.getAttribute('data-v') === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  var toastTimer;
  function toast(m) { var t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2800); }
  function setNet() { $('#net').hidden = navigator.onLine; }

  /* ---------- data sync ---------- */
  function cachePlan() { LS.set(planKey(), { s: S, dirty: dirty }); }
  function save() {
    dirty = true; cachePlan();
    clearTimeout(saveTimer); saveTimer = setTimeout(pushPlan, 600);
  }
  function change() { confirmNew = false; save(); render(); }
  function pushPlan() {
    if (!sb || !USER || !navigator.onLine) return;
    var snapshot = JSON.parse(JSON.stringify(S));
    sb.from('plans').upsert({ user_id: USER.id, data: snapshot, updated_at: new Date().toISOString() }).then(function (res) {
      if (res.error) { toast('Couldn’t sync your plan. It’s saved on this phone.'); return; }
      if (JSON.stringify(S) === JSON.stringify(snapshot)) { dirty = false; cachePlan(); }
    });
  }
  function fetchPlan() {
    if (!sb || !USER) return;
    if (dirty) { pushPlan(); return; }
    sb.from('plans').select('data').eq('user_id', USER.id).maybeSingle().then(function (res) {
      if (res.error || dirty) return;
      if (res.data && res.data.data) { S = norm(res.data.data); cachePlan(); render(); }
    });
  }
  function fetchRecipes(announce) {
    if (!sb || !USER) return;
    sb.from('recipes').select('*').order('created_at', { ascending: false }).order('name').then(function (res) {
      if (res.error) { if (announce) toast('Couldn’t load recipes. Check your connection.'); return; }
      LS.set('dp-recipes', res.data);
      RECIPES = res.data.map(prep);
      var ids = {}; RECIPES.forEach(function (r) { ids[r.id] = 1; });
      var before = S.plan.length; S.plan = S.plan.filter(function (p) { return ids[p.id]; });
      if (S.plan.length !== before) save();
      render(); if (announce) toast('Recipes up to date');
    });
  }

  /* ---------- auth ---------- */
  function showAuth() {
    $('#main').hidden = true; $('#nav').hidden = true; $('#acct').hidden = true; $('#auth').hidden = false;
    $('#authTitle').textContent = signup ? 'Create your account' : 'Welcome back';
    $('#authSub').textContent = signup ? 'Recipes are shared with everyone in your kitchen. Your plan stays yours.' : 'Sign in to see your recipes and this week’s plan.';
    $('#nameRow').hidden = !signup;
    $('#authBtn').textContent = signup ? 'Create account' : 'Sign in';
    $('#authToggle').textContent = signup ? 'Already have an account? Sign in' : 'New here? Create an account';
    document.querySelector('#authForm [name=password]').autocomplete = signup ? 'new-password' : 'current-password';
  }
  function startApp(user) {
    var first = !USER || USER.id !== user.id;
    USER = user;
    $('#auth').hidden = true; $('#main').hidden = false; $('#nav').hidden = false; $('#acct').hidden = false;
    if (first) {
      var cachedR = LS.get('dp-recipes'); RECIPES = Array.isArray(cachedR) ? cachedR.map(prep) : [];
      var cp = LS.get(planKey()); S = norm(cp && cp.s); dirty = !!(cp && cp.dirty);
    }
    show(); render(); renderInstall();
    fetchRecipes(false); fetchPlan();
  }

  /* ---------- CSV import ---------- */
  function parseCSV(t) {
    t = t.replace(/^﻿/, '');
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }
  var HEAD = { name: /^(name|recipe|title|recipe name)$/, minutes: /^(minutes|mins|time|total time|cook time|time \(min\))$/, servings: /^(servings|serves|yield|makes)$/, tags: /^(tags?|category|categories)$/, ingredients: /^ingredients?$/, steps: /^(steps|instructions|directions|method)$/ };
  function importCSV(file) {
    var msg = $('#impMsg'); msg.className = 'msg'; msg.textContent = 'Reading ' + file.name + '…';
    file.text().then(function (txt) {
      var rows = parseCSV(txt); if (rows.length < 2) throw new Error('That file has no recipe rows.');
      var head = rows[0].map(function (h) { return h.trim().toLowerCase(); }), col = {};
      Object.keys(HEAD).forEach(function (k) { col[k] = head.findIndex(function (h) { return HEAD[k].test(h); }); });
      if (col.name < 0 || col.ingredients < 0) throw new Error('The first row needs “name” and “ingredients” columns. Use the template.');
      var cell = function (r, k) { return col[k] > -1 ? (r[col[k]] || '').trim() : ''; };
      var out = rows.slice(1).map(function (r) {
        return { name: cell(r, 'name').slice(0, 100), minutes: parseInt(cell(r, 'minutes'), 10) || null, servings: parseInt(cell(r, 'servings'), 10) || 2,
          tags: P.parseTags(cell(r, 'tags')).join(', '), ingredients: P.splitIngredients(cell(r, 'ingredients')).map(function (s) { return s.trim(); }).filter(Boolean).join('\n'),
          steps: P.parseSteps(cell(r, 'steps')).join('\n'), added_by_name: userName() };
      }).filter(function (r) { return r.name && r.ingredients; });
      if (!out.length) throw new Error('No rows had both a name and ingredients.');
      msg.textContent = 'Importing ' + out.length + ' recipe' + (out.length > 1 ? 's' : '') + '…';
      return sb.from('recipes').insert(out).then(function (res) {
        if (res.error) throw new Error('Import failed: ' + res.error.message);
        msg.className = 'msg ok'; msg.textContent = 'Imported ' + out.length + ' recipe' + (out.length > 1 ? 's' : '') + '.';
        fetchRecipes(false);
      });
    }).catch(function (e) { msg.className = 'msg'; msg.textContent = e.message || 'Couldn’t read that file.'; });
  }

  /* ---------- recipe save ---------- */
  function saveRecipe(form) {
    var msg = $('#rfMsg'), fd = new FormData(form), name = String(fd.get('name') || '').trim(), ing = String(fd.get('ingredients') || '').trim();
    if (!name) { msg.textContent = 'Give the recipe a name.'; return; }
    if (!ing) { msg.textContent = 'Add at least one ingredient.'; return; }
    if (!navigator.onLine) { msg.textContent = 'You’re offline. Recipes can be saved once you’re back online.'; return; }
    var tags = Array.prototype.map.call(form.querySelectorAll('[data-act=ftag][aria-pressed=true]'), function (b) { return b.getAttribute('data-t'); }).concat(P.parseTags(fd.get('moretags')));
    var row = { name: name.slice(0, 100), minutes: parseInt(fd.get('minutes'), 10) || null, servings: Math.min(20, Math.max(1, parseInt(fd.get('servings'), 10) || 2)),
      tags: P.parseTags(tags.join(',')).join(', '), ingredients: ing, steps: P.parseSteps(fd.get('steps')).join('\n') };
    var btn = $('#rfSave'); btn.disabled = true; btn.textContent = 'Saving…';
    var editing = M.id, q;
    if (editing) { row.updated_at = new Date().toISOString(); q = sb.from('recipes').update(row).eq('id', editing).select().single(); }
    else { row.added_by_name = userName(); q = sb.from('recipes').insert(row).select().single(); }
    q.then(function (res) {
      if (res.error) { btn.disabled = false; btn.textContent = 'Try again'; msg.textContent = 'Couldn’t save: ' + res.error.message; return; }
      var r = prep(res.data);
      if (editing) RECIPES = RECIPES.map(function (x) { return x.id === r.id ? r : x; }); else RECIPES.unshift(r);
      LS.set('dp-recipes', RECIPES.map(function (x) { return x.raw; }));
      M = { mode: 'view', id: r.id, sv: r.servings, done: {} }; render(); renderView();
      toast(editing ? 'Recipe updated' : 'Recipe added for everyone');
    });
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || el.tagName === 'FORM' || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
    var a = el.getAttribute('data-act'), id = el.getAttribute('data-id'), p, r;
    switch (a) {
      case 'filter': F = el.getAttribute('data-f'); renderRecipes(); break;
      case 'open': r = byId(id); M = { mode: 'view', id: id, sv: r ? r.servings : 2, done: {} }; renderView(); break;
      case 'close': closeSheet(); break;
      case 'new': M = { mode: 'edit', id: null }; renderEdit(); break;
      case 'edit': M = { mode: 'edit', id: id }; renderEdit(); break;
      case 'acct': M = { mode: 'acct' }; renderAccount(); break;
      case 'toggle':
        p = inPlan(id);
        if (p) S.plan = S.plan.filter(function (x) { return x.id !== id; });
        else { r = byId(id); S.plan.push({ id: id, sv: M && M.mode === 'view' && M.id === id ? M.sv : (r ? r.servings : 2), done: false }); toast('Added to this week'); }
        change(); break;
      case 'sv': p = inPlan(id); if (p) { p.sv = Math.min(20, Math.max(1, p.sv + +el.getAttribute('data-d'))); change(); } break;
      case 'msv':
        p = inPlan(id);
        if (p) { p.sv = Math.min(20, Math.max(1, p.sv + +el.getAttribute('data-d'))); change(); }
        else { M.sv = Math.min(20, Math.max(1, M.sv + +el.getAttribute('data-d'))); renderView(); }
        break;
      case 'done': p = inPlan(id); if (p) { p.done = !p.done; change(); } break;
      case 'stepdone': var i = +el.getAttribute('data-i'); M.done[i] = !M.done[i]; el.classList.toggle('d'); break;
      case 'xdel': e.preventDefault(); S.extra.splice(+el.getAttribute('data-i'), 1); change(); break;
      case 'uncheck': S.chk = []; S.extra.forEach(function (x) { x.c = false; }); change(); break;
      case 'newweek':
        if (!confirmNew) { confirmNew = true; renderGro(); return; }
        S = norm(); change(); toast('Fresh week. Pick some dinners!'); break;
      case 'copy':
        var g = groceries().filter(function (x) { return S.chk.indexOf(x.key) < 0; }), t = '';
        P.AISLE_KEYS.forEach(function (k) { var it = g.filter(function (x) { return x.a === k; }); if (it.length) t += P.AISLES[k] + '\n' + it.map(function (x) { return '- ' + P.show(x.q, x.u, x.n); }).join('\n') + '\n\n'; });
        var ex = S.extra.filter(function (x) { return !x.c; }); if (ex.length) t += 'Also need\n' + ex.map(function (x) { return '- ' + x.n; }).join('\n');
        try { navigator.clipboard.writeText(t.trim()).then(function () { toast('List copied. Paste it anywhere.'); }, function () { toast('Couldn’t copy here'); }); } catch (err) { toast('Couldn’t copy here'); }
        break;
      case 'ftag': el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') !== 'true'); break;
      case 'del':
        if (el.getAttribute('data-armed') !== '1') { el.setAttribute('data-armed', '1'); el.textContent = 'Tap again to delete'; return; }
        el.disabled = true;
        sb.from('recipes').delete().eq('id', id).then(function (res) {
          if (res.error) { toast('Couldn’t delete: ' + res.error.message); el.disabled = false; return; }
          RECIPES = RECIPES.filter(function (x) { return x.id !== id; }); S.plan = S.plan.filter(function (x) { return x.id !== id; });
          LS.set('dp-recipes', RECIPES.map(function (x) { return x.raw; }));
          closeSheet(); change(); toast('Recipe deleted');
        });
        break;
      case 'refresh': closeSheet(); fetchRecipes(true); fetchPlan(); break;
      case 'signout':
        closeSheet(); sb.auth.signOut().finally(function () { USER = null; RECIPES = []; S = norm(); showAuth(); });
        break;
      case 'authmode': signup = !signup; $('#authMsg').textContent = ''; showAuth(); break;
      case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(function () { deferredInstall = null; renderInstall(); }); } break;
      case 'hideinstall': LS.set('dp-hide-install', true); renderInstall(); break;
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target, a = el.getAttribute('data-act');
    if (a === 'chk') { var k = el.getAttribute('data-k'); S.chk = el.checked ? S.chk.concat([k]) : S.chk.filter(function (x) { return x !== k; }); change(); }
    else if (a === 'xchk') { S.extra[+el.getAttribute('data-i')].c = el.checked; change(); }
    else if (a === 'aisle') {
      var ta = document.querySelector('#rf [name=ingredients]'), lines = ta.value.split('\n'), i = +el.getAttribute('data-line');
      var base = lines[i].replace(/\s*\[[^\]]*\]\s*$/, ''), guess = (P.parseLine(base) || {}).aisle;
      lines[i] = el.value === guess ? base : base + ' [' + el.value + ']';
      ta.value = lines.join('\n'); preview();
    }
    else if (el.id === 'csv' && el.files && el.files[0]) { importCSV(el.files[0]); el.value = ''; }
  });

  var pvTimer;
  document.addEventListener('input', function (e) {
    if (e.target.id === 'q') { Q = e.target.value; renderRecipes(); }
    else if (e.target.name === 'ingredients') { clearTimeout(pvTimer); pvTimer = setTimeout(preview, 200); }
  });

  document.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.getAttribute('data-act') === 'xadd') { var v = $('#xin').value.trim(); if (v) { S.extra.push({ n: v.slice(0, 80), c: false }); change(); var x = $('#xin'); if (x) x.focus(); } }
    else if (f.id === 'rf') saveRecipe(f);
    else if (f.id === 'authForm') {
      var fd = new FormData(f), un = String(fd.get('username') || '').trim().toLowerCase(), pw = String(fd.get('password')), msg = $('#authMsg'), btn = $('#authBtn');
      msg.className = 'msg'; msg.textContent = '';
      if (!/^[a-z0-9._-]{3,30}$/.test(un)) { msg.textContent = 'Usernames are 3–30 letters or numbers (dots, dashes and underscores are OK, no spaces).'; return; }
      if (pw.length < 6) { msg.textContent = 'Passwords need at least 6 characters.'; return; }
      var email = un + LOGIN_DOMAIN; btn.disabled = true;
      var done = function () { btn.disabled = false; };
      if (signup) {
        var nm = String(fd.get('name') || '').trim();
        if (!nm) { msg.textContent = 'Add your first name so others see who added a recipe.'; done(); return; }
        sb.auth.signUp({ email: email, password: pw, options: { data: { name: nm } } }).then(function (res) {
          done();
          if (res.error) { msg.textContent = /not allowed|disabled/i.test(res.error.message) ? 'New sign-ups are turned off for this kitchen.' : /already|registered|exists/i.test(res.error.message) ? 'That username is taken. Try another.' : res.error.message; return; }
          if (!res.data.session) { msg.textContent = 'Almost there: in Supabase, turn off “Confirm email” (see the setup guide), then try again.'; }
        });
      } else {
        sb.auth.signInWithPassword({ email: email, password: pw }).then(function (res) {
          done();
          if (res.error) msg.textContent = /invalid/i.test(res.error.message) ? 'That username and password don’t match.' : res.error.message;
        });
      }
    }
  });

  $('#ov').addEventListener('click', function (e) { if (e.target.id === 'ov' && M && M.mode !== 'edit') closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && M) closeSheet(); });
  window.addEventListener('hashchange', function () { show(); window.scrollTo(0, 0); });
  window.addEventListener('online', function () { setNet(); if (USER) { pushPlan(); fetchRecipes(false); } });
  window.addEventListener('offline', setNet);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && USER) { fetchRecipes(false); fetchPlan(); } });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; if (USER) renderInstall(); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});

  /* ---------- boot ---------- */
  setNet();
  if (!sb) { $('#setup').hidden = false; return; }
  sb.auth.onAuthStateChange(function (evt, session) {
    if (session && session.user) { var u = session.user; setTimeout(function () { startApp(u); }, 0); }
    else if (evt === 'SIGNED_OUT' || evt === 'INITIAL_SESSION') { USER = null; setTimeout(showAuth, 0); }
  });
})();
