/* =========================================================
   MAKERS — Núcleo compartido
   1. Utilidades        5. Precios y cotizador
   2. Almacenamiento    6. Componentes (tarjetas, avatar…)
   3. Sesión (registro) 7. Toast y ventanas modales
   4. Base de datos     8. Header / footer
   Todo se guarda en el navegador (localStorage): no hay servidor.
   ========================================================= */

/* 1. Utilidades ------------------------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => 'S/ ' + Number(n).toLocaleString('es-PE');
const compact = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k' : String(n));
const params = () => new URLSearchParams(location.search);
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const imgSrc = (x) => (/^(data:|https?:|img\/)/.test(x) ? x : IMG(x));
const currentFile = () => location.pathname.split('/').pop() || 'index.html';
const goLogin = () => { location.href = 'login.html?next=' + encodeURIComponent(currentFile() + location.search); };
const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
const stars = (r) => (r ? `<span class="rating">${Number(r).toFixed(2).replace(/0$/, '')}</span>` : '<span class="chip">Nuevo</span>');

/* 2. Almacenamiento --------------------------------------- */
const Store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('makers_' + k)) ?? d; } catch { return d; } },
  set(k, v) {
    try { localStorage.setItem('makers_' + k, JSON.stringify(v)); return true; }
    catch { toast('No hay espacio para guardar. Usa una imagen más liviana.'); return false; }
  },
};

/* 3. Sesión: registro e inicio de sesión ------------------- */
async function hash(s) {
  if (window.crypto && crypto.subtle) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  return btoa(unescape(encodeURIComponent(s)));
}

const Auth = {
  users: () => Store.get('users', []),
  current() { const id = Store.get('session', null); return this.users().find((u) => u.id === id) || null; },
  async register(d) {
    const users = this.users();
    if (users.some((u) => u.email === d.email.toLowerCase())) return { error: 'Ya existe una cuenta con ese correo.' };
    const user = {
      id: 'u' + Date.now(), role: d.role, name: d.name.trim(), email: d.email.toLowerCase().trim(),
      pass: await hash(d.password), city: d.city.trim(), cat: d.cat || '', bio: (d.bio || '').trim(), created: new Date().toISOString(),
    };
    users.push(user); Store.set('users', users); Store.set('session', user.id);
    return { user };
  },
  async login(email, password) {
    const p = await hash(password);
    const u = this.users().find((x) => x.email === email.toLowerCase().trim() && x.pass === p);
    if (!u) return { error: 'Correo o contraseña incorrectos.' };
    Store.set('session', u.id);
    return { user: u };
  },
  logout() { Store.set('session', null); },
  /* Devuelve el usuario o redirige al login. role: 'cliente' | 'freelance' */
  require(role) {
    const u = this.current();
    if (!u) { goLogin(); return null; }
    if (role && u.role !== role) { toast(`Esta acción es solo para ${role === 'cliente' ? 'clientes' : 'freelancers'}.`); return null; }
    return u;
  },
};

/* 4. Base de datos (datos de ejemplo + lo que crean los usuarios) */
const DB = {
  freelancers() {
    const reg = Auth.users().filter((u) => u.role === 'freelance').map((u) => ({
      id: u.id, name: u.name, role: 'Freelance · ' + u.cat, city: u.city || 'Perú', cats: [u.cat], rating: 0, reviews: 0,
      available: true, bio: u.bio || 'Nuevo talento en MAKERS.', skills: [u.cat], since: new Date(u.created).getFullYear(),
    }));
    return [...FREELANCERS, ...reg];
  },
  freelancer(id) { return this.freelancers().find((f) => f.id === id); },
  projects() { return [...PROJECTS, ...Store.get('projects', [])]; },
  project(id) { return this.projects().find((p) => p.id === id); },
  byFreelancer(id) { return this.projects().filter((p) => p.f === id); },
  briefs() { return [...Store.get('briefs', []), ...SEED_BRIEFS]; },
  gallery(p) {
    const c = CATEGORIES.find((x) => x.name === p.cat);
    return [...new Set([p.img, ...(p.gallery || []), ...(c ? c.pool : [])])].slice(0, 4);
  },
};

const Orders = {
  all: () => Store.get('orders', []),
  add(o) { const a = this.all(); a.unshift(o); Store.set('orders', a); },
  setStatus(id, status) { Store.set('orders', this.all().map((o) => (o.id === id ? { ...o, status } : o))); },
};
const Proposals = {
  all: () => Store.get('proposals', []),
  forBrief(id) { return this.all().filter((p) => p.briefId === id); },
  add(p) { const a = this.all(); a.push(p); Store.set('proposals', a); },
};
const Messages = {
  all: () => Store.get('messages', []),
  add(m) { const a = this.all(); a.unshift(m); Store.set('messages', a); },
};
const Saved = {
  key() { const u = Auth.current(); return u ? 'saved_' + u.id : null; },
  list() { const k = this.key(); return k ? Store.get(k, []) : []; },
  has(id) { return this.list().includes(id); },
  toggle(id) {
    const k = this.key();
    if (!k) { toast('Inicia sesión para guardar proyectos'); setTimeout(goLogin, 900); return null; }
    const l = this.list(); const i = l.indexOf(id);
    if (i < 0) l.push(id); else l.splice(i, 1);
    Store.set(k, l);
    return i < 0;
  },
};

