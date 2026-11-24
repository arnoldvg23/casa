import { connect, generateHomeCode, isDemo, normalizeCode, notificationsEnabled } from './store.js';
import { mountShopping } from './shopping.js';
import { mountWishes } from './wishes.js';
import { mountGifts } from './gifts.js';
import { mountFinances } from './finances.js';
import { ICONS, escapeHtml, toast } from './ui.js';

const PROFILE_KEY = 'casa.perfil';
const INSTALL_DISMISSED_KEY = 'casa.instalacion-descartada';
const NOTIFY_DISMISSED_KEY = 'casa.avisos-descartats';
const TAB_KEY = 'casa.pestanya';
const TABS = ['compra', 'casa', 'nadal', 'finances'];

const app = document.getElementById('app');
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isAndroid = /android/i.test(navigator.userAgent);

let installPrompt = null;
addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((error) => console.error('Service worker', error));
}

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY));
  } catch {
    return null;
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

const ACCOUNT_ERRORS = {
  'auth/email-already-in-use': 'Ja hi ha un compte amb aquest correu. Prova «Ja tinc compte».',
  'auth/credential-already-in-use': 'Ja hi ha un compte amb aquest correu. Prova «Ja tinc compte».',
  'auth/invalid-email': 'Aquest correu no és vàlid.',
  'auth/weak-password': 'La contrasenya ha de tenir almenys 6 caràcters.',
  'auth/missing-password': 'Escriu la contrasenya.',
  'auth/invalid-credential': 'El correu o la contrasenya no són correctes.',
  'auth/wrong-password': 'El correu o la contrasenya no són correctes.',
  'auth/user-not-found': 'El correu o la contrasenya no són correctes.',
  'auth/too-many-requests': 'Massa intents. Espera una estona i torna-ho a provar.',
  'auth/network-request-failed': 'Necessites connexió per fer això.',
  'auth/operation-not-allowed': 'Els comptes encara no estan activats a Firebase.',
};

const accountError = (error) => ACCOUNT_ERRORS[error?.code] ?? "No s'ha pogut fer. Torna-ho a provar.";

// Full per crear un compte o entrar-hi. `onDone` rep el perfil desat al compte
// (nom i llar) quan s'hi entra, o null quan es crea.
function openAccountSheet(backend, { mode, profile, onDone }) {
  const sheet = document.createElement('dialog');
  sheet.className = 'sheet';
  document.body.append(sheet);

  const render = () => {
    const creating = mode === 'create';
    sheet.innerHTML = `
      <form class="sheet-body" id="account-form" novalidate>
        <h2>${creating ? 'Crea el teu compte' : 'Entra al teu compte'}</h2>
        <p>${creating
          ? "Així no perds les teves coses si canvies de mòbil, i hi pots entrar des d'un altre."
          : 'Recuperaràs la teva llar i tot el que hi havies afegit.'}</p>
        <label class="field"><span>Correu</span><input id="account-email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" required></label>
        <label class="field"><span>Contrasenya${creating ? ' (mínim 6 caràcters)' : ''}</span><input id="account-password" type="password" minlength="6" autocomplete="${creating ? 'new-password' : 'current-password'}" required></label>
        <p class="error" id="account-error" role="alert" hidden></p>
        <button class="btn" type="submit" id="account-submit">${creating ? 'Crea el compte' : 'Entra'}</button>
        ${creating ? '' : '<button class="btn secondary" type="button" id="account-reset">He oblidat la contrasenya</button>'}
        <button class="btn secondary" type="button" id="account-switch">${creating ? 'Ja tinc compte' : 'Encara no tinc compte'}</button>
        <button class="btn danger" type="button" id="account-cancel">Cancel·la</button>
      </form>`;

    const email = sheet.querySelector('#account-email');
    const password = sheet.querySelector('#account-password');
    const error = sheet.querySelector('#account-error');
    const fail = (message) => { error.textContent = message; error.hidden = false; };

    sheet.querySelector('#account-switch').addEventListener('click', () => {
      mode = creating ? 'login' : 'create';
      render();
    });
    sheet.querySelector('#account-cancel').addEventListener('click', () => sheet.close());
    sheet.querySelector('#account-reset')?.addEventListener('click', async () => {
      if (!email.value.trim()) {
        fail('Escriu el teu correu i et enviarem un enllaç per canviar-la.');
        email.focus();
        return;
      }
      try {
        await backend.account.resetPassword(email.value.trim());
        toast("T'hem enviat un correu per canviar la contrasenya");
      } catch (problem) {
        fail(accountError(problem));
      }
    });
    sheet.querySelector('#account-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      error.hidden = true;
      const submit = sheet.querySelector('#account-submit');
      submit.disabled = true;
      try {
        if (creating) {
          await backend.account.create(email.value.trim(), password.value, profile);
          sheet.close();
          toast('Compte creat');
          onDone(null);
        } else {
          const saved = await backend.account.signIn(email.value.trim(), password.value, profile?.home);
          sheet.close();
          onDone(saved);
        }
      } catch (problem) {
        console.error(problem);
        fail(accountError(problem));
      } finally {
        submit.disabled = false;
      }
    });
  };

  render();
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) sheet.close();
  });
  sheet.addEventListener('close', () => sheet.remove());
  sheet.showModal();
}

