(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const app = $('.app'), form = $('#calc'), result = $('#result'), title = $('#title');
  const stepsLis = $$('.steps li'), sections = $$('section[data-step]', form);
  const state = { step: 1, adults: 1, kids: 0, pets: 0, housingType: 'studio', from: null, to: null };
  let DATA = null, lastCalc = null;

  /* ---------- Данные ---------- */
  fetch('data.json').then(r => r.json()).then(d => { DATA = d; initCombos(); })
    .catch(() => showError('Не удалось загрузить data.json. Откройте сайт через локальный сервер (например, python -m http.server).'));

  /* ---------- Экраны и визард ---------- */
  function goTo(n) {
    state.step = n;
    app.dataset.step = n;
    title.textContent = 'Рассчитайте свой переезд';
    sections.forEach(s => s.hidden = +s.dataset.step !== n);
    form.hidden = false; result.hidden = true;
    stepsLis.forEach((li, i) => {
      li.classList.toggle('is-done', i + 1 < n);
      li.classList.toggle('is-current', i + 1 === n);
      li.toggleAttribute('aria-current', i + 1 === n);
      if (i + 1 === n) li.setAttribute('aria-current', 'step');
    });
    form.classList.remove('panel'); void form.offsetWidth; form.classList.add('panel'); // перезапуск анимации
    const first = $('input:not([type=hidden]), button', sections[n - 1]);
    if (n > 1 && first) first.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
  function showResult() {
    app.dataset.step = 'result';
    form.hidden = true; result.hidden = false;
    title.textContent = 'Итоговая стоимость переезда';
    title.focus?.();
    window.scrollTo({ top: 0 });
  }
  function showError(msg) { const e = $('#err1'); e.textContent = msg; e.hidden = !msg; }

  form.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-prev')) goTo(state.step - 1);
    if (b.hasAttribute('data-next') && validate(state.step)) goTo(state.step + 1);
    if (b.hasAttribute('data-submit')) { render(calculate()); showResult(); }
  });
  form.addEventListener('submit', e => e.preventDefault());

  function validate(step) {
    if (step === 1) {
      if (!DATA) return showError('Данные ещё загружаются, попробуйте через секунду.'), false;
      const f = findCity(DATA.origins, $('#from').value), t = findCity(DATA.destinations, $('#to').value);
      if (!f || !t) return showError(!f ? 'Выберите город отправления из списка.' : 'Выберите город назначения из списка.'), false;
      state.from = f; state.to = t; $('#from').value = f.name; $('#to').value = t.name; showError('');
    }
    if (step === 2) {
      const n = $('#baggage'); if (n.value === '' || +n.value < 0) n.value = 0;
    }
    return true;
  }
  const findCity = (list, v) => list.find(c => c.name.toLowerCase() === v.trim().toLowerCase());

  /* ---------- Автокомплит городов ---------- */
  function initCombos() {
    combo($('#from'), $('#from-list'), DATA.origins);
    combo($('#to'), $('#to-list'), DATA.destinations);
  }
  function combo(input, list, items) {
    const wrap = input.parentElement; let active = -1;
    const open = o => { wrap.classList.toggle('is-open', o); list.hidden = !o; input.setAttribute('aria-expanded', o); if (!o) active = -1; };
    function render() {
      const q = input.value.trim().toLowerCase();
      const found = items.filter(c => !q || c.name.toLowerCase().includes(q) || (c.country || '').toLowerCase().startsWith(q))
        .sort((a, b) => a.name.toLowerCase().startsWith(q) ? -1 : b.name.toLowerCase().startsWith(q) ? 1 : 0);
      list.innerHTML = found.map((c, i) => `<li role="option" id="${list.id}-${i}" data-name="${c.name}">${c.name}${c.country ? `, ${c.country}` : ''}</li>`).join('');
      open(found.length > 0);
    }
    const pick = li => { input.value = li.dataset.name; open(false); showError(''); };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('blur', () => setTimeout(() => open(false), 120));
    list.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(li); } });
    input.addEventListener('keydown', e => {
      const lis = $$('li', list);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (list.hidden) render();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + lis.length) % lis.length;
        lis.forEach((l, i) => l.classList.toggle('is-active', i === active));
        input.setAttribute('aria-activedescendant', lis[active]?.id || '');
      } else if (e.key === 'Enter' && !list.hidden) { e.preventDefault(); pick(lis[active] || lis[0]); }
      else if (e.key === 'Escape') open(false);
    });
  }

  /* ---------- Счётчики ---------- */
  $$('.counter').forEach(c => {
    const [minus, plus] = $$('button', c), out = $('output', c);
    const { name, min, max } = c.dataset;
    const set = v => { v = Math.max(+min, Math.min(+max, v)); state[name] = v; out.textContent = v; minus.disabled = v <= +min; plus.disabled = v >= +max; };
    minus.onclick = () => set(state[name] - 1);
    plus.onclick = () => set(state[name] + 1);
    c.set = set; set(+out.textContent);
  });

  /* ---------- Условные поля ---------- */
  const val = n => form.elements[n].value;
  function syncConditional() {
    $('#ticket-class').hidden = val('transport') === 'car';
    $('#housing-type').hidden = val('housing') === 'own';
  }
  form.addEventListener('change', syncConditional); syncConditional();

  /* ---------- Кастомный select ---------- */
  const sel = $('.select'), selBtn = $('.select__btn', sel), selList = $('.select__list', sel), selVal = $('#ht-val');
  const toggleSel = o => { sel.classList.toggle('is-open', o); selList.hidden = !o; selBtn.setAttribute('aria-expanded', o); };
  selBtn.onclick = () => toggleSel(selList.hidden);
  selList.addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    $$('li', selList).forEach(l => l.setAttribute('aria-selected', l === li));
    state.housingType = li.dataset.value; selVal.textContent = li.textContent; toggleSel(false); selBtn.focus();
  });
  document.addEventListener('click', e => { if (!sel.contains(e.target)) toggleSel(false); });
  sel.addEventListener('keydown', e => {
    if (e.key === 'Escape') { toggleSel(false); selBtn.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); const lis = $$('li', selList);
      const i = lis.findIndex(l => l.getAttribute('aria-selected') === 'true');
      lis[(i + (e.key === 'ArrowDown' ? 1 : -1) + lis.length) % lis.length].click(); toggleSel(true);
    }
  });

  /* ---------- Расчёт ---------- */
  function calculate() {
    const R = DATA.routes[`${state.from.id}-${state.to.id}`];
    const { adults, kids, pets } = state, people = adults + kids;
    const transport = val('transport'), kg = +$('#baggage').value || 0;

    // билеты
    let tickets;
    if (transport === 'car') tickets = R.tickets.car;
    else tickets = R.tickets[transport] * R.classMultiplier[val('ticketClass')] * (adults + kids * R.tickets.childFactor);
    tickets += pets * R.tickets.petFee[transport];

    // жильё
    const h = val('housing'); let housing = 0;
    if (h === 'rent') housing = R.housing.rentMonthly[state.housingType] * (1 + R.housing.depositMonths);
    if (h === 'temporary') housing = R.housing.temporaryNightly * R.housing.temporaryNights * Math.ceil(adults / 2) * (state.housingType === 'house' ? 1.6 : 1);

    // перевозка вещей
    const b = R.baggage[transport];
    const cargo = kg > 0 ? R.baggage.handling + Math.max(0, kg - b.freeKgPerPerson * people) * b.perKg : 0;

    // доп. расходы
    const extras = $$('input[name=extras]:checked').reduce((s, i) =>
      s + R.extras[i.value] * (DATA.perPersonExtras.includes(i.value) ? people : 1), 0);

    const cur = DATA.currencies[val('currency')];
    const step = { rub: 500, eur: 10, usd: 10 }[val('currency')];
    const conv = v => Math.round(v * cur.rate / step) * step;
    const rows = [
      ['Билеты', tickets],
      ['Жильё на первое время', housing],
      ['Перевозка вещей', cargo],
      ['Доп. расходы', extras]
    ].map(([l, v]) => [l, conv(v)]);
    return { rows, total: rows.reduce((s, r) => s + r[1], 0), cur, route: `${state.from.name} → ${state.to.name}, ${state.to.country}` };
  }

  const money = (n, cur) => `${cur.symbol}\u00A0${n.toLocaleString('ru-RU').replace(/\u202F/g, '\u00A0')}`;
  function render(c) {
    lastCalc = c;
    $('#route').textContent = c.route;
    $('#total').textContent = money(c.total, c.cur);
    $('#breakdown').innerHTML = c.rows.map(([l, v]) => `<div><dt>${l}</dt><dd>${money(v, c.cur)}</dd></div>`).join('');
  }

  /* ---------- Скачать / сбросить ---------- */
  $('#download').onclick = () => {
    const c = lastCalc; if (!c) return;
    const txt = [`Расчёт переезда: ${c.route}`, '', ...c.rows.map(([l, v]) => `${l}: ${money(v, c.cur)}`), '', `Итого: ${money(c.total, c.cur)}`, '(ориентировочная сумма)'].join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' })), download: 'raschet-pereezda.txt' });
    a.click(); URL.revokeObjectURL(a.href);
  };
  $('#reset').onclick = () => {
    form.reset(); $$('.counter').forEach(c => c.set(+c.dataset.min));
    $$('li', selList).forEach((l, i) => l.setAttribute('aria-selected', i === 0));
    state.housingType = 'studio'; selVal.textContent = 'Студия';
    syncConditional(); showError(''); goTo(1);
  };
  goTo(1);
})();