/* 5. Precios y cotizador ----------------------------------- */
const Pricing = {
  config(p) {
    const c = CATEGORIES.find((x) => x.name === p.cat) || CATEGORIES[0];
    const prices = p.pk || c.prices; const days = p.days || c.days;
    return {
      packages: ['Básico', 'Estándar', 'Premium'].map((n, i) => ({ id: 'pk' + i, name: n, price: Number(prices[i]), days: Number(days[i]), features: c.features[i] })),
      extras: c.extras, discount: p.discount || 0,
    };
  },
  from(p) {
    const cfg = this.config(p); const base = cfg.packages[0].price;
    return { base, now: Math.round(base * (1 - cfg.discount / 100)), discount: cfg.discount };
  },
  /* sel = { pkg, extras: [ids], rev: n, rush: bool } */
  quote(p, sel) {
    const cfg = this.config(p);
    const pkg = cfg.packages.find((x) => x.id === sel.pkg) || cfg.packages[0];
    const lines = [{ label: `Paquete ${pkg.name}`, amount: pkg.price }];
    let total = pkg.price;
    if (cfg.discount) { const d = -Math.round((pkg.price * cfg.discount) / 100); lines.push({ label: `Descuento ${cfg.discount}%`, amount: d }); total += d; }
    cfg.extras.filter((e) => sel.extras.includes(e.id)).forEach((e) => { lines.push({ label: e.label, amount: e.price }); total += e.price; });
    if (sel.rev > 0) { const a = sel.rev * REV_PRICE; lines.push({ label: `${sel.rev} revisión(es) adicional(es)`, amount: a }); total += a; }
    let days = pkg.days;
    if (sel.rush) { const a = Math.round(total * RUSH_RATE); lines.push({ label: `Entrega urgente (+${RUSH_RATE * 100}%)`, amount: a }); total += a; days = Math.max(1, Math.ceil(days * 0.6)); }
    return { pkg, lines, total, days };
  },
};

/* 6. Componentes ------------------------------------------- */
const GRADS = ['#2fc4b8,#2f5fe0', '#d4189b,#ffb938', '#2f5fe0,#d4189b', '#1fa89d,#8fe3dc', '#ffb938,#d4189b'];
function avatar(name, size = '') {
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const ini = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return `<span class="avatar ${size}" style="background:linear-gradient(135deg,${GRADS[h % GRADS.length]})" aria-hidden="true">${esc(ini)}</span>`;
}

function heartBtn(id) {
  const on = Saved.has(id);
  return `<button class="heart" type="button" data-save="${id}" aria-pressed="${on}" aria-label="${on ? 'Quitar de guardados' : 'Guardar proyecto'}">♥</button>`;
}

function projectCard(p) {
  const f = DB.freelancer(p.f) || { id: '', name: 'Freelancer' }; const pr = Pricing.from(p);
  return `<article class="project-card">
    <div class="project-card__media">
      <a href="proyecto.html?id=${p.id}" tabindex="-1" aria-hidden="true"><img src="${imgSrc(p.img)}" alt="" loading="lazy"></a>
      ${pr.discount ? `<span class="badge">-${pr.discount}%</span>` : ''}${heartBtn(p.id)}
    </div>
    <div class="project-card__body">
      <span class="chip chip--pink">${esc(p.cat)}</span>
      <h3 class="project-card__title"><a href="proyecto.html?id=${p.id}">${esc(p.title)}</a></h3>
      <a class="author-line" href="freelancer.html?id=${f.id}">${avatar(f.name, 'avatar--xs')}<span>${esc(f.name)}</span></a>
      <div class="project-card__foot">
        <p class="price">${pr.discount ? `<s>${money(pr.base)}</s> ` : ''}<small>Desde</small> ${money(pr.now)}</p>
        <span class="stats">♥ ${compact(p.likes)} · 👁 ${compact(p.views)}</span>
      </div>
    </div>
  </article>`;
}

function freelancerCard(f) {
  const mine = DB.byFreelancer(f.id);
  const min = mine.length ? Math.min(...mine.map((p) => Pricing.from(p).now)) : null;
  const cover = mine[0] ? imgSrc(mine[0].img) : IMG('portada');
  return `<article class="pro-card">
    <a class="pro-card__media" href="freelancer.html?id=${f.id}" tabindex="-1" aria-hidden="true"><img src="${cover}" alt="" loading="lazy"></a>
    <div class="pro-card__body">
      <div class="pro-card__top">${avatar(f.name, 'avatar--sm')}<div><h3 class="pro-card__name"><a href="freelancer.html?id=${f.id}">${esc(f.name)}</a></h3>
        <p class="pro-card__role">${esc(f.role)} · ${esc(f.city)}</p></div></div>
      <div class="pro-card__tags">${f.available ? '<span class="chip chip--ok">Disponible</span>' : '<span class="chip">Ocupado/a</span>'}${f.cats.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
      <p class="pro-card__foot">${stars(f.rating)}<span class="price">${min ? `<small>Desde</small> ${money(min)}` : ''}</span></p>
    </div>
  </article>`;
}