function renderWelcome(backend) {
  const invited = new URLSearchParams(location.search).get('llar');

  app.innerHTML = `
    <main class="welcome">
      <img src="icons/icon-192.png" alt="">
      <h1>Casa</h1>
      <p>${invited ? 'Et conviden a la llista de la compra de casa.' : 'La llista de la compra de tota la família.'}</p>
      <label class="field"><span>El teu nom</span><input id="name" maxlength="30" autocomplete="given-name" autocapitalize="words"></label>
      ${invited ? '' : '<button class="btn" id="create" type="button">Crea la nostra llar</button><div class="divider">o</div>'}
      <label class="field"><span>Codi de la llar</span><input id="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JKMN" value="${escapeHtml(invited ? normalizeCode(invited) : '')}"></label>
      <button class="btn ${invited ? '' : 'secondary'}" id="join" type="button">Uneix-me amb el codi</button>
      <p class="error" id="error" role="alert" hidden></p>
      <button class="link-btn" id="login" type="button">Ja tinc compte: entra-hi</button>
    </main>`;

  const nameInput = app.querySelector('#name');
  const error = app.querySelector('#error');
  const fail = (message) => {
    error.textContent = message;
    error.hidden = false;
  };

  async function enter(getCode, button) {
    const name = nameInput.value.trim();
    if (!name) {
      fail('Escriu el teu nom perquè la família sàpiga qui afegeix cada cosa.');
      nameInput.focus();
      return;
    }
    error.hidden = true;
    button.disabled = true;
    try {
      const code = await getCode();
      if (!code) return;
      const profile = { name, home: code };
      saveProfile(profile);
      history.replaceState(null, '', location.pathname);
      renderHome(backend, profile);
    } catch (problem) {
      console.error(problem);
      fail(navigator.onLine ? "No s'ha pogut connectar. Torna-ho a provar." : 'Necessites connexió la primera vegada.');
    } finally {
      button.disabled = false;
    }
  }

  app.querySelector('#login').addEventListener('click', () => openAccountSheet(backend, {
    mode: 'login',
    onDone(saved) {
      if (saved?.home) {
        const profile = { name: saved.name || 'Jo', home: saved.home };
        saveProfile(profile);
        history.replaceState(null, '', location.pathname);
        renderHome(backend, profile);
        return;
      }
      toast('Ja has entrat. Ara crea la llar o uneix-te amb el codi.');
      if (saved?.name && !nameInput.value) nameInput.value = saved.name;
    },
  }));

  app.querySelector('#create')?.addEventListener('click', (event) => enter(async () => {
    const code = generateHomeCode();
    await backend.createHome(code);
    return code;
  }, event.currentTarget));

  app.querySelector('#join').addEventListener('click', (event) => enter(async () => {
    const code = normalizeCode(app.querySelector('#code').value);
    if (!code) {
      fail('Escriu el codi de la llar.');
      return null;
    }
    if (await backend.homeExists(code)) return code;
    fail('No trobo aquesta llar. Revisa el codi.');
    return null;
  }, event.currentTarget));
}

