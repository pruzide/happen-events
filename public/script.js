import { EVENTS } from './events.js';

// Small vanilla JS application: authored catalogue, server-owned registrations.
const CATEGORIES = ['All events', ...new Set(EVENTS.map(event => event.category))];
const THEME_KEY = 'happen:theme:v1';
const SAVED_EVENTS_KEY = 'happen:events:v3';
const LEGACY_RECEIPTS_KEY = 'happen:confirmations:v2';
const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const TIME = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
const DAY = new Intl.DateTimeFormat('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' });
const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
const $ = selector => document.querySelector(selector);
const eventGrid = $('#eventsGrid');
const filterContainer = $('#categoryFilters');
const searchInput = $('#eventSearch');
const cityFilter = $('#cityFilter');
const eventDialog = $('#eventDialog');
const registrationDialog = $('#registrationDialog');
const confirmationDialog = $('#confirmationDialog');
const savedDialog = $('#savedDialog');
const form = $('#registrationForm');
let selectedCategory = 'All events';
let selectedEventId = null;
let featuredEvent = null;
let config = { enabled: false, local: false, siteKey: null };
let submitting = false;
let captchaToken = '';
let captchaWidgetId = null;
let captchaScriptPromise = null;
let savedEvents = readSavedEvents();

// Private browser shortcuts for event display only. Never persist participant details
// or server-generated confirmation IDs. Migrate old versions without exposing IDs.
function readSavedEvents() {
  try {
    const current = localStorage.getItem(SAVED_EVENTS_KEY);
    const legacy = current === null ? localStorage.getItem(LEGACY_RECEIPTS_KEY) : null;
    const data = JSON.parse(current ?? legacy ?? '[]');
    if (!Array.isArray(data)) return [];
    const unique = new Map();
    for (const item of data) {
      const event = item && typeof item.eventId === 'string' ? eventById(item.eventId) : null;
      if (!event || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) ||
          Date.parse(event.end) + 30 * 86400000 <= Date.now()) continue;
      unique.set(event.id, { eventId: event.id, createdAt: item.createdAt });
    }
    const visible = [...unique.values()].slice(-60);
    if (legacy !== null) localStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify(visible));
    localStorage.removeItem(LEGACY_RECEIPTS_KEY);
    return visible;
  } catch { return []; }
}
function saveSavedEvents() {
  try { localStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify(savedEvents)); } catch { /* Not available in private browsing; current UI still works. */ }
  updateSavedCount();
}
function updateSavedCount() {
  const badge = $('#registrationCount');
  badge.textContent = String(savedEvents.length);
  badge.hidden = savedEvents.length === 0;
}
function eventById(id) { return EVENTS.find(event => event.id === id); }
function isClosed(event) { return Date.now() >= Date.parse(event.date); }
function eventDateText(event) { return `${DATE.format(new Date(event.date))} · ${TIME.format(new Date(event.date))} IST`; }
function eventVenueText(event) { return event.venue.toLocaleLowerCase().includes(event.city.toLocaleLowerCase()) ? event.venue : `${event.venue}, ${event.city}`; }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
}
function posterUrl(event) {
  return /^assets\/[a-z0-9-]+\.svg$/.test(event.image) ? event.image : 'assets/favicon.svg';
}
function icon(type) {
  if (type === 'pin') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.7"/></svg>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
}
function buildFilters() {
  CATEGORIES.forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-btn';
    button.textContent = category;
    button.setAttribute('aria-pressed', String(category === selectedCategory));
    button.addEventListener('click', () => {
      selectedCategory = category;
      updateCategoryButtons();
      renderEvents();
    });
    filterContainer.append(button);
  });
  [...new Set(EVENTS.map(event => event.city))].sort().forEach(city => {
    const option = new Option(city, city);
    cityFilter.append(option);
  });
  EVENTS.forEach(event => $('#selectedEvent').append(new Option(`${event.title} — ${event.city}`, event.id)));
}
function updateCategoryButtons() {
  filterContainer.querySelectorAll('button').forEach(btn => btn.setAttribute('aria-pressed', String(btn.textContent === selectedCategory)));
}
function renderEvents() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const city = cityFilter.value;
  const matches = EVENTS.filter(event => {
    const text = [event.title, event.category, event.city, event.venue, event.excerpt].join(' ').toLocaleLowerCase();
    return (selectedCategory === 'All events' || event.category === selectedCategory) &&
      (city === 'all' || event.city === city) && (!query || text.includes(query));
  }).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  // Only authored catalogue records enter this template; text is encoded and image paths are allowlisted.
  eventGrid.innerHTML = matches.map(event => {
    const closed = isClosed(event);
    const title = escapeHtml(event.title);
    const id = escapeHtml(event.id);
    return `<article class="event-card">
      <button type="button" class="event-card-media" data-event-id="${id}" aria-label="View details for ${title}">
        <img src="${posterUrl(event)}" alt="Illustrated poster for ${title}" loading="lazy" width="400" height="500">
        <span class="card-date"><strong>${DAY.format(new Date(event.date))}</strong><small>${MONTH.format(new Date(event.date)).toUpperCase()}</small></span>
        ${closed ? '<span class="card-featured">REGISTRATION CLOSED</span>' : event.featured ? '<span class="card-featured">FEATURED</span>' : ''}
      </button>
      <div class="event-card-body"><span class="card-category">${escapeHtml(event.category)}</span><h3>${title}</h3>
        <p class="card-excerpt">${escapeHtml(event.excerpt)}</p>
        <div class="card-metadata"><span class="card-location">${icon('pin')} ${escapeHtml(event.venue)}</span><span class="card-time">${icon('clock')} ${TIME.format(new Date(event.date))} IST</span></div>
        <div class="card-divider"></div><div class="card-foot"><span class="card-price">${escapeHtml(event.price)}</span>
          <button class="card-view" type="button" data-event-id="${id}" aria-label="View details for ${title}">View details <span aria-hidden="true">↗</span></button>
        </div></div>
    </article>`;
  }).join('');
  $('#resultsCount').textContent = `${matches.length} event${matches.length === 1 ? '' : 's'} found`;
  $('#emptyState').hidden = matches.length > 0;
}
function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('modal-open');
}
function closeDialog(dialog) { if (dialog.open) dialog.close(); }
function showEventDetails(id) {
  const event = eventById(id);
  if (!event) return;
  selectedEventId = event.id;
  $('#detailImage').src = posterUrl(event);
  $('#detailImage').alt = `Illustrated poster for ${event.title}`;
  $('#detailCategory').textContent = event.category;
  $('#detailTitle').textContent = event.title;
  $('#detailDescription').textContent = event.description;
  $('#detailDate').textContent = `${eventDateText(event)} – ${TIME.format(new Date(event.end))} IST`;
  $('#detailVenue').textContent = event.venue;
  $('#detailPrice').textContent = event.price + ' (demo only; no payment taken)';
  $('#detailHighlights').replaceChildren(...event.highlights.map(thing => {
    const li = document.createElement('li');
    li.textContent = thing;
    return li;
  }));
  $('#detailRegister').disabled = isClosed(event);
  $('#detailRegister').textContent = isClosed(event) ? 'Registration closed' : 'Register for this event ↗';
  openDialog(eventDialog);
}
function clearErrors() {
  for (const id of ['fullName', 'email', 'phone', 'selectedEvent', 'consent']) $('#' + id).removeAttribute('aria-invalid');
  for (const id of ['nameError', 'emailError', 'phoneError', 'eventError', 'consentError', 'turnstileError']) $('#' + id).textContent = '';
  $('#formStatus').hidden = true;
}
function setError(field, errorId, message) {
  $('#' + field).setAttribute('aria-invalid', 'true');
  $('#' + errorId).textContent = message;
}
function formStatus(message) { $('#formStatus').textContent = message; $('#formStatus').hidden = !message; }
function validateRegistration() {
  clearErrors();
  const name = $('#fullName').value.trim().replace(/\s+/g, ' ');
  const email = $('#email').value.trim();
  const phone = $('#phone').value.trim();
  const eventId = $('#selectedEvent').value;
  let firstInvalid = null;
  function error(field, errorId, message) {
    setError(field, errorId, message);
    firstInvalid ||= $('#' + field);
  }
  if (name.length < 2 || name.length > 80 || !/^[\p{L}\p{M} .'-]+$/u.test(name) || !/\p{L}/u.test(name)) error('fullName', 'nameError', 'Enter a valid full name (2–80 characters).');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) error('email', 'emailError', 'Enter a valid email address.');
  if (!/^\+?\d{10,15}$/.test(phone.replace(/[\s().-]/g, ''))) error('phone', 'phoneError', 'Enter a valid phone number (10–15 digits).');
  if (!eventById(eventId) || isClosed(eventById(eventId))) error('selectedEvent', 'eventError', 'Select an upcoming event.');
  if (!$('#consent').checked) error('consent', 'consentError', 'Please agree to the privacy notice.');
  if (firstInvalid) { firstInvalid.focus(); return null; }
  return { name, email, phone, eventId, consent: true };
}
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!captchaScriptPromise) {
    captchaScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Verification did not initialize'));
      script.onerror = () => reject(new Error('Verification script was blocked'));
      document.head.append(script);
    }).catch(error => { captchaScriptPromise = null; throw error; });
  }
  return captchaScriptPromise;
}
async function prepareVerification() {
  captchaToken = '';
  const slot = $('#turnstileWidget');
  if (config.local) {
    captchaToken = 'local-development-only';
    slot.replaceChildren(); // No third-party challenge is needed on loopback.
    return;
  }
  slot.textContent = 'Loading verification…';
  try {
    const turnstile = await loadTurnstile();
    if (!registrationDialog.open) return;
    slot.replaceChildren();
    captchaWidgetId = turnstile.render(slot, {
      sitekey: config.siteKey,
      action: 'register',
      theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
      callback: token => { captchaToken = token; $('#turnstileError').textContent = ''; },
      'expired-callback': () => { captchaToken = ''; $('#turnstileError').textContent = 'Verification expired. Please retry.'; },
      'error-callback': () => { captchaToken = ''; $('#turnstileError').textContent = 'Could not verify. Refresh the page and retry.'; },
    });
  } catch {
    slot.textContent = 'Verification could not load. Check your internet connection and try again.';
  }
}
function resetVerification() {
  captchaToken = '';
  if (!config.local && captchaWidgetId !== null && window.turnstile) window.turnstile.reset(captchaWidgetId);
}
function openRegistration(id) {
  const event = eventById(id);
  if (!event || isClosed(event)) return;
  closeDialog(eventDialog);
  form.reset();
  clearErrors();
  $('#selectedEvent').value = event.id;
  $('#formStatus').textContent = '';
  $('#turnstileWidget').replaceChildren();
  captchaToken = '';
  if (captchaWidgetId !== null && window.turnstile && !config.local) {
    window.turnstile.remove(captchaWidgetId);
  }
  captchaWidgetId = null;
  openDialog(registrationDialog);
  $('#fullName').focus();
  if (!config.enabled) {
    formStatus('Registration is temporarily unavailable. Please try again later.');
    $('#submitRegistrationButton').disabled = true;
  } else {
    $('#submitRegistrationButton').disabled = false;
    void prepareVerification();
  }
}
async function submitRegistration(event) {
  event.preventDefault();
  if (submitting || !config.enabled) return;
  const values = validateRegistration();
  if (!values) return;
  if (!captchaToken) { $('#turnstileError').textContent = 'Please complete the verification.'; return; }
  submitting = true;
  const button = $('#submitRegistrationButton');
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Submitting…';
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, turnstileToken: captchaToken }),
      cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok) {
      if (result.field === 'email') setError('email', 'emailError', result.message);
      else if (result.field === 'selectedEvent') setError('selectedEvent', 'eventError', result.message);
      else if (result.field === 'turnstile') $('#turnstileError').textContent = result.message;
      else formStatus(result.message || 'Registration failed. Please try again.');
      resetVerification();
      return;
    }
    savedEvents = savedEvents.filter(item => item.eventId !== result.eventId);
    savedEvents.push({ eventId: result.eventId, createdAt: new Date().toISOString() });
    savedEvents = savedEvents.slice(-60);
    saveSavedEvents();
    closeDialog(registrationDialog);
    const selected = eventById(result.eventId);
    $('#confirmationMessage').textContent = 'Your registration was successful. Here are your event details.';
    $('#confirmationImage').src = posterUrl(selected);
    $('#confirmationEventName').textContent = selected.title;
    $('#confirmationEventDate').textContent = eventDateText(selected);
    $('#confirmationEventVenue').textContent = eventVenueText(selected);
    openDialog(confirmationDialog);
  } catch {
    formStatus('Could not reach the server. Check your connection and try again.');
    resetVerification();
  } finally {
    submitting = false;
    button.disabled = false;
    button.textContent = original;
  }
}
// UI projection: only present event information; server-generated IDs stay internal.
function renderSavedRegistrationsList() {
  const list = $('#savedList');
  list.replaceChildren();
  const events = [...savedEvents].reverse()
    .map(item => eventById(item.eventId))
    .filter(Boolean);
  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'saved-empty';
    const mark = document.createElement('span');
    mark.className = 'saved-empty-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '✳';
    const heading = document.createElement('h3');
    heading.textContent = 'Your next great plan starts here.';
    const message = document.createElement('p');
    message.textContent = 'Find an event you love and sign up to see it here.';
    const button = document.createElement('button');
    button.className = 'btn btn-dark';
    button.type = 'button';
    button.textContent = 'Explore events ↗';
    button.addEventListener('click', () => {
      closeDialog(savedDialog);
      $('#events').scrollIntoView({ behavior: 'smooth' });
    });
    empty.append(mark, heading, message, button);
    list.append(empty);
    return;
  }
  events.forEach(event => {
    const entry = document.createElement('article');
    entry.className = 'saved-item';
    const artwork = document.createElement('img');
    artwork.className = 'saved-artwork';
    artwork.src = posterUrl(event);
    artwork.alt = '';
    artwork.width = 78;
    artwork.height = 98;

    const content = document.createElement('div');
    content.className = 'saved-item-info';
    const status = document.createElement('span');
    status.className = 'registration-status';
    status.textContent = '✓ Registered';
    const title = document.createElement('h3');
    title.textContent = event.title;
    const when = document.createElement('p');
    when.textContent = eventDateText(event);
    const where = document.createElement('p');
    where.textContent = eventVenueText(event);
    content.append(status, title, when, where);

    const details = document.createElement('button');
    details.className = 'saved-details-btn';
    details.type = 'button';
    details.textContent = 'View details';
    details.setAttribute('aria-label', `View details for ${event.title}`);
    details.addEventListener('click', () => {
      closeDialog(savedDialog);
      showEventDetails(event.id);
    });
    entry.append(artwork, content, details);
    list.append(entry);
  });
}
function showSavedRegistrations() {
  renderSavedRegistrationsList();
  closeDialog(confirmationDialog);
  openDialog(savedDialog);
}
function updateCountdown() {
  if (!featuredEvent) return;
  const target = Date.parse(featuredEvent.date);
  let diff = Math.max(0, target - Date.now());
  const days = Math.floor(diff / 86400000); diff %= 86400000;
  const hours = Math.floor(diff / 3600000); diff %= 3600000;
  const minutes = Math.floor(diff / 60000); diff %= 60000;
  const seconds = Math.floor(diff / 1000);
  for (const [name, value] of Object.entries({ days, hours, minutes, seconds })) $('#' + name).textContent = String(value).padStart(2, '0');
  if (target <= Date.now()) $('.countdown-label').textContent = 'THIS EVENT HAS STARTED';
}
function setFeaturedEvent() {
  featuredEvent = EVENTS.filter(event => event.featured && !isClosed(event)).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0] ||
    EVENTS.filter(event => !isClosed(event)).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0] || null;
  if (!featuredEvent) {
    $('#featuredDetails').disabled = true;
    $('.countdown-label').textContent = 'NO UPCOMING EVENTS RIGHT NOW';
    $('#countdown').hidden = true;
    return;
  }
  $('#featuredImage').src = posterUrl(featuredEvent);
  $('#featuredImage').alt = `Illustrated poster for ${featuredEvent.title}`;
  $('.countdown-label').textContent = `COUNTING DOWN TO ${featuredEvent.title.toUpperCase()}`;
  updateCountdown();
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#themeToggle').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* No persistent preference in private mode. */ }
}
function closeMobileNav() {
  $('#mobileNav').hidden = true;
  $('#menuToggle').setAttribute('aria-expanded', 'false');
  $('#menuToggle').setAttribute('aria-label', 'Open menu');
}
function init() {
  $('#year').textContent = new Date().getFullYear();
  buildFilters();
  renderEvents();
  setFeaturedEvent();
  updateSavedCount();
  window.setInterval(updateCountdown, 1000);
  try { if (localStorage.getItem(THEME_KEY) === 'dark') setTheme('dark'); } catch { /* Ignore storage restriction. */ }
  fetch('/api/config').then(response => {
    if (!response.ok) throw new Error('Backend unavailable');
    return response.json();
  }).then(settings => { config = settings; }).catch(() => { config.enabled = false; });

  $('#themeToggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  searchInput.addEventListener('input', renderEvents);
  cityFilter.addEventListener('change', renderEvents);
  $('#heroSearchForm').addEventListener('submit', event => {
    event.preventDefault();
    searchInput.value = $('#heroSearch').value;
    selectedCategory = 'All events';
    cityFilter.value = 'all';
    updateCategoryButtons();
    renderEvents();
    $('#events').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    searchInput.focus({ preventScroll: true });
  });
  $('#resetFilters').addEventListener('click', () => { searchInput.value = ''; cityFilter.value = 'all'; selectedCategory = 'All events'; updateCategoryButtons(); renderEvents(); });
  eventGrid.addEventListener('click', event => {
    const button = event.target.closest('button[data-event-id]');
    if (button) showEventDetails(button.dataset.eventId);
  });
  $('#featuredDetails').addEventListener('click', () => { if (featuredEvent) showEventDetails(featuredEvent.id); });
  $('#detailRegister').addEventListener('click', () => openRegistration(selectedEventId));
  form.addEventListener('submit', submitRegistration);
  form.querySelectorAll('input,select').forEach(input => input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    const errorId = input.getAttribute('aria-describedby');
    if (errorId) $('#' + errorId).textContent = '';
  }));
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      if (dialog === registrationDialog && captchaWidgetId !== null && window.turnstile && !config.local) {
        window.turnstile.remove(captchaWidgetId);
        captchaWidgetId = null;
        captchaToken = '';
      }
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
    });
    dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(dialog); });
  });
  for (const id of ['myRegistrationsBtn', 'mobileRegistrationsBtn', 'footerRegistrationsBtn', 'viewMyRegistrations']) {
    $('#' + id).addEventListener('click', () => { closeMobileNav(); showSavedRegistrations(); });
  }
  $('#menuToggle').addEventListener('click', () => {
    const expanded = $('#menuToggle').getAttribute('aria-expanded') === 'true';
    $('#menuToggle').setAttribute('aria-expanded', String(!expanded));
    $('#menuToggle').setAttribute('aria-label', expanded ? 'Open menu' : 'Close menu');
    $('#mobileNav').hidden = expanded;
  });
  $('#mobileNav').querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileNav));
  window.matchMedia('(min-width: 651px)').addEventListener('change', event => { if (event.matches) closeMobileNav(); });
}

document.addEventListener('DOMContentLoaded', init);