function initTabs(root) {
  const tabs = $$('[role="tab"]', root);
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
  }));
}

/* 7. Toast y ventanas modales ------------------------------ */
function toast(msg) {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.append(box); }
  const t = document.createElement('p'); t.className = 'toast'; t.textContent = msg; box.append(t);
  setTimeout(() => t.remove(), 3800);
}

function modal({ title, body, submit = 'Enviar', onSubmit }) {
  const d = document.createElement('dialog'); d.className = 'modal';
  d.innerHTML = `<form method="dialog">
    <header class="modal__head"><h2>${title}</h2><button class="modal__x" value="cancel" formnovalidate aria-label="Cerrar">×</button></header>
    <div class="modal__body">${body}</div>
    <footer class="modal__foot"><button class="btn btn--outline" value="cancel" formnovalidate>Cancelar</button><button class="btn btn--primary" value="ok">${submit}</button></footer>
  </form>`;
  document.body.append(d); d.showModal();
  const form = $('form', d);
  form.addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value === 'ok') {
      const r = onSubmit(Object.fromEntries(new FormData(form)));
      if (r === false) e.preventDefault();
    }
  });
  d.addEventListener('close', () => d.remove());
}

/* Mensaje a un freelancer (se usa en proyecto y perfil) */
function askFreelancer(f, project) {
  const u = Auth.require(); if (!u) return;
  modal({
    title: `Escribir a ${esc(f.name)}`, submit: 'Enviar mensaje',
    body: `<label class="field"><span>Tu mensaje</span><textarea name="text" rows="4" required minlength="10" placeholder="Hola, me interesa tu servicio…"></textarea></label>`,
    onSubmit: (d) => {
      Messages.add({ id: 'm' + Date.now(), to: f.id, from: u.id, fromName: u.name, project: project ? project.title : '', text: d.text.trim(), date: new Date().toISOString() });
      toast('Mensaje enviado');
    },
  });
}

/* 8. Header y footer --------------------------------------- */
const NAV = [['index.html', 'Inicio', 'home'], ['servicios.html', 'Servicios', 'servicios'], ['proyectos.html', 'Proyectos', 'proyectos'], ['oportunidades.html', 'Oportunidades', 'oportunidades']];

function renderLayout() {
  const page = document.body.dataset.page, u = Auth.current();
  const header = $('[data-component="header"]');
  if (header) {
    header.innerHTML = `<div class="container header__inner">
      <a class="brand" href="index.html" aria-label="MAKERS, ir al inicio">
        <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#2fc4b8"/><path d="M9 22 L14 8 L18 17 L22 8 L23 22" fill="none" stroke="#17181c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>MAKERS</a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="menu" aria-label="Abrir menú"><span></span></button>
      <nav id="menu" class="nav" aria-label="Principal">
        <ul class="nav__list">${NAV.map(([h, t, k]) => `<li><a class="nav__link" href="${h}"${k === page ? ' aria-current="page"' : ''}>${t}</a></li>`).join('')}</ul>
        <div class="nav__actions">${u
          ? `<a class="user-chip" href="perfil.html">${avatar(u.name, 'avatar--sm')}<span>${esc(u.name.split(' ')[0])}</span></a><button class="btn btn--ghost" type="button" id="logout">Salir</button>`
          : `<a class="btn btn--ghost" href="registro.html">Registrarse</a><a class="btn btn--primary" href="login.html">Iniciar sesión</a>`}</div>
      </nav></div>`;
    const toggle = $('.nav-toggle', header), menu = $('#menu', header);
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open); toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
    const out = $('#logout', header);
    if (out) out.addEventListener('click', () => { Auth.logout(); toast('Sesión cerrada'); setTimeout(() => { location.href = 'index.html'; }, 600); });
  }
  const footer = $('[data-component="footer"]');
  if (footer) {
    footer.innerHTML = `<div class="container footer__inner">
        <p class="footer__claim">Donde las ideas encuentran a las personas capaces de hacerlo realidad.</p>
        <div class="footer__actions"><a class="btn btn--primary" href="proyectos.html">Explorar talento</a><a class="btn btn--light" href="registro.html?rol=freelance">Crear mi perfil</a></div>
      </div>
      <nav class="container footer__links" aria-label="Pie de página">
        <a href="servicios.html">Servicios</a><a href="proyectos.html">Proyectos</a><a href="oportunidades.html">Oportunidades</a><a href="registro.html">Registrarse</a><a href="login.html">Iniciar sesión</a>
      </nav>
      <p class="footer__legal">© 2026 MAKERS. Todos los derechos reservados.</p>`;
  }
}

/* Botones de guardar (♥) en cualquier tarjeta */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-save]'); if (!b) return;
  const on = Saved.toggle(b.dataset.save);
  if (on === null) return;
  b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Quitar de guardados' : 'Guardar proyecto');
  toast(on ? 'Proyecto guardado' : 'Quitado de guardados');
  document.dispatchEvent(new CustomEvent('saved-change'));
});