function installHint() {
  if (isStandalone) return null;
  if (installPrompt) return { text: 'Instal·la Casa per obrir-la com una app.', action: 'Instal·la' };
  if (isIos) return { text: "Per instal·lar-la: botó Compartir i «Afegeix a la pantalla d'inici»." };
  if (isAndroid) return { text: "Per instal·lar-la: menú del navegador i «Instal·la l'aplicació»." };
  return null;
}

function renderInstallNotice(container) {
  const hint = installHint();
  if (!hint || localStorage.getItem(INSTALL_DISMISSED_KEY)) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.innerHTML = `
    <span>${hint.text}</span>
    ${hint.action ? `<button type="button" id="install">${hint.action}</button>` : ''}
    <button type="button" id="dismiss-install" aria-label="Tanca l'avís">Tanca</button>`;

  container.querySelector('#install')?.addEventListener('click', async () => {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    container.hidden = true;
  });
  container.querySelector('#dismiss-install').addEventListener('click', () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
    container.hidden = true;
  });
}

// A l'iPhone les notificacions web només existeixen amb l'app instal·lada.
const canNotify = (backend) => notificationsEnabled
  && Boolean(backend.enableNotifications)
  && 'serviceWorker' in navigator
  && 'Notification' in window
  && (!isIos || isStandalone);

async function enableNotifications(backend, profile) {
  try {
    if ((await Notification.requestPermission()) !== 'granted') {
      toast('Cal permetre les notificacions al mòbil');
      return false;
    }
    await backend.enableNotifications(profile.home, profile.name);
    toast('Notificacions activades');
    return true;
  } catch (error) {
    console.error(error);
    toast("No s'han pogut activar les notificacions");
    return false;
  }
}

function renderNotifyNotice(container, backend, profile) {
  if (!canNotify(backend) || Notification.permission !== 'default' || localStorage.getItem(NOTIFY_DISMISSED_KEY)) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.innerHTML = `
    <span>Rep un avís quan algú afegeixi alguna cosa a la llista.</span>
    <button type="button" id="enable-notify">Activa</button>
    <button type="button" id="dismiss-notify" aria-label="Tanca l'avís">Tanca</button>`;

  container.querySelector('#enable-notify').addEventListener('click', async () => {
    await enableNotifications(backend, profile);
    container.hidden = true;
  });
  container.querySelector('#dismiss-notify').addEventListener('click', () => {
    localStorage.setItem(NOTIFY_DISMISSED_KEY, '1');
    container.hidden = true;
  });
}

