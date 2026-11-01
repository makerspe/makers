/* =========================================================
   MAKERS — Lógica por página
   Cada página HTML tiene <body data-page="..."> y aquí hay una
   función con ese nombre dentro de `Pages`.
   ========================================================= */

/* ---------- Ayudantes compartidos ---------- */
const empty = (msg, extra = '') => `<p class="empty">${msg} ${extra}</p>`;
const agoText = (n) => (n < 1 ? 'hoy' : n < 7 ? `hace ${n} día${n > 1 ? 's' : ''}` : n < 30 ? `hace ${Math.round(n / 7)} semanas` : `hace ${Math.round(n / 30)} meses`);
const slug = (s) => norm(s).replace(/\s+/g, '-');
const catOptions = (sel = '') => CATEGORIES.map((c) => `<option value="${esc(c.name)}"${c.name === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');

function briefCard(b) {
  const n = Proposals.forBrief(b.id).length;
  return `<article class="brief">
    <div><span class="chip chip--pink">${esc(b.cat)}</span>
      <h3 class="brief__title">${esc(b.title)}</h3>
      <p class="brief__client">${esc(b.clientName)} · publicado el ${fmtDate(b.date)}</p>
      <p>${esc(b.desc)}</p></div>
    <div class="brief__side">
      <p class="price"><small>Presupuesto</small> ${money(b.min)} – ${money(b.max)}</p>
      <p class="brief__meta">${b.days} días · ${n} propuesta${n === 1 ? '' : 's'}</p>
      <button class="btn btn--dark btn--sm" type="button" data-propose="${b.id}">Enviar propuesta</button>
    </div></article>`;
}

function proposeFlow(id) {
  const b = DB.briefs().find((x) => x.id === id); if (!b) return;
  const u = Auth.require('freelance'); if (!u) return;
  if (Proposals.forBrief(id).some((p) => p.freelancerId === u.id)) { toast('Ya enviaste una propuesta a esta solicitud'); return; }
  modal({
    title: 'Enviar propuesta', submit: 'Enviar propuesta',
    body: `<p class="modal__hint">${esc(b.title)} · Presupuesto ${money(b.min)} – ${money(b.max)}</p>
      <label class="field"><span>Tu precio (S/)</span><input type="number" name="price" min="1" required value="${b.min}"></label>
      <label class="field"><span>Mensaje</span><textarea name="message" rows="4" required minlength="10" placeholder="Cuéntale cómo lo harías y en cuánto tiempo"></textarea></label>`,
    onSubmit: (d) => {
      Proposals.add({ id: 'pr' + Date.now(), briefId: id, freelancerId: u.id, freelancerName: u.name, price: Number(d.price), message: d.message.trim(), date: new Date().toISOString() });
      toast('Propuesta enviada');
      document.dispatchEvent(new CustomEvent('data-change'));
    },
  });
}

function readImage(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader(); fr.onerror = rej;
    fr.onload = () => {
      const im = new Image(); im.onerror = rej;
      im.onload = () => {
        const s = Math.min(1, 900 / Math.max(im.width, im.height));
        const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.78));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

document.addEventListener('click', (e) => { const b = e.target.closest('[data-propose]'); if (b) proposeFlow(b.dataset.propose); });

/* ---------- Páginas ---------- */
const Pages = {

  /* INICIO */
  home() {
    $('#home-categories').innerHTML = CATEGORIES.map((c) => `<li><a class="category" href="proyectos.html?cat=${encodeURIComponent(c.name)}"><img src="${IMG(c.icon)}" alt="" loading="lazy"><span>${esc(c.name)}</span></a></li>`).join('');
    const top = DB.freelancers().filter((f) => f.rating).sort((a, b) => b.rating - a.rating).slice(0, 4);
    $('#home-featured').innerHTML = top.map(freelancerCard).join('');
    $('#stat-pro').textContent = DB.freelancers().length;
    $('#stat-proj').textContent = DB.projects().length;
  },

  /* SERVICIOS */
  servicios() {
    $('#service-list').innerHTML = CATEGORIES.map((c) => {
      const n = DB.freelancers().filter((f) => f.cats.includes(c.name)).length;
      return `<article class="service-card">
        <img src="${IMG(c.icon)}" alt="" loading="lazy">
        <div><h3 class="service-card__title">${esc(c.name)}</h3>
          <p class="service-card__text">${esc(c.text)}</p>
          <p class="price"><small>Desde</small> ${money(c.prices[0])}</p>
          <div class="service-card__foot"><span class="chip chip--pink">${esc(c.tag)}</span>
            <a class="service-card__link" href="proyectos.html?cat=${encodeURIComponent(c.name)}">Ver expertos (${n})</a></div></div></article>`;
    }).join('');
    $('#price-body').innerHTML = CATEGORIES.map((c) => `<tr><th scope="row">${esc(c.name)}</th>${c.prices.map((p, i) => `<td><strong>${money(p)}</strong><small>${c.days[i]} días</small></td>`).join('')}</tr>`).join('');
  },

  /* PROYECTOS (listado con filtros) */
  proyectos() {
    const wanted = params().get('cat');
    const st = { cat: CATEGORIES.some((c) => c.name === wanted) ? wanted : 'Todos', q: '', sort: 'recent', max: 4000, shown: 9 };
    const chips = $('#cat-chips'), grid = $('#project-grid');
    chips.innerHTML = ['Todos', ...CATEGORIES.map((c) => c.name)].map((n) => `<button class="tab-chip" type="button" data-cat="${esc(n)}" aria-pressed="${n === st.cat}">${esc(n)}</button>`).join('');

    const render = () => {
      let list = DB.projects().filter((p) => {
        const f = DB.freelancer(p.f);
        return (st.cat === 'Todos' || p.cat === st.cat)
          && (st.max >= 4000 || Pricing.from(p).now <= st.max)
          && (!st.q || norm(`${p.title} ${p.cat} ${f ? f.name : ''}`).includes(st.q));
      });
      const price = (p) => Pricing.from(p).now;
      const sorts = { recent: (a, b) => (a.ago || 0) - (b.ago || 0), popular: (a, b) => b.likes - a.likes, low: (a, b) => price(a) - price(b), high: (a, b) => price(b) - price(a) };
      list.sort(sorts[st.sort]);
      $('#count').textContent = `${list.length} proyecto${list.length === 1 ? '' : 's'}`;
      grid.innerHTML = list.length ? list.slice(0, st.shown).map(projectCard).join('') : empty('No encontramos proyectos con esos filtros.');
      $('#more').hidden = list.length <= st.shown;
    };

    chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      st.cat = b.dataset.cat; st.shown = 9;
      $$('[data-cat]', chips).forEach((x) => x.setAttribute('aria-pressed', x === b)); render();
    });
    $('#q').addEventListener('input', (e) => { st.q = norm(e.target.value.trim()); st.shown = 9; render(); });
    $('#sort').addEventListener('change', (e) => { st.sort = e.target.value; render(); });
    $('#max').addEventListener('input', (e) => {
      st.max = +e.target.value; st.shown = 9;
      $('#max-out').textContent = st.max >= 4000 ? 'Sin límite' : 'Hasta ' + money(st.max); render();
    });
    $('#more').addEventListener('click', () => { st.shown += 9; render(); });
    render();
  },

  /* DETALLE DE PROYECTO + COTIZADOR */
  proyecto() {
    const root = $('#project-root'), p = DB.project(params().get('id'));
    if (!p) { root.innerHTML = empty('Este proyecto no existe.', '<a href="proyectos.html">Volver a proyectos</a>'); return; }
    document.title = `${p.title} · MAKERS`;
    const f = DB.freelancer(p.f) || { id: '', name: 'Freelancer', role: '', city: '', rating: 0, reviews: 0 };
    const cfg = Pricing.config(p), pr = Pricing.from(p), gal = DB.gallery(p);
    const idx = parseInt(p.id.replace(/\D/g, ''), 10) || 0;
    const reviews = p.custom ? [] : REVIEWS.slice(idx % 2, (idx % 2) + 2);
    const similar = DB.projects().filter((x) => x.cat === p.cat && x.id !== p.id).slice(0, 3);
    const first = p.desc.split('. ')[0].replace(/\.$/, '') + '.';
    const lowest = cfg.packages[0], highest = cfg.packages[2];

    root.innerHTML = `
      <p class="breadcrumb"><a href="proyectos.html">‹ Volver a proyectos</a></p>
      <div class="detail">
        <article>
          <header>
            <span class="chip chip--pink">${esc(p.cat)}</span>
            <h1 class="detail__title">${esc(p.title)}</h1>
            <p class="detail__lead">${esc(first)}</p>
            <p class="detail__meta"><span>Publicado ${agoText(p.ago || 0)}</span><span>♥ ${compact(p.likes)} me gusta</span><span>👁 ${compact(p.views)} vistas</span></p>
          </header>
          <figure class="gallery">
            <div class="gallery__main"><img id="gallery-main" src="${imgSrc(gal[0])}" alt="${esc(p.title)}"></div>
            <div class="gallery__thumbs">${gal.map((g, i) => `<button type="button" data-full="${imgSrc(g)}" ${i === 0 ? 'aria-current="true"' : ''} aria-label="Ver imagen ${i + 1}"><img src="${imgSrc(g)}" alt=""></button>`).join('')}</div>
          </figure>
          <section class="tabs" id="info-tabs" aria-label="Información del proyecto">
            <div class="tabs__list" role="tablist">
              <button class="tabs__tab" role="tab" id="t-desc" aria-controls="pn-desc" aria-selected="true" type="button">Descripción</button>
              <button class="tabs__tab" role="tab" id="t-plan" aria-controls="pn-plan" aria-selected="false" tabindex="-1" type="button">Planes y precios</button>
              <button class="tabs__tab" role="tab" id="t-val" aria-controls="pn-val" aria-selected="false" tabindex="-1" type="button">Valoraciones</button>
            </div>
            <div class="tabs__panel" role="tabpanel" id="pn-desc" aria-labelledby="t-desc">
              <h2>Descripción del proyecto</h2><p>${esc(p.desc)}</p>
              <h3>Entregables del paquete Premium</h3>
              <ul class="checklist">${highest.features.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            </div>
            <div class="tabs__panel" role="tabpanel" id="pn-plan" aria-labelledby="t-plan" hidden>
              <h2>Planes y precios</h2>
              <div class="plans">${cfg.packages.map((k) => `<section class="plan"><h3>${k.name}</h3>
                <p class="plan__price">${cfg.discount ? `<s>${money(k.price)}</s> ` : ''}${money(Math.round(k.price * (1 - cfg.discount / 100)))}</p>
                <p class="plan__days">${k.days} días hábiles</p>
                <ul class="checklist">${k.features.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`).join('')}</div>
              <p class="note">Puedes sumar extras, revisiones y entrega urgente en el cotizador.</p>
            </div>
            <div class="tabs__panel" role="tabpanel" id="pn-val" aria-labelledby="t-val" hidden>
              <h2>Valoraciones</h2>
              ${reviews.length ? reviews.map((r) => `<div class="review"><strong>${esc(r.name)} <span class="rating">${r.rating}</span></strong><p>${esc(r.text)}</p></div>`).join('') : '<p>Este proyecto aún no tiene valoraciones.</p>'}
            </div>
          </section>
        </article>

        <aside class="aside" aria-label="Cotización y contacto">
          <form class="panel" id="quote-form" novalidate>
            <h2 class="panel__title">COTIZA TU PROYECTO</h2>
            <p class="quote__from">${pr.discount ? `<span class="badge badge--inline">-${pr.discount}%</span> ` : ''}Desde <strong>${money(pr.now)}</strong></p>
            <fieldset class="fieldset"><legend>1. Elige el paquete</legend>
              <div class="pkgs">${cfg.packages.map((k, i) => `<label class="pkg"><input type="radio" name="pkg" value="${k.id}" ${i === 0 ? 'checked' : ''}><span class="pkg__box"><strong>${k.name}</strong><small>${k.days} días</small><b>${money(k.price)}</b></span></label>`).join('')}</div>
            </fieldset>
            <fieldset class="fieldset"><legend>2. Agrega extras</legend>
              ${cfg.extras.map((x) => `<label class="check"><input type="checkbox" name="extra" value="${x.id}"><span>${esc(x.label)}</span><b>+${money(x.price)}</b></label>`).join('')}
              <label class="check"><input type="checkbox" name="rush"><span>Entrega urgente (plazo −40%)</span><b>+${RUSH_RATE * 100}%</b></label>
              <label class="check check--num"><span>Revisiones adicionales (${money(REV_PRICE)} c/u)</span><input type="number" name="rev" min="0" max="10" value="0" aria-label="Revisiones adicionales"></label>
            </fieldset>
            <div class="quote" id="quote-out" aria-live="polite"></div>
            <label class="field"><span>Cuéntale qué necesitas (opcional)</span><textarea name="notes" rows="3" placeholder="Describe tu negocio, estilo, fechas…"></textarea></label>
            <button class="btn btn--primary btn--block" type="submit">Contratar este servicio</button>
          </form>

          <section class="panel" aria-label="Freelancer">
            <div class="author">${avatar(f.name, 'avatar--lg')}<div>
              <p class="author__name"><a href="freelancer.html?id=${f.id}">${esc(f.name)}</a></p>
              <p class="author__role">${esc(f.role)} · ${esc(f.city)}</p>${stars(f.rating)}${f.reviews ? ` <small>(${f.reviews})</small>` : ''}</div></div>
            <div class="panel__actions">
              <a class="btn btn--outline btn--block" href="freelancer.html?id=${f.id}">Ver perfil y proyectos</a>
              <button class="btn btn--dark btn--block" type="button" id="ask">Preguntar algo</button>
              <div class="btn-row"><button class="btn btn--ghost" type="button" data-save="${p.id}" id="save-btn" aria-pressed="${Saved.has(p.id)}">${Saved.has(p.id) ? '♥ Guardado' : '♡ Guardar'}</button>
                <button class="btn btn--ghost" type="button" id="share">Compartir</button></div>
            </div>
          </section>

          ${similar.length ? `<section class="panel" aria-labelledby="sim-t"><h2 class="panel__title" id="sim-t">PROYECTOS SIMILARES</h2><ul class="similar">${similar.map((s) => `<li><a class="similar__item" href="proyecto.html?id=${s.id}"><img src="${imgSrc(s.img)}" alt="" loading="lazy"><span><span class="similar__title">${esc(s.title)}</span><br><span class="similar__meta">Desde ${money(Pricing.from(s).now)}</span></span></a></li>`).join('')}</ul></section>` : ''}
        </aside>
      </div>`;

    /* Galería y pestañas */
    const main = $('#gallery-main'), thumbs = $$('.gallery__thumbs button');
    thumbs.forEach((t) => t.addEventListener('click', () => {
      main.src = t.dataset.full; thumbs.forEach((x) => x.removeAttribute('aria-current')); t.setAttribute('aria-current', 'true');
    }));
    initTabs($('#info-tabs'));

    /* Cotizador en vivo */
    const form = $('#quote-form');
    const read = () => ({ pkg: form.elements.pkg.value, extras: $$('[name=extra]:checked', form).map((x) => x.value), rev: Math.max(0, Math.min(10, parseInt(form.elements.rev.value, 10) || 0)), rush: form.elements.rush.checked });
    const update = () => {
      const q = Pricing.quote(p, read());
      $('#quote-out').innerHTML = `<ul class="quote__lines">${q.lines.map((l) => `<li><span>${esc(l.label)}</span><span>${l.amount < 0 ? '−' : ''}${money(Math.abs(l.amount))}</span></li>`).join('')}</ul>
        <p class="quote__total"><span>Total estimado</span><strong>${money(q.total)}</strong></p><p class="quote__days">Entrega en ${q.days} días hábiles</p>`;
    };
    form.addEventListener('input', update); form.addEventListener('change', update); update();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = Auth.require('cliente'); if (!u) return;
      const sel = read(), q = Pricing.quote(p, sel);
      Orders.add({
        id: 'o' + Date.now(), projectId: p.id, title: p.title, cat: p.cat, clientId: u.id, clientName: u.name,
        freelancerId: p.f, freelancerName: f.name, pkg: q.pkg.name, total: q.total, days: q.days,
        notes: form.elements.notes.value.trim(), status: 'Pendiente', date: new Date().toISOString(),
      });
      toast('¡Pedido enviado! Lo verás en tu panel');
      setTimeout(() => { location.href = 'perfil.html#pedidos'; }, 1000);
    });

    $('#ask').addEventListener('click', () => askFreelancer(f, p));
    $('#share').addEventListener('click', async () => {
      const url = location.href;
      if (navigator.share) { try { await navigator.share({ title: p.title, url }); } catch { /* cancelado */ } return; }
      try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } catch { toast(url); }
    });
    document.addEventListener('saved-change', () => { $('#save-btn').textContent = Saved.has(p.id) ? '♥ Guardado' : '♡ Guardar'; });
  },

  /* PERFIL PÚBLICO DE UN FREELANCER */
  freelancer() {
    const root = $('#freelancer-root'), f = DB.freelancer(params().get('id'));
    if (!f) { root.innerHTML = empty('Este perfil no existe.', '<a href="proyectos.html">Volver a proyectos</a>'); return; }
    document.title = `${f.name} · MAKERS`;
    const mine = DB.byFreelancer(f.id), cover = mine[0] ? imgSrc(mine[0].img) : IMG('portada');
    root.innerHTML = `
      <section class="profile">
        <div class="profile__cover" style="background-image:linear-gradient(rgba(23,24,28,.15),rgba(23,24,28,.55)),url('${cover}')"></div>
        <div class="profile__card">
          ${avatar(f.name, 'avatar--xl')}
          <div class="profile__main">
            <h1 class="profile__name">${esc(f.name)}</h1>
            <p class="profile__role">${esc(f.role)} · ${esc(f.city)}</p>
            <p>${f.available ? '<span class="chip chip--ok">Disponible</span>' : '<span class="chip">Ocupado/a</span>'} ${f.cats.map((c) => `<span class="chip chip--pink">${esc(c)}</span>`).join(' ')}</p>
          </div>
          <div class="profile__cta"><button class="btn btn--primary" type="button" id="contact">Contactar</button></div>
        </div>
        <dl class="stats-row">
          <div><dt>Valoración</dt><dd>${f.rating ? f.rating.toFixed(2).replace(/0$/, '') + ' ★' : 'Nuevo'}</dd></div>
          <div><dt>Reseñas</dt><dd>${f.reviews}</dd></div>
          <div><dt>Proyectos</dt><dd>${mine.length}</dd></div>
          <div><dt>En MAKERS desde</dt><dd>${f.since}</dd></div>
        </dl>
        <div class="profile__bio"><h2>Sobre mí</h2><p>${esc(f.bio)}</p>
          <ul class="skills">${f.skills.map((s) => `<li class="chip">${esc(s)}</li>`).join('')}</ul></div>
      </section>
      <section aria-labelledby="fp-t" class="section" style="padding-bottom:0"><h2 class="section__title" id="fp-t">Proyectos de ${esc(f.name.split(' ')[0])}</h2>
        <div class="grid grid--cards" id="fp-grid">${mine.length ? mine.map(projectCard).join('') : empty('Aún no ha publicado proyectos.')}</div></section>`;
    $('#contact').addEventListener('click', () => askFreelancer(f, null));
  },

  /* REGISTRO (cliente o freelancer) */
  registro() {
    if (Auth.current()) { location.replace('perfil.html'); return; }
    const form = $('#register-form'), rol = params().get('rol');
    $('#cat').innerHTML = '<option value="">Elige tu especialidad</option>' + catOptions();
    if (rol === 'freelance' || rol === 'cliente') form.elements.role.value = rol;
    const sync = () => {
      const fl = form.elements.role.value === 'freelance';
      $('#freelance-fields').hidden = !fl; $('#cat').required = fl;
    };
    form.addEventListener('change', sync); sync();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#form-error'); err.textContent = '';
      const d = Object.fromEntries(new FormData(form));
      if (d.password.length < 6) { err.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
      if (d.password !== d.password2) { err.textContent = 'Las contraseñas no coinciden.'; return; }
      const r = await Auth.register(d);
      if (r.error) { err.textContent = r.error; return; }
      toast(`¡Bienvenido/a, ${r.user.name.split(' ')[0]}!`);
      setTimeout(() => { location.href = r.user.role === 'freelance' ? 'publicar.html' : 'proyectos.html'; }, 800);
    });
  },

  /* INICIO DE SESIÓN */
  login() {
    if (Auth.current()) { location.replace('perfil.html'); return; }
    const form = $('#login-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      const r = await Auth.login(d.email, d.password);
      if (r.error) { $('#form-error').textContent = r.error; return; }
      const next = params().get('next');
      location.href = next && /^[\w.-]+\.html(\?[\w=&%.-]*)?$/.test(next) ? next : 'perfil.html';
    });
  },

  /* PANEL DEL USUARIO (cliente o freelancer) */
  perfil() {
    const u = Auth.require(); if (!u) return;
    const isF = u.role === 'freelance';
    const tabs = isF
      ? [['pedidos', 'Pedidos recibidos'], ['proyectos', 'Mis proyectos'], ['solicitudes', 'Solicitudes abiertas'], ['mensajes', 'Mensajes']]
      : [['pedidos', 'Mis pedidos'], ['solicitudes', 'Mis solicitudes'], ['guardados', 'Guardados']];

    $('#panel-head').innerHTML = `${avatar(u.name, 'avatar--xl')}<div><h1 class="profile__name">${esc(u.name)}</h1>
      <p class="profile__role">${isF ? 'Freelance · ' + esc(u.cat) : 'Cliente'} · ${esc(u.city)}</p><p><small>${esc(u.email)}</small></p></div>
      <div class="profile__cta">${isF ? `<a class="btn btn--outline" href="freelancer.html?id=${u.id}">Ver mi perfil público</a>` : ''}
      <a class="btn btn--primary" href="publicar.html">${isF ? 'Publicar proyecto' : 'Publicar solicitud'}</a></div>`;

    $('#panel-tabs').innerHTML = `<div class="tabs__list" role="tablist">${tabs.map(([k, t], i) => `<button class="tabs__tab" role="tab" id="tab-${k}" aria-controls="pn-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" type="button">${t}</button>`).join('')}</div>
      ${tabs.map(([k], i) => `<div class="tabs__panel" role="tabpanel" id="pn-${k}" aria-labelledby="tab-${k}" ${i ? 'hidden' : ''}></div>`).join('')}`;
    initTabs($('#panel-tabs'));

    const orderCard = (o) => `<article class="order">
      <div><h3 class="order__title">${o.projectId ? `<a href="proyecto.html?id=${o.projectId}">${esc(o.title)}</a>` : esc(o.title)}</h3>
        <p class="order__meta">${isF ? 'Cliente: ' + esc(o.clientName) : 'Freelancer: <a href="freelancer.html?id=' + o.freelancerId + '">' + esc(o.freelancerName) + '</a>'} · ${esc(o.pkg)} · ${o.days} días · ${fmtDate(o.date)}</p>
        ${o.notes ? `<p class="order__notes">“${esc(o.notes)}”</p>` : ''}</div>
      <div class="order__side"><strong class="order__total">${money(o.total)}</strong>
        ${isF ? `<label class="sr-only" for="st-${o.id}">Estado</label><select id="st-${o.id}" class="select select--sm" data-status="${o.id}">${['Pendiente', 'En curso', 'Entregado', 'Rechazado'].map((s) => `<option${s === o.status ? ' selected' : ''}>${s}</option>`).join('')}</select>`
          : `<span class="status status--${slug(o.status)}">${esc(o.status)}</span>`}</div></article>`;

    const draw = {
      pedidos() {
        const list = Orders.all().filter((o) => (isF ? o.freelancerId === u.id : o.clientId === u.id));
        $('#pn-pedidos').innerHTML = list.length ? `<div class="stack">${list.map(orderCard).join('')}</div>`
          : empty(isF ? 'Aún no recibes pedidos.' : 'Aún no has contratado servicios.', isF ? '' : '<a href="proyectos.html">Explorar proyectos</a>');
      },
      proyectos() {
        const mine = DB.byFreelancer(u.id);
        $('#pn-proyectos').innerHTML = mine.length
          ? `<div class="grid grid--cards">${mine.map((p) => `<div class="card-wrap">${projectCard(p)}<button class="btn btn--outline btn--sm" type="button" data-del="${p.id}">Eliminar</button></div>`).join('')}</div>`
          : empty('Aún no has publicado proyectos.', '<a href="publicar.html">Publicar el primero</a>');
      },
      solicitudes() {
        const el = $('#pn-solicitudes');
        if (isF) {
          const open = DB.briefs().filter((b) => b.status !== 'Asignada').sort((a, b) => (b.cat === u.cat) - (a.cat === u.cat));
          el.innerHTML = `<p class="note">Las de tu especialidad aparecen primero.</p><div class="stack">${open.map(briefCard).join('')}</div>`;
          return;
        }
        const mine = Store.get('briefs', []).filter((b) => b.clientId === u.id);
        el.innerHTML = mine.length ? `<div class="stack">${mine.map((b) => {
          const props = Proposals.forBrief(b.id);
          return `<article class="brief brief--col"><div><span class="chip chip--pink">${esc(b.cat)}</span> <span class="status status--${slug(b.status || 'Abierta')}">${b.status || 'Abierta'}</span>
            <h3 class="brief__title">${esc(b.title)}</h3><p>${esc(b.desc)}</p><p class="brief__meta">Presupuesto ${money(b.min)} – ${money(b.max)} · ${b.days} días</p></div>
            <div class="proposals"><h4>Propuestas (${props.length})</h4>${props.length ? props.map((pr) => `<div class="proposal"><div><strong><a href="freelancer.html?id=${pr.freelancerId}">${esc(pr.freelancerName)}</a></strong> · ${money(pr.price)}<p>${esc(pr.message)}</p></div>
              ${b.status === 'Asignada' ? '' : `<button class="btn btn--dark btn--sm" type="button" data-accept="${pr.id}" data-brief="${b.id}">Aceptar</button>`}</div>`).join('') : '<p class="note">Todavía no hay propuestas.</p>'}</div></article>`;
        }).join('')}</div>` : empty('No has publicado solicitudes.', '<a href="publicar.html">Publicar una solicitud</a>');
      },
      guardados() {
        const list = Saved.list().map((id) => DB.project(id)).filter(Boolean);
        $('#pn-guardados').innerHTML = list.length ? `<div class="grid grid--cards">${list.map(projectCard).join('')}</div>` : empty('Aún no guardas proyectos.', '<a href="proyectos.html">Explorar proyectos</a>');
      },
      mensajes() {
        const list = Messages.all().filter((m) => m.to === u.id);
        $('#pn-mensajes').innerHTML = list.length ? `<div class="stack">${list.map((m) => `<article class="order"><div><h3 class="order__title">${esc(m.fromName)}</h3>
          <p class="order__meta">${m.project ? 'Sobre: ' + esc(m.project) + ' · ' : ''}${fmtDate(m.date)}</p><p>${esc(m.text)}</p></div></article>`).join('')}</div>` : empty('No tienes mensajes.');
      },
    };
    const renderAll = () => tabs.forEach(([k]) => draw[k]());
    renderAll();
    document.addEventListener('saved-change', renderAll);
    document.addEventListener('data-change', renderAll);

    const h = location.hash.slice(1);
    if (tabs.some(([k]) => k === h)) $('#tab-' + h).click();

    const panel = $('#panel-tabs');
    panel.addEventListener('change', (e) => {
      const s = e.target.closest('[data-status]'); if (!s) return;
      Orders.setStatus(s.dataset.status, s.value); toast('Estado actualizado');
    });
    panel.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del && confirm('¿Eliminar este proyecto?')) {
        Store.set('projects', Store.get('projects', []).filter((p) => p.id !== del.dataset.del)); renderAll(); toast('Proyecto eliminado');
      }
      const acc = e.target.closest('[data-accept]');
      if (acc) {
        const briefs = Store.get('briefs', []), b = briefs.find((x) => x.id === acc.dataset.brief), pr = Proposals.all().find((x) => x.id === acc.dataset.accept);
        if (!b || !pr) return;
        b.status = 'Asignada'; Store.set('briefs', briefs);
        Orders.add({ id: 'o' + Date.now(), projectId: null, title: b.title, cat: b.cat, clientId: u.id, clientName: u.name, freelancerId: pr.freelancerId, freelancerName: pr.freelancerName, pkg: 'Propuesta aceptada', total: pr.price, days: b.days, notes: pr.message, status: 'En curso', date: new Date().toISOString() });
        renderAll(); toast('Propuesta aceptada. Revisa tus pedidos');
      }
    });
  },

  /* PUBLICAR (cliente: solicitud · freelancer: proyecto) */
  publicar() {
    const u = Auth.require(); if (!u) return;
    const root = $('#publish-root');

    if (u.role === 'cliente') {
      root.innerHTML = `<h1 class="section__title">Publica tu solicitud</h1>
        <p class="lead">Cuéntanos qué necesitas y recibe propuestas de freelancers con su precio.</p>
        <form class="form" id="brief-form">
          <label class="field"><span>Título</span><input name="title" required minlength="8" maxlength="90" placeholder="Ej. Logo para mi cafetería"></label>
          <label class="field"><span>Categoría</span><select name="cat" class="select" required>${catOptions()}</select></label>
          <label class="field"><span>Descripción</span><textarea name="desc" rows="5" required minlength="20" placeholder="Describe tu negocio, qué necesitas y el estilo que buscas"></textarea></label>
          <div class="field-row">
            <label class="field"><span>Presupuesto mínimo (S/)</span><input type="number" name="min" min="1" required></label>
            <label class="field"><span>Presupuesto máximo (S/)</span><input type="number" name="max" min="1" required></label>
            <label class="field"><span>Plazo (días)</span><input type="number" name="days" min="1" max="120" required value="7"></label>
          </div>
          <p class="form__error" id="form-error" role="alert"></p>
          <button class="btn btn--primary" type="submit">Publicar solicitud</button>
        </form>`;
      $('#brief-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        if (+d.max < +d.min) { $('#form-error').textContent = 'El presupuesto máximo debe ser mayor al mínimo.'; return; }
        const list = Store.get('briefs', []);
        list.unshift({ id: 'b' + Date.now(), clientId: u.id, clientName: u.name, title: d.title.trim(), cat: d.cat, min: +d.min, max: +d.max, days: +d.days, desc: d.desc.trim(), date: new Date().toISOString(), status: 'Abierta' });
        if (Store.set('briefs', list)) { toast('Solicitud publicada'); setTimeout(() => { location.href = 'perfil.html#solicitudes'; }, 800); }
      });
      return;
    }

    root.innerHTML = `<h1 class="section__title">Publica un proyecto</h1>
      <p class="lead">Muestra tu trabajo y define tus precios. Los clientes podrán cotizar y contratarte.</p>
      <form class="form" id="project-form">
        <label class="field"><span>Título</span><input name="title" required minlength="8" maxlength="90" placeholder="Ej. Identidad visual para cafetería"></label>
        <label class="field"><span>Categoría</span><select name="cat" id="p-cat" class="select" required>${catOptions(u.cat)}</select></label>
        <label class="field"><span>Descripción</span><textarea name="desc" rows="5" required minlength="30" placeholder="Qué hiciste, para quién y qué incluye el servicio"></textarea></label>
        <fieldset class="fieldset"><legend>Tus precios por paquete (S/)</legend>
          <div class="field-row">
            <label class="field"><span>Básico</span><input type="number" name="p0" min="1" required></label>
            <label class="field"><span>Estándar</span><input type="number" name="p1" min="1" required></label>
            <label class="field"><span>Premium</span><input type="number" name="p2" min="1" required></label>
          </div><p class="note">Precargamos el tarifario sugerido de la categoría; ajústalo a tu gusto.</p></fieldset>
        <label class="field"><span>Imagen principal</span><input type="file" name="image" id="p-img" accept="image/*" required></label>
        <img id="preview" class="preview" alt="" hidden>
        <p class="form__error" id="form-error" role="alert"></p>
        <button class="btn btn--primary" type="submit">Publicar proyecto</button>
      </form>`;
    const fill = () => {
      const c = CATEGORIES.find((x) => x.name === $('#p-cat').value); if (!c) return;
      c.prices.forEach((v, i) => { $(`[name=p${i}]`).value = v; });
    };
    $('#p-cat').addEventListener('change', fill); fill();
    $('#p-img').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { const url = await readImage(file); const pv = $('#preview'); pv.src = url; pv.hidden = false; } catch { toast('No se pudo leer la imagen'); }
    });
    $('#project-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target)), file = $('#p-img').files[0];
      let img; try { img = await readImage(file); } catch { $('#form-error').textContent = 'No se pudo leer la imagen.'; return; }
      const list = Store.get('projects', []);
      list.unshift({ id: 'c' + Date.now(), custom: true, title: d.title.trim(), cat: d.cat, f: u.id, img, desc: d.desc.trim(), pk: [+d.p0, +d.p1, +d.p2], likes: 0, views: 0, ago: 0 });
      if (Store.set('projects', list)) { toast('Proyecto publicado'); setTimeout(() => { location.href = 'perfil.html#proyectos'; }, 800); }
    });
  },

  /* OPORTUNIDADES (descuentos + solicitudes abiertas) */
  oportunidades() {
    let cat = 'Todos';
    const offers = DB.projects().filter((p) => p.featured);
    $('#offers').innerHTML = offers.map((p) => {
      const f = DB.freelancer(p.f), pr = Pricing.from(p), g = DB.gallery(p).slice(0, 4);
      return `<article class="offer"><div>
        <span class="chip chip--pink">${esc(p.cat)}</span><h3 class="offer__title">${esc(p.title)}</h3>
        <p class="offer__text">${esc(p.desc)}</p>
        <a class="author-line" href="freelancer.html?id=${f.id}">${avatar(f.name, 'avatar--xs')}<span>${esc(f.name)}</span></a>
        <p class="offer__prices"><span class="offer__now"><small>Ahora</small>${money(pr.now)}</span><span class="offer__old">${money(pr.base)} antes</span><span class="chip chip--ok">${pr.discount}% DSCTO</span></p>
        <a class="btn btn--dark" href="proyecto.html?id=${p.id}">Ver proyecto</a></div>
        <div class="offer__gallery">${g.map((x) => `<img src="${imgSrc(x)}" alt="" loading="lazy">`).join('')}</div></article>`;
    }).join('');

    const deals = CATEGORIES.map((c) => ({ c, d: Math.max(0, ...DB.projects().filter((p) => p.cat === c.name).map((p) => p.discount || 0)) })).filter((x) => x.d > 0);
    $('#deals').innerHTML = deals.map(({ c, d }) => `<li><button class="deal-badge" type="button" data-cat="${esc(c.name)}" aria-pressed="false">
      <img class="deal-badge__icon" src="${IMG(c.icon)}" alt=""><span class="deal-badge__name">${esc(c.name.toUpperCase())}</span>
      <span class="deal-badge__pct">${d}% DSCTO</span><span class="deal-badge__note">En algunos proyectos</span></button></li>`).join('');

    const drawDeals = () => {
      const list = DB.projects().filter((p) => p.discount && (cat === 'Todos' ? !p.featured : p.cat === cat));
      $('#deal-grid').innerHTML = list.length ? list.map(projectCard).join('') : empty('No hay descuentos en esta categoría por ahora.');
      $('#deal-filter').textContent = cat === 'Todos' ? 'Toca una categoría para filtrar' : `Mostrando: ${cat} (toca de nuevo para quitar el filtro)`;
    };
    $('#deals').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      cat = cat === b.dataset.cat ? 'Todos' : b.dataset.cat;
      $$('#deals [data-cat]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.cat === cat)); drawDeals();
    });
    drawDeals();

    const drawBriefs = () => {
      const open = DB.briefs().filter((b) => b.status !== 'Asignada');
      $('#brief-list').innerHTML = open.length ? open.map(briefCard).join('') : empty('No hay solicitudes abiertas.');
    };
    drawBriefs(); document.addEventListener('data-change', drawBriefs);
  },
};

document.addEventListener('DOMContentLoaded', () => {
  renderLayout();
  const fn = Pages[document.body.dataset.page];
  if (fn) fn();
});