async function shareInvite(code) {
  const link = new URL('./', location.href);
  link.searchParams.set('llar', code);
  const text = `Uneix-te a la nostra llista de la compra a Casa. Codi de la llar: ${code}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Casa', text, url: link.href });
    } catch (error) {
      if (error.name !== 'AbortError') toast("No s'ha pogut compartir");
    }
    return;
  }
  await navigator.clipboard.writeText(`${text}\n${link.href}`);
  toast('Invitació copiada');
}

function renderSettings(backend, profile) {
  const showNotify = canNotify(backend) && Notification.permission !== 'granted';
  const account = backend.account.current();
  const accountBlock = account.anonymous
    ? `<p>Ara les teves coses només són en aquest mòbil. Crea un compte per no perdre-les i entrar-hi des d'un altre.</p>
      <button class="btn secondary" type="button" id="account-create">Crea el teu compte</button>
      <button class="link-btn" type="button" id="account-login">Ja tinc compte: entra-hi</button>`
    : `<p>Has entrat com a <strong>${escapeHtml(account.email ?? '')}</strong>.</p>`;
  const sheet = document.createElement('dialog');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="sheet-body">
      <h2>La teva llar</h2>
      <label class="field"><span>El teu nom</span><input id="profile-name" maxlength="30" value="${escapeHtml(profile.name)}"></label>
      ${accountBlock}
      <p>Comparteix aquest codi amb la família:</p>
      <div class="code">${escapeHtml(profile.home)}</div>
      <button class="btn dark" type="button" id="invite">Convida la família</button>
      ${showNotify ? '<button class="btn secondary" type="button" id="notify">Activa les notificacions</button>' : ''}
      <button class="btn secondary" type="button" id="close">Fet</button>
      ${account.anonymous ? '' : '<button class="btn danger" type="button" id="logout">Tanca la sessió</button>'}
      <button class="btn danger" type="button" id="leave">Surt d'aquesta llar</button>
    </div>`;
  document.body.append(sheet);

  sheet.querySelector('#invite').addEventListener('click', () => shareInvite(profile.home));
  sheet.querySelector('#notify')?.addEventListener('click', async (event) => {
    if (await enableNotifications(backend, profile)) event.target.hidden = true;
  });
  sheet.querySelector('#close').addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) sheet.close();
  });
  sheet.querySelector('#account-create')?.addEventListener('click', () => {
    sheet.close();
    openAccountSheet(backend, { mode: 'create', profile: { name: profile.name, home: profile.home }, onDone() {} });
  });
  sheet.querySelector('#account-login')?.addEventListener('click', () => {
    sheet.close();
    openAccountSheet(backend, {
      mode: 'login',
      profile,
      // Cada secció escolta amb l'uid de qui ha obert l'app: es torna a carregar amb el del compte.
      onDone(saved) {
        saveProfile(saved?.home ? { name: saved.name || profile.name, home: saved.home } : profile);
        location.reload();
      },
    });
  });
  sheet.querySelector('#logout')?.addEventListener('click', async () => {
    if (!confirm("Sortiràs del compte en aquest mòbil. Hi podràs tornar a entrar amb el correu i la contrasenya.")) return;
    await backend.account.signOut();
    localStorage.removeItem(PROFILE_KEY);
    location.reload();
  });
  sheet.querySelector('#leave').addEventListener('click', async () => {
    if (!confirm('Deixaràs de veure aquesta llista en aquest mòbil. Hi podràs tornar amb el codi.')) return;
    localStorage.removeItem(PROFILE_KEY);
    // Amb compte, sortir de la llar també tanca la sessió en aquest mòbil.
    if (!backend.account.current().anonymous) await backend.account.signOut();
    location.reload();
  });
  sheet.addEventListener('close', () => {
    const name = sheet.querySelector('#profile-name').value.trim();
    if (name && name !== profile.name) {
      profile.name = name;
      saveProfile(profile);
      renderHome(backend, profile);
    }
    sheet.remove();
  });
  sheet.showModal();
}

function renderHome(backend, profile) {
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <h1>Hola, ${escapeHtml(profile.name)}!</h1>
        <div class="topbar-actions">
          <button class="round-btn" type="button" id="share" aria-label="Convida la família">${ICONS.invite}</button>
          <button class="round-btn" type="button" id="settings" aria-label="Ajustos de la llar">${ICONS.settings}</button>
        </div>
      </header>
      <div class="notice" id="demo" ${isDemo ? '' : 'hidden'}><span>Mode de prova: la llista només es desa en aquest dispositiu.</span></div>
      <div class="notice" id="offline" hidden><span>Sense connexió. Els canvis s'enviaran quan la recuperis.</span></div>
      <div class="notice" id="install-notice" hidden></div>
      <div class="notice" id="notify-notice" hidden></div>
      <main>
        <section id="view-compra" aria-label="Llista de la compra"></section>
        <section id="view-casa" aria-label="Llista per a casa" hidden></section>
        <section id="view-nadal" aria-label="Llista de Nadal" hidden></section>
        <section id="view-finances" aria-label="Les teves finances" hidden></section>
      </main>
    </div>
    <nav class="tabbar" aria-label="Seccions">
      <button class="tab" type="button" data-tab="compra" aria-label="Compra">${ICONS.cart}<span>Compra</span></button>
      <button class="tab" type="button" data-tab="casa" aria-label="Per a casa">${ICONS.sofa}<span>Per a casa</span></button>
      <button class="tab" type="button" data-tab="nadal" aria-label="Nadal">${ICONS.gift}<span>Nadal</span></button>
      <button class="tab" type="button" data-tab="finances" aria-label="Finances">${ICONS.wallet}<span>Finances</span></button>
    </nav>`;

  const offline = app.querySelector('#offline');
  const updateConnection = () => { offline.hidden = navigator.onLine; };
  addEventListener('online', updateConnection);
  addEventListener('offline', updateConnection);
  updateConnection();

  const installNotice = app.querySelector('#install-notice');
  renderInstallNotice(installNotice);
  addEventListener('beforeinstallprompt', () => renderInstallNotice(installNotice));

  renderNotifyNotice(app.querySelector('#notify-notice'), backend, profile);
  // El token de notificacions pot canviar: es refresca en cada obertura.
  if (canNotify(backend) && Notification.permission === 'granted') {
    backend.enableNotifications(profile.home, profile.name).catch(console.error);
  }

  app.querySelector('#share').addEventListener('click', () => shareInvite(profile.home));
  app.querySelector('#settings').addEventListener('click', () => renderSettings(backend, profile));

  backend.account.remember({ name: profile.name, home: profile.home });
  const store = backend.open(profile.home);
  mountShopping(app.querySelector('#view-compra'), { store, profile, toast });
  mountWishes(app.querySelector('#view-casa'), { store: store.wishes, profile, toast });
  mountGifts(app.querySelector('#view-nadal'), { store: store.gifts, profile, toast });
  mountFinances(app.querySelector('#view-finances'), {
    store: store.finances,
    isAnonymous: backend.account.current().anonymous,
    openAccount: () => openAccountSheet(backend, {
      mode: 'create',
      profile: { name: profile.name, home: profile.home },
      onDone: () => renderHome(backend, profile),
    }),
    toast,
  });

  // Les seccions queden muntades i escoltant canvis; la pestanya només decideix quina es veu.
  const showTab = (tab) => {
    const active = TABS.includes(tab) ? tab : TABS[0];
    TABS.forEach((name) => {
      app.querySelector(`#view-${name}`).hidden = name !== active;
      const button = app.querySelector(`.tab[data-tab="${name}"]`);
      button.classList.toggle('active', name === active);
      button.setAttribute('aria-current', name === active ? 'page' : 'false');
    });
    try { localStorage.setItem(TAB_KEY, active); } catch { /* sense emmagatzematge no es recorda la pestanya */ }
  };
  app.querySelector('.tabbar').addEventListener('click', (event) => {
    const tab = event.target.closest('.tab')?.dataset.tab;
    if (!tab) return;
    showTab(tab);
    scrollTo(0, 0);
  });
  showTab(localStorage.getItem(TAB_KEY));
}

async function start() {
  try {
    const backend = await connect();
    const profile = loadProfile();
    if (profile?.home) renderHome(backend, profile);
    else renderWelcome(backend);
  } catch (error) {
    console.error(error);
    app.innerHTML = "<div class=\"empty\"><strong>No s'ha pogut obrir Casa</strong><p>Comprova la connexió i torna-la a obrir.</p></div>";
  }
}

start();
