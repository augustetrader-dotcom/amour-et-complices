/* ================= CONFIGURATION & ÉTAT ================= */
const cfg = window.APP_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const API = cfg.API_BASE;
const API_TIMEOUT_MS = 15000;
let cloudinaryConfigPromise = Promise.resolve();

try {
  const cachedCloudinaryConfig = JSON.parse(localStorage.getItem("cloudinary_public_config") || "null");
  if (cachedCloudinaryConfig?.cloudinaryCloudName && cachedCloudinaryConfig?.cloudinaryUploadPreset) {
    cfg.CLOUDINARY_CLOUD_NAME = cachedCloudinaryConfig.cloudinaryCloudName;
    cfg.CLOUDINARY_UPLOAD_PRESET = cachedCloudinaryConfig.cloudinaryUploadPreset;
  }
} catch (error) {}

async function loadCloudinaryPublicConfig() {
  if (!API) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${API}/api/public-config`, { signal: controller.signal });
    if (!response.ok) return;
    const publicConfig = await response.json();
    if (!publicConfig.cloudinaryCloudName || !publicConfig.cloudinaryUploadPreset) return;
    cfg.CLOUDINARY_CLOUD_NAME = publicConfig.cloudinaryCloudName;
    cfg.CLOUDINARY_UPLOAD_PRESET = publicConfig.cloudinaryUploadPreset;
    localStorage.setItem("cloudinary_public_config", JSON.stringify(publicConfig));
  } catch (error) {
  } finally {
    clearTimeout(timeout);
  }
}

/* ================= ÉCRAN DE CHARGEMENT ================= */
function showLoadingScreen() {
  document.getElementById('loadingScreen').style.display = 'flex';
  document.getElementById('phoneFrame').style.display = 'none';
}

function hideLoadingScreen() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('phoneFrame').style.display = 'flex';
}

/* ================= QUESTIONNAIRE D'AMOUR ================= */
let loveQuizQuestions = [];
let currentQuizQuestion = 0;
let quizResponses = {};

async function loadLoveQuizQuestions() {
  try {
    const response = await fetch(`${API}/api/love-quiz/questions`);
    const data = await response.json();
    loveQuizQuestions = data.questions;
    return data;
  } catch (error) {
    // Erreur silencieuse pour le développement
    return null;
  }
}

function showLoveQuizScreen() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('loveQuizScreen').style.display = 'flex';
  document.getElementById('phoneFrame').style.display = 'none';
  
  loadAndRenderQuiz();
}

function hideLoveQuizScreen() {
  document.getElementById('loveQuizScreen').style.display = 'none';
  document.getElementById('phoneFrame').style.display = 'flex';
}

async function loadAndRenderQuiz() {
  const questionsData = await loadLoveQuizQuestions();
  if (!questionsData) {
    console.error("Impossible de charger les questions du questionnaire");
    hideLoveQuizScreen();
    return;
  }
  
  renderQuizProgress();
  renderCurrentQuestion();
}

function renderQuizProgress() {
  const dotsContainer = document.getElementById('quizProgressDots');
  dotsContainer.innerHTML = '';
  
  loveQuizQuestions.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';
    
    if (index < currentQuizQuestion) {
      dot.classList.add('completed');
    } else if (index === currentQuizQuestion) {
      dot.classList.add('active');
    }
    
    dotsContainer.appendChild(dot);
  });
}

function renderCurrentQuestion() {
  const question = loveQuizQuestions[currentQuizQuestion];
  const content = document.getElementById('quizContent');
  
  let html = `
    <div class="quiz-question">
      <div class="quiz-question-text">${question.question}</div>
      <div class="quiz-options">
  `;
  
  if (question.type === 'single_choice') {
    question.options.forEach(option => {
      const isSelected = quizResponses[question.id] === option.value;
      html += `
        <div class="quiz-option ${isSelected ? 'selected' : ''}" 
             onclick="selectQuizOption(${question.id}, '${option.value}', 'single')">
          <div class="quiz-option-icon">${option.icon}</div>
          <div class="quiz-option-label">${option.label}</div>
        </div>
      `;
    });
  } else if (question.type === 'multiple_choice') {
    const selectedValues = quizResponses[question.id] || [];
    question.options.forEach(option => {
      const isSelected = selectedValues.includes(option.value);
      html += `
        <div class="quiz-option ${isSelected ? 'selected' : ''}" 
             onclick="selectQuizOption(${question.id}, '${option.value}', 'multiple')">
          <div class="quiz-option-multiple">
            <div class="quiz-checkbox ${isSelected ? 'checked' : ''}"></div>
            <div class="quiz-option-icon">${option.icon}</div>
          </div>
          <div class="quiz-option-label">${option.label}</div>
        </div>
      `;
    });
  }
  
  html += `
      </div>
    </div>
  `;
  
  content.innerHTML = html;
  
  // Mettre à jour les boutons
  document.getElementById('quizBackBtn').style.display = currentQuizQuestion > 0 ? 'block' : 'none';
  document.getElementById('quizNextBtn').style.display = currentQuizQuestion < loveQuizQuestions.length - 1 ? 'block' : 'none';
  document.getElementById('quizSubmitBtn').style.display = currentQuizQuestion === loveQuizQuestions.length - 1 ? 'block' : 'none';
}

function selectQuizOption(questionId, value, type) {
  if (type === 'single') {
    quizResponses[questionId] = value;
  } else if (type === 'multiple') {
    if (!quizResponses[questionId]) {
      quizResponses[questionId] = [];
    }
    
    const index = quizResponses[questionId].indexOf(value);
    if (index > -1) {
      quizResponses[questionId].splice(index, 1);
    } else {
      quizResponses[questionId].push(value);
    }
  }
  
  renderCurrentQuestion();
}

function nextQuizQuestion() {
  const currentQuestion = loveQuizQuestions[currentQuizQuestion];
  
  // Validation : vérifier que l'utilisateur a répondu à la question actuelle
  if (!quizResponses[currentQuestion.id]) {
    alert("Veuillez sélectionner au moins une option avant de continuer.");
    return;
  }
  
  // Pour les questions à choix multiples, vérifier qu'il y a au moins une sélection
  if (currentQuestion.type === 'multiple_choice') {
    const answers = quizResponses[currentQuestion.id];
    if (!Array.isArray(answers) || answers.length === 0) {
      alert("Veuillez sélectionner au moins une option avant de continuer.");
      return;
    }
  }
  
  if (currentQuizQuestion < loveQuizQuestions.length - 1) {
    currentQuizQuestion++;
    renderQuizProgress();
    renderCurrentQuestion();
  }
}

function previousQuizQuestion() {
  if (currentQuizQuestion > 0) {
    currentQuizQuestion--;
    renderQuizProgress();
    renderCurrentQuestion();
  }
}

async function submitLoveQuiz() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    
    const response = await fetch(`${API}/api/love-quiz/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        responses: quizResponses
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Appliquer les paramètres de personnalisation
      if (result.personalization_settings) {
        applyPersonalizationSettings(result.personalization_settings);
      }
      
      hideLoveQuizScreen();
      init();
    } else {
      alert("Erreur lors de la sauvegarde. Veuillez réessayer.");
    }
  } catch (error) {
    alert("Erreur lors de la soumission. Veuillez réessayer.");
  }
}

function applyPersonalizationSettings(settings) {
  // Appliquer le thème
  if (settings.theme && settings.theme !== 'default') {
    document.body.className = `theme-${settings.theme}`;
    localStorage.setItem('theme', settings.theme);
  }
  
  // Autres paramètres de personnalisation peuvent être appliqués ici
}

async function startApp() {
  showLoadingScreen();
  registerServiceWorkerSilently().catch(() => {});
  cloudinaryConfigPromise = loadCloudinaryPublicConfig();
  if (!API && window.Capacitor?.isNativePlatform?.()) {
    document.querySelector("#loadingScreen .loading-subtitle").textContent =
      "Adresse du serveur manquante : configurez APP_API_BASE en HTTPS pour Android.";
    return;
  }
  await checkAuthAndQuizStatus();
}

async function checkAuthAndQuizStatus() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    
    if (!session) {
      hideLoadingScreen();
      renderAuth();
      return;
    }
    
    // Vérifier si le questionnaire a été complété
    const profileController = new AbortController();
    const profileTimeout = setTimeout(() => profileController.abort(), 8000);
    let profile;
    try {
      ({ data: profile } = await sb
        .from('profiles')
        .select('love_quiz_completed')
        .eq('id', session.user.id)
        .abortSignal(profileController.signal)
        .single());
    } catch (error) {
      profile = null;
    } finally {
      clearTimeout(profileTimeout);
    }
    
    if (profile && !profile.love_quiz_completed) {
      // Montrer le questionnaire
      showLoveQuizScreen();
    } else {
      // Questionnaire déjà complété ou erreur, continuer normalement
      hideLoadingScreen();
      init();
    }
  } catch (error) {
    hideLoadingScreen();
    renderAuth();
  }
}

// Écouteurs d'événements pour les boutons du questionnaire
document.addEventListener('DOMContentLoaded', () => {
  const quizNextBtn = document.getElementById('quizNextBtn');
  const quizBackBtn = document.getElementById('quizBackBtn');
  const quizSubmitBtn = document.getElementById('quizSubmitBtn');
  
  if (quizNextBtn) quizNextBtn.addEventListener('click', nextQuizQuestion);
  if (quizBackBtn) quizBackBtn.addEventListener('click', previousQuizQuestion);
  if (quizSubmitBtn) quizSubmitBtn.addEventListener('click', submitLoveQuiz);
});

let session = null;
let coupleId = null;
let soloMode = false; // Accès à l'app sans partenaire encore lié
let isCampA = true; // Déterminé par user_a vs user_b dans le couple
let partnerInfo = { nickname: "Ta moitié", avatar: "❤️", last_seen: null, isOnline: false, phone: null, id: null };
let myProfile = { nickname: "Moi", avatar: "🌸", background: null, sound: true, phone: "" };
let currentTab = "chat";
let currentFriendsSubTab = "discussions"; // 'discussions' ou 'groups'
let activeChatEntity = null; // contact ou groupe ouvert
let realtimeChatChannel = null;
let typingTimeout = null;
let currentLightboxUrl = null;
let lightboxZoomLevel = 1;
let lightboxRotation = 0;
let onceCountdownInterval = null;
let friendsStoriesRealtimeChannel = null;

// Banque de libellés
const LANGUAGE_LABELS = { words:"Paroles valorisantes", quality_time:"Moments de qualité", gifts:"Cadeaux", acts:"Services rendus", touch:"Toucher physique" };
const CATEGORY_LABELS = { nostalgie:"Nostalgie", reves:"Rêves & projets", tendresse:"Tendresse", fun:"Fun", profondeur:"Profondeur", distance:"À distance" };

/* ================= PERFORMANCE - BATCH PROCESSING ================= */
// [PERFORMANCE] Batch processing pour éviter les mises à jour excessives du DOM
let realtimeUpdateQueue = [];
let realtimeProcessingTimer = null;

function queueRealtimeUpdate(updateFn) {
  realtimeUpdateQueue.push(updateFn);
  
  if (!realtimeProcessingTimer) {
    realtimeProcessingTimer = setTimeout(() => {
      const updates = [...realtimeUpdateQueue];
      realtimeUpdateQueue = [];
      realtimeProcessingTimer = null;
      
      // Traiter toutes les mises à jour en batch
      requestAnimationFrame(() => {
        updates.forEach(fn => fn());
      });
    }, 50); // 50ms de debouncing
  }
}

/* ================= PERFORMANCE - CACHE LOCAL ================= */
// [PERFORMANCE] Cache local pour les données fréquemment accédées
const localCache = {
  userProfile: null,
  coupleState: null,
  chatHistory: null,
  stories: null,
  timestamp: null
};

function setCache(key, data) {
  localCache[key] = data;
  localCache.timestamp = Date.now();
  try {
    localStorage.setItem(`cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    // Ignorer les erreurs de stockage
  }
}

function getCache(key, maxAge = 1 * 60 * 1000) { // 1 minute par défaut pour plus de réactivité
  // D'abord vérifier le cache en mémoire
  if (localCache[key] && localCache.timestamp && (Date.now() - localCache.timestamp) < maxAge) {
    return localCache[key];
  }
  
  // Ensuite vérifier le localStorage
  try {
    const cached = localStorage.getItem(`cache_${key}`);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (timestamp && (Date.now() - timestamp) < maxAge) {
        localCache[key] = data;
        localCache.timestamp = timestamp;
        return data;
      }
    }
  } catch (e) {
    // Ignorer les erreurs de lecture
  }
  
  return null;
}

function clearCache() {
  localCache = { userProfile: null, coupleState: null, chatHistory: null, stories: null, timestamp: null };
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('cache_')) {
      localStorage.removeItem(key);
    }
  });
}

/* ================= OFFLINE PERSISTENCE (WhatsApp-like) ================= */
// IndexedDB pour stocker les messages hors ligne
let offlineDB = null;
const DB_NAME = 'AmourComplicesOffline';
const DB_VERSION = 2;
const STORE_MESSAGES = 'messages';
const STORE_PENDING = 'pending_messages';
const STORE_STICKERS = 'saved_stickers';

async function initOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      offlineDB = request.result;
      resolve(offlineDB);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store pour les messages reçus
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const messagesStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        messagesStore.createIndex('coupleId', 'couple_id', { unique: false });
        messagesStore.createIndex('createdAt', 'created_at', { unique: false });
      }
      
      // Store pour les messages en attente d'envoi
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const pendingStore = db.createObjectStore(STORE_PENDING, { keyPath: 'id', autoIncrement: true });
        pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_STICKERS)) {
        const stickersStore = db.createObjectStore(STORE_STICKERS, { keyPath: 'id' });
        stickersStore.createIndex('user_id', 'user_id', { unique: false });
      }
    };
  });
}

async function saveMessageOffline(message) {
  if (!offlineDB) await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = offlineDB.transaction([STORE_MESSAGES], 'readwrite');
    const store = transaction.objectStore(STORE_MESSAGES);
    const request = store.put(message);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getOfflineMessages(coupleId) {
  if (!offlineDB) await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = offlineDB.transaction([STORE_MESSAGES], 'readonly');
    const store = transaction.objectStore(STORE_MESSAGES);
    const index = store.index('coupleId');
    const request = index.getAll(coupleId);
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function saveStickerRecord(blob, name) {
  if (!offlineDB) await initOfflineDB();
  const sticker = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    user_id: session.user.id,
    name,
    mime_type: blob.type || "image/png",
    blob,
    created_at: new Date().toISOString()
  };
  return new Promise((resolve, reject) => {
    const request = offlineDB.transaction([STORE_STICKERS], 'readwrite').objectStore(STORE_STICKERS).put(sticker);
    request.onsuccess = () => resolve(sticker);
    request.onerror = () => reject(request.error);
  });
}

async function getSavedStickerRecords() {
  if (!offlineDB) await initOfflineDB();
  return new Promise((resolve, reject) => {
    const request = offlineDB.transaction([STORE_STICKERS], 'readonly').objectStore(STORE_STICKERS).getAll();
    request.onsuccess = () => resolve((request.result || []).filter(sticker => sticker.user_id === session?.user?.id));
    request.onerror = () => reject(request.error);
  });
}

async function deleteStickerRecord(stickerId) {
  if (!offlineDB) await initOfflineDB();
  return new Promise((resolve, reject) => {
    const store = offlineDB.transaction([STORE_STICKERS], 'readwrite').objectStore(STORE_STICKERS);
    const request = store.get(stickerId);
    request.onsuccess = () => {
      if (request.result?.user_id === session?.user?.id) store.delete(stickerId);
    };
    request.onerror = () => reject(request.error);
    store.transaction.oncomplete = resolve;
    store.transaction.onerror = () => reject(store.transaction.error);
  });
}

async function savePendingMessage(messageData) {
  if (!offlineDB) await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = offlineDB.transaction([STORE_PENDING], 'readwrite');
    const store = transaction.objectStore(STORE_PENDING);
    const request = store.add({
      ...messageData,
      timestamp: Date.now()
    });
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getPendingMessages() {
  if (!offlineDB) await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = offlineDB.transaction([STORE_PENDING], 'readonly');
    const store = transaction.objectStore(STORE_PENDING);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function deletePendingMessage(id) {
  if (!offlineDB) await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = offlineDB.transaction([STORE_PENDING], 'readwrite');
    const store = transaction.objectStore(STORE_PENDING);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function syncPendingMessages() {
  try {
    const pending = await getPendingMessages();
    if (pending.length === 0) return;
    
    for (const msg of pending) {
      try {
        if (msg.scope === 'couple') {
          await apiCall("/api/chat/send", {
            method: "POST",
            body: {
              coupleId: msg.coupleId,
              type: msg.type,
              text: msg.text,
              mediaPath: msg.mediaPath,
              mimeType: msg.mimeType,
              replyToId: msg.replyToId,
              replyPreview: msg.replyPreview,
              replyIsMine: msg.replyIsMine
            }
          });
        } else if (msg.scope === 'conv' && msg.convId) {
          await apiCall(`/api/groups/${msg.convId}/messages`, {
            method: "POST",
            body: {
              type: msg.type,
              text: msg.text,
              mediaPath: msg.mediaPath,
              mimeType: msg.mimeType,
              replyToId: msg.replyToId,
              replyPreview: msg.replyPreview,
              replyIsMine: msg.replyIsMine
            }
          });
        }
        
        await deletePendingMessage(msg.id);
      } catch (e) {
        console.warn('Failed to sync pending message:', e);
      }
    }
  } catch (e) {
    console.warn('Error syncing pending messages:', e);
  }
}

/* ================= AUDIO CHIME ================= */
function playChime() {
  if (!myProfile.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(830.61, now + 0.12);
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.75);
  } catch (e) {}
}

/* [NOTIFICATIONS] Chaque notification porte sa destination :
   - "chat" (par défaut) -> ouvre le Chat
   - { tab: "game", mode: "defi"|"aov" } -> ouvre le Jeu sur le bon mode
   Le son (carillon) est joué à chaque notification. */
let toastTarget = "chat";
function showToast(title, msg, target = "chat") {
  playChime();
  toastTarget = target;
  const toast = document.getElementById("toastNotification");
  document.getElementById("toastTitle").textContent = title;
  document.getElementById("toastMessage").textContent = msg;
  toast.style.display = "flex";
  setTimeout(() => { toast.style.display = "none"; }, 6000);
}
function handleToastClick() {
  document.getElementById("toastNotification").style.display = "none";
  if (toastTarget && typeof toastTarget === "object") {
    if (toastTarget.mode) gameMode = toastTarget.mode; // ouvre le Jeu sur le bon mode
    switchTab(toastTarget.tab);
  } else {
    switchTab(toastTarget || "chat");
  }
}

/* ============================================================
   [ERREURS CLAIRES] Traduit les erreurs techniques en phrases
   que tout le monde comprend. Utilisée dans TOUTE l'app à la
   place des codes bruts (431, schema cache, Failed to fetch...).
   ============================================================ */
function friendlyError(err) {
  const raw = (err?.message || String(err || "")).trim();
  const low = raw.toLowerCase();

  // Traduire les messages d'erreur Supabase courants
  if (low.includes("user already registered") || low.includes("already registered")) {
    return "Un compte avec cet email existe déjà. Connectez-vous plutôt.";
  }
  if (low.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (low.includes("email not confirmed")) {
    return "Email non confirmé. Veuillez vérifier votre boîte mail.";
  }
  if (low.includes("password should be at least")) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }
  if (low.includes("unable to validate email address")) {
    return "Adresse email invalide.";
  }
  
  // Table manquante côté Supabase (migration pas encore exécutée)
  if (low.includes("could not find the table")) {
    const table = (raw.match(/'public\.([a-z_]+)'/) || [])[1];
    return `Une mise à jour de l'app n'est pas encore activée côté base de données${table ? ` (module « ${table} »)` : ""}.\n\nOuvre Supabase → SQL Editor → colle le fichier schema.sql du projet → Run, puis rafraîchis l'app.`;
  }
  // En-têtes trop volumineux (ancien token avec photo intégrée)
  if (low.includes("431") || low.includes("headers too large") || low.includes("header fields too large")) {
    return `Ta session est trop volumineuse (ancien format avec photo intégrée).\n\nDéconnecte-toi puis reconnecte-toi : le problème disparaît définitivement.`;
  }
  // Réseau / serveur éteint
  if (low.includes("failed to fetch") || low.includes("networkerror") || low.includes("load failed") || low.includes("en attente du réseau")) {
    return `En attente du réseau.\n\nVérifie ta connexion internet. Les messages seront envoyés dès que le réseau sera disponible.`;
  }
  // Session expirée
  if (low.includes("401") || low.includes("token") || low.includes("jwt")) {
    return `Ta session a expiré.\n\nDéconnecte-toi et reconnecte-toi pour continuer.`;
  }
  // Email de connexion (OTP) non reçu
  if (low.includes("otp") || low.includes("email not sent") || low.includes("rate limit")) {
    return `Le code de connexion n'a pas pu être envoyé.\n\nVérifie tes spams et réessaie dans une minute (limite anti-spam).`;
  }
  // Flood / rate limiting (protection anti-DDoS du serveur)
  if (low.includes("429") || low.includes("too many requests")) {
    return `Tu envoies des requêtes trop vite.\n\nFais une pause d'une à deux minutes, puis réessaie.`;
  }
  // Fichier trop lourd
  if (low.includes("413") || low.includes("too large") || low.includes("entity too large") || low.includes("maximum size") || low.includes("50 mo")) {
    return `Ce fichier est trop gros (maximum ~50 Mo).\n\nAstuce : envoie une version plus légère (photo plutôt que vidéo, ou clip plus court).`;
  }
  // Stockage / permissions d'upload (RLS, bucket)
  if (low.includes("row-level security") || low.includes("rls") || low.includes("bucket") || low.includes("storage") || low.includes("not allowed") || low.includes("unauthorized") || low.includes("mime type") || low.includes("invalid mime")) {
    return `L'envoi de la photo a été refusé par le stockage.\n\nEssaie une photo JPG/PNG, ou reconnecte-toi puis réessaie.`;
  }
  if (low.includes("image illisible") || low.includes("failed to decode") || low.includes("heic")) {
    return `Cette image n'a pas pu être lue (format non supporté, souvent HEIC iPhone).\n\nEnregistre-la en JPG ou PNG puis réessaie.`;
  }
  // Doublon base de données
  if (low.includes("duplicate key")) {
    return `Cette information existe déjà (double envoi).\n\nRafraîchis la page puis réessaie.`;
  }
  // Par défaut : on garde le message du serveur (déjà en français)
  return raw || "Une erreur inattendue s'est produite. Réessaie.";
}

/* ================= APPEL API ================= */
let sessionRefreshPromise = null;

function refreshCurrentSession() {
  if (!sessionRefreshPromise) {
    const refreshOptions = session?.refresh_token ? { refresh_token: session.refresh_token } : undefined;
    sessionRefreshPromise = sb.auth.refreshSession(refreshOptions)
      .then(result => {
        if (!result.error && result.data.session) session = result.data.session;
        return result;
      })
      .finally(() => { sessionRefreshPromise = null; });
  }
  return sessionRefreshPromise;
}

async function apiCall(pathname, opts = {}) {
  if (!API) throw new Error("Adresse du serveur manquante. Configurez APP_API_BASE avec l'URL HTTPS de production.");

  // [OFFLINE] Si hors ligne et envoi de message, sauvegarder localement
  if (!navigator.onLine && (pathname.includes('/send') || pathname.includes('/messages'))) {
    const body = opts.body || {};
    await savePendingMessage({
      ...body,
      pathname,
      scope: pathname.includes('/chat/') ? 'couple' : 'conv',
      coupleId: body.coupleId,
      convId: pathname.match(/\/groups\/([^\/]+)/)?.[1]
    });
    throw new Error("En attente du réseau - Message sauvegardé localement");
  }
  
  const sendRequest = token => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    return fetch(API + pathname, {
      ...opts,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {})
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).catch(error => {
      if (error.name === "AbortError") {
        throw new Error("Le serveur met trop de temps à répondre. Vérifiez la connexion puis réessayez.");
      }
      throw error;
    }).finally(() => clearTimeout(timeout));
  };

  let token = session?.access_token;
  let res = await sendRequest(token);
  if (res.status === 401 && token && !pathname.startsWith("/api/auth/")) {
    const { data: refreshed, error: refreshError } = await refreshCurrentSession();
    if (!refreshError && refreshed.session) {
      session = refreshed.session;
      token = session.access_token;
      res = await sendRequest(token);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

/* ================= INITIALISATION ================= */
async function init() {
  loadLocalPreferences();

  // [OFFLINE] Initialiser IndexedDB pour la persistance hors ligne
  initOfflineDB().catch(() => {});

  // [PERFORMANCE] Chargement parallèle pour optimiser le démarrage
  const sessionResult = await sb.auth.getSession();

  session = sessionResult.data.session;
  if (!session) {
    return renderAuth();
  }

  connectFriendsStoriesRealtime();

  sb.auth.onAuthStateChange((_event, newSession) => {
    session = newSession;
  });

  // [OFFLINE] Écouter les changements de connexion
  window.addEventListener('online', () => {
    syncPendingMessages();
    showToast('Connexion rétablie', 'Les messages en attente sont en cours d\'envoi');
  });
  
  window.addEventListener('offline', () => {
    showToast('Mode hors ligne', 'En attente du réseau - Les messages seront envoyés dès que possible');
  });

  // [PRÉSENCE IMMÉDIATE] Signale tout de suite qu'on est en ligne sans attendre le chargement des données
  sendHeartbeat();

  // [PERFORMANCE] Chargement parallèle du profil et de l'état du couple
  await Promise.all([
    loadUserProfile().catch(() => {}),
    checkCoupleState()
  ]);

  // [FLUIDITÉ] Rattrapage automatique toutes les 4s (filet de sécurité
  // du temps réel : aucun message ne peut plus être manqué)
  startPolling();
  
  // [OFFLINE] Synchroniser les messages en attente au démarrage
  if (navigator.onLine) {
    syncPendingMessages();
  }
}

function connectFriendsStoriesRealtime() {
  if (friendsStoriesRealtimeChannel) sb.removeChannel(friendsStoriesRealtimeChannel);
  friendsStoriesRealtimeChannel = sb
    .channel(`friend-stories-${session.user.id}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "stories"
    }, payload => {
      if (!["friends", "couple"].includes(payload.new?.audience)) return;
      if (payload.new?.user_id === session?.user?.id) return;
      if (currentTab === "friends") refreshFriendsStories();
    })
    .subscribe();
}

// Enregistre le SW silencieusement au démarrage. La permission push est
// demandée séparément par l'utilisateur (bouton Paramètres).
async function registerServiceWorkerSilently() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/service-worker.js");
  } catch (e) {
    // Pas de HTTPS sur ce réseau : le SW ne peut pas s'enregistrer,
    // mais l'app continue de fonctionner normalement.
  }
}

function loadLocalPreferences() {
  // Préférences PUREMENT locales d'affichage (le profil, lui, vient du serveur)
  const savedTheme = localStorage.getItem("app_theme") || "default";
  applyTheme(savedTheme, false);
  const savedBg = localStorage.getItem("app_custom_bg");
  if (savedBg) applyCustomBg(savedBg);
  const mySound = localStorage.getItem("my_sound");
  if (mySound !== null) myProfile.sound = mySound !== "0";
}

async function loadUserProfile() {
  try {
    // [PERFORMANCE] Vérifier le cache d'abord
    const cached = getCache('userProfile', 10 * 60 * 1000); // 10 minutes
    if (cached) {
      myProfile.nickname = cached.nickname || "Moi";
      myProfile.avatar = cached.avatar || myProfile.avatar || "🌸";
      myProfile.phone = cached.phone || "";
      return;
    }

    const data = await apiCall("/api/couple/profile");
    if (data) {
      myProfile.nickname = data.nickname || "Moi";
      myProfile.avatar = data.avatar || myProfile.avatar || "🌸";
      myProfile.phone = data.phone || "";
      setCache('userProfile', data);
    }
  } catch (e) {}
}

async function checkCoupleState() {
  try {
    // [PERFORMANCE] Vérifier le cache d'abord
    const cached = getCache('coupleState', 2 * 60 * 1000); // 2 minutes
    if (cached) {
      if (cached.couple) {
        soloMode = false;
        localStorage.removeItem("solo_mode");
        if (window._pairInterval) clearInterval(window._pairInterval);
        if (window._soloCheckInterval) clearInterval(window._soloCheckInterval);
        coupleId = cached.couple.id;
        isCampA = (cached.couple.user_a === session.user.id);
        if (cached.partner) {
          partnerInfo = {
            ...partnerInfo,
            ...cached.partner,
            nickname: cached.partner.nickname || "Ta moitié",
            avatar: cached.partner.avatar || "❤️",
            isOnline: !!cached.partner.is_online,
          };
        }
        setupHeaderUI();
        document.getElementById("appHeader").style.display = "flex";
        document.getElementById("bottomNav").style.display = "flex";
        sendHeartbeat();
        connectRealtime();
        switchTab("chat");
        // Rafraîchir en arrière-plan
        apiCall("/api/couple/mine").then(freshData => {
          if (freshData.couple) {
            setCache('coupleState', freshData);
          }
        }).catch(() => {});
        return;
      }
    }

    const { couple, partner } = await apiCall("/api/couple/mine");
    if (couple) {
      soloMode = false;
      localStorage.removeItem("solo_mode");
      if (window._pairInterval) clearInterval(window._pairInterval);
      if (window._soloCheckInterval) clearInterval(window._soloCheckInterval);
      coupleId = couple.id;
      isCampA = (couple.user_a === session.user.id);
      if (partner) {
        partnerInfo = {
          ...partnerInfo,
          ...partner,
          nickname: partner.nickname || "Ta moitié",
          avatar: partner.avatar || "❤️",
          // [PHASE 1] Présence réelle calculée côté serveur (heartbeat < 90s)
          isOnline: !!partner.is_online,
        };
      }
      setCache('coupleState', { couple, partner });
      setupHeaderUI();
      document.getElementById("appHeader").style.display = "flex";
      document.getElementById("bottomNav").style.display = "flex";
      sendHeartbeat();
      connectRealtime();
      switchTab("chat");
    } else if (localStorage.getItem("solo_mode") === "1") {
      enterSoloMode();
    } else {
      document.getElementById("appHeader").style.display = "none";
      document.getElementById("bottomNav").style.display = "none";
      renderPairingScreen();
    }
  } catch (e) {
    renderPairingScreen();
  }
}

function renderAvatarHTML(avatar) {
  if (!avatar) return "🌸";
  if (avatar.startsWith("data:image") || avatar.startsWith("http")) {
    return `<img src="${escapeAttr(avatar)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" alt="">`;
  }
  return escapeHtml(avatar);
}

// Mode solo : l'utilisateur explore l'app sans partenaire.
// Il peut toujours inviter ensuite via l'écran de liaison.
async function enterSoloMode() {
  // Vérifier d'abord si le questionnaire doit être affiché
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const { data: profile } = await sb
        .from('profiles')
        .select('love_quiz_completed')
        .eq('id', session.user.id)
        .single();
      
      if (profile && !profile.love_quiz_completed) {
        // Afficher le questionnaire au lieu du mode solo
        showLoveQuizScreen();
        return;
      }
    }
  } catch (error) {
    // console.error("Erreur lors de la vérification du questionnaire:", error);
    // Continuer normalement en cas d'erreur
  }

  soloMode = true;
  localStorage.setItem("solo_mode", "1");
  document.getElementById("appHeader").style.display = "flex";
  document.getElementById("bottomNav").style.display = "flex";
  setupHeaderUI();
  switchTab("chat");

  // Détecte automatiquement l'arrivée du partenaire
  if (window._soloCheckInterval) clearInterval(window._soloCheckInterval);
  window._soloCheckInterval = setInterval(async () => {
    try {
      // [PHASE 1] Même en solo, on signale sa présence (heartbeat)
      apiCall("/api/couple/heartbeat", { method: "POST" }).catch(() => {});
      const { couple } = await apiCall("/api/couple/mine");
      if (couple) {
        clearInterval(window._soloCheckInterval);
        await init();
      }
    } catch (e) {}
  }, 5000);
}

function setupHeaderUI() {
  // Mode solo : l'en-tête invite à lier son partenaire
  if (soloMode) {
    const avatarEl = document.getElementById("headerAvatar");
    avatarEl.innerHTML = "💘";
    document.getElementById("headerPartnerName").textContent = "En attente de ta moitié";
    document.getElementById("headerPresence").textContent = "Débloque le chat avec un partenaire";
    document.getElementById("headerStatusDot").classList.add("offline");
    document.getElementById("headerCoupleMeta").style.display = "flex";
    document.getElementById("headerFriendsMeta").style.display = "none";
    return;
  }

  const avatarEl = document.getElementById("headerAvatar");
  avatarEl.innerHTML = renderAvatarHTML(partnerInfo.avatar);
  document.getElementById("headerPartnerName").textContent = partnerInfo.nickname || "Ta moitié";
  updatePresenceDisplay();

  // Met à jour l'en-tête selon l'onglet courant
  if (currentTab === "friends") {
    document.getElementById("headerCoupleMeta").style.display = "none";
    document.getElementById("headerFriendsMeta").style.display = "flex";
  } else {
    document.getElementById("headerCoupleMeta").style.display = "flex";
    document.getElementById("headerFriendsMeta").style.display = "none";
  }
}

function formatLastSeenLabel(iso) {
  if (!iso) return "Hors ligne";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Était en ligne à l'instant";
  if (mins < 60) return `Était en ligne il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Était en ligne il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Était en ligne il y a ${days}j`;
}

function getStoryTimeDisplay(expiresAt, createdAt) {
  const expires = expiresAt
    ? new Date(expiresAt).getTime()
    : createdAt
      ? new Date(createdAt).getTime() + 24 * 60 * 60 * 1000
      : null;
  if (!Number.isFinite(expires)) return "Disparaît dans 24h";
  const remaining = expires - Date.now();

  if (remaining <= 0) return "Expirée";
  
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 0) {
    return `Disparaît dans ${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
  } else if (minutes > 0) {
    return `Disparaît dans ${minutes} min`;
  } else {
    return "Disparaît dans moins d'une minute";
  }
}

function updatePresenceDisplay() {
  const dot = document.getElementById("headerStatusDot");
  const pres = document.getElementById("headerPresence");
  if (!dot || !pres) return;

  if (partnerInfo.isOnline) {
    dot.classList.remove("offline");
    pres.textContent = "🟢 En ligne";
  } else if (partnerInfo.last_seen) {
    dot.classList.add("offline");
    pres.textContent = formatLastSeenLabel(partnerInfo.last_seen);
  } else {
    dot.classList.add("offline");
    pres.textContent = "Hors ligne";
  }
}

/* ================= AUTHENTIFICATION ULTRA SIMPLE (SE CONNECTER / S'INSCRIRE) ================= */
let currentAuthTab = "register"; // 'login' ou 'register'

function renderAuth() {
  document.getElementById("appHeader").style.display = "none";
  document.getElementById("bottomNav").style.display = "none";
  
  const isLogin = (currentAuthTab === "login");

  document.getElementById("screenBody").innerHTML = `
    <div class="screen-scrollable" style="display:flex; flex-direction:column; justify-content:center; padding:30px 20px; min-height:100%;">
      <div style="text-align:center; margin-bottom:28px;">
        <div style="font-size:46px; margin-bottom:8px;">💍</div>
        <h1 style="font-family:var(--font-serif); font-size:26px; margin:0 0 6px; font-weight:600;">Amour & Complices</h1>
        <p style="font-size:13px; color:var(--text-muted); margin:0;">Votre espace intime à deux</p>
      </div>

      <!-- Sélecteur d'onglets ultra simple Se connecter / S'inscrire -->
      <div style="display:flex; background:var(--bg-input); border:1px solid var(--border-color); border-radius:16px; padding:4px; margin-bottom:20px;">
        <button class="amis-tab-btn ${isLogin ? 'active' : ''}" style="border-radius:12px; font-size:13px; padding:9px 4px; ${isLogin ? 'background:var(--accent-gold); color:#181124;' : 'color:var(--text-muted);'}" onclick="setAuthTab('login')">
          Se connecter
        </button>
        <button class="amis-tab-btn ${!isLogin ? 'active' : ''}" style="border-radius:12px; font-size:13px; padding:9px 4px; ${!isLogin ? 'background:var(--accent-gold); color:#181124;' : 'color:var(--text-muted);'}" onclick="setAuthTab('register')">
          S'inscrire
        </button>
      </div>

      <div style="display:flex; flex-direction:column; gap:6px;">
        ${!isLogin ? `
          <label style="font-size:11px; color:var(--text-muted); padding-left:4px;">Ton prénom ou surnom</label>
          <input class="input-field" id="authNickname" placeholder="Ex: Alex" style="margin-bottom:6px;">

          <label style="font-size:11px; color:var(--text-muted); padding-left:4px;">Ton numéro de téléphone (pour être retrouvé par tes amis)</label>
          <input class="input-field" id="authPhone" type="tel" placeholder="Ex: +226 00 00 00 00" style="margin-bottom:6px;">
        ` : ''}

        <label style="font-size:11px; color:var(--text-muted); padding-left:4px;">Adresse email</label>
        <input class="input-field" id="authEmail" type="email" placeholder="ton@email.com" style="margin-bottom:6px;">

        <label style="font-size:11px; color:var(--text-muted); padding-left:4px;">Mot de passe</label>
        <input class="input-field" id="authPassword" type="password" placeholder="••••••••" style="margin-bottom:14px;" onkeydown="if(event.key==='Enter')${isLogin ? 'handleLogin()' : 'handleRegister()'}">

        <button class="btn-primary" onclick="${isLogin ? 'handleLogin()' : 'handleRegister()'}" style="font-size:15px; padding:14px;">
          ${isLogin ? 'Se connecter' : 'S\'inscrire & se connecter'}
        </button>
      </div>

      <p id="authError" style="color:#ef4444; font-size:12px; text-align:center; margin-top:14px; min-height:16px; font-weight:500;"></p>
    </div>
  `;
}

function setAuthTab(tab) {
  currentAuthTab = tab;
  renderAuth();
}

async function handleLogin() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value.trim();
  const errEl = document.getElementById("authError");
  errEl.textContent = "";

  if (!email || !password) {
    errEl.textContent = "Veuillez renseigner votre email et mot de passe.";
    return;
  }

  try {
    errEl.textContent = "Connexion en cours...";
    const res = await apiCall("/api/auth/login", {
      method: "POST",
      body: { email, password }
    });

    if (res.session) {
      session = res.session;
      await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      await init();
    }
  } catch (err) {
    errEl.textContent = err.message || "Email ou mot de passe incorrect.";
  }
}

async function handleRegister() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value.trim();
  const nickname = document.getElementById("authNickname")?.value.trim() || "";
  const phone = document.getElementById("authPhone")?.value.trim() || "";
  const errEl = document.getElementById("authError");
  errEl.textContent = "";

  if (!email || !password) {
    errEl.textContent = "Veuillez renseigner un email et un mot de passe.";
    return;
  }

  try {
    errEl.textContent = "Création du compte et connexion...";
    const res = await apiCall("/api/auth/register", {
      method: "POST",
      body: { email, password, nickname, phone: phone || null }
    });

    if (res.session) {
      session = res.session;
      await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      await checkAuthAndQuizStatus();
    }
  } catch (err) {
    errEl.textContent = err.message || "Erreur lors de l'inscription.";
  }
}

/* ================= JUMELAGE & ACCÈS DIRECT À L'APPLICATION ================= */
async function renderPairingScreen() {
  // Vérifier d'abord si le questionnaire doit être affiché
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const { data: profile } = await sb
        .from('profiles')
        .select('love_quiz_completed')
        .eq('id', session.user.id)
        .single();
      
      if (profile && !profile.love_quiz_completed) {
        // Afficher le questionnaire au lieu de l'écran de bienvenue
        showLoveQuizScreen();
        return;
      }
    }
  } catch (error) {
    // console.error("Erreur lors de la vérification du questionnaire:", error);
    // Continuer normalement en cas d'erreur
  }

  // Afficher l'écran de bienvenue normal si le questionnaire est complété
  if (window._soloCheckInterval) clearInterval(window._soloCheckInterval);
  window._soloCheckInterval = null;
  document.getElementById("screenBody").innerHTML = `
    <div class="screen-scrollable" style="padding:24px 20px; display:flex; flex-direction:column; justify-content:center;">
      <div style="text-align:center; margin-bottom:20px;">
        <div style="font-size:48px; margin-bottom:6px;">💞</div>
        <h2 style="font-family:var(--font-serif); font-size:24px; margin:0 0 6px;">Bienvenue dans votre Espace</h2>
        <p style="font-size:13px; color:var(--text-muted); margin:0;">Accédez directement à l'accueil ou liez votre partenaire</p>
      </div>

      <!-- BOUTON ACCÉDER DIRECTEMENT À L'APPLICATION -->
      <button class="btn-primary" style="margin-bottom:18px; font-size:15px; padding:15px; background:linear-gradient(135deg, #e2b76b, #cf8435); box-shadow:0 6px 20px rgba(226, 183, 107, 0.35); border-radius:16px;" onclick="continueDirectlyToApp()">
        🚀 Continuer vers l'Accueil (Accéder à l'App)
      </button>

      <div style="text-align:center; margin-bottom:16px; font-size:12px; color:var(--text-muted); font-weight:600;">
        — OU LIER VOTRE PARTENAIRE DÈS MAINTENANT —
      </div>

      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:18px; padding:16px; margin-bottom:14px;">
        <div style="font-size:13px; font-weight:600; margin-bottom:8px; color:var(--accent-gold);">Option 1 : Tu invites ton/ta partenaire</div>
        <button class="btn-secondary" style="border-color:var(--accent-gold); color:var(--accent-gold);" onclick="generateAndShowInvite()">✨ Créer mon code d'invitation</button>
        <div id="inviteBox" style="margin-top:10px;"></div>
      </div>

      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:18px; padding:16px;">
        <div style="font-size:13px; font-weight:600; margin-bottom:8px; color:var(--accent-rose);">Option 2 : Tu as reçu un code</div>
        <input class="input-field" id="inputJoinCode" placeholder="Ex: WX82K9" maxlength="6" style="text-transform:uppercase; letter-spacing:4px; text-align:center; font-size:18px; font-weight:700;">
        <button class="btn-secondary" style="border-color:var(--accent-rose); color:var(--accent-rose);" onclick="submitJoinCode()">🔗 Valider le code et rejoindre</button>
      </div>

      <p id="pairingError" style="color:#ef4444; font-size:12px; text-align:center; margin-top:12px; min-height:16px;"></p>
      <button class="btn-secondary" style="margin-top:8px; font-size:12px; opacity:0.7;" onclick="logout()">Changer de compte / Se déconnecter</button>
    </div>
  `;

  // Vérifie toutes les 4s si le partenaire s'est connecté
  window._pairInterval = setInterval(async () => {
    try {
      const { couple } = await apiCall("/api/couple/mine");
      if (couple) {
        clearInterval(window._pairInterval);
        await init();
      }
    } catch(e) {}
  }, 4000);
}

async function continueDirectlyToApp() {
  // Vérifier d'abord si le questionnaire doit être affiché
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const { data: profile } = await sb
        .from('profiles')
        .select('love_quiz_completed')
        .eq('id', session.user.id)
        .single();
      
      if (profile && !profile.love_quiz_completed) {
        // Afficher le questionnaire au lieu de continuer vers l'app
        showLoveQuizScreen();
        return;
      }
    }
  } catch (error) {
    // console.error("Erreur lors de la vérification du questionnaire:", error);
    // Continuer normalement en cas d'erreur
  }

  const errEl = document.getElementById("pairingError");
  if (errEl) errEl.textContent = "Accès à l'application en cours...";

  try {
    const res = await apiCall("/api/couple/instant-connect", { method: "POST" });
    if (window._pairInterval) clearInterval(window._pairInterval);
    if (window._soloCheckInterval) clearInterval(window._soloCheckInterval);

    if (res.coupleId) {
      coupleId = res.coupleId;
      await init();
      return;
    }

    // Pas encore de partenaire : on entre en mode solo
    enterSoloMode();
  } catch (err) {
    if (errEl) errEl.textContent = err.message || "Erreur de connexion directe";
  }
}

async function generateAndShowInvite() {
  const box = document.getElementById("inviteBox");
  box.innerHTML = `<div style="text-align:center; font-size:12px; color:var(--text-muted);">Génération du code...</div>`;
  try {
    const { code } = await apiCall("/api/couple/create-invite", { method: "POST" });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(code)}`;
    box.innerHTML = `
      <div style="text-align:center; background:var(--bg-input); padding:16px; border-radius:14px; border:2px dashed var(--accent-gold);">
        <div style="font-family:var(--font-serif); font-size:32px; letter-spacing:6px; color:var(--accent-gold); font-weight:700;">${code}</div>
        <div style="font-size:12px; color:var(--text-muted); margin:6px 0 12px;">Transmets ce code à ton/ta partenaire</div>
        <button class="btn-secondary" style="padding:8px 14px; font-size:12px;" onclick="copyToClipboard('${code}')">📋 Copier le code</button>
        <div style="margin-top:14px;">
          <img src="${qrUrl}" style="width:120px; height:120px; border-radius:8px; background:#fff; padding:4px;" alt="QR Code">
        </div>
      </div>
    `;
  } catch (e) {
    document.getElementById("pairingError").textContent = friendlyError(e);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  alert("Code copié dans le presse-papier !");
}

async function submitJoinCode() {
  const code = document.getElementById("inputJoinCode").value.trim();
  if (!code) return;
  try {
    const { coupleId: cid } = await apiCall("/api/couple/join", { method: "POST", body: { code } });
    coupleId = cid;
    if (window._pairInterval) clearInterval(window._pairInterval);
    if (window._soloCheckInterval) clearInterval(window._soloCheckInterval);
    await init();
  } catch (e) {
    document.getElementById("pairingError").textContent = friendlyError(e);
  }
}

/* ================= PRÉSENCE (en ligne / last_seen) ================= */
function sendHeartbeat() {
  apiCall("/api/couple/heartbeat", { method: "POST" }).catch(() => {});
}

function startHeartbeatLoop() {
  if (window._heartbeatInterval) clearInterval(window._heartbeatInterval);
  sendHeartbeat();
  window._heartbeatInterval = setInterval(() => {
    if (document.hidden) return;
    sendHeartbeat();
  }, 60000); // Réduit de 28s à 60s pour moins de requêtes
}

function partnerIsPresent() {
  if (!realtimeChatChannel) return false;
  try {
    const state = realtimeChatChannel.presenceState() || {};
    // Si on connaît l'ID du partenaire, on cherche directement
    if (partnerInfo.id && state[partnerInfo.id] && state[partnerInfo.id].length) return true;
    // Sinon on cherche n'importe quelle clé qui n'est pas nous
    return Object.keys(state).some(
      (k) => k !== session?.user?.id && state[k] && state[k].length > 0
    );
  } catch (e) {
    return false;
  }
}

function applyPresenceFromChannel() {
  // Récupérer l'ID du partenaire depuis la présence si on ne l'a pas encore
  if (!partnerInfo.id) {
    try {
      const state = realtimeChatChannel?.presenceState() || {};
      const foreignKey = Object.keys(state).find((k) => k !== session?.user?.id);
      if (foreignKey) partnerInfo.id = foreignKey;
    } catch (e) {}
  }
  const present = partnerIsPresent();
  if (present) {
    partnerInfo.isOnline = true;
    partnerInfo.last_seen = new Date().toISOString();
  } else if (partnerInfo.isOnline) {
    partnerInfo.isOnline = false;
  }
  updatePresenceDisplay();
}

async function refreshPartnerPresenceFallback() {
  if (document.hidden || soloMode || !coupleId) return;
  if (partnerIsPresent()) {
    if (!partnerInfo.isOnline) {
      partnerInfo.isOnline = true;
      partnerInfo.last_seen = new Date().toISOString();
      updatePresenceDisplay();
    }
    return;
  }
  try {
    const { partner } = await apiCall("/api/couple/mine");
    if (!partner) return;
    // Si entre-temps le presence channel a détecté le partenaire, on ne l'écrase pas
    if (partnerIsPresent()) return;
    if (partner.id) partnerInfo.id = partner.id;
    partnerInfo.last_seen = partner.last_seen || partnerInfo.last_seen;
    partnerInfo.isOnline = !!partner.is_online;
    updatePresenceDisplay();
  } catch (e) { /* filet silencieux */ }
}

function startPresenceFallbackPoll() {
  if (window._presencePoll) clearInterval(window._presencePoll);
  if (window._presenceLabelTimer) clearInterval(window._presenceLabelTimer);
  // Poll moins fréquent (30s au lieu de 10s) pour éviter les erreurs 429
  window._presencePoll = setInterval(refreshPartnerPresenceFallback, 30000);
  // Mise à jour du libellé "Était en ligne il y a X min" toutes les 60s
  window._presenceLabelTimer = setInterval(() => {
    if (!partnerInfo.isOnline) updatePresenceDisplay();
  }, 60000);
}

function trackMyPresence() {
  if (!realtimeChatChannel || !session?.user?.id) return;
  realtimeChatChannel.track({ userId: session.user.id, online_at: new Date().toISOString() }).catch(() => {});
}

// Re-track périodique : la présence Supabase expire si pas renouvelée
function startPresenceHeartbeat() {
  if (window._presenceTrackInterval) clearInterval(window._presenceTrackInterval);
  window._presenceTrackInterval = setInterval(() => {
    if (!document.hidden) trackMyPresence();
  }, 60000); // Augmenté de 25s à 60s pour moins de requêtes
}

function untrackMyPresence() {
  if (!realtimeChatChannel) return;
  realtimeChatChannel.untrack().catch(() => {});
}

function bindPresenceVisibility() {
  if (window._presenceVisBound) return;
  window._presenceVisBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      untrackMyPresence();
      sendHeartbeat();
    } else {
      sendHeartbeat();
      trackMyPresence();
      // Forcer une lecture immédiate de la présence à la reprise
      setTimeout(() => applyPresenceFromChannel(), 1000);
    }
  });
  window.addEventListener("pagehide", () => {
    untrackMyPresence();
    sendHeartbeat();
  });
}

/* ================= TEMPS RÉEL (Supabase Realtime) ================= */
function connectRealtime() {
  if (realtimeChatChannel) sb.removeChannel(realtimeChatChannel);

  realtimeChatChannel = sb
    .channel(`couple-live-${coupleId}`, {
      config: { presence: { key: session.user.id } }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` }, (payload) => {
      // [PERFORMANCE] Utiliser le batch processing pour les mises à jour DOM
      queueRealtimeUpdate(() => {
        if (payload.eventType === "INSERT") {
          const isFromMe = (payload.new.from_user === session.user.id);
          // [FLUIDITÉ] Anti-doublon : si le polling a déjà affiché ce message,
          // on ne l'ajoute pas une seconde fois.
          const alreadyShown = !!document.querySelector(`[data-msg-id="${payload.new.id}"]`);
          if (isFromMe) {
            // [UPLOAD DIRECT] Mon vrai message vient d'arriver en temps réel :
            // on retire la bulle d'attente "Envoi..." si elle existe encore.
            document.querySelector("[data-pending]")?.remove();
          }
          if (!isFromMe && !alreadyShown) {
            const txt = payload.new.type === "text" ? (payload.new.text || "") : "📷 Média reçu";
            // [NOTIFICATIONS] Les cartes de jeu partagées dans le chat (🎴 défi,
            // 💭 vérité, 🎯 action) ramènent vers le Jeu au clic sur la notif
            const isGameCard = typeof txt === "string" && (txt.startsWith("🎴") || txt.startsWith("💭") || txt.startsWith("🎯"));
            showToast(
              partnerInfo.nickname || "Message",
              txt || "📷 Média reçu",
              isGameCard ? { tab: "game", mode: txt.startsWith("🎴") ? "defi" : "aov" } : "chat"
            );
            // [CONFIRMATIONS] Mon appareil vient de recevoir le message en direct :
            // je le confomme au serveur pour que mon/ma partenaire voie ✓✓.
            apiCall("/api/chat/mark-delivered", { method: "POST", body: { coupleId } }).catch(() => {});
            // [CONFIRMATIONS — CORRECTION DU BLEU] Si la conversation est OUVERTE
            // à l'écran, le message est VU : on marque lu immédiatement (et plus
            // seulement à l'ouverture du chat) -> ✓✓ bleus chez l'expéditeur.
            if (currentTab === "chat") {
              apiCall("/api/chat/mark-seen", { method: "POST", body: { coupleId } }).catch(() => {});
            }
          }

          if (currentTab === "chat" && !alreadyShown) {
            if (payload.new.type === "text") {
              appendMessageToDOM(normalizeIncoming(payload.new));
            } else {
              loadChatHistory();
            }
          }
        } else if (payload.eventType === "UPDATE") {
          if (payload.new.consumed) {
            const el = document.querySelector(`[data-once-id="${payload.new.id}"]`);
            if (el) {
              el.className = "once-card consumed";
              el.innerHTML = `<span class="once-icon">✓</span><span>Déjà vu & supprimé</span>`;
            }
          } else if (payload.new.deleted) {
            // [CRUD] Le message a été supprimé par son auteur : placeholder
            replaceWithDeleted(document.querySelector(`[data-msg-id="${payload.new.id}"]`));
          } else if (payload.new.edited) {
            // [CRUD] Le message a été modifié par son auteur
            const row = document.querySelector(`[data-msg-id="${payload.new.id}"]`);
            const bubble = row?.querySelector(".msg-bubble");
            if (bubble && payload.new.text) bubble.textContent = payload.new.text;
            markEdited(row);
          } else if (payload.new.read_at) {
            // [CONFIRMATIONS — BLEU INSTANTANÉ] Quand un seul UPDATE read_at arrive,
            // mark-seen a mis à jour TOUS les messages non lus en même temps.
            // On passe donc TOUS les .ticks visibles en bleu d'un coup (pas un par un).
            const allTicks = document.querySelectorAll(".msg-row[data-mine='1'] .ticks:not(.read)");
            allTicks.forEach((el) => {
              el.className = "ticks read";
              el.innerHTML = tickDoubleSvg();
            });
            // Mettre aussi à jour le data-attribute du message spécifique
            const row = document.querySelector(`[data-msg-id="${payload.new.id}"]`);
            if (row) row.dataset.readAt = payload.new.read_at;
          } else if (payload.new.delivered_at) {
            // [CONFIRMATIONS] Un de MES messages vient d'être REÇU par l'appareil
            // de mon/ma partenaire : le simple ✓ devient un double trait ✓✓
            const row = document.querySelector(`[data-msg-id="${payload.new.id}"]`);
            if (row) row.dataset.deliveredAt = payload.new.delivered_at;
            const el = row?.querySelector(".ticks");
            if (el && !el.classList.contains("read")) el.innerHTML = tickDoubleSvg();
          }
        }
      });
    });
    
    // [PHASE 2 + CRUD] Temps réel des conversations amis/groupes :
    // INSERT (nouveaux messages) ET UPDATE (lu, modifié, supprimé).
    realtimeChatChannel
    .on("postgres_changes", { event: "*", schema: "public", table: "group_messages" }, (payload) => {
      // [PERFORMANCE] Utiliser le batch processing pour les groupes aussi
      queueRealtimeUpdate(() => {
      const incoming = payload.new;
      const isFromMe = (incoming.from_user === session.user.id);

      // Hors de la conversation ouverte : rien à mettre à jour à l'écran
      if (!currentChatContext || incoming.conversation_id !== currentChatContext.id) return;

      if (payload.eventType === "INSERT") {
        if (!isFromMe) {
          showToast(currentChatContext.name, incoming.type === "text" ? incoming.text : "📎 Nouveau message");
          // [TICKS AMIS] je confirme la livraison dès réception
          apiCall(`/api/groups/${currentChatContext.id}/delivered`, { method: "POST" }).catch(() => {});
          // conversation 1:1 ouverte = lu immédiatement
          if (currentChatContext.kind === "friend") {
            apiCall(`/api/groups/${currentChatContext.id}/seen`, { method: "POST" }).catch(() => {});
          }
        }
        // Recharge l'historique (simple et fiable : gère aussi les URLs signées)
        loadConvHistory();
      } else if (payload.eventType === "UPDATE") {
        // [CRUD] suppression / modification par l'auteur
        const row = document.querySelector(`[data-msg-id="${incoming.id}"]`);
        if (incoming.deleted) { replaceWithDeleted(row); return; }
        if (incoming.edited) {
          const bubble = row?.querySelector(".msg-bubble");
          if (bubble && incoming.text) bubble.textContent = incoming.text;
          markEdited(row);
        }
        // [TICKS AMIS] livraison / lecture (seulement en 1:1)
        if (currentChatContext.kind === "friend" && isFromMe) {
          const t = row?.querySelector(".ticks");
          if (t && incoming.read_at) {
            if (row) row.dataset.readAt = incoming.read_at;
            t.className = "ticks read"; t.innerHTML = tickDoubleSvg();
          } else if (t && incoming.delivered_at) {
            if (row) row.dataset.deliveredAt = incoming.delivered_at;
            t.innerHTML = tickDoubleSvg();
          }
        }
      }
      });
    })
    .on("broadcast", { event: "typing" }, (payload) => {
      if (payload.payload.userId !== session.user.id && currentTab === "chat") {
        showTypingIndicator();
      }
    })
    .on("broadcast", { event: "profile-update" }, (payload) => {
      // SYNCHRONISATION INSTANTANÉE DE LA PHOTO ET DU PROFIL PARTENAIRE
      if (payload.payload.userId !== session.user.id) {
        partnerInfo.avatar = payload.payload.avatar;
        if (payload.payload.nickname) partnerInfo.nickname = payload.payload.nickname;
        setupHeaderUI();
        showToast(partnerInfo.nickname, "A mis à jour sa photo de profil ! ✨");
      }
    })
    .on("broadcast", { event: "story-update" }, ({ payload }) => {
      if (payload?.senderId !== session.user.id && payload?.coupleId === coupleId) {
        loadStoriesBar();
      }
    })
    .on("broadcast", { event: "game-sync" }, (payload) => {
      if (payload.payload.senderId === session.user.id) return;
      // [JEU SYNCHRONISÉ + NOTIFICATIONS] Le/la partenaire a pioché ou validé :
      // - sur l'onglet Jeu -> mise à jour instantanée de l'écran
      // - ailleurs dans l'app -> notification SONORE qui ramène au Jeu au clic
      if (currentTab === "game") {
        refreshGameState();
      } else {
        showToast(`🎮 ${partnerInfo.nickname || "Ton/ta partenaire"}`, "Une nouvelle carte t'attend dans le Jeu ! Touche pour ouvrir.", { tab: "game", mode: "defi" });
      }
    })
    .on("presence", { event: "sync" }, () => applyPresenceFromChannel())
    .on("presence", { event: "join" }, () => applyPresenceFromChannel())
    .on("presence", { event: "leave" }, ({ key }) => {
      if (key === partnerInfo.id) {
        partnerInfo.isOnline = false;
        partnerInfo.last_seen = new Date().toISOString();
        updatePresenceDisplay();
      } else {
        applyPresenceFromChannel();
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        trackMyPresence();
        sendHeartbeat();
        // Lecture immédiate de l'état de présence dès la connexion au channel
        setTimeout(() => applyPresenceFromChannel(), 500);
      }
    });

  startHeartbeatLoop();
  startPresenceFallbackPoll();
  startPresenceHeartbeat();
  bindPresenceVisibility();
}

function showTypingIndicator() {
  const badge = document.getElementById("headerTyping");
  const pres = document.getElementById("headerPresence");
  if (!badge || !pres) return;
  badge.style.display = "inline";
  pres.style.display = "none";

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    badge.style.display = "none";
    pres.style.display = "inline";
  }, 2500);
}

function broadcastTyping() {
  if (!realtimeChatChannel) return;
  realtimeChatChannel.send({
    type: "broadcast",
    event: "typing",
    payload: { userId: session.user.id, name: myProfile.nickname }
  });
}

function normalizeIncoming(row) {
  return {
    id: row.id,
    from: row.from_user,
    from_user: row.from_user,
    type: row.type,
    text: row.text,
    mime_type: row.mime_type,
    consumed: row.consumed,
    read_at: row.read_at,
    delivered_at: row.delivered_at, // [CONFIRMATIONS] état de distribution
    created_at: row.created_at,
    media_url: null,
  };
}

/* ================= NAVIGATION DES ONGLETS ================= */
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".nav-btn").forEach((el) => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });

  setupHeaderUI();

  if (tab === "chat") loadChat();
  else if (tab === "quiz") loadQuiz();
  else if (tab === "game") loadGame();
  else if (tab === "words") loadWords();
  else if (tab === "friends") loadFriends();
}

/* ================= CHAT DU COUPLE ================= */
/* [PHASE 0 — CORRECTION 2] Second bloc CSS/HTML invalide collé ici
   (.notification-badge, .loading-animation, <div> orphelin) : il provoquait
   aussi une SyntaxError fatale. Supprimé. L'animation fadeIn existe déjà
   dans la section <style> en haut du fichier. */

async function loadChat() {
  // En mode solo : impossible de discuter sans partenaire
  if (soloMode) {
    const container = document.getElementById("screenBody");
    container.innerHTML = `
      <div class="screen-scrollable" style="display:flex; flex-direction:column; justify-content:center; align-items:center; padding:30px 20px;">
        <div style="font-size:52px; margin-bottom:10px;">💞</div>
        <h2 style="font-family:var(--font-serif); font-size:22px; margin:0 0 6px;">Débloque le chat</h2>
        <p style="font-size:13px; color:var(--text-muted); text-align:center; margin:0 0 20px;">Liez votre partenaire pour discuter à deux, échanger des mots doux et relever vos défis.</p>
        <button class="btn-primary" onclick="renderPairingScreen()">💌 Inviter mon/ta partenaire</button>
      </div>
    `;
    return;
  }

  const container = document.getElementById("screenBody");
  container.innerHTML = `
    <div class="chat-view">
      <!-- [STORIES] Barre de stories éphémères 24h (style WhatsApp Status) -->
      <div class="stories-bar" id="storiesBar"></div>
      <input type="file" id="storyFileInput" accept="image/*,video/*" multiple style="display:none;" onchange="handleStoryUpload(event)">

      <div class="chat-messages" id="messagesContainer">
        <div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:12px;">
          Chargement de votre conversation...
        </div>
      </div>
      
      <div class="chat-attach-preview-bar" id="attachPreviewBar">
        <span id="attachFileName" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;"></span>
        <label style="display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;">
          <input type="checkbox" id="onceCheck"> 👁️ Vue unique
        </label>
        <button class="icon-btn" style="width:24px; height:24px; font-size:12px;" onclick="cancelAttachment()">✕</button>
      </div>

      <!-- [REPLY] Barre de réponse intégrée -->
      <div class="reply-preview-bar" id="replyPreviewBar" style="display:none;">
        <div class="reply-preview-text">
          <strong id="replyPreviewAuthor"></strong>
          <span id="replyPreviewText"></span>
        </div>
        <button class="reply-preview-close" onclick="clearReplyTo()" aria-label="Annuler réponse">✕</button>
      </div>

      <!-- Barre de saisie protégée contre tout débordement -->
      <div class="chat-input-bar">
        <div class="chat-input-controls">
          <button class="icon-btn" title="Joindre une photo ou vidéo" onclick="document.getElementById('chatFileInput').click()">📎</button>
          <input type="file" id="chatFileInput" accept="image/*,video/*" multiple style="display:none;" onchange="handleFileSelect(event)">
          <button class="icon-btn" id="micBtn" title="Message vocal" onclick="toggleVoiceRecord()">🎤</button>
          <input type="file" id="chatAudioFileInput" accept="audio/*" style="display:none;" onchange="handleAudioFileSelect(event)">
          <!-- [EMOJI/STICKERS/GIF] Bouton du panneau d'insertion -->
          <button class="icon-btn" title="Emoji, stickers & GIF" onclick="toggleEmojiPanel('chatTextInput')">😊</button>
          <input class="chat-text-input" id="chatTextInput" placeholder="Écris un mot doux..." oninput="broadcastTyping()" onkeydown="if(event.key==='Enter')sendTextMessage()">
          <button class="chat-send-btn" id="sendBtn" title="Envoyer" onclick="sendTextMessage()">➤</button>
        </div>

        <!-- [VOICE RECORD] Interface d'enregistrement vocal en direct -->
        <div class="voice-record-bar" id="voiceRecordBar" style="display:none;">
          <div class="voice-record-info">
            <span class="voice-record-dot">🔴</span>
            <span class="voice-record-timer" id="voiceRecordTimer">0:00</span>
          </div>
          <div class="voice-record-waves">
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
          </div>
          <div class="voice-record-actions">
            <button class="voice-btn-cancel" onclick="cancelVoiceRecording()" title="Annuler le vocal">🗑️</button>
            <button class="voice-btn-send" onclick="stopAndSendVoiceRecording()" title="Envoyer le vocal">➤</button>
          </div>
        </div>
      </div>

      <!-- [EMOJI/STICKERS/GIF] Panneau au-dessus de la barre de saisie -->
      <div id="emojiPanel" class="emoji-panel" style="display:none;"></div>
    </div>
  `;

  await loadChatHistory();
  const messageBox = document.getElementById("messagesContainer");
  if (messageBox && !messageBox.dataset.historyPaginationBound) {
    messageBox.dataset.historyPaginationBound = "1";
    messageBox.addEventListener("scroll", async () => {
      if (messageBox.scrollTop > 32 || !chatPagination.hasMore || chatPagination.isLoading) return;
      const previousHeight = messageBox.scrollHeight;
      const previousTop = messageBox.scrollTop;
      await loadChatHistory(true);
      messageBox.scrollTop = previousTop + messageBox.scrollHeight - previousHeight;
    }, { passive: true });
  }
  loadStoriesBar(); // [STORIES] charge la barre de stories 24h
  apiCall("/api/chat/mark-seen", { method: "POST", body: { coupleId } }).catch(() => {});
}

/* [PHASE 0 — CORRECTION CRITIQUE]
   Un bloc CSS/HTML avait été collé ici par erreur (styles .notification-badge,
   <div class="loading-animation">, appels à initChat() inexistant...).
   Ce code invalide provoquait une SyntaxError qui empêchait TOUT le
   JavaScript de la page de s'exécuter (auth, chat, jeu, quiz : rien ne
   marchait). Le bloc a été supprimé et l'accolade fermante de loadChat()
   restaurée. */

// ==========================================
// [PERFORMANCE] Pagination et cache pour le chat
// ==========================================
let chatPagination = {
  messages: [],
  loadedCount: 0,
  pageSize: 50,
  oldestCursor: null,
  hasMore: true,
  isLoading: false
};

async function loadChatHistory(append = false) {
  let hasCachedHistory = false;
  const chatHistoryCacheKey = `chatHistory_${coupleId || session?.user?.id || "solo"}`;
  try {
    const box = document.getElementById("messagesContainer");
    if (!box) return;

    // Si on charge depuis le début, réinitialiser la pagination
    if (!append) {
      chatPagination = {
        messages: [],
        loadedCount: 0,
        pageSize: 50,
        oldestCursor: null,
        hasMore: true,
        isLoading: false
      };
    }

    // Éviter le chargement multiple
    if (chatPagination.isLoading || !chatPagination.hasMore) return;
    chatPagination.isLoading = true;

    // [OFFLINE] Si hors ligne, charger depuis IndexedDB
    if (!navigator.onLine && !append) {
      try {
        const offlineMessages = await getOfflineMessages(coupleId);
        if (offlineMessages.length > 0) {
          const messages = offlineMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          chatPagination.messages = messages;
          chatPagination.loadedCount = messages.length;
          chatPagination.hasMore = false;
          chatPagination.isLoading = false;
          
          const fragment = document.createDocumentFragment();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = messages.map(renderMessageHTML).join("");
          
          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
          }
          
          box.innerHTML = '';
          box.appendChild(fragment);
          bindAllLongPress(box);
          bindAllSwipeReply(box);
          scrollChatToBottom(false);
          
          showToast('Mode hors ligne', 'Messages chargés localement');
          return;
        } else {
          box.innerHTML = `
            <div style="text-align:center; margin:auto; color:var(--text-muted); font-size:13px; padding:20px;">
              <div style="font-size:36px; margin-bottom:8px;">📶</div>
              <div>En attente du réseau</div>
              <div style="font-size:11px; opacity:0.8; margin-top:4px;">Vos messages seront envoyés dès que possible</div>
            </div>
          `;
          chatPagination.hasMore = false;
          chatPagination.isLoading = false;
          return;
        }
      } catch (e) {
        console.warn('Failed to load offline messages:', e);
      }
    }

    if (!append) {
      const cached = getCache(chatHistoryCacheKey, 50 * 60 * 1000);
      if (cached?.length) {
        hasCachedHistory = true;
        chatPagination.messages = cached;
        chatPagination.loadedCount = cached.length;
        chatPagination.oldestCursor = cached[0]?.created_at || null;
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cached.map(renderMessageHTML).join("");
        while (tempDiv.firstChild) fragment.appendChild(tempDiv.firstChild);
        box.replaceChildren(fragment);
        bindAllLongPress(box);
        bindAllSwipeReply(box);
        scrollChatToBottom(false);
      }
    }

    const cursor = append && chatPagination.oldestCursor
      ? `&before=${encodeURIComponent(chatPagination.oldestCursor)}`
      : "";
    const { messages, hasMore } = await apiCall(
      `/api/chat/history?coupleId=${coupleId}&limit=${chatPagination.pageSize}${cursor}`
    );

    if (!messages || messages.length === 0) {
      if (!append) {
        box.innerHTML = `
          <div style="text-align:center; margin:auto; color:var(--text-muted); font-size:13px; padding:20px;">
            <div style="font-size:36px; margin-bottom:8px;">💌</div>
            <div>C'est le début de votre histoire ici.</div>
            <div style="font-size:11px; opacity:0.8; margin-top:4px;">Envoyez un message ou un mot doux pour commencer !</div>
          </div>
        `;
      }
      chatPagination.hasMore = false;
      chatPagination.isLoading = false;
      return;
    }

    // Mettre en cache les nouveaux messages
    chatPagination.messages = append ? [...messages, ...chatPagination.messages] : messages;
    chatPagination.loadedCount += messages.length;
    chatPagination.hasMore = hasMore;
    chatPagination.oldestCursor = chatPagination.messages[0]?.created_at || chatPagination.oldestCursor;
    chatPagination.isLoading = false;
    
    // [PERFORMANCE] Mettre en cache l'historique pour accès instantané
    if (!append) {
      setCache(chatHistoryCacheKey, messages);
    }
    
    // [OFFLINE] Sauvegarder les messages dans IndexedDB
    messages.forEach(msg => {
      saveMessageOffline({
        ...msg,
        couple_id: coupleId
      }).catch(() => {});
    });

    // Rendu optimisé avec DocumentFragment
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = messages.map(renderMessageHTML).join("");
    
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }

    if (append) {
      // Insertion au début pour les messages plus anciens
      box.insertBefore(fragment, box.firstChild);
    } else {
      box.innerHTML = '';
      box.appendChild(fragment);
    }

    // Attacher le long-press et swipe-to-reply sur les nouveaux messages
    bindAllLongPress(box);
    bindAllSwipeReply(box);
    
    if (!append) {
      scrollChatToBottom(false);
    }

    // [FLUIDITÉ] À partir d'ici, le polling ne rattrape que le NOUVEAU
    couplePollSince = new Date().toISOString();
  } catch (e) {
    const box = document.getElementById("messagesContainer");
    if (box && !hasCachedHistory) {
      box.innerHTML = `<div style="text-align:center; color:#ef4444; font-size:12px; padding:20px;">Erreur de chargement: ${e.message}</div>`;
    }
    chatPagination.isLoading = false;
  }
}

function appendMessageToDOM(message) {
  const box = document.getElementById("messagesContainer");
  if (!box) return;
  box.insertAdjacentHTML("beforeend", renderMessageHTML(message));
  // Attacher le long-press et swipe-to-reply sur le nouveau message ajouté
  const lastRow = box.lastElementChild;
  if (lastRow && lastRow.classList.contains("msg-row")) {
    attachLongPress(lastRow);
    attachSwipeReply(lastRow);
  }
  scrollChatToBottom(true);
}

function scrollChatToBottom(smooth = true) {
  requestAnimationFrame(() => {
    const box = document.getElementById("messagesContainer");
    if (box) {
      box.scrollTo({
        top: box.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  });
}

function formatMessageTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Échappement pour les attributs HTML (src="...", onclick="...").
// À utiliser pour toute donnée contrôlée par un utilisateur.
function escapeAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Registre temporaire des URLs en mémoire, référencées par un id numérique.
// Permet d'ouvrir un média sans jamais injecter son URL brute dans un onClick.
let mediaRegistry = {};
let mediaRegistryCounter = 0;
function registerMedia(url) {
  const id = "media-" + (++mediaRegistryCounter) + "-" + Date.now();
  mediaRegistry[id] = url;
  return id;
}
function openRegisteredMedia(id, isEphemeral, isVideo) {
  const url = mediaRegistry[id] || "";
  if (!url) return false;
  openLightbox(url, !!isEphemeral, !!isVideo);
  return false;
}

// Convertit un fichier (ou Blob) en data-URL base64, de façon fiable.
// FileReader/readAsDataURL ont été retirés des navigateurs modernes.
async function fileToDataUrl(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunk = 32768;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.slice(i, i + chunk));
  }
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

// Redimensionne et compresse une image en data-URL JPEG avant envoi.
// Evite les payloads énormes qui font échouer la requête ("Failed to fetch").
// Retourne null si l'image ne peut pas être décodée (fichier non-UTF8, etc.)
async function compressImageToDataUrl(file, maxDim = 512, quality = 0.85) {
  try {
    const dataUrl = await fileToDataUrl(file);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image illisible"));
      el.src = dataUrl;
    });

    let { width, height } = img;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch (e) {
    return null;
  }
}

/* ============================================================
   [CONFIRMATIONS] Icônes SVG des traits (style WhatsApp).
   Le SVG rend beaucoup plus net que le texte "✓✓" et prend la
   couleur de son conteneur (gris par défaut, bleu si lu).
   ============================================================ */
function tickSingleSvg() {
  return `<svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-label="Envoyé">
    <path d="M2 5.5L5 8.5L10.5 1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function tickDoubleSvg() {
  return `<svg width="17" height="10" viewBox="0 0 17 10" fill="none" aria-label="Distribué">
    <path d="M1 5.5L4 8.5L9.5 1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6.5 5.5L9.5 8.5L15 1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ============================================================
   [UPLOAD DIRECT] Les médias (photos, vidéos, vocaux, stories)
  partent du navigateur DIRECTEMENT vers le stockage configuré :
   - envoi quasi instantané (un seul trajet au lieu de deux)
  - Cloudinary accepte les fichiers jusqu'à 500 Mo par blocs
   - zéro octet de média ne charge la mémoire du serveur
  - Supabase reste limité à 50 Mo/fichier
   ============================================================ */
const MAX_SUPABASE_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_CLOUDINARY_UPLOAD_BYTES = 500 * 1024 * 1024;
const CLOUDINARY_CHUNK_BYTES = 20 * 1024 * 1024;
const CLOUDINARY_CHUNK_THRESHOLD = 100 * 1024 * 1024;

function extForFile(file) {
  const map = { "image/png":"png","image/jpeg":"jpg","image/webp":"webp","video/webm":"webm","video/mp4":"mp4","video/quicktime":"mov","audio/webm":"webm","audio/ogg":"ogg","audio/mpeg":"mp3","audio/mp4":"m4a","audio/wav":"wav" };
  if (map[file.type]) return map[file.type];
  const m = (file.name || "").match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "bin";
}

// Envoie le fichier brut et renvoie chemin/URL + type MIME.
// [CLOUDINARY] Si CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET sont
// renseignés dans config.js, le fichier part vers le CDN Cloudinary
// (25 Go gratuits, lecture ultra-rapide) et on stocke son URL publique.
// Sinon : Supabase Storage (par défaut, aucune configuration requise).
async function uploadMediaDirectly(file, folder, onProgress = () => {}) {
  if (!cfg.CLOUDINARY_CLOUD_NAME || !cfg.CLOUDINARY_UPLOAD_PRESET) {
    await cloudinaryConfigPromise;
  }
  const cloud = cfg.CLOUDINARY_CLOUD_NAME;
  const preset = cfg.CLOUDINARY_UPLOAD_PRESET;
  if (cloud && preset) {
    if (file.size > MAX_CLOUDINARY_UPLOAD_BYTES) {
      throw new Error("Le fichier dépasse la limite configurée de 500 Mo.");
    }

    const resourceType = file.type.startsWith("image/") ? "image" : "video";
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/upload`;
    let data;

    if (file.size > CLOUDINARY_CHUNK_THRESHOLD) {
      const uploadId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const chunks = Math.ceil(file.size / CLOUDINARY_CHUNK_BYTES);

      for (let index = 0; index < chunks; index++) {
        const start = index * CLOUDINARY_CHUNK_BYTES;
        const end = Math.min(start + CLOUDINARY_CHUNK_BYTES, file.size);
        const form = new FormData();
        form.append("file", file.slice(start, end), file.name);
        form.append("upload_preset", preset);

        let responseData;
        for (let attempt = 0; attempt < 3; attempt++) {
          let response;
          try {
            response = await fetch(uploadUrl, {
              method: "POST",
              headers: {
                "X-Unique-Upload-Id": uploadId,
                "Content-Range": `bytes ${start}-${end - 1}/${file.size}`
              },
              body: form
            });
          } catch (error) {
            if (attempt === 2) throw new Error("Connexion interrompue pendant l'envoi Cloudinary. Réessaie.");
            await new Promise(resolve => setTimeout(resolve, 500 * (2 ** attempt)));
            continue;
          }
          responseData = await response.json().catch(() => ({}));
          if (response.ok) break;
          if ((response.status < 500 && response.status !== 420) || attempt === 2) {
            throw new Error(responseData.error?.message || "Échec de l'envoi vers Cloudinary");
          }
          await new Promise(resolve => setTimeout(resolve, 500 * (2 ** attempt)));
        }

        if (!responseData || responseData.error) {
          throw new Error(responseData?.error?.message || "Échec de l'envoi vers Cloudinary");
        }
        data = responseData;
        onProgress((index + 1) / chunks);
      }
    } else {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("upload_preset", preset);
      const response = await fetch(uploadUrl, { method: "POST", body: form });
      data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || "Échec de l'envoi vers Cloudinary");
      onProgress(1);
    }

    if (!data?.secure_url) throw new Error("Cloudinary n'a pas retourné l'URL du média.");
    return { path: data.secure_url, mimeType: file.type || "application/octet-stream" };
  }

  if (file.size > MAX_SUPABASE_UPLOAD_BYTES) {
    throw new Error("Configure Cloudinary pour envoyer des fichiers de plus de 50 Mo.");
  }

  const ext = extForFile(file);
  const path = `${folder}/${Date.now()}-${session.user.id}.${ext}`;
  try {
    const { error } = await sb.storage.from("chat-media").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });
    if (error) {
      console.warn("[STORAGE] Direct upload error, falling back to data URL:", error.message);
      // Fallback to data URL for better reliability
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return { path: dataUrl, mimeType: file.type || "application/octet-stream" };
    }
  } catch (err) {
    console.warn("[STORAGE] Direct upload exception, falling back to data URL:", err.message);
    // Fallback to data URL for better reliability
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { path: dataUrl, mimeType: file.type || "application/octet-stream" };
  }
  return { path, mimeType: file.type || "application/octet-stream" };
}

// Bulle d'attente "Envoi..." affichée PENDANT l'upload (feedback immédiat,
// comme WhatsApp : le message apparaît avant même d'être arrivé)
let pendingCounter = 0;
function showPendingBubble(text = "⏳ Envoi en cours...") {
  const box = document.getElementById("messagesContainer") || document.getElementById("convMessagesContainer");
  if (!box) return null;
  const id = `pending-${++pendingCounter}`;
  box.insertAdjacentHTML("beforeend", `<div class="msg-row me" data-pending="${id}"><div class="msg-bubble msg-pending">${escapeHtml(text)}</div></div>`);
  scrollChatToBottom(true);
  return id;
}
function removePendingBubble(id) {
  if (!id) return;
  document.querySelector(`[data-pending="${id}"]`)?.remove();
}
function updatePendingBubble(id, text) {
  const bubble = document.querySelector(`[data-pending="${id}"] .msg-bubble`);
  if (bubble) bubble.textContent = text;
}

/* [CRUD] Détection "message = uniquement des emojis" -> affichage en
   grand sticker (comme WhatsApp), sans bulle */
function isEmojiOnly(t) {
  if (!t) return false;
  const s = String(t).replace(/[\uFE0E\uFE0F\u200D\s]/g, "");
  if (!s) return false;
  try { return /^[\p{Extended_Pictographic}]{1,5}$/u.test(s); } catch (e) { return false; }
}

function msgRowAttrs(m, scope, isMe) {
  const type = m.type || "text";
  const canEdit = isMe && !m.deleted && type === "text" && !isEmojiOnly(m.text);
  return `data-msg-id="${escapeAttr(m.id)}" data-scope="${scope}" data-mine="${isMe ? "1" : "0"}" data-type="${escapeAttr(type)}" data-deleted="${m.deleted ? "1" : "0"}" data-can-edit="${canEdit ? "1" : "0"}" data-created-at="${escapeAttr(m.created_at || "")}" data-delivered-at="${escapeAttr(m.delivered_at || "")}" data-read-at="${escapeAttr(m.read_at || "")}"`;
}

function renderMessageHTML(m) {
  const isMe = (m.from === session.user.id || m.from_user === session.user.id);
  const side = isMe ? "me" : "them";
  const time = formatMessageTime(m.created_at);
  /* ============================================================
     [CONFIRMATIONS DE LECTURE] (style WhatsApp)
     ✓        = envoyé : partenaire hors ligne, pas encore reçu
     ✓✓       = distribué : son appareil a reçu le message (ou il/elle
                est en ligne) — double trait gris
     ✓✓ bleu  = lu : il/elle a ouvert la conversation (read_at)
     ============================================================ */
  const isRead = m.type === "once" ? false : !!m.read_at;
  const isDelivered = isRead || !!m.delivered_at || (isMe && partnerInfo.isOnline);
  const tickIcon = isRead
    ? `<span class="ticks read" title="Lu">${tickDoubleSvg()}</span>`
    : (isDelivered
      ? `<span class="ticks" title="Distribué">${tickDoubleSvg()}</span>`
      : `<span class="ticks" title="Envoyé">${tickSingleSvg()}</span>`);
  const isMyRead = (isMe && m.type !== "once") ? tickIcon : "";

  // [REPLY] Bulle citée si ce message est une réponse
  const replyAuthor = m.reply_is_mine ? (isMe ? "Toi" : (partnerInfo.nickname || "Partenaire")) : (isMe ? (partnerInfo.nickname || "Partenaire") : "Toi");
  const replyQuoteHtml = m.reply_preview
    ? `<div class="reply-quote" onclick="scrollToMessage('${escapeAttr(m.reply_to_id || '')}')"><strong>${escapeHtml(replyAuthor)}</strong>${escapeHtml(m.reply_preview)}</div>`
    : "";

  let body = "";

  /* [CRUD] Message supprimé -> placeholder visible par tous (comme WhatsApp) */
  if (m.deleted) {
    body = `<div class="msg-bubble msg-deleted">🚫 Message supprimé</div>`;
  } else if (m.type === "text") {
    /* [STICKERS] Un message composé uniquement d'emojis s'affiche en GRAND,
       sans bulle — c'est notre système de stickers intégrés */
    if (isEmojiOnly(m.text)) {
      body = `<div class="emoji-only-msg">${escapeHtml(m.text)}</div>`;
    } else if (m.text && m.text.startsWith("🎴")) {
      body = `
        <div class="card-embedded">
          <div class="card-embedded-badge">Défi à Deux</div>
          <div class="card-embedded-prompt">${escapeHtml(m.text.replace("🎴", "").trim())}</div>
          <button class="card-embedded-btn" onclick="switchTab('game')">Relever le défi ensemble</button>
        </div>
      `;
    } else {
      body = `<div class="msg-bubble">${escapeHtml(m.text)}</div>`;
    }
  } else if (m.type === "photo") {
    const mediaUrl = m.media_url || m.media_path;
    if (!mediaUrl) {
      body = `<div class="msg-bubble msg-deleted">📷 Photo non disponible</div>`;
    } else {
      const regId = registerMedia(mediaUrl);
      body = `
        <div class="msg-bubble ${m.text === "sticker" ? "custom-sticker-bubble" : ""}" style="padding:4px; background:none;">
          <img class="chat-media-preview" src="${escapeAttr(mediaUrl)}" alt="${m.text === "sticker" ? "Sticker" : "Photo"}" 
               onload="scrollChatToBottom()" 
               onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'color:#ef4444;font-size:12px;padding:10px;\\'>📷 Photo non disponible</div>'"
               onclick="openRegisteredMedia('${regId}', false, false)">
        </div>
      `;
    }
  } else if (m.type === "video") {
    const mediaUrl = m.media_url || m.media_path;
    if (!mediaUrl) {
      body = `<div class="msg-bubble msg-deleted">🎬 Vidéo non disponible</div>`;
    } else {
      const regId = registerMedia(mediaUrl);
      body = `
        <div class="msg-bubble" style="padding:4px; background:none;">
          <video class="chat-video-preview" src="${escapeAttr(mediaUrl)}" controls playsinline 
                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'color:#ef4444;font-size:12px;padding:10px;\\'>🎬 Vidéo non disponible</div>'"
                 onclick="openRegisteredMedia('${regId}', false, true)"></video>
        </div>
      `;
    }
  } else if (m.type === "voice") {
    body = `
      <div class="msg-bubble" style="display:flex; align-items:center; gap:8px;">
        <span>🎙️</span><audio class="chat-audio-preview" src="${escapeAttr(m.media_url)}" controls preload="metadata"></audio>
      </div>
    `;
  } else if (m.type === "once") {
    if (isMe) {
      body = `
        <div class="once-card sender">
          <span class="once-icon">🔒</span>
          <div>
            <div>Photo vue unique envoyée</div>
            <div style="font-size:10px; opacity:0.8;">Visible 1 fois par ton/ta partenaire</div>
          </div>
        </div>
      `;
    } else {
      if (m.consumed) {
        body = `
          <div class="once-card consumed" data-once-id="${m.id}">
            <span class="once-icon">✓</span><span>Contenu éphémère déjà vu</span>
          </div>
        `;
      } else {
        body = `
          <div class="once-card" data-once-id="${m.id}" onclick="openViewOnce('${m.id}')">
            <span class="once-icon">👁️</span>
            <div>
              <div style="font-weight:700;">Photo vue unique</div>
              <div style="font-size:10px;">Appuyer pour révéler (1 seule ouverture)</div>
            </div>
          </div>
        `;
      }
    }
  }

  const editedFlag = m.edited ? `<span class="edited-flag">modifié</span>` : "";

  // [LONG-PRESS] Les actions sont dans le menu contextuel (appui long)
  // On stocke les données dans des data-attributes pour les lire dans openMsgMenu()
  const canEditAttr = (isMe && !m.deleted && m.type === "text" && !isEmojiOnly(m.text)) ? "1" : "0";
  const canDeleteAttr = (isMe && !m.deleted) ? "1" : "0";
  const authorName = isMe ? myProfile.nickname : partnerInfo.nickname;

  return `
    <div class="msg-row ${side}" data-msg-id="${escapeAttr(m.id)}" data-scope="couple"
         data-mine="${isMe ? '1' : '0'}" data-type="${escapeAttr(m.type || 'text')}"
         data-deleted="${m.deleted ? '1' : '0'}" data-can-edit="${canEditAttr}" data-can-delete="${canDeleteAttr}"
         data-created-at="${escapeAttr(m.created_at || '')}" data-delivered-at="${escapeAttr(m.delivered_at || '')}"
         data-read-at="${escapeAttr(m.read_at || '')}" data-text="${escapeAttr(m.text || '')}"
         data-reply-to-id="${escapeAttr(m.reply_to_id || '')}" data-reply-preview="${escapeAttr(m.reply_preview || '')}"
         data-author="${escapeAttr(authorName || '')}">
      ${replyQuoteHtml}
      ${body}
      <div class="msg-meta">
        ${editedFlag}
        <span>${time}</span>
        ${isMyRead}
      </div>
    </div>
  `;
}

// [REPLY] État de la réponse en cours
let _replyToId = null;
let _replyPreview = null;
let _replyIsMine = false;

function ensureReplyBar() {
  let bar = document.getElementById("replyPreviewBar");
  const inputBar = document.querySelector(".chat-input-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "replyPreviewBar";
    bar.className = "reply-preview-bar";
    bar.innerHTML = `
      <div class="reply-preview-text">
        <strong id="replyPreviewAuthor"></strong>
        <span id="replyPreviewText"></span>
      </div>
      <button class="reply-preview-close" onclick="clearReplyTo()" aria-label="Annuler réponse">✕</button>
    `;
  }
  if (inputBar && bar.nextElementSibling !== inputBar) {
    inputBar.insertAdjacentElement("beforebegin", bar);
  }
  return bar;
}

function setReplyTo(msgId, preview, isMine, authorName) {
  _replyToId = msgId;
  _replyPreview = preview;
  _replyIsMine = isMine;

  let displayName = "Toi";
  if (!isMine) {
    if (authorName) displayName = authorName;
    else if (currentChatContext?.name) displayName = currentChatContext.name;
    else displayName = partnerInfo.nickname || "Partenaire";
  }

  // Mettre à jour immédiatement la barre de réponse si elle existe
  const bar = document.getElementById("replyPreviewBar");
  if (bar) {
    const authorEl = document.getElementById("replyPreviewAuthor");
    const textEl = document.getElementById("replyPreviewText");
    if (authorEl) authorEl.textContent = displayName;
    if (textEl) textEl.textContent = preview;
    bar.classList.add("active");
    bar.style.display = "flex";
  } else {
    // Créer la barre si elle n'existe pas
    const ensureBar = ensureReplyBar();
    if (ensureBar) {
      const authorEl = document.getElementById("replyPreviewAuthor");
      const textEl = document.getElementById("replyPreviewText");
      if (authorEl) authorEl.textContent = displayName;
      if (textEl) textEl.textContent = preview;
      ensureBar.classList.add("active");
      ensureBar.style.display = "flex";
    }
  }

  const input = document.getElementById("chatTextInput") || document.getElementById("convTextInput");
  if (input) {
    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function clearReplyTo() {
  _replyToId = null;
  _replyPreview = null;
  _replyIsMine = false;
  const bar = document.getElementById("replyPreviewBar");
  if (bar) {
    bar.classList.remove("active");
    bar.style.display = "none";
  }
}

function scrollToMessage(msgId) {
  if (!msgId) return;
  const row = document.querySelector(`.msg-row[data-msg-id="${msgId}"]`);
  if (row) {
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.remove("highlight-flash");
    void row.offsetWidth; // Déclenche un reflow pour relancer l'animation
    row.classList.add("highlight-flash");
    setTimeout(() => row.classList.remove("highlight-flash"), 1500);
  }
}

async function sendTextMessage() {
  const input = document.getElementById("chatTextInput");
  const text = input.value.trim();

  if (window._pendingFiles?.length) {
    return confirmSendAttachment();
  }

  if (!text) return;
  input.value = "";

  const replyToId = _replyToId;
  const replyPreview = _replyPreview;
  const replyIsMine = _replyIsMine;
  clearReplyTo();

  try {
    await apiCall("/api/chat/send", {
      method: "POST",
      body: { coupleId, type: "text", text,
        ...(replyToId ? { replyToId, replyPreview, replyIsMine } : {}) }
    });
  } catch (e) {
    // [OFFLINE] Si l'erreur est due au mode hors ligne, ne pas alerter (déjà géré par apiCall)
    if (!e.message.includes('En attente du réseau')) {
      alert(friendlyError(e));
    }
  }
}

/* ================= ENVOI DE FICHIERS / MÉDIAS ================= */
function handleFileSelect(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  window._pendingFiles = files;
  const bar = document.getElementById("attachPreviewBar");
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const fileNames = files.map(file => file.name).join(", ");
  document.getElementById("attachFileName").textContent = files.length === 1
    ? `Fichier: ${fileNames}`
    : `${files.length} médias (${(totalSize / (1024 * 1024)).toFixed(1)} Mo) : ${fileNames}`;
  bar.style.display = "flex";
}

function cancelAttachment() {
  window._pendingFiles = [];
  document.getElementById("chatFileInput").value = "";
  document.getElementById("attachPreviewBar").style.display = "none";
}

async function confirmSendAttachment() {
  const files = window._pendingFiles || [];
  if (!files.length) return;
  const isOnce = document.getElementById("onceCheck").checked;
  cancelAttachment();

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const type = isOnce ? "once" : (file.type.startsWith("video/") ? "video" : "photo");
    const pendingId = showPendingBubble(files.length > 1 ? `⏳ Envoi ${index + 1}/${files.length}...` : "⏳ Envoi en cours...");
    try {
      const { path, mimeType } = await uploadMediaDirectly(
        file,
        `${coupleId}/${type === "once" ? "once" : "media"}`,
        progress => updatePendingBubble(pendingId, `⏳ ${file.name} : ${Math.round(progress * 100)}%`)
      );
      await apiCall("/api/chat/send", {
        method: "POST",
        body: { coupleId, type, mediaPath: path, mimeType }
      });
    } catch (e) {
      if (!e.message.includes('En attente du réseau')) alert(`${file.name} : ${friendlyError(e)}`);
      break;
    } finally {
      removePendingBubble(pendingId);
    }
  }
  await loadChatHistory();
}

/* ============================================================
   VUE UNIQUE — SANS COMPTE À REBOURS (comme WhatsApp)
   - Tant que la visionneuse est OUVERTE : le média reste visible,
     autant de temps que voulu, sans chrono.
   - Dès que l'utilisateur QUITTE (fermeture, changement d'app) :
     le message est marqué vu et le fichier est DÉTRUIT du stockage.
   ============================================================ */
let currentOnceMessageId = null; // message vue unique actuellement ouvert

async function openViewOnce(messageId) {
  try {
    // On mémorise le message : la destruction se fera à la FERMETURE
    currentOnceMessageId = messageId;

    const { dataUrl, mediaUrl, mimeType } = await apiCall("/api/chat/view-once", {
      method: "POST",
      body: { messageId }
    });

    const isVideo = mimeType?.startsWith("video/");
    openLightbox(dataUrl || mediaUrl, true, isVideo);
    // NOTE : plus de compte à rebours ni de marquage ici —
    // closeLightbox() appelle consumeCurrentOnce() à la fermeture.
  } catch (e) {
    currentOnceMessageId = null;
    alert(friendlyError(e));
  }
}

// Détruit le média vue unique après consultation (appelé à la fermeture)
async function consumeCurrentOnce() {
  const id = currentOnceMessageId;
  currentOnceMessageId = null;
  if (!id) return;
  try {
    await apiCall("/api/chat/consume-once", { method: "POST", body: { messageId: id } });
    // Met à jour la bulle côté destinataire : "Déjà vu & supprimé"
    const el = document.querySelector(`[data-once-id="${id}"]`);
    if (el) {
      el.className = "once-card consumed";
      el.innerHTML = `<span class="once-icon">✓</span><span>Déjà vu & supprimé</span>`;
    }
  } catch (e) {
    // Silencieux : la bulle sera mise à jour par le temps réel (consumed)
  }
}

function openLightbox(url, isEphemeral = false, isVideo = false) {
  currentLightboxUrl = url;
  lightboxZoomLevel = 1;
  lightboxRotation = 0;

  const modal = document.getElementById("lightboxModal");
  const img = document.getElementById("lightboxImg");
  const vid = document.getElementById("lightboxVideo");
  const countdown = document.getElementById("lightboxCountdown");
  const shield = document.getElementById("antiScreenshotShield");
  const downloadBtn = document.getElementById("lightboxDownloadBtn");
  const title = document.getElementById("lightboxTitle");

  img.style.transform = `scale(1) rotate(0deg)`;
  vid.style.transform = `scale(1) rotate(0deg)`;

  if (isVideo) {
    img.style.display = "none";
    vid.style.display = "block";
    vid.src = url;
  } else {
    vid.style.display = "none";
    img.style.display = "block";
    img.src = url;
  }

  if (isEphemeral) {
    title.textContent = "Vue Unique — ferme pour détruire";
    countdown.style.display = "none"; // [VUE UNIQUE] plus de compte à rebours
    shield.style.display = "flex";
    downloadBtn.style.display = "none";

    modal.oncontextmenu = (e) => e.preventDefault();

    /* [SANS CHRONO] Consultation LIBRE : pas de timer, pas de fermeture
       automatique. La destruction se déclenche uniquement quand
       l'utilisateur QUITTE (bouton ✕ ou changement d'app) —
       closeLightbox() appelle alors consumeCurrentOnce(). */
    window.onblur = () => {
      if (modal.classList.contains("active")) {
        closeLightbox();
      }
    };
    window.onkeydown = (e) => {
      if (e.key === "PrintScreen" || (e.ctrlKey && e.shiftKey && e.key === "S")) {
        closeLightbox();
        alert("Capture d'écran interdite pour cette vue unique !");
      }
    };
  } else {
    title.textContent = "Aperçu Média";
    countdown.style.display = "none";
    shield.style.display = "none";
    downloadBtn.style.display = "inline-flex";
    modal.oncontextmenu = null;
    window.onblur = null;
  }

  modal.classList.add("active");
}

function closeLightbox() {
  const modal = document.getElementById("lightboxModal");
  modal.classList.remove("active");
  document.getElementById("lightboxImg").src = "";
  document.getElementById("lightboxVideo").src = "";
  currentLightboxUrl = null;
  window.onblur = null;

  // [VUE UNIQUE] Quitter la visionneuse = destruction immédiate
  // du média (marqué vu + fichier supprimé du stockage)
  consumeCurrentOnce();
}

function zoomLightbox(factor) {
  lightboxZoomLevel *= factor;
  applyLightboxTransform();
}
function rotateLightbox() {
  lightboxRotation = (lightboxRotation + 90) % 360;
  applyLightboxTransform();
}
function applyLightboxTransform() {
  const t = `scale(${lightboxZoomLevel}) rotate(${lightboxRotation}deg)`;
  document.getElementById("lightboxImg").style.transform = t;
  document.getElementById("lightboxVideo").style.transform = t;
}

function downloadCurrentMedia() {
  if (!currentLightboxUrl) return;
  const a = document.createElement("a");
  a.href = currentLightboxUrl;
  a.download = `souvenir-couple-${Date.now()}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ================= VOCAUX (Style WhatsApp) ================= */
let voiceMediaRecorder = null;
let voiceAudioChunks = [];
let voiceRecordTimerId = null;
let voiceRecordSeconds = 0;
let voiceRecordStream = null;
let voiceRecordCancelled = false;

function getVoiceSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus"
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "";
}

async function toggleVoiceRecord() {
  if (voiceMediaRecorder && voiceMediaRecorder.state === "recording") {
    stopAndSendVoiceRecording();
  } else {
    startVoiceRecording();
  }
}

async function startVoiceRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Le micro n'est pas accessible. L'enregistrement direct nécessite d'ouvrir l'application en HTTPS ou sur localhost.");
    return;
  }

  try {
    voiceRecordStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (err) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      alert("Accès au microphone refusé. Autorise l'accès au micro dans les paramètres de ton navigateur pour envoyer des vocaux.");
    } else {
      alert("Impossible d'accéder au microphone : " + (err.message || err));
    }
    return;
  }

  try {
    const mimeType = getVoiceSupportedMimeType();
    const options = mimeType ? { mimeType } : {};
    voiceMediaRecorder = new MediaRecorder(voiceRecordStream, options);
    voiceAudioChunks = [];
    voiceRecordCancelled = false;

    voiceMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) voiceAudioChunks.push(e.data);
    };

    voiceMediaRecorder.onstop = async () => {
      if (voiceRecordStream) {
        voiceRecordStream.getTracks().forEach((t) => t.stop());
        voiceRecordStream = null;
      }
      clearInterval(voiceRecordTimerId);
      voiceRecordTimerId = null;
      resetVoiceRecordingUI();

      if (voiceRecordCancelled || voiceAudioChunks.length === 0) {
        return;
      }

      const actualMime = mimeType || "audio/webm";
      const blob = new Blob(voiceAudioChunks, { type: actualMime });

      // Ignorer si clic accidentel quasi-instantané
      if (blob.size < 300) {
        return;
      }

      const pendingId = showPendingBubble("⏳ Envoi du vocal...");

      try {
        // Convert blob to file for direct upload
        const file = new File([blob], `voice-${Date.now()}.${actualMime.split('/')[1] || 'webm'}`, { type: actualMime });
        
        const replyToId = _replyToId;
        const replyPreview = _replyPreview;
        const replyIsMine = _replyIsMine;
        clearReplyTo();

        if (currentChatContext) {
          const { path, mimeType } = await uploadMediaDirectly(file, `conv/${currentChatContext.id}/media`);
          await apiCall(`/api/groups/${currentChatContext.id}/messages`, {
            method: "POST",
            body: {
              type: "voice",
              mediaPath: path,
              mimeType: mimeType,
              ...(replyToId ? { replyToId, replyPreview, replyIsMine } : {})
            }
          });
          await loadConvHistory();
        } else {
          const { path, mimeType } = await uploadMediaDirectly(file, `${coupleId}/media`);
          await apiCall("/api/chat/send", {
            method: "POST",
            body: {
              coupleId,
              type: "voice",
              mediaPath: path,
              mimeType: mimeType,
              ...(replyToId ? { replyToId, replyPreview, replyIsMine } : {})
            }
          });
          await loadChatHistory();
        }
      } catch (e) {
        alert(friendlyError(e));
      } finally {
        removePendingBubble(pendingId);
      }
    };

    voiceMediaRecorder.start(250);
    showVoiceRecordingUI();
  } catch (err) {
    alert("Erreur micro : " + err.message);
    if (voiceRecordStream) {
      voiceRecordStream.getTracks().forEach((t) => t.stop());
      voiceRecordStream = null;
    }
    resetVoiceRecordingUI();
  }
}

function cancelVoiceRecording() {
  voiceRecordCancelled = true;
  if (voiceMediaRecorder && voiceMediaRecorder.state === "recording") {
    voiceMediaRecorder.stop();
  } else {
    resetVoiceRecordingUI();
  }
}

function stopAndSendVoiceRecording() {
  voiceRecordCancelled = false;
  if (voiceMediaRecorder && voiceMediaRecorder.state === "recording") {
    voiceMediaRecorder.stop();
  } else {
    resetVoiceRecordingUI();
  }
}

function showVoiceRecordingUI() {
  document.querySelectorAll(".chat-input-controls").forEach((el) => el.style.display = "none");
  document.querySelectorAll(".voice-record-bar").forEach((el) => el.style.display = "flex");

  voiceRecordSeconds = 0;
  updateVoiceTimerDisplay(0);

  clearInterval(voiceRecordTimerId);
  voiceRecordTimerId = setInterval(() => {
    voiceRecordSeconds++;
    updateVoiceTimerDisplay(voiceRecordSeconds);
  }, 1000);
}

function updateVoiceTimerDisplay(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const str = `${m}:${s < 10 ? "0" : ""}${s}`;
  document.querySelectorAll(".voice-record-timer").forEach((el) => el.textContent = str);
}

function resetVoiceRecordingUI() {
  clearInterval(voiceRecordTimerId);
  voiceRecordTimerId = null;
  document.querySelectorAll(".voice-record-bar").forEach((el) => el.style.display = "none");
  document.querySelectorAll(".chat-input-controls").forEach((el) => el.style.display = "flex");
}

// Envoi d'un fichier audio sélectionné (fallback)
async function handleAudioFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    // [UPLOAD DIRECT] fichier audio -> Storage directement
    const { path, mimeType } = await uploadMediaDirectly(file, `${coupleId}/media`);
    await apiCall("/api/chat/send", {
      method: "POST",
      body: { coupleId, type: "voice", mediaPath: path, mimeType }
    });
  } catch (e) {
    alert(friendlyError(e));
  }
}

// Envoi d'un fichier audio sélectionné — conversation ami/groupe
async function handleConvAudioFileSelect(event) {
  if (!currentChatContext) return;
  const file = event.target.files[0];
  if (!file) return;
  try {
    const { path, mimeType } = await uploadMediaDirectly(file, `conv/${currentChatContext.id}/media`);
    await apiCall(`/api/groups/${currentChatContext.id}/messages`, {
      method: "POST",
      body: { type: "voice", mediaPath: path, mimeType }
    });
    await loadConvHistory();
  } catch (e) {
    alert(friendlyError(e));
  } finally {
    event.target.value = "";
  }
}

/* ================= MOTS DOUX ================= */
let sweetMessagesBank = [];
let displayedSuggestions = [];
let selectedWordIndex = null;

async function loadWords() {
  const screen = document.getElementById("screenBody");
  screen.innerHTML = `
    <div class="screen-scrollable">
      <div style="margin-bottom:18px;">
        <h2 style="font-family:var(--font-serif); font-size:22px; margin:0 0 4px;">Mots Doux & Pensées</h2>
        <p style="font-size:12px; color:var(--text-muted); margin:0;">Choisissez ou écrivez une attention pour votre moitié</p>
      </div>

      <div id="wordsListContainer">
        <div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:12px;">Chargement des mots doux...</div>
      </div>

      <div style="margin-top:14px;">
        <span style="font-size:12px; color:var(--accent-gold); cursor:pointer; text-decoration:underline;" onclick="shuffleWordsSuggestions()">🔄 Autres suggestions inspirantes</span>
      </div>

      <div style="margin-top:20px;">
        <label style="font-size:12px; color:var(--text-muted);">Ou écrivez votre propre message d'amour :</label>
        <textarea class="input-field" id="customSweetInput" rows="3" placeholder="Écris ce que tu ressens en ce moment..."></textarea>
        <button class="btn-primary" onclick="sendSelectedSweetMessage()">💌 Envoyer dans notre chat</button>
      </div>
    </div>
  `;

  try {
    const { messages } = await apiCall("/api/content/words");
    sweetMessagesBank = messages || [];
    shuffleWordsSuggestions();
  } catch (e) {
    document.getElementById("wordsListContainer").innerHTML = `<div style="color:#ef4444; font-size:12px;">Erreur : ${friendlyError(e)}</div>`;
  }
}

function shuffleWordsSuggestions() {
  if (!sweetMessagesBank.length) return;
  const shuffled = [...sweetMessagesBank].sort(() => 0.5 - Math.random());
  displayedSuggestions = shuffled.slice(0, 5);
  selectedWordIndex = null;
  renderWordsSuggestions();
}

function renderWordsSuggestions() {
  const container = document.getElementById("wordsListContainer");
  container.innerHTML = displayedSuggestions.map((item, idx) => `
    <div class="sweet-card ${selectedWordIndex === idx ? 'selected' : ''}" onclick="pickSweetMessage(${idx})">
      <div style="font-size:10px; color:var(--accent-gold); text-transform:uppercase; margin-bottom:4px;">
        ${CATEGORY_LABELS[item.category] || "Tendresse"}
      </div>
      <div>${escapeHtml(item.text)}</div>
    </div>
  `).join("");
}

function pickSweetMessage(idx) {
  selectedWordIndex = idx;
  document.getElementById("customSweetInput").value = displayedSuggestions[idx].text;
  renderWordsSuggestions();
}

async function sendSelectedSweetMessage() {
  if (soloMode) {
    alert("Débloque le chat en invitant ton/ta partenaire !");
    switchTab("chat");
    return;
  }
  const input = document.getElementById("customSweetInput");
  const text = input.value.trim();
  if (!text) return;

  try {
    await apiCall("/api/chat/send", {
      method: "POST",
      body: { coupleId, type: "text", text: `💌 ${text}` }
    });
    alert("Mot doux envoyé avec tendresse !");
    switchTab("chat");
  } catch (e) {
    alert(friendlyError(e));
  }
}

/* ============================================================
   [JEU SYNCHRONISÉ] L'état du jeu vit côté SERVEUR (table game_state).
   Avant : chaque partenaire piochait SA propre carte au hasard dans son
   navigateur -> impossible de jouer ensemble, aucune notification.
   Désormais : même carte chez les deux, révélation croisée seulement
   quand les deux ont répondu, notifications sonores avec navigation.
   ============================================================ */
let gameState = null;        // État partagé : { card, my_answer, partner_answered, partner_answer, revealed }

// [PHASE 4] État du module "Action ou Vérité"
let gameMode = "defi";        // 'defi' (défi complice) | 'aov' (action ou vérité)
let truthDareCards = [];      // Banque chargée depuis Supabase (90 cartes)
let truthDareKind = "verite"; // Carte en cours : 'verite' | 'action'
let truthDareLevel = "doux";  // Niveau : 'doux' | 'complice' | 'ose'
let currentTdCard = null;
const TD_LEVEL_LABELS = { doux: "🌙 Doux", complice: "🔥 Complice", ose: "💋 Osé" };

async function loadGame() {
  const screen = document.getElementById("screenBody");
  screen.innerHTML = `
    <div class="screen-scrollable">
      <div style="margin-bottom:14px;">
        <h2 style="font-family:var(--font-serif); font-size:22px; margin:0 0 4px;">Jeu de Désir & Complicité</h2>
        <p style="font-size:12px; color:var(--text-muted); margin:0;">La même carte pour vous deux : répondez en secret, révélation croisée quand vous avez répondu tous les deux 💞</p>
      </div>

      <!-- [PHASE 4] Sélecteur de mode : Défi complice / Action ou Vérité -->
      <div style="display:flex; background:var(--bg-input); border:1px solid var(--border-color); border-radius:14px; padding:4px; margin-bottom:16px;">
        <button class="amis-tab-btn ${gameMode==='defi'?'active':''}" style="border-radius:10px; font-size:12px; padding:9px 4px; ${gameMode==='defi'?'background:var(--accent-gold); color:#181124;':''}" onclick="switchGameMode('defi')">🎴 Défi complice</button>
        <button class="amis-tab-btn ${gameMode==='aov'?'active':''}" style="border-radius:10px; font-size:12px; padding:9px 4px; ${gameMode==='aov'?'background:var(--accent-rose); color:#fff;':''}" onclick="switchGameMode('aov')">🔥 Action ou Vérité</button>
      </div>

      <!-- ================= MODE 1 : DÉFI COMPLICE ================= -->
      <!-- Contenu rendu dynamiquement par renderDefiSection() à partir de
           l'état partagé du serveur (même carte + statuts + révélation) -->
      <div class="game-container" id="defiSection" style="display:${gameMode==='defi'?'flex':'none'};">
        <div style="text-align:center; padding:24px 10px; color:var(--text-muted); font-size:12px;">Chargement de votre partie...</div>
      </div>

      <!-- ================= MODE 2 : ACTION OU VÉRITÉ ================= -->
      <div class="game-container" id="aovSection" style="display:${gameMode==='aov'?'flex':'none'};">
        <!-- Choix Vérité / Action -->
        <div style="display:flex; gap:10px;">
          <button class="btn-primary" style="background:${truthDareKind==='verite'?'var(--accent-rose)':'var(--bg-input)'}; color:${truthDareKind==='verite'?'#fff':'var(--text-primary)'};" onclick="setTruthDareKind('verite')">💭 Vérité</button>
          <button class="btn-primary" style="background:${truthDareKind==='action'?'var(--accent-gold)':'var(--bg-input)'}; color:${truthDareKind==='action'?'#181124':'var(--text-primary)'};" onclick="setTruthDareKind('action')">🎯 Action</button>
        </div>

        <!-- Choix du niveau d'intensité -->
        <div style="display:flex; gap:8px; justify-content:center;">
          ${Object.entries(TD_LEVEL_LABELS).map(([key, label]) => `
            <button class="btn-secondary" style="width:auto; padding:7px 12px; font-size:11px; ${truthDareLevel===key?'border-color:var(--accent-rose); color:var(--accent-rose); font-weight:700;':''}" onclick="setTruthDareLevel('${key}')">${label}</button>
          `).join("")}
        </div>

        <!-- La carte piochée -->
        <div class="game-card-view" id="tdCardView">
          <div class="game-badge" id="tdBadge">💭 Vérité · 🌙 Doux</div>
          <div class="game-prompt-text" id="tdPrompt">Choisis ton niveau et pioche une carte...</div>
        </div>

        <button class="btn-primary" onclick="pickTruthDare()">🔥 Piocher une carte</button>
        <button class="btn-secondary" onclick="sendTruthDareToChat()">💬 Envoyer cette carte dans notre chat</button>
        <p style="font-size:11px; color:var(--text-muted); text-align:center; margin:4px 0 0;">
          À jouer à deux, l'un après l'autre. Respect et consentement avant tout ❤️
        </p>
      </div>
    </div>
  `;

  try {
    // [JEU SYNCHRONISÉ] Charge en parallèle : l'état du jeu partagé (serveur)
    // et la banque Action ou Vérité. L'état du jeu est TOUJOURS récupéré au
    // démarrage : même si on a manqué une notification, on voit la bonne carte.
    const [stateRes, tdRes] = await Promise.all([
      apiCall(`/api/game/state?coupleId=${coupleId}`).catch(() => ({ state: null })),
      apiCall("/api/content/truth-dare").catch(() => ({ cards: [] }))
    ]);
    gameState = stateRes.state || null;
    truthDareCards = tdRes.cards || [];
    renderDefiSection();
  } catch (e) {
    const el = document.getElementById("defiSection");
    if (el) el.innerHTML = `<div style="color:#ef4444; font-size:12px; text-align:center; padding:20px;">Erreur : ${friendlyError(e)}</div>`;
  }
}

// ------------------------------------------------------------
// [PHASE 4] Action ou Vérité — logique du module
// ------------------------------------------------------------

// Bascule entre les deux modes de jeu (affiche/masque les sections)
function switchGameMode(mode) {
  gameMode = mode;
  loadGame();
}

// Change le type de carte (Vérité ou Action) et re-pioche
function setTruthDareKind(kind) {
  truthDareKind = kind;
  loadGame();
}

// Change le niveau d'intensité (doux / complice / osé)
function setTruthDareLevel(level) {
  truthDareLevel = level;
  loadGame();
}

// Pioche une carte aléatoire dans la banque, selon type + niveau choisis
function pickTruthDare() {
  const pool = truthDareCards.filter((c) => c.kind === truthDareKind && c.level === truthDareLevel);
  if (pool.length === 0) {
    document.getElementById("tdPrompt").textContent = "Aucune carte pour ce niveau. Veuillez contacter le support technique.";
    return;
  }
  currentTdCard = pool[Math.floor(Math.random() * pool.length)];

  const isVerite = truthDareKind === "verite";
  document.getElementById("tdBadge").textContent = `${isVerite ? "💭 Vérité" : "🎯 Action"} · ${TD_LEVEL_LABELS[truthDareLevel]}`;
  document.getElementById("tdPrompt").textContent = currentTdCard.prompt;
}

// Envoie la carte en cours dans le chat du couple (format carte intégrée)
async function sendTruthDareToChat() {
  if (soloMode) {
    alert("Débloque le chat en invitant ton/ta partenaire !");
    switchTab("chat");
    return;
  }
  if (!currentTdCard) {
    alert("Pioche d'abord une carte !");
    return;
  }

  const isVerite = currentTdCard.kind === "verite";
  const prefix = isVerite ? "💭 Vérité" : "🎯 Action";
  try {
    await apiCall("/api/chat/send", {
      method: "POST",
      body: { coupleId, type: "text", text: `${prefix} : ${currentTdCard.prompt}` }
    });
    alert("Carte envoyée dans votre chat ! À ton/ta partenaire de jouer 😏");
    switchTab("chat");
  } catch (e) {
    alert(friendlyError(e));
  }
}

/* ============================================================
   [JEU SYNCHRONISÉ] Logique du Défi complice — tout passe par le
   serveur (/api/game/*), donc les deux partenaires voient TOUJOURS
   la même carte et les mêmes statuts, même en arrivant en retard.
   ============================================================ */

// Recharge l'état partagé du jeu (utilisé au démarrage, après un broadcast,
// ou au retour sur l'onglet)
async function refreshGameState() {
  if (soloMode || !coupleId) { gameState = null; renderDefiSection(); return; }
  try {
    const { state } = await apiCall(`/api/game/state?coupleId=${coupleId}`);
    gameState = state;
  } catch (e) {
    gameState = null;
  }
  renderDefiSection();
}

// Rend TOUTE la section Défi complice à partir de l'état partagé.
// 3 situations : aucune carte / en cours (répondre ou attendre) / révélation.
function renderDefiSection() {
  const el = document.getElementById("defiSection");
  if (!el) return;
  const partnerName = partnerInfo.nickname || "Ton/ta partenaire";

  // --- Situation 1 : aucune partie en cours -> invitation à piocher ---
  if (!gameState || !gameState.card) {
    el.innerHTML = `
      <div class="game-card-view">
        <div class="game-badge">🎴 Défi complice</div>
        <div class="game-prompt-text">Aucune carte en cours.<br>Pioche : la MÊME carte apparaîtra instantanément chez ton/ta partenaire !</div>
      </div>
      <button class="btn-primary" onclick="drawGameCard()">🎴 Piocher une carte (pour vous deux)</button>
      <button class="btn-secondary" onclick="shareCardToChat()">💬 Inviter mon/ma partenaire à jouer</button>
    `;
    return;
  }

  const card = gameState.card;
  const iAnswered = !!gameState.my_answer;
  const partnerAnswered = !!gameState.partner_answered;

  // Badges de statut clairs (jeu équitable : chacun voit où l'autre en est)
  const statuses = `
    <div style="display:flex; gap:8px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
      <span class="game-status ${iAnswered ? "ok" : ""}">Moi : ${iAnswered ? "✅ répondu" : "✍️ à répondre"}</span>
      <span class="game-status ${partnerAnswered ? "ok" : ""}">${escapeHtml(partnerName)} : ${partnerAnswered ? "✅ a répondu" : "⏳ en réflexion"}</span>
    </div>
  `;

  // --- Situation 3 : les deux ont répondu -> RÉVÉLATION CROISÉE ---
  if (gameState.revealed) {
    el.innerHTML = `
      <div class="game-card-view">
        <div class="game-badge">✨ Révélation croisée</div>
        <div class="game-prompt-text">${escapeHtml(card.prompt)}</div>
        ${statuses}
      </div>
      <div class="revealed-camp-card">
        <div style="font-size:11px; font-weight:700; color:var(--accent-gold); margin-bottom:2px;">💬 Ma réponse</div>
        <div style="font-size:13px;">${escapeHtml(gameState.my_answer || "")}</div>
      </div>
      <div class="revealed-camp-card partner">
        <div style="font-size:11px; font-weight:700; color:var(--accent-rose); margin-bottom:2px;">💬 Réponse de ${escapeHtml(partnerName)}</div>
        <div style="font-size:13px;">${escapeHtml(gameState.partner_answer || "")}</div>
      </div>
      <button class="btn-primary" onclick="drawGameCard()">🎴 Piocher une nouvelle carte (pour vous deux)</button>
      <button class="btn-secondary" onclick="shareCardToChat()">💬 Envoyer ce défi dans notre chat</button>
    `;
    return;
  }

  // --- Situation 2 : partie en cours ---
  el.innerHTML = `
    <div class="game-card-view">
      <div class="game-badge">🎴 Défi complice</div>
      <div class="game-prompt-text">${escapeHtml(card.prompt)}</div>
      ${statuses}
    </div>

    <div class="secret-box">
      ${iAnswered ? `
        <div style="font-size:11px; color:var(--accent-gold); font-weight:600; margin-bottom:6px;">✅ Ta réponse est verrouillée</div>
        <div style="background:var(--bg-input); border-radius:10px; padding:10px 12px; font-size:13px;">${escapeHtml(gameState.my_answer)}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:10px;">
          ⏳ En attente de ${escapeHtml(partnerName)}... Dès qu'il/elle valide, vos deux réponses se révèlent EN MÊME TEMPS 💞
        </div>
      ` : `
        <div style="font-size:11px; color:var(--accent-gold); font-weight:600; margin-bottom:6px;">🔒 Ta réponse reste secrète jusqu'à ce que vous ayez répondu TOUS LES DEUX</div>
        <textarea class="input-field" id="gameAnswerInput" rows="2" placeholder="Écris librement ta réponse..."></textarea>
        <button class="btn-primary" style="padding:10px 14px; font-size:12px;" onclick="submitGameAnswer()">✅ Valider ma réponse</button>
      `}
    </div>

    <button class="btn-secondary" onclick="shareCardToChat()">💬 Envoyer ce défi dans notre chat</button>
  `;
}

// Pioche une carte : enregistrée côté SERVEUR -> même carte chez les deux,
// notification sonore envoyée au/à la partenaire
async function drawGameCard() {
  if (soloMode) { alert("Invite ton/ta partenaire pour jouer à deux !"); return; }
  try {
    const { state } = await apiCall("/api/game/draw", { method: "POST", body: { coupleId } });
    gameState = state;
    renderDefiSection();
    broadcastGameUpdate();
  } catch (e) {
    alert(friendlyError(e));
  }
}

// Valide ma réponse ; quand les deux ont répondu -> révélation croisée + son
async function submitGameAnswer() {
  const input = document.getElementById("gameAnswerInput");
  const text = (input?.value || "").trim();
  if (!text) return;
  try {
    const { state } = await apiCall("/api/game/answer", { method: "POST", body: { coupleId, text } });
    gameState = state;
    renderDefiSection();
    broadcastGameUpdate();
    if (state.revealed) playChime(); // petit son de récompense 💞
  } catch (e) {
    alert(friendlyError(e));
  }
}

// Prévient le/la partenaire en temps réel : s'il/elle est sur l'onglet Jeu
// -> mise à jour instantanée ; sinon -> notification sonore avec navigation
function broadcastGameUpdate() {
  if (realtimeChatChannel) {
    realtimeChatChannel.send({
      type: "broadcast",
      event: "game-sync",
      payload: { action: "update", senderId: session.user.id }
    });
  }
}

async function shareCardToChat() {
  if (soloMode) {
    alert("Débloque le chat en invitant ton/ta partenaire !");
    switchTab("chat");
    return;
  }
  if (!gameState?.card) return;
  try {
    await apiCall("/api/chat/send", {
      method: "POST",
      body: { coupleId, type: "text", text: `🎴 Défi complice : ${gameState.card.prompt}` }
    });
    // Le/la partenaire reçoit une notification sonore qui ramène vers le Jeu
    alert("Invitation envoyée dans votre chat ! 🎉");
    switchTab("chat");
  } catch (e) {
    alert(friendlyError(e));
  }
}

/* ================= QUIZ DE COMPATIBILITÉ =================
   [PHASE 4] Deux modes de questions :
   - "Classique"  : les 100 questions douces (order_index 1-100)
   - "Complice"   : les 30 nouvelles questions épicées/intimes (101-130)
   ============================================================ */
let quizQuestions = [];
let quizIndex = 0;
let quizMode = "classique"; // 'classique' | 'complice'
let quizScores = { words:0, quality_time:0, gifts:0, acts:0, touch:0 };

async function loadQuiz() {
  const screen = document.getElementById("screenBody");
  screen.innerHTML = `
    <div class="screen-scrollable">
      <h2 style="font-family:var(--font-serif); font-size:22px; margin:0 0 4px;">Quiz des Langages de l'Amour</h2>
      <p style="font-size:12px; color:var(--text-muted); margin:0 0 12px;">Découvrez vos besoins profonds et votre harmonie</p>

      <!-- [PHASE 4] Sélecteur de série de questions -->
      <div style="display:flex; background:var(--bg-input); border:1px solid var(--border-color); border-radius:14px; padding:4px; margin-bottom:14px;">
        <button class="amis-tab-btn ${quizMode==='classique'?'active':''}" style="border-radius:10px; font-size:12px; padding:9px 4px; ${quizMode==='classique'?'background:var(--accent-gold); color:#181124;':''}" onclick="setQuizMode('classique')">🌸 Classique</button>
        <button class="amis-tab-btn ${quizMode==='complice'?'active':''}" style="border-radius:10px; font-size:12px; padding:9px 4px; ${quizMode==='complice'?'background:var(--accent-rose); color:#fff;':''}" onclick="setQuizMode('complice')">🔥 Complice (18+)</button>
      </div>

      <div id="quizContentBox">Chargement...</div>
    </div>
  `;

  try {
    const { questions } = await apiCall("/api/quiz/questions");
    // [PHASE 4] Filtre selon le mode choisi : la série "Complice" ne pioche
    // QUE dans les nouvelles questions intimes (order_index > 100).
    const pool = (quizMode === "complice")
      ? questions.filter((q) => q.order_index > 100)
      : questions.filter((q) => q.order_index <= 100);
    /* ============================================================
       [LOTS DE 15 + ANTI-RÉPÉTITION] À chaque ouverture/actualisation :
       - 15 questions tirées au hasard dans la série (au lieu de 10)
       - on évite de retomber sur les mêmes que les dernières fois :
         l'app mémorise les questions déjà vues (localStorage) et ne
         repioche QUE parmi les jamais vues. Quand toute la série a
         été vue, la mémoire se réinitialise (nouveau cycle).
       ============================================================ */
    const QUIZ_BATCH = 15;
    const seenKey = `quiz_seen_${quizMode}`;
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch (e) { seen = []; }

    // Priorité aux questions JAMAIS vues
    let fresh = pool.filter((q) => !seen.includes(q.order_index));
    if (fresh.length < QUIZ_BATCH) {
      // Toute la série a déjà été vue -> nouveau cycle complet
      seen = [];
      fresh = [...pool];
    }
    const chosen = fresh.sort(() => 0.5 - Math.random()).slice(0, QUIZ_BATCH);

    // Mémorise les questions venant d'être servies (borne de sécurité 200)
    seen = [...seen, ...chosen.map((q) => q.order_index)].slice(-200);
    localStorage.setItem(seenKey, JSON.stringify(seen));

    quizQuestions = chosen;
    quizIndex = 0;
    quizScores = { words:0, quality_time:0, gifts:0, acts:0, touch:0 };

    // [CORRECTION] Série vide (questions pas encore chargées en base) :
    // message clair au lieu de rester bloqué sur "Chargement..."
    if (quizQuestions.length === 0) {
      document.getElementById("quizContentBox").innerHTML = `
        <div style="text-align:center; padding:30px 16px; color:var(--text-muted); font-size:13px;">
          <div style="font-size:36px; margin-bottom:10px;">🔥</div>
          Aucune question dans cette série pour l'instant.<br><br>
          <span style="font-size:12px;">Le contenu sera bientôt disponible. Veuillez réessayer plus tard.</span>
          <div style="margin-top:14px;">
            <button class="btn-secondary" style="width:auto; padding:8px 16px; font-size:12px;" onclick="setQuizMode('classique')">🌸 Revenir au mode Classique</button>
          </div>
        </div>
      `;
      return;
    }

    renderQuizStep();
  } catch (e) {
    document.getElementById("quizContentBox").innerHTML = `<div style="color:#ef4444; font-size:12px;">Erreur : ${friendlyError(e)}</div>`;
  }
}

// Change de série de questions et relance le quiz
function setQuizMode(mode) {
  quizMode = mode;
  loadQuiz();
}

function renderQuizStep() {
  const q = quizQuestions[quizIndex];
  const box = document.getElementById("quizContentBox");
  if (!q) return;

  const progress = Math.round(((quizIndex + 1) / quizQuestions.length) * 100);

  box.innerHTML = `
    <div style="height:6px; background:var(--bg-input); border-radius:3px; overflow:hidden; margin-bottom:12px;">
      <div style="height:100%; width:${progress}%; background:var(--accent-rose); transition:width 0.3s ease;"></div>
    </div>
    <div style="font-size:11px; color:var(--text-muted); margin-bottom:14px;">Question ${quizIndex + 1} sur ${quizQuestions.length}</div>
    <div style="font-family:var(--font-serif); font-size:17px; font-weight:500; margin-bottom:18px;">Tu préfères quand ton/ta partenaire...</div>
    
    <div style="display:flex; flex-direction:column; gap:10px;">
      <button class="btn-secondary" style="text-align:left; padding:14px;" onclick="chooseQuizAnswer('${q.option_a_language}')">${escapeHtml(q.option_a_text)}</button>
      <div style="text-align:center; font-size:11px; color:var(--text-muted);">— ou —</div>
      <button class="btn-secondary" style="text-align:left; padding:14px;" onclick="chooseQuizAnswer('${q.option_b_language}')">${escapeHtml(q.option_b_text)}</button>
    </div>
  `;
}

async function chooseQuizAnswer(lang) {
  quizScores[lang] = (quizScores[lang] || 0) + 1;
  quizIndex++;

  if (quizIndex < quizQuestions.length) {
    renderQuizStep();
  } else {
    document.getElementById("quizContentBox").innerHTML = `<div style="text-align:center; padding:30px 10px; color:var(--text-muted);">Calcul du profil...</div>`;
    const answers = [];
    for (const [lang, count] of Object.entries(quizScores)) {
      for (let i = 0; i < count; i++) answers.push({ chosen_language: lang });
    }
    try {
      const { result } = await apiCall("/api/quiz/submit", { method: "POST", body: { answers } });
      renderQuizResults(result);
    } catch (e) {
      document.getElementById("quizContentBox").innerHTML = `<div style="color:#ef4444; font-size:12px;">Erreur : ${friendlyError(e)}</div>`;
    }
  }
}

async function renderQuizResults(result) {
  const box = document.getElementById("quizContentBox");
  const sorted = Object.entries(result.scores).sort((a,b) => b[1]-a[1]);

  let compHtml = `<div style="font-size:12px; color:var(--text-muted); margin-top:14px;">En attente que ton/ta partenaire termine aussi le quiz...</div>`;
  if (!soloMode) {
    try {
      const { compatibility } = await apiCall(`/api/quiz/compatibility?coupleId=${coupleId}`);
      if (compatibility) {
        compHtml = `
          <div style="background:var(--accent-rose-soft); border:1px solid var(--accent-rose); border-radius:14px; padding:16px; margin-top:16px; text-align:center;">
            <div style="font-size:32px; font-weight:700; color:var(--accent-rose);">${compatibility.compatibility_score}%</div>
            <div style="font-weight:600; font-size:13px; margin-top:4px;">Affinité Émotionnelle de Couple</div>
          </div>
        `;
      }
    } catch(e) {}
  }

  box.innerHTML = `
    <div style="text-align:center; margin-bottom:18px;">
      <div style="font-size:12px; color:var(--accent-gold); text-transform:uppercase;">Ton langage principal</div>
      <div style="font-family:var(--font-serif); font-size:24px; font-weight:600; margin-top:4px;">${LANGUAGE_LABELS[result.primary_language]}</div>
    </div>

    <div style="display:flex; flex-direction:column; gap:8px;">
      ${sorted.map(([lang, val]) => `
        <div>
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px;">
            <span>${LANGUAGE_LABELS[lang]}</span>
            <span>${val} pts</span>
          </div>
          <div style="height:6px; background:var(--bg-input); border-radius:3px; overflow:hidden;">
            <div style="height:100%; width:${Math.min(100, (val/quizQuestions.length)*100)}%; background:var(--accent-gold);"></div>
          </div>
        </div>
      `).join("")}
    </div>

    ${compHtml}
    <button class="btn-secondary" style="margin-top:20px;" onclick="loadQuiz()">Refaire le quiz</button>
  `;
}

/* ============================================================
   [PHASE 2] ONGLET AMIS — STYLE WHATSAPP, 100% SUPABASE
   ============================================================
   Remplace les faux contacts codés en dur (Lucas, Camille, Thomas...)
   et la logique en mémoire du backend.

   Structure :
   - Onglet "Discussions" : liste unifiée (couple + amis + groupes)
     avec aperçu du dernier message, comme WhatsApp.
   - Onglet "Amis" : ajout par numéro de téléphone, demandes reçues
     à accepter/refuser, demandes envoyées en attente.
   - Onglet "Groupes" : création, ajout de membres par numéro,
     chat de groupe avec photos.
   ============================================================ */
let friendsData = [];        // Amis acceptés (profil + conversation_id)
let friendStoriesData = [];  // Stories d'amis acceptés et mes stories audience amis
let friendStoriesError = null;
let incomingRequests = [];   // Demandes d'ami reçues
let outgoingRequests = [];   // Demandes d'ami envoyées (en attente)
let groupsData = [];         // Groupes réels (conversations type 'group')
let currentChatContext = null; // Chat ouvert : {kind:'friend'|'group', id, name, avatar}
const convHistoryState = new Map();
let pendingConvFile = null;  // Fichier photo en attente d'envoi (chat ami/groupe)

// Charge les VRAIS amis + demandes + groupes depuis l'API Supabase
async function loadFriends() {
  const screen = document.getElementById("screenBody");
  screen.innerHTML = `
    <div class="screen-scrollable" style="padding-top:10px;">
      <!-- Barre d'onglets style WhatsApp -->
      <div class="amis-tabs">
        <button class="amis-tab-btn ${currentFriendsSubTab==='discussions'?'active':''}" onclick="switchFriendsSubTab('discussions')">Discussions</button>
        <button class="amis-tab-btn ${currentFriendsSubTab==='amis'?'active':''}" onclick="switchFriendsSubTab('amis')">Amis</button>
        <button class="amis-tab-btn ${currentFriendsSubTab==='groupes'?'active':''}" onclick="switchFriendsSubTab('groupes')">Groupes</button>
      </div>
      <div class="friends-stories-bar" id="friendsStoriesBar"></div>
      <input type="file" id="friendStoryFileInput" accept="image/*,video/*" multiple hidden onchange="handleStoryUpload(event, 'friends')">
      <div id="friendsListContainer">
        <div style="text-align:center; padding:24px; color:var(--text-muted); font-size:12px;">Chargement de vos discussions...</div>
      </div>
    </div>
  `;

  const friendsCacheKey = `friendsOverview_${session.user.id}`;
  const cachedOverview = getCache(friendsCacheKey, 10 * 60 * 1000);
  const cachedStories = getCache(`friendStories_${session.user.id}`, 50 * 60 * 1000);
  if (cachedOverview) {
    friendsData = cachedOverview.friends || [];
    incomingRequests = cachedOverview.incomingRequests || [];
    outgoingRequests = cachedOverview.outgoingRequests || [];
    groupsData = cachedOverview.groups || [];
    renderFriendsSubTabContent();
  }
  if (cachedStories) {
    friendStoriesData = cachedStories;
    friendStoriesError = null;
    renderFriendsStoriesBar();
  }

  try {
    const [friendsRes, groupsRes, storiesRes] = await Promise.all([
      apiCall("/api/friends"),
      apiCall("/api/groups"),
      apiCall("/api/stories/friends").catch(error => {
        friendStoriesError = error;
        return { stories: [] };
      })
    ]);
    friendsData = friendsRes.friends || [];
    incomingRequests = friendsRes.requests?.incoming || [];
    outgoingRequests = friendsRes.requests?.outgoing || [];
    groupsData = groupsRes.groups || [];
    friendStoriesData = storiesRes.stories || [];
    setCache(friendsCacheKey, { friends: friendsData, incomingRequests, outgoingRequests, groups: groupsData });
    setCache(`friendStories_${session.user.id}`, friendStoriesData);
    renderFriendsSubTabContent();
    renderFriendsStoriesBar();
    if (window._friendStoryRefresh) clearInterval(window._friendStoryRefresh);
    window._friendStoryRefresh = setInterval(() => {
      if (currentTab === "friends" && !document.hidden) refreshFriendsStories();
    }, 30000);
  } catch (e) {
    document.getElementById("friendsListContainer").innerHTML = `<div style="color:#ef4444; font-size:12px;">Erreur : ${friendlyError(e)}</div>`;
  }
}

async function refreshFriendsStories() {
  if (currentTab !== "friends" || !document.getElementById("friendsStoriesBar")) return;
  try {
    const { stories } = await apiCall("/api/stories/friends");
    friendStoriesData = stories || [];
    setCache(`friendStories_${session.user.id}`, friendStoriesData);
    friendStoriesError = null;
    renderFriendsStoriesBar();
  } catch (error) {
    friendStoriesError = error;
    renderFriendsStoriesBar();
  }
}

function renderFriendsStoriesBar() {
  const bar = document.getElementById("friendsStoriesBar");
  if (!bar) return;
  const ownStories = friendStoriesData.filter(story => story.is_mine);
  const knownFriendIds = new Set(friendsData.map(friend => friend.id));
  const friendItems = friendsData.map(friend => {
    const stories = friendStoriesData.filter(story => story.user_id === friend.id);
    return { friend, stories };
  });
  const groupContactIds = [...new Set(friendStoriesData
    .filter(story => !story.is_mine && !knownFriendIds.has(story.user_id))
    .map(story => story.user_id))];
  for (const contactId of groupContactIds) {
    const story = friendStoriesData.find(item => item.user_id === contactId);
    friendItems.push({
      friend: { id: contactId, display_name: story.author_name, avatar_url: story.author_avatar },
      stories: friendStoriesData.filter(item => item.user_id === contactId)
    });
  }

  bar.innerHTML = `
    ${friendStoriesError ? `<div class="friends-stories-warning">Stories amis indisponibles. Exécute scripts/migrate_friend_stories.sql dans Supabase, puis recharge.</div>` : ''}
    <div class="friends-story-item" onclick="${ownStories.length ? 'openMyFriendStories()' : 'document.getElementById(\'friendStoryFileInput\').click()'}">
      <div class="story-circle me ${ownStories.length ? 'has-story' : 'empty'}">
        <div class="story-inner">${renderAvatarHTML(myProfile.avatar)}</div>
        <button class="story-add-badge" title="Ajouter une story pour mes amis" aria-label="Ajouter une story" onclick="event.stopPropagation(); document.getElementById('friendStoryFileInput').click()">+</button>
      </div>
      <div class="story-label">Ma story</div>
      ${ownStories.length ? `<div class="story-view-count-badge">👁 ${ownStories[0].view_count || 0}</div>` : ""}
    </div>
    ${friendItems.map(({ friend, stories }) => `
      <button class="friends-story-item friends-story-button" onclick="openFriendStories('${escapeAttr(friend.id)}')" aria-label="Story de ${escapeAttr(friend.display_name)}">
        <div class="story-circle ${stories.length ? 'has-story' : 'empty'}">
          <div class="story-inner">${renderAvatarHTML(friend.avatar_url)}</div>
        </div>
        <div class="story-label">${escapeHtml(friend.display_name)}</div>
      </button>
    `).join("")}
  `;
}

function openMyFriendStories() {
  const stories = friendStoriesData.filter(story => story.is_mine);
  if (stories.length) openStoryViewer(stories, 0);
  else document.getElementById("friendStoryFileInput")?.click();
}

function openFriendStories(friendId) {
  const stories = friendStoriesData.filter(story => story.user_id === friendId);
  if (stories.length) openStoryViewer(stories, 0);
  else showToast("Pas encore de story", "Cet ami n'a pas publié de story visible pour ses amis.");
}

function switchFriendsSubTab(subTab) {
  currentFriendsSubTab = subTab;
  loadFriends();
}

function renderFriendsSubTabContent() {
  if (currentFriendsSubTab === "amis") return renderAmisTab();
  if (currentFriendsSubTab === "groupes") return renderGroupesTab();
  return renderDiscussionsTab();
}

// ------------------------------------------------------------
// Onglet DISCUSSIONS : liste unifiée style WhatsApp.
// En tête : la conversation du couple ❤️, puis les amis, puis les
// groupes (triés par dernière activité côté API).
// ------------------------------------------------------------
function renderDiscussionsTab() {
  const container = document.getElementById("friendsListContainer");
  const rows = [];

  // 1. La conversation privée du couple (toujours en première position)
  if (!soloMode) {
    rows.push(`
      <div class="group-item" onclick="switchTab('chat')">
        <div class="group-icon" style="border:2px solid var(--accent-rose);">${renderAvatarHTML(partnerInfo.avatar)}</div>
        <div style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; font-weight:600; color:var(--text-primary);">${escapeHtml(partnerInfo.nickname || "Ma moitié")} ❤️</span>
            <span style="font-size:10px; color:var(--accent-gold);">Amour</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Votre conversation privée à deux</div>
        </div>
      </div>
    `);
  }

  // 2. Les amis (chat 1:1 réel via conversation_id)
  for (const f of friendsData) {
    const online = f.is_online ? "🟢 En ligne" : (f.last_seen ? `Vu ${new Date(f.last_seen).toLocaleDateString("fr-FR")}` : "Hors ligne");
    rows.push(`
      <div class="group-item" onclick="openFriendChat('${f.conversation_id || ''}')">
        <div class="group-icon">${renderAvatarHTML(f.avatar_url)}</div>
        <div style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; font-weight:600; color:var(--text-primary);">${escapeHtml(f.display_name)}</span>
            <span style="font-size:10px; color:var(--text-muted);">${online}</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Tapez pour discuter...</div>
        </div>
      </div>
    `);
  }

  // 3. Les groupes (avec aperçu du dernier message, servi par l'API)
  for (const g of groupsData) {
    rows.push(`
      <div class="group-item" onclick="openGroupChat('${g.id}')">
        <div class="group-icon">${escapeHtml(g.icon || "👥")}</div>
        <div style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; font-weight:600; color:var(--text-primary);">${escapeHtml(g.name)}</span>
            <span style="font-size:10px; color:var(--text-muted);">${g.membersCount} membres</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:230px;">${escapeHtml(g.lastMessage || "Nouvelle discussion")}</div>
        </div>
      </div>
    `);
  }

  container.innerHTML = rows.length > 0
    ? `<div class="groups-list">${rows.join("")}</div>`
    : `<div style="text-align:center; padding:30px 16px; color:var(--text-muted); font-size:12px;">
         <div style="font-size:34px; margin-bottom:8px;">💬</div>
         Aucune discussion pour le moment.<br>Ajoute un ami par son numéro dans l'onglet "Amis" !
       </div>`;
}

// ------------------------------------------------------------
// Onglet AMIS : ajout par numéro + demandes à traiter.
// ------------------------------------------------------------
function renderAmisTab() {
  const container = document.getElementById("friendsListContainer");

  // Demandes d'ami reçues (à accepter/refuser)
  const requestsHtml = incomingRequests.length > 0 ? `
    <div style="font-size:12px; font-weight:700; color:var(--accent-rose); margin-bottom:8px;">📥 Demandes reçues (${incomingRequests.length})</div>
    <div class="groups-list" style="margin-bottom:16px;">
      ${incomingRequests.map((r) => `
        <div class="group-item">
          <div class="group-icon">${renderAvatarHTML(r.user.avatar_url)}</div>
          <div style="flex:1;">
            <div style="font-size:14px; font-weight:600;">${escapeHtml(r.user.display_name)}</div>
            <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(r.user.phone || "Numéro masqué")}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-primary" style="width:auto; padding:7px 12px; font-size:11px;" onclick="acceptFriendRequest('${r.request_id}')">✓</button>
            <button class="btn-secondary" style="width:auto; padding:7px 10px; font-size:11px; color:#ef4444; border-color:rgba(239,68,68,0.4);" onclick="declineFriendRequest('${r.request_id}')">✕</button>
          </div>
        </div>
      `).join("")}
    </div>
  ` : "";

  // Demandes envoyées (en attente de réponse)
  const pendingHtml = outgoingRequests.length > 0 ? `
    <div style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">⏳ En attente de réponse</div>
    <div class="groups-list" style="margin-bottom:16px;">
      ${outgoingRequests.map((r) => `
        <div class="group-item">
          <div class="group-icon">⏳</div>
          <div style="flex:1; font-size:13px; font-weight:500;">${escapeHtml(r.display_name)}</div>
          <span style="font-size:11px; color:var(--text-muted);">Envoyée</span>
        </div>
      `).join("")}
    </div>
  ` : "";

  // Liste des amis acceptés
  const friendsHtml = friendsData.length > 0 ? `
    <div style="font-size:12px; font-weight:700; color:var(--accent-gold); margin-bottom:8px;">✅ Mes amis (${friendsData.length})</div>
    <div class="groups-list">
      ${friendsData.map((f) => `
        <div class="group-item" onclick="openFriendChat('${f.conversation_id || ''}')">
          <div class="group-icon">${renderAvatarHTML(f.avatar_url)}</div>
          <div style="flex:1;">
            <div style="font-size:14px; font-weight:600;">${escapeHtml(f.display_name)}</div>
            <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(f.phone || "")}</div>
          </div>
          <span style="font-size:14px;">💬</span>
        </div>
      `).join("")}
    </div>
  ` : "";

  container.innerHTML = `
    <button class="btn-primary" style="margin-bottom:16px;" onclick="addFriendByPhone()">📱 Ajouter un ami par son numéro</button>
    ${requestsHtml}
    ${pendingHtml}
    ${friendsHtml || `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">Aucun ami pour l'instant. Ajoute-en un avec son numéro de téléphone 👆</div>`}
  `;
}

// Ajout d'un ami par numéro de téléphone (comme WhatsApp)
async function addFriendByPhone() {
  const phone = prompt("Numéro de téléphone de ton ami(e) :\n(format international conseillé, ex: +226 00 00 00 00)");
  if (!phone) return;

  try {
    const result = await apiCall("/api/friends/request", { method: "POST", body: { phone } });
    if (result.auto_accepted) {
      alert("🎉 Amitié créée ! Vous pouvez discuter immédiatement.");
    } else {
      alert(`✅ Demande envoyée à ${result.target?.display_name || "ton ami(e)"} !`);
    }
    loadFriends();
  } catch (e) {
    alert(friendlyError(e));
  }
}

// Accepte une demande d'ami -> amitié + conversation créées côté serveur
async function acceptFriendRequest(requestId) {
  try {
    await apiCall("/api/friends/accept", { method: "POST", body: { requestId } });
    showToast("👥 Nouvel ami", "Demande acceptée — vous pouvez discuter !");
    loadFriends();
  } catch (e) {
    alert(friendlyError(e));
  }
}

// Refuse une demande d'ami
async function declineFriendRequest(requestId) {
  try {
    await apiCall("/api/friends/decline", { method: "POST", body: { requestId } });
    loadFriends();
  } catch (e) {
    alert(friendlyError(e));
  }
}

// ------------------------------------------------------------
// Onglet GROUPES : création + liste.
// ------------------------------------------------------------
function renderGroupesTab() {
  const container = document.getElementById("friendsListContainer");
  container.innerHTML = `
    <button class="btn-primary" style="margin-bottom:16px;" onclick="promptCreateGroup()">➕ Créer un nouveau groupe</button>
    ${groupsData.length > 0 ? `
      <div class="groups-list">
        ${groupsData.map((g) => `
          <div class="group-item" onclick="openGroupChat('${g.id}')">
            <div class="group-icon">${escapeHtml(g.icon || "👥")}</div>
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:14px; font-weight:600; color:var(--text-primary);">${escapeHtml(g.name)}</span>
                <span style="font-size:11px; color:var(--accent-gold); font-weight:600;">${g.membersCount} membres</span>
              </div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:230px;">${escapeHtml(g.lastMessage || "")}</div>
            </div>
          </div>
        `).join("")}
      </div>
    ` : `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">Aucun groupe. Crée le premier et invite tes amis par leur numéro 👆</div>`}
  `;
}

// Création d'un groupe réel (conversation type 'group' en base)
async function promptCreateGroup() {
  const name = prompt("Nom du nouveau groupe (ex: Soirées Potes, Double Date) :");
  if (!name) return;
  try {
    const { group } = await apiCall("/api/groups", {
      method: "POST",
      body: { name, icon: "✨" }
    });
    groupsData.unshift(group);
    showToast("👥 Groupe créé", `${group.name} est prêt !`);
    currentFriendsSubTab = "groupes";
    loadFriends();
  } catch (e) {
    alert(friendlyError(e));
  }
}

// ------------------------------------------------------------
// [PHASE 2] MOTEUR DE CONVERSATION UNIFIÉ (amis & groupes).
// Remplace les anciens écrans factices : les messages sont réellement
// stockés dans Supabase (table group_messages) et servis par l'API.
// ------------------------------------------------------------

// Ouvre le chat 1:1 avec un ami (via sa conversation)
function openFriendChat(conversationId) {
  if (!conversationId) {
    alert("La conversation n'est pas encore prête — réessaie dans un instant.");
    return;
  }
  const friend = friendsData.find((f) => f.conversation_id === conversationId);
  if (!friend) { loadFriends(); return; }

  currentChatContext = { kind: "friend", id: conversationId, name: friend.display_name, avatar: friend.avatar_url };

  renderConversationShell({
    title: escapeHtml(friend.display_name),
    subtitle: friend.is_online ? "🟢 En ligne" : "Hors ligne",
    avatarHtml: renderAvatarHTML(friend.avatar_url),
    headerRight: "",
    placeholder: `Écris à ${escapeHtml(friend.display_name)}...`,
  });
  loadConvHistory();
}

// Ouvre le chat d'un groupe (avec bouton d'ajout de membres)
function openGroupChat(groupId) {
  const group = groupsData.find((g) => g.id === groupId);
  if (!group) { loadFriends(); return; }

  currentChatContext = { kind: "group", id: groupId, name: group.name, avatar: group.icon || "👥" };

  renderConversationShell({
    title: escapeHtml(group.name),
    subtitle: `${group.membersCount} membres`,
    avatarHtml: escapeHtml(group.icon || "👥"),
    headerRight: `<div style="display:flex; gap:6px;">
          <button class="btn-secondary" style="padding:6px 10px; font-size:11px; width:auto;" onclick="openGroupMemories('${groupId}')">📸 Album</button>
          <button class="btn-secondary" style="padding:6px 10px; font-size:11px; width:auto;" onclick="addMemberToGroup('${groupId}')">➕ Membre</button>
        </div>`,
    placeholder: "Message au groupe...",
  });
  loadConvHistory();
}

// Construit l'écran de conversation (en-tête + messages + barre de saisie)
function renderConversationShell(opts) {
  const screen = document.getElementById("screenBody");
  screen.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%; overflow:hidden;">
      <!-- En-tête style WhatsApp -->
      <div style="padding:10px 14px; background:var(--bg-card); border-bottom:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <button class="icon-btn" onclick="closeConversationChat()">←</button>
          <div class="avatar-img" style="width:36px; height:36px; font-size:17px;">${opts.avatarHtml}</div>
          <div style="min-width:0;">
            <div style="font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${opts.title}</div>
            <div style="font-size:11px; color:var(--accent-gold);">${opts.subtitle}</div>
          </div>
        </div>
        ${opts.headerRight}
      </div>

      <!-- Historique des messages (chargé depuis Supabase) -->
      <div class="chat-messages" id="convMessagesContainer">
        <div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">Chargement des messages...</div>
      </div>

      <!-- [REPLY] Barre de réponse intégrée -->
      <div class="reply-preview-bar" id="replyPreviewBar" style="display:none;">
        <div class="reply-preview-text">
          <strong id="replyPreviewAuthor"></strong>
          <span id="replyPreviewText"></span>
        </div>
        <button class="reply-preview-close" onclick="clearReplyTo()" aria-label="Annuler réponse">✕</button>
      </div>

      <!-- Barre de saisie : photo + vocal + texte (comme WhatsApp) -->
      <div class="chat-input-bar">
        <div class="chat-input-controls">
          <button class="icon-btn" title="Envoyer une photo" onclick="document.getElementById('convFileInput').click()">📎</button>
          <input type="file" id="convFileInput" accept="image/*" style="display:none;" onchange="handleConvPhotoSelect(event)">
          <button class="icon-btn" id="convMicBtn" title="Message vocal" onclick="toggleVoiceRecord()">🎤</button>
          <input type="file" id="convAudioFileInput" accept="audio/*" style="display:none;" onchange="handleConvAudioFileSelect(event)">
          <button class="icon-btn" title="Emoji, stickers & GIF" onclick="toggleEmojiPanel('convTextInput')">😊</button>
          <input class="chat-text-input" id="convTextInput" placeholder="${opts.placeholder}" onkeydown="if(event.key==='Enter')sendConvTextMessage()">
          <button class="chat-send-btn" onclick="sendConvTextMessage()">➤</button>
        </div>

        <!-- [VOICE RECORD] Interface d'enregistrement vocal en direct -->
        <div class="voice-record-bar" id="voiceRecordBar" style="display:none;">
          <div class="voice-record-info">
            <span class="voice-record-dot">🔴</span>
            <span class="voice-record-timer" id="voiceRecordTimer">0:00</span>
          </div>
          <div class="voice-record-waves">
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
          </div>
          <div class="voice-record-actions">
            <button class="voice-btn-cancel" onclick="cancelVoiceRecording()" title="Annuler le vocal">🗑️</button>
            <button class="voice-btn-send" onclick="stopAndSendVoiceRecording()" title="Envoyer le vocal">➤</button>
          </div>
        </div>
      </div>

      <!-- [EMOJI/STICKERS/GIF] Panneau -->
      <div id="emojiPanel" class="emoji-panel" style="display:none;"></div>
    </div>
  `;

  const messageBox = screen.querySelector("#convMessagesContainer");
  messageBox.addEventListener("scroll", async () => {
    if (messageBox.scrollTop > 32) return;
    const previousHeight = messageBox.scrollHeight;
    const previousTop = messageBox.scrollTop;
    await loadConvHistory(true);
    messageBox.scrollTop = previousTop + messageBox.scrollHeight - previousHeight;
  }, { passive: true });
}

// Retour à la liste des discussions
function closeConversationChat() {
  currentChatContext = null;
  loadFriends();
}

// Charge l'historique réel de la conversation ouverte
async function loadConvHistory(loadOlder = false) {
  if (!currentChatContext) return;
  const convId = currentChatContext.id;
  const cacheKey = `convHistory_${convId}`;
  const state = convHistoryState.get(convId) || {
    messages: [], oldestCursor: null, hasMore: true, initialized: false,
    isLoading: false, refreshPending: false,
  };
  convHistoryState.set(convId, state);
  if (state.isLoading) {
    if (!loadOlder) state.refreshPending = true;
    return;
  }
  if (loadOlder && (!state.hasMore || !state.oldestCursor)) return;

  const box = document.getElementById("convMessagesContainer");
  if (!box) return;
  const renderMessages = (messages, scrollToBottom) => {
    if (!messages.length) {
      box.innerHTML = `<div style="text-align:center; margin:auto; color:var(--text-muted); font-size:12px;">
        <div style="font-size:34px; margin-bottom:8px;">👋</div>
        Aucun message ici.<br>Lancez la discussion !
      </div>`;
      return;
    }
    box.innerHTML = messages.map(renderConvMessageHTML).join("");
    bindAllLongPress(box);
    bindAllSwipeReply(box);
    if (scrollToBottom) box.scrollTop = box.scrollHeight;
  };

  if (!state.initialized) {
    const cached = getCache(cacheKey, 50 * 60 * 1000);
    if (cached?.length) {
      state.messages = cached;
      state.oldestCursor = cached[0]?.created_at || null;
      state.initialized = true;
    }
    if (state.messages.length) renderMessages(state.messages, true);
  }

  state.isLoading = true;
  try {
    const cursor = loadOlder && state.oldestCursor
      ? `&before=${encodeURIComponent(state.oldestCursor)}`
      : "";
    const { messages = [], hasMore = false } = await apiCall(
      `/api/groups/${convId}/messages?limit=50${cursor}`
    );
    state.messages = loadOlder
      ? [...messages, ...state.messages]
      : messages;
    state.oldestCursor = state.messages[0]?.created_at || null;
    state.hasMore = hasMore;
    state.initialized = true;
    setCache(cacheKey, state.messages.slice(-50));

    if (currentChatContext?.id !== convId) return;
    renderMessages(state.messages, !loadOlder);
    if (!loadOlder) {
      convPollSince = new Date().toISOString();
      apiCall(`/api/groups/${convId}/delivered`, { method: "POST" }).catch(() => {});
      apiCall(`/api/groups/${convId}/seen`, { method: "POST" }).catch(() => {});
    }
  } catch (error) {
    if (currentChatContext?.id === convId && !state.messages.length) {
      box.innerHTML = `<div style="text-align:center; color:#ef4444; font-size:12px; padding:20px;">Erreur : ${friendlyError(error)}</div>`;
    }
  } finally {
    state.isLoading = false;
    if (state.refreshPending) {
      state.refreshPending = false;
      if (currentChatContext?.id === convId) loadConvHistory();
    }
  }
}

// Rendu d'un message de conversation (texte, photo, vocal, vidéo).
// [TICKS AMIS] Dans une conversation amie 1:1 : mêmes confirmations que
// le chat couple (✓ envoyé / ✓✓ distribué / ✓✓ bleu lu).
// [CRUD] Boutons modifier/supprimer sur mes propres messages.
function renderConvMessageHTML(m) {
  const isMe = (m.from_user === session.user.id);
  const side = isMe ? "me" : "them";
  const time = formatMessageTime(m.created_at);
  const isGroup = currentChatContext?.kind === "group";

  let body = "";
  if (m.deleted) {
    body = `<div class="msg-bubble msg-deleted">🚫 Message supprimé</div>`;
  } else if (m.type === "text") {
    if (isEmojiOnly(m.text)) {
      body = `<div class="emoji-only-msg">${escapeHtml(m.text)}</div>`;
    } else {
      body = `<div class="msg-bubble">${escapeHtml(m.text || "")}</div>`;
    }
  } else if (m.type === "photo") {
    const mediaUrl = m.media_url || m.media_path;
    if (!mediaUrl) {
      body = `<div class="msg-bubble msg-deleted">📷 Photo non disponible</div>`;
    } else {
      const regId = registerMedia(mediaUrl);
      body = `
        <div class="msg-bubble ${m.text === "sticker" ? "custom-sticker-bubble" : ""}" style="padding:4px; background:none;">
          <img class="chat-media-preview" src="${escapeAttr(mediaUrl)}" alt="${m.text === "sticker" ? "Sticker" : "Photo"}" 
               onload="scrollChatToBottom()" 
               onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'color:#ef4444;font-size:12px;padding:10px;\\'>📷 Photo non disponible</div>'"
               onclick="openRegisteredMedia('${regId}', false, false)">
        </div>
      `;
    }
  } else if (m.type === "video") {
    body = `
      <div class="msg-bubble" style="padding:4px; background:none;">
        <video class="chat-video-preview" src="${escapeAttr(m.media_url)}" controls playsinline></video>
      </div>
    `;
  } else if (m.type === "voice") {
    body = `
      <div class="msg-bubble" style="display:flex; align-items:center; gap:8px;">
        <span>🎙️</span><audio class="chat-audio-preview" src="${escapeAttr(m.media_url)}" controls preload="metadata"></audio>
      </div>
    `;
  }

  /* Ticks : complets en conversation amie ; en groupe, simple ✓ d'envoi
     (la lecture par CHAQUE membre demanderait un suivi par membre) */
  let tickHtml = "";
  if (isMe && !m.deleted) {
    if (isGroup) {
      tickHtml = `<span class="ticks" title="Envoyé">${tickSingleSvg()}</span>`;
    } else if (m.read_at) {
      tickHtml = `<span class="ticks read" title="Lu">${tickDoubleSvg()}</span>`;
    } else if (m.delivered_at) {
      tickHtml = `<span class="ticks" title="Distribué">${tickDoubleSvg()}</span>`;
    } else {
      tickHtml = `<span class="ticks" title="Envoyé">${tickSingleSvg()}</span>`;
    }
  }

  const editedFlag = m.edited ? `<span class="edited-flag">modifié</span>` : "";
  // [LONG-PRESS] Les actions sont dans le menu contextuel (appui long)
  const canEditAttr = (isMe && !m.deleted && m.type === "text" && !isEmojiOnly(m.text)) ? "1" : "0";
  const canDeleteAttr = (isMe && !m.deleted) ? "1" : "0";
  const authorName = isMe ? myProfile.nickname : (m.user_name || "Membre");

  // [REPLY] Bulle citée si ce message est une réponse
  const replyAuthor = m.reply_is_mine ? (isMe ? "Toi" : (m.user_name || "Membre")) : (isMe ? (m.user_name || "Membre") : "Toi");
  const replyQuoteHtml = m.reply_preview
    ? `<div class="reply-quote" onclick="scrollToMessage('${escapeAttr(m.reply_to_id || '')}')"><strong>${escapeHtml(replyAuthor)}</strong>${escapeHtml(m.reply_preview)}</div>`
    : "";

  return `
    <div class="msg-row ${side}" data-msg-id="${escapeAttr(m.id)}" data-scope="conv"
         data-mine="${isMe ? '1' : '0'}" data-type="${escapeAttr(m.type || 'text')}"
         data-deleted="${m.deleted ? '1' : '0'}" data-can-edit="${canEditAttr}" data-can-delete="${canDeleteAttr}"
         data-created-at="${escapeAttr(m.created_at || '')}" data-delivered-at="${escapeAttr(m.delivered_at || '')}"
         data-read-at="${escapeAttr(m.read_at || '')}" data-text="${escapeAttr(m.text || '')}"
         data-author="${escapeAttr(authorName || '')}"
         data-reply-to-id="${escapeAttr(m.reply_to_id || '')}" data-reply-preview="${escapeAttr(m.reply_preview || '')}">
      ${!isMe ? `<div style="font-size:11px; font-weight:600; color:var(--accent-gold); margin:0 4px 2px;">${escapeHtml(m.user_name || "Membre")}</div>` : ""}
      ${replyQuoteHtml}
      ${body}
      <div class="msg-meta">
        ${editedFlag}
        <span>${time}</span>
        ${tickHtml}
      </div>
    </div>
  `;
}

// Envoie un message texte dans la conversation ouverte
async function sendConvTextMessage() {
  if (!currentChatContext) return;
  const input = document.getElementById("convTextInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  const replyToId = _replyToId;
  const replyPreview = _replyPreview;
  const replyIsMine = _replyIsMine;
  clearReplyTo();

  try {
    await apiCall(`/api/groups/${currentChatContext.id}/messages`, {
      method: "POST",
      body: {
        type: "text",
        text,
        ...(replyToId ? { replyToId, replyPreview, replyIsMine } : {})
      }
    });
    await loadConvHistory();
  } catch (e) {
    alert(friendlyError(e));
  }
}

// Sélection d'une photo -> compression -> envoi immédiat
async function handleConvPhotoSelect(event) {
  if (!currentChatContext) return;
  const file = event.target.files[0];
  if (!file) return;

  const pendingId = showPendingBubble();
  try {
    /* [UPLOAD DIRECT] Les images sont compressées localement puis
       envoyées directement vers Storage ; les vidéos partent brutes. */
    let toUpload = file;
    if (file.type.startsWith("image/")) {
      const dataUrl = await compressImageToDataUrl(file, 1080, 0.85);
      if (dataUrl) {
        const blob = await (await fetch(dataUrl)).blob();
        toUpload = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      }
    }
    const { path, mimeType } = await uploadMediaDirectly(toUpload, `conv/${currentChatContext.id}/media`);
    await apiCall(`/api/groups/${currentChatContext.id}/messages`, {
      method: "POST",
      body: { type: "photo", mediaPath: path, mimeType }
    });
    removePendingBubble(pendingId);
    await loadConvHistory();
  } catch (e) {
    removePendingBubble(pendingId);
    alert(friendlyError(e));
  } finally {
    event.target.value = ""; // permet de re-sélectionner le même fichier
  }
}

/* ============================================================
   [CRUD MESSAGES] Modifier / Supprimer ses propres messages
   (texte ET médias) dans le chat couple ET les conversations.
   Suppression = douce : le message reste visible comme
   "🚫 Message supprimé" pour tout le monde (comme WhatsApp).
   ============================================================ */

// Remplace le contenu d'une bulle par le placeholder "supprimé"
function replaceWithDeleted(row) {
  if (!row) return;
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble msg-deleted";
  bubble.textContent = "🚫 Message supprimé";
  row.querySelector(".msg-bubble")?.replaceWith(bubble);
  row.querySelectorAll("img, video, audio, .card-embedded, .once-card").forEach((el) => el.remove());
  // Retirer les data-attributes liés aux actions
  row.dataset.canEdit = "0";
  row.dataset.canDelete = "0";
  row.dataset.deleted = "1";
}

// Ajoute (ou met à jour) la mention "modifié" sous la bulle
function markEdited(row) {
  if (!row) return;
  const meta = row.querySelector(".msg-meta");
  if (meta && !meta.querySelector(".edited-flag")) {
    const flag = document.createElement("span");
    flag.className = "edited-flag";
    flag.textContent = "modifié";
    meta.prepend(flag);
  }
}

/* ============================================================
   [LONG-PRESS MENU] Menu contextuel style WhatsApp
   Appui long (≥ 500ms) sur un message → bottom sheet
   ============================================================ */
let _longPressTimer = null;
let _longPressMoved = false;
let _currentMenuRow = null;

function closeMsgMenu() {
  const overlay = document.getElementById("msgMenuOverlay");
  if (overlay) overlay.classList.remove("open");
  document.querySelectorAll(".msg-row.msg-selected").forEach((r) => r.classList.remove("msg-selected"));
  _currentMenuRow = null;
}

function copySelectedMessageText() {
  const text = _currentMenuRow?.dataset.text;
  closeMsgMenu();
  if (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    showToast("Copié", "Texte copié dans le presse-papier");
  }
}

function handleReplyFromMenu() {
  const row = _currentMenuRow;
  closeMsgMenu();
  if (!row) return;

  const msgId = row.dataset.msgId;
  const isMe = row.dataset.mine === "1";
  const msgType = row.dataset.type || "text";
  const msgText = row.dataset.text || "";
  let rPreview = "";

  if (msgType === "text") {
    rPreview = msgText.replace(/^🎴\s*/, "").slice(0, 60) + (msgText.length > 60 ? "…" : "");
  } else if (msgType === "photo") {
    rPreview = "📷 Photo";
  } else if (msgType === "video") {
    rPreview = "🎬 Vidéo";
  } else if (msgType === "voice") {
    rPreview = "🎙️ Vocal";
  } else {
    rPreview = "📎 Fichier";
  }

  const rAuthor = row.dataset.author || "";
  setReplyTo(msgId, rPreview, isMe, rAuthor);
}

function openMsgMenu(row) {
  _currentMenuRow = row;
  const scope     = row.dataset.scope;     // 'couple' ou 'conv'
  const msgId     = row.dataset.msgId;
  const isMe      = row.dataset.mine === "1";
  const canEdit   = row.dataset.canEdit === "1";
  const canDelete = row.dataset.canDelete === "1";
  const type      = row.dataset.type || "text";
  const createdAt = row.dataset.createdAt;
  const deliveredAt = row.dataset.deliveredAt;
  const readAt    = row.dataset.readAt;
  const text      = row.dataset.text || "";

  // Surligner la bulle sélectionnée
  document.querySelectorAll(".msg-row.msg-selected").forEach((r) => r.classList.remove("msg-selected"));
  row.classList.add("msg-selected");

  // Construire le contenu du sheet
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  };

  let infoRows = `
    <div class="msg-info-row">
      <span class="msg-info-label">Envoyé à</span>
      <span class="msg-info-value">${fmtTime(createdAt)}${createdAt ? ' (' + fmtDate(createdAt) + ')' : ''}</span>
    </div>`;
  if (isMe) {
    let statusLabel = "Envoyé ✓";
    if (readAt)           statusLabel = `Lu ✓✓ (${fmtTime(readAt)})`;
    else if (deliveredAt) statusLabel = `Distribué ✓✓ (${fmtTime(deliveredAt)})`;
    infoRows += `
    <div class="msg-info-row">
      <span class="msg-info-label">Statut</span>
      <span class="msg-info-value">${statusLabel}</span>
    </div>`;
  }

  let actionBtns = "";

  // [REPLY] Bouton Répondre — toujours disponible sauf si message supprimé
  const isDeleted = row.dataset.deleted === "1";
  if (!isDeleted) {
    actionBtns += `<button class="msg-menu-btn" onclick="handleReplyFromMenu()">
      <span>💬</span><span>Répondre</span>
    </button>`;
  }

  if (canEdit) {
    actionBtns += `<button class="msg-menu-btn" onclick="closeMsgMenu(); editMessage('${scope}', '${msgId}')">
      <span>✏️</span><span>Modifier</span>
    </button>`;
  }
  if (canDelete) {
    actionBtns += `<button class="msg-menu-btn danger" onclick="closeMsgMenu(); deleteMessage('${scope}', '${msgId}')">
      <span>🗑️</span><span>Supprimer pour tout le monde</span>
    </button>`;
  }
  if (!isDeleted && type === "photo" && row.querySelector(".chat-media-preview")) {
    actionBtns += `<button class="msg-menu-btn" onclick="saveStickerFromMessage()">
      <span>🎟️</span><span>Enregistrer comme sticker</span>
    </button>`;
  }
  // Copier le texte (si texte)
  if (type === "text" && text) {
    actionBtns += `<button class="msg-menu-btn" onclick="copySelectedMessageText()">
      <span>📋</span><span>Copier</span>
    </button>`;
  }
  actionBtns += `<button class="msg-menu-btn" onclick="closeMsgMenu()">
    <span>✕</span><span>Fermer</span>
  </button>`;

  const sheet = document.getElementById("msgMenuSheet");
  if (!sheet) return;
  sheet.innerHTML = `
    <div class="msg-menu-handle"></div>
    ${infoRows}
    ${actionBtns}
  `;

  const overlay = document.getElementById("msgMenuOverlay");
  if (overlay) overlay.classList.add("open");
}

// Pose les listeners long-press sur un .msg-row
function attachLongPress(row) {
  if (!row || row._longPressAttached) return;
  row._longPressAttached = true;

  const start = (e) => {
    _longPressMoved = false;
    _longPressTimer = setTimeout(() => {
      if (!_longPressMoved) {
        // Vibration haptique si supportée
        if (navigator.vibrate) navigator.vibrate(40);
        openMsgMenu(row);
      }
    }, 500);
  };
  const cancel = () => {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  };
  const move = () => { _longPressMoved = true; cancel(); };

  row.addEventListener("touchstart", start, { passive: true });
  row.addEventListener("touchend", cancel);
  row.addEventListener("touchcancel", cancel);
  row.addEventListener("touchmove", move, { passive: true });
  // Support souris (desktop)
  row.addEventListener("mousedown", start);
  row.addEventListener("mouseup", cancel);
  row.addEventListener("mouseleave", cancel);
  row.addEventListener("contextmenu", (e) => { e.preventDefault(); openMsgMenu(row); });
}

// Attache les long-press à tous les .msg-row présents dans un conteneur
function bindAllLongPress(container) {
  container.querySelectorAll(".msg-row").forEach((row) => {
    attachLongPress(row);
  });
}

// Attache le swipe-to-reply à tous les .msg-row présents dans un conteneur
function bindAllSwipeReply(container) {
  container.querySelectorAll(".msg-row").forEach((row) => {
    attachSwipeReply(row);
  });
}

/* [SWIPE-TO-REPLY] Glisser un message vers la droite pour répondre.
   Sur mobile : touchstart -> touchend, si décalage horizontal > 60px
   et décalage vertical < 40px (geste non ambigu). */
function attachSwipeReply(row) {
  if (!row || row._swipeReplyAttached) return;
  row._swipeReplyAttached = true;

  let startX = 0, startY = 0, moved = false;
  let touchStartTime = 0;

  row.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false;
    touchStartTime = Date.now();
  }, { passive: true });

  row.addEventListener("touchmove", (e) => {
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > 20 && dy < 40) {
      // Retour haptique visuel (léger décalage)
      const shift = Math.min(dx * 0.35, 55);
      row.style.transform = `translateX(${shift}px)`;
      row.classList.add("swiping");
      moved = true;
    }
  }, { passive: true });

  row.addEventListener("touchend", (e) => {
    if (!moved) return;
    const dx = e.changedTouches[0].clientX - startX;
    const touchDuration = Date.now() - touchStartTime;
    
    row.style.transform = "";
    row.classList.remove("swiping");
    
    // Réduire le seuil pour iOS et ajuster selon la durée du geste
    const swipeThreshold = (dx > 40 && touchDuration < 500) || dx > 60;
    
    if (swipeThreshold) {
      // Déclencher la réponse
      const msgId = row.dataset.msgId;
      const isMe = row.dataset.mine === "1";
      const text = row.dataset.text || row.querySelector(".msg-bubble")?.textContent || "";
      const msgType = row.dataset.type || "text";
      const authorName = row.dataset.author || (isMe ? myProfile.nickname : partnerInfo.nickname);
      let preview = "";
      if (msgType === "text") preview = text.slice(0, 60) + (text.length > 60 ? "…" : "");
      else if (msgType === "photo") preview = "📷 Photo";
      else if (msgType === "video") preview = "🎬 Vidéo";
      else if (msgType === "voice") preview = "🎙️ Vocal";
      else preview = "📎 Fichier";
      if (navigator.vibrate) navigator.vibrate(20);
      setReplyTo(msgId, preview, isMe, authorName);
    }
    moved = false;
  }, { passive: true });
  
  // Support desktop mouse events
  let mouseDown = false;
  let mouseStartX = 0;
  
  row.addEventListener("mousedown", (e) => {
    mouseDown = true;
    mouseStartX = e.clientX;
  });
  
  row.addEventListener("mousemove", (e) => {
    if (!mouseDown) return;
    const dx = e.clientX - mouseStartX;
    if (dx > 20) {
      const shift = Math.min(dx * 0.35, 55);
      row.style.transform = `translateX(${shift}px)`;
      row.classList.add("swiping");
      moved = true;
    }
  });
  
  row.addEventListener("mouseup", (e) => {
    mouseDown = false;
    if (!moved) return;
    const dx = e.clientX - mouseStartX;
    row.style.transform = "";
    row.classList.remove("swiping");
    
    if (dx > 60) {
      const msgId = row.dataset.msgId;
      const isMe = row.dataset.mine === "1";
      const text = row.dataset.text || row.querySelector(".msg-bubble")?.textContent || "";
      const msgType = row.dataset.type || "text";
      const authorName = row.dataset.author || (isMe ? myProfile.nickname : partnerInfo.nickname);
      let preview = "";
      if (msgType === "text") preview = text.slice(0, 60) + (text.length > 60 ? "…" : "");
      else if (msgType === "photo") preview = "📷 Photo";
      else if (msgType === "video") preview = "🎬 Vidéo";
      else if (msgType === "voice") preview = "🎙️ Vocal";
      else preview = "📎 Fichier";
      setReplyTo(msgId, preview, isMe, authorName);
    }
    moved = false;
  });
  
  row.addEventListener("mouseleave", () => {
    mouseDown = false;
    if (moved) {
      row.style.transform = "";
      row.classList.remove("swiping");
      moved = false;
    }
  });
}

// ✏️ Modifier mon message texte (couple : 'couple' / conversation : 'conv')
async function editMessage(scope, messageId) {
  const row = document.querySelector(`[data-msg-id="${messageId}"]`);
  const current = row?.dataset.text || row?.querySelector(".msg-bubble")?.textContent || "";
  const newText = prompt("Modifier ton message :", current);
  if (!newText || !newText.trim() || newText === current) return;

  try {
    const url = scope === "couple"
      ? "/api/chat/message/update"
      : `/api/groups/${currentChatContext.id}/messages/update`;
    await apiCall(url, {
      method: "POST",
      body: { messageId, text: newText.trim() }
    });
    // Mise à jour locale immédiate (le temps réel confirme aux autres)
    const bubble = row?.querySelector(".msg-bubble");
    if (bubble) bubble.textContent = newText.trim();
    if (row) row.dataset.text = newText.trim();
    markEdited(row);
  } catch (e) {
    alert(friendlyError(e));
  }
}

// 🗑️ Supprimer mon message (pour tout le monde)
async function deleteMessage(scope, messageId) {
  if (!confirm("Supprimer ce message pour tout le monde ?")) return;
  try {
    const url = scope === "couple"
      ? "/api/chat/message/delete"
      : `/api/groups/${currentChatContext.id}/messages/delete`;
    await apiCall(url, {
      method: "POST",
      body: { messageId }
    });
    replaceWithDeleted(document.querySelector(`[data-msg-id="${messageId}"]`));
  } catch (e) {
    alert(friendlyError(e));
  }
}

// ============================================================
// [FLUIDITÉ] Rattrapage automatique toutes les 4 secondes.
// Le temps réel Supabase reste prioritaire (instantané) ; ce
// polling garantit qu'AUCUN message n'est jamais manqué, même si
// Realtime n'est pas activé côté base ou si une connexion a loupé.
// ============================================================
let couplePollSince = null;  // dernier instant vu côté chat couple
let convPollSince = null;    // dernier instant vu côté conversation ouverte

function startPolling() {
  if (window._pollInterval) return;
  window._pollInterval = setInterval(async () => {
    if (document.hidden) return; // économise la batterie en arrière-plan
    try {
      if (currentTab === "chat" && coupleId && !soloMode) await pollCoupleUpdates();
      if (currentChatContext) await pollConvUpdates();
    } catch (e) { /* silencieux : on retentera dans 10s */ }
  }, 10000); // Augmenté de 4s à 10s pour moins de requêtes
}

// Rattrape les NOUVEAUX messages + les changements d'état (lu, supprimé,
// modifié, distribué) du chat couple
async function pollCoupleUpdates() {
  const { new: newMsgs, statuses, now } = await apiCall(
    `/api/chat/updates?coupleId=${coupleId}&since=${encodeURIComponent(couplePollSince || "")}`
  );
  couplePollSince = now;
  if (currentTab !== "chat") return;

  for (const m of newMsgs || []) {
    if (document.querySelector(`[data-msg-id="${m.id}"]`)) continue; // déjà affiché
    appendMessageToDOM(normalizeIncoming(m));
    scrollChatToBottom(true);
  }
  for (const s of statuses || []) applyCoupleStatus(s);
}

// Applique un changement d'état sur une bulle du chat couple
function applyCoupleStatus(s) {
  const row = document.querySelector(`[data-msg-id="${s.id}"]`);
  if (!row) return;

  if (s.deleted) { replaceWithDeleted(row); return; }
  if (s.edited) {
    const bubble = row.querySelector(".msg-bubble");
    if (bubble && s.text && bubble.textContent !== s.text) bubble.textContent = s.text;
    markEdited(row);
  }
  if (s.consumed) {
    const once = row.querySelector(".once-card");
    if (once && !once.classList.contains("consumed")) {
      once.className = "once-card consumed";
      once.innerHTML = `<span class="once-icon">✓</span><span>Déjà vu & supprimé</span>`;
    }
  }
  const ticks = row.querySelector(".ticks");
  if (ticks) {
    if (s.read_at) { ticks.className = "ticks read"; ticks.innerHTML = tickDoubleSvg(); }
    else if (s.delivered_at && !ticks.classList.contains("read")) ticks.innerHTML = tickDoubleSvg();
  }
}

// Même chose pour la conversation ami/groupe ouverte
async function pollConvUpdates() {
  const convId = currentChatContext?.id;
  if (!convId) return;
  const { new: newMsgs, now } = await apiCall(
    `/api/groups/${convId}/updates?since=${encodeURIComponent(convPollSince || "")}`
  );
  convPollSince = now;
  if (!currentChatContext || currentChatContext.id !== convId) return;

  let received = false;
  for (const m of newMsgs || []) {
    if (document.querySelector(`[data-msg-id="${m.id}"]`)) continue;
    received = received || (m.from_user !== session.user.id);
  }
  if ((newMsgs || []).length > 0) await loadConvHistory();

  // [TICKS AMIS] Conversation ouverte à l'écran = messages VUS :
  // marque lu (bleu chez l'expéditeur) ; et livraison dès réception
  if (received || (newMsgs || []).length > 0) {
    apiCall(`/api/groups/${convId}/delivered`, { method: "POST" }).catch(() => {});
    apiCall(`/api/groups/${convId}/read`, { method: "POST" }).catch(() => {});
  }
}

/* ============================================================
   [EMOJI / STICKERS / GIF] Panneau d'insertion comme WhatsApp.
   - Onglet Emoji : s'insèrent dans le champ de saisie
   - Onglet Stickers : emojis envoyés en GRAND (message dédié)
   - Onglet GIF : recherche Tenor si TENOR_API_KEY configurée
   ============================================================ */
const EMOJI_PICKER_SET = "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😍 🥰 😘 😗 😋 😜 🤪 🤗 🤔 🤨 😐 😴 😢 😭 😤 😠 🤯 😳 🥵 🥶 😱 🤠 🤡 👻 💀 🤖 😈 👅 👄 💋 🌹 🥀 💐 🎁 💝 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 💞 💓 💘 💕 ✨ 🔥 🎉 🎊 🥂 🍷 🍫 🌙 ⭐ 🌈 🦄 🐶 🐱 😺 🐼 🐵 💦 💍 👑 🙈 🙉 🙊 💪 🙏 👍 👏 🤝 🫶 😇 🥺 😬 🙄 🤭 🤫 😎 🤩 🥳 😇".split(/\s+/).filter((v, i, a) => v && a.indexOf(v) === i);
const STICKER_SET = "😍 🥰 😘 ❣️ 💋 ❤️ 💘 💝 🌹 🔥 🥵 😈 🍑 🍌 💦 🤤 😜 🫶 🙈 💃 🍾 🎁 ✨ 💎 🥂 🌙 🐻 🐼 🥺 😇 😎 🤩".split(/\s+/).filter((v, i, a) => v && a.indexOf(v) === i);
let emojiPanelInputId = null; // champ de saisie ciblé par le panneau
const stickerObjectUrls = new Set();

// Ouvre/ferme le panneau (couple : 'chatTextInput' / conversation : 'convTextInput')
function toggleEmojiPanel(inputId) {
  const panel = document.getElementById("emojiPanel");
  if (!panel) return;
  emojiPanelInputId = inputId;
  const isOpen = panel.style.display === "block";
  panel.style.display = isOpen ? "none" : "block";
  if (!isOpen) renderEmojiTab("emoji");
}

function hideEmojiPanel() {
  const panel = document.getElementById("emojiPanel");
  if (panel) panel.style.display = "none";
  stickerObjectUrls.forEach(url => URL.revokeObjectURL(url));
  stickerObjectUrls.clear();
}

function renderEmojiTab(tab) {
  const panel = document.getElementById("emojiPanel");
  if (!panel) return;
  panel.dataset.activeTab = tab;

  let content = "";
  if (tab === "emoji") {
    content = `<div class="emoji-grid">${EMOJI_PICKER_SET.map((e) => `<button class="emoji-cell" onclick="insertEmoji('${e}')">${e}</button>`).join("")}</div>`;
  } else if (tab === "stickers") {
    content = `
      <div class="sticker-library-actions">
        <button class="btn-secondary" onclick="document.getElementById('customStickerInput').click()">＋ Ajouter une image</button>
        <input id="customStickerInput" type="file" accept="image/*" hidden onchange="addCustomSticker(event)">
      </div>
      <div id="savedStickerGrid" class="saved-sticker-grid"><div class="emoji-hint">Chargement de tes stickers...</div></div>
      <div class="emoji-grid stickers">${STICKER_SET.map((e) => `<button class="emoji-cell big" onclick="sendEmojiSticker('${e}')">${e}</button>`).join("")}</div>`;
  } else if (tab === "gif") {
    content = `
      <input class="input-field" id="gifSearchInput" placeholder="Rechercher un GIF... (ex: amour, drôle)" onkeydown="if(event.key==='Enter')searchGifs()">
      <div id="gifResults" class="gif-grid"><div class="emoji-hint">Tape un mot-clé puis Entrée 🔎</div></div>
    `;
  }

  panel.innerHTML = `
    <div class="emoji-tabs">
      <button class="amis-tab-btn ${tab==='emoji'?'active':''}" onclick="renderEmojiTab('emoji')">😊 Emoji</button>
      <button class="amis-tab-btn ${tab==='stickers'?'active':''}" onclick="renderEmojiTab('stickers')">🎟️ Stickers</button>
      <button class="amis-tab-btn ${tab==='gif'?'active':''}" onclick="renderEmojiTab('gif')">🎬 GIF</button>
      <button class="icon-btn" style="margin-left:auto;" onclick="hideEmojiPanel()">✕</button>
    </div>
    <div class="emoji-body">${content}</div>
  `;
  if (tab === "stickers") renderSavedStickerGrid();
}

async function renderSavedStickerGrid() {
  const grid = document.getElementById("savedStickerGrid");
  if (!grid) return;
  stickerObjectUrls.forEach(url => URL.revokeObjectURL(url));
  stickerObjectUrls.clear();
  try {
    const stickers = await getSavedStickerRecords();
    if (grid !== document.getElementById("savedStickerGrid")) return;
    grid.innerHTML = stickers.length ? stickers.map(sticker => {
      const url = URL.createObjectURL(sticker.blob);
      stickerObjectUrls.add(url);
      return `<div class="saved-sticker-tile">
        <button class="saved-sticker-send" title="Envoyer ${escapeAttr(sticker.name)}" onclick="sendSavedSticker('${escapeAttr(sticker.id)}')"><img src="${escapeAttr(url)}" alt="${escapeAttr(sticker.name)}"></button>
        <button class="saved-sticker-remove" title="Supprimer le sticker" onclick="removeSavedSticker('${escapeAttr(sticker.id)}')">×</button>
      </div>`;
    }).join("") : `<div class="emoji-hint">Tes stickers enregistrés apparaîtront ici. Tu peux aussi enregistrer une photo reçue depuis son menu.</div>`;
  } catch (error) {
    grid.innerHTML = `<div class="emoji-hint">La bibliothèque de stickers n'est pas disponible sur cet appareil.</div>`;
  }
}

async function addCustomSticker(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    let blob = file;
    if (file.type !== "image/gif") {
      const compressed = await compressImageToDataUrl(file, 512, 0.82);
      if (!compressed) throw new Error("Cette image ne peut pas être utilisée comme sticker.");
      blob = await (await fetch(compressed)).blob();
    }
    await saveStickerRecord(blob, file.name || "Sticker");
    showToast("Sticker enregistré", "Disponible dans ta bibliothèque sur cet appareil.");
    renderSavedStickerGrid();
  } catch (error) {
    alert(error.message || "Impossible d'enregistrer ce sticker.");
  }
}

async function saveStickerFromMessage() {
  const url = _currentMenuRow?.querySelector(".chat-media-preview")?.src;
  closeMsgMenu();
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Image inaccessible");
    const original = await response.blob();
    let blob = original;
    if (original.type !== "image/gif") {
      const file = new File([original], "sticker-image", { type: original.type || "image/jpeg" });
      const compressed = await compressImageToDataUrl(file, 512, 0.82);
      if (!compressed) throw new Error("Cette image ne peut pas être enregistrée comme sticker.");
      blob = await (await fetch(compressed)).blob();
    }
    await saveStickerRecord(blob, "Sticker enregistré");
    showToast("Sticker enregistré", "Ajouté à ta bibliothèque sur cet appareil.");
  } catch (error) {
    alert("Impossible d'enregistrer cette image comme sticker. Vérifie ta connexion et réessaie.");
  }
}

async function removeSavedSticker(stickerId) {
  await deleteStickerRecord(stickerId);
  renderSavedStickerGrid();
}

async function sendSavedSticker(stickerId) {
  hideEmojiPanel();
  if (!currentChatContext && soloMode) {
    alert("Invite ton/ta partenaire pour envoyer des stickers !");
    return;
  }
  let pendingId = null;
  try {
    const sticker = (await getSavedStickerRecords()).find(item => item.id === stickerId);
    if (!sticker) throw new Error("Sticker introuvable dans ta bibliothèque.");
    const file = new File([sticker.blob], sticker.name || "sticker", { type: sticker.mime_type });
    pendingId = showPendingBubble("⏳ Envoi du sticker...");
    const folder = currentChatContext
      ? `conv/${currentChatContext.id}/media`
      : `${coupleId}/media`;
    const { path, mimeType } = await uploadMediaDirectly(file, folder);
    if (currentChatContext) {
      await apiCall(`/api/groups/${currentChatContext.id}/messages`, {
        method: "POST",
        body: { type: "photo", text: "sticker", mediaPath: path, mimeType }
      });
      await loadConvHistory();
    } else {
      await apiCall("/api/chat/send", {
        method: "POST",
        body: { coupleId, type: "photo", text: "sticker", mediaPath: path, mimeType }
      });
    }
  } catch (error) {
    alert(friendlyError(error));
  } finally {
    removePendingBubble(pendingId);
  }
}

// Insère un emoji dans le champ de saisie ciblé
function insertEmoji(emoji) {
  const input = document.getElementById(emojiPanelInputId || "chatTextInput");
  if (input) { input.value += emoji; input.focus(); }
}

// Envoie un sticker = emoji seul, rendu en GRAND dans la discussion
async function sendEmojiSticker(emoji) {
  hideEmojiPanel();
  try {
    if (currentChatContext) {
      await apiCall(`/api/groups/${currentChatContext.id}/messages`, {
        method: "POST",
        body: { type: "text", text: emoji }
      });
      await loadConvHistory();
    } else if (!soloMode) {
      await apiCall("/api/chat/send", { method: "POST", body: { coupleId, type: "text", text: emoji } });
      // L'affichage arrive via temps réel / polling
    } else {
      alert("Invite ton/ta partenaire pour envoyer des stickers !");
    }
  } catch (e) {
    alert(friendlyError(e));
  }
}

// Recherche de GIFs via l'API Tenor (optionnelle)
async function searchGifs() {
  const q = document.getElementById("gifSearchInput")?.value?.trim();
  const box = document.getElementById("gifResults");
  if (!q || !box) return;
  box.innerHTML = `<div class="emoji-hint">Recherche...</div>`;
  try {
    const data = await apiCall(`/api/content/gifs?q=${encodeURIComponent(q)}`);
    const results = data.results || [];
    if (!results.length) { box.innerHTML = `<div class="emoji-hint">Aucun GIF trouvé 🙈</div>`; return; }
    box.innerHTML = results.map((r) => {
      const url = r.media_formats?.gif?.url;
      return url ? `<img class="gif-cell" src="${escapeAttr(url)}" alt="GIF Tenor" onclick="sendGif('${escapeAttr(url)}')">` : "";
    }).join("");
  } catch (e) {
    box.innerHTML = `<div class="emoji-hint">${escapeHtml(e.message || "Erreur de recherche GIF")}</div>`;
  }
}

// Envoie un GIF (URL Tenor publique) comme photo animée
async function sendGif(url) {
  hideEmojiPanel();
  try {
    if (currentChatContext) {
      await apiCall(`/api/groups/${currentChatContext.id}/messages`, {
        method: "POST",
        body: { type: "photo", mediaPath: url, mimeType: "image/gif" }
      });
      await loadConvHistory();
    } else if (!soloMode) {
      await apiCall("/api/chat/send", { method: "POST", body: { coupleId, type: "photo", mediaPath: url, mimeType: "image/gif" } });
    }
  } catch (e) {
    alert(friendlyError(e));
  }
}

// Ajoute un membre au groupe ouvert, par numéro de téléphone
async function addMemberToGroup(groupId) {
  const phone = prompt("Numéro de téléphone de la personne à ajouter au groupe :");
  if (!phone) return;
  try {
    const result = await apiCall(`/api/groups/${groupId}/members`, { method: "POST", body: { phone } });
    alert(`✅ ${result.member.display_name} a rejoint le groupe !`);
    // Rafraîchit l'en-tête (compteur de membres) sans quitter le chat
    const group = groupsData.find((g) => g.id === groupId);
    if (group) {
      group.membersCount += 1;
      currentChatContext = { kind: "group", id: groupId, name: group.name, avatar: group.icon || "👥" };
      openGroupChat(groupId);
    }
  } catch (e) {
    alert(friendlyError(e));
  }
}

/* [PHASE 2] Les anciennes fonctions openGroupDetail / addParticipantToGroup /
   loadGroupMessages / sendGroupMessage / openGroupMemories ont été SUPPRIMÉES :
   elles reposaient sur des données factices (tableaux en mémoire, compteur
   incrémenté sans vérification) et un album souvenirs jamais persisté.
   Elles sont remplacées par le moteur de conversation unifié ci-dessus
   (openGroupChat + openFriendChat), connecté aux vraies tables Supabase. */

/* ============================================================
   [STORIES] Stories éphémères 24h (comme WhatsApp Status).
   Barre de cercles en haut du chat + visionneuse plein écran
   avec barre de progression et avance automatique.
   ============================================================ */
let myStories = [];      // mes stories actives (< 24h)
let partnerStories = []; // stories actives du/de la partenaire
let storyTimer = null;

// Charge les stories actives et dessine la barre de cercles
async function loadStoriesBar() {
  if (soloMode || !coupleId) return;
  const bar = document.getElementById("storiesBar");
  if (!bar) return;

  try {
    const { stories } = await apiCall(`/api/stories?coupleId=${coupleId}`);
    const all = stories || [];
    myStories = all.filter((s) => s.is_mine);
    partnerStories = all.filter((s) => !s.is_mine);
  } catch (e) {
    myStories = []; partnerStories = [];
  }

  const lastMine = myStories[0];
  const lastPartner = partnerStories[0];

  /* [STORIES — ÉTAT VIDE CLAIR] Quand il n'y a PAS de story :
     - cercle en POINTILLÉS + avatar grisé (aucune ambiguïté avec une
       vraie story qui, elle, a un anneau coloré plein)
     - libellés explicites ("+ Ajouter une story", "Aucune story")
     - petite phrase d'aide quand la barre est entièrement vide */
  const barEmpty = myStories.length === 0 && partnerStories.length === 0;
  bar.innerHTML = `
    <div onclick="myStories.length ? openStoryViewer(myStories, 0) : document.getElementById('storyFileInput').click()">
      <div class="story-circle me ${myStories.length ? 'has-story' : 'empty'}">
        <div class="story-inner">${renderAvatarHTML(myProfile.avatar)}</div>
        <button class="story-add-badge" title="Ajouter une story" aria-label="Ajouter une story" onclick="event.stopPropagation(); document.getElementById('storyFileInput').click()">+</button>
      </div>
      <div class="story-label">${myStories.length ? 'Ma story' : '+ Ajouter'}</div>
      ${myStories.length ? `<div class="story-view-count-badge">👁 ${myStories[0].view_count || 0}</div>` : ""}
    </div>
    <div onclick="handlePartnerStoryClick()">
      <div class="story-circle ${partnerStories.length ? 'has-story' : 'empty'}">
        <div class="story-inner">${renderAvatarHTML(lastPartner?.author_avatar || partnerInfo.avatar)}</div>
        ${!partnerStories.length ? '<div class="story-none-badge">∅</div>' : ''}
      </div>
      <div class="story-label">${partnerStories.length ? escapeHtml(partnerInfo.nickname || 'Ma moitié') : 'Aucune story'}</div>
    </div>
    ${barEmpty ? '<div class="stories-hint">Aucune story pour le moment —<br>appuie sur + pour créer la première ✨</div>' : ''}
  `;
}

// Clic sur le cercle du/de la partenaire : visionneuse ou message doux
function handlePartnerStoryClick() {
  if (partnerStories.length) {
    openStoryViewer(partnerStories, 0);
  } else {
    showToast("💫 Story", "Ton/ta partenaire n'a pas de story active.");
  }
}

function broadcastStoryUpdate() {
  if (!realtimeChatChannel) return;
  realtimeChatChannel.send({
    type: "broadcast",
    event: "story-update",
    payload: { coupleId, senderId: session?.user?.id }
  }).catch(() => {});
}

// Publication d'une story : sélection -> légende -> envoi -> barre à jour
// Fichier en attente de publication (story)
let _storyPendingFiles = [];
let _storyPreviewObjectUrl = null;
let _storyQueueTotal = 0;
let _storyAudience = "couple";

async function handleStoryUpload(event, audience = "couple") {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  event.target.value = "";
  if (soloMode && audience === "couple") { alert("Invite ton/ta partenaire pour partager des stories !"); return; }

  _storyAudience = audience;
  _storyPendingFiles = files;
  _storyQueueTotal = files.length;
  showStoryPreview(files[0], true, 1, files.length);
}

function showStoryPreview(file, resetCaption = false, position = 1, total = _storyQueueTotal) {
  const overlay = document.getElementById("storyPreviewOverlay");
  const mediaWrap = document.getElementById("storyPreviewMedia");
  const caption = document.getElementById("storyPreviewCaption");
  if (!overlay) return;

  const previousPreviewUrl = _storyPreviewObjectUrl;
  _storyPreviewObjectUrl = null;
  mediaWrap.innerHTML = "";
  if (previousPreviewUrl) URL.revokeObjectURL(previousPreviewUrl);
  if (resetCaption && caption) { caption.value = ""; caption.style.height = "40px"; }
  const count = document.getElementById("storyPreviewCount");
  if (count) count.textContent = total > 1 ? `${position} / ${total}` : "";

  const url = URL.createObjectURL(file);
  _storyPreviewObjectUrl = url;
  if (file.type.startsWith("video/")) {
    const vid = document.createElement("video");
    vid.src = url; vid.controls = true; vid.autoplay = false; vid.playsInline = true;
    vid.style.cssText = "max-width:100%; max-height:100%; object-fit:contain;";
    mediaWrap.appendChild(vid);
  } else {
    const img = document.createElement("img");
    img.src = url;
    img.style.cssText = "max-width:100%; max-height:100%; object-fit:contain;";
    mediaWrap.appendChild(img);
  }

  overlay.classList.add("active");
  if (resetCaption && caption) setTimeout(() => caption.focus(), 200);
}

function cancelStoryPreview() {
  _storyPendingFiles = [];
  _storyQueueTotal = 0;
  const overlay = document.getElementById("storyPreviewOverlay");
  if (overlay) overlay.classList.remove("active");
  const mediaWrap = document.getElementById("storyPreviewMedia");
  if (mediaWrap) mediaWrap.innerHTML = "";
  if (_storyPreviewObjectUrl) URL.revokeObjectURL(_storyPreviewObjectUrl);
  _storyPreviewObjectUrl = null;
  const sendBtn = document.querySelector(".story-preview-send-btn");
  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = "➤"; }
}

async function publishSingleStory(file, caption, onProgress, audience) {
  const storyFolder = audience === "friends" ? `${session.user.id}/stories` : `${coupleId}/stories`;
  const storyBody = fields => ({ audience, ...(audience === "couple" ? { coupleId } : {}), caption, ...fields });
  if (cfg.CLOUDINARY_CLOUD_NAME && cfg.CLOUDINARY_UPLOAD_PRESET) {
    const { path, mimeType } = await uploadMediaDirectly(file, storyFolder, onProgress);
    await apiCall("/api/stories", { method: "POST", body: storyBody({ mediaPath: path, mimeType }) });
    return;
  }

  if (file.type.startsWith("image/")) {
    const dataUrl = await compressImageToDataUrl(file, 1080, 0.82);
    if (dataUrl) {
      await apiCall("/api/stories", { method: "POST", body: storyBody({ mediaDataUrl: dataUrl }) });
      onProgress(1);
      return;
    }
  }

  if (file.size > MAX_SUPABASE_UPLOAD_BYTES) {
    throw new Error("Cette vidéo dépasse 50 Mo. Configure Cloudinary pour publier des vidéos plus lourdes.");
  }

  const path = `${storyFolder}/${Date.now()}-${session.user.id}.${extForFile(file)}`;
  const { error } = await sb.storage.from("chat-media").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });
  if (error) throw new Error("Échec du stockage de la story. Vérifie les droits Supabase ou configure Cloudinary.");
  onProgress(1);
  await apiCall("/api/stories", {
    method: "POST",
    body: storyBody({ mediaPath: path, mimeType: file.type || "application/octet-stream" })
  });
}

async function publishStoryFromPreview() {
  const files = [..._storyPendingFiles];
  if (!files.length) return;
  const caption = document.getElementById("storyPreviewCaption")?.value?.trim() || "";
  const sendBtn = document.querySelector(".story-preview-send-btn");
  if (sendBtn) sendBtn.disabled = true;
  let published = 0;

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    _storyPendingFiles = files.slice(index);
    if (index > 0) showStoryPreview(file, false, index + 1, _storyQueueTotal);
    try {
      await publishSingleStory(file, caption, progress => {
        if (sendBtn) sendBtn.textContent = files.length > 1
          ? `${index + 1}/${files.length} · ${Math.round(progress * 100)}%`
          : `${Math.round(progress * 100)}%`;
      }, _storyAudience);
      published++;
    } catch (error) {
      showStoryPreview(file, false, index + 1, _storyQueueTotal);
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = "➤"; }
      alert(`Story ${index + 1}/${files.length} non publiée : ${friendlyError(error)}\n\nTu peux réessayer ; les stories déjà publiées ne seront pas renvoyées.`);
      if (published) {
        loadStoriesBar();
        broadcastStoryUpdate();
      }
      return;
    }
  }

  cancelStoryPreview();
  showToast("🌟 Stories publiées", `${published} ${published > 1 ? "stories publiées" : "story publiée"} · visibles pendant 24h`);
  if (_storyAudience === "friends") {
    await refreshFriendsStories();
  } else {
    loadStoriesBar();
    broadcastStoryUpdate();
  }
}

// Visionneuse plein écran avec progression automatique (6s par story)
function openStoryViewer(list, startIndex) {
  clearInterval(storyTimer);
  const stories = list;
  let index = startIndex;
  const viewsRecorded = new Set();

  const viewer = document.createElement("div");
  viewer.className = "story-viewer";
  viewer.id = "storyViewer";
  document.getElementById("phoneFrame").appendChild(viewer);

  function close() {
    clearInterval(storyTimer);
    viewer.remove();
  }

  function moveStory(direction) {
    clearInterval(storyTimer);
    viewer.querySelector("video")?.pause();
    const nextIndex = index + direction;
    if (nextIndex < 0) return;
    if (nextIndex >= stories.length) { close(); return; }
    index = nextIndex;
    render();
  }

  let touchStartX = null;
  viewer.addEventListener("touchstart", event => {
    touchStartX = event.changedTouches[0]?.clientX ?? null;
  }, { passive: true });
  viewer.addEventListener("touchend", event => {
    if (touchStartX === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(deltaX) > 55) {
      event.preventDefault();
      moveStory(deltaX < 0 ? 1 : -1);
    }
  }, { passive: false });

  function render() {
    const story = stories[index];
    if (!story) { close(); return; }
    const isVideo = (story.mime_type || "").startsWith("video/");
    const elapsed = story.is_mine
      ? Math.floor((Date.now() - new Date(story.created_at).getTime()) / 3600000)
      : 0;

    viewer.innerHTML = `
      <div class="story-progress">
        ${stories.map((_, i) => `
          <div class="story-progress-seg ${i < index ? 'filled' : ''}">
            ${i === index ? '<span class="fill" id="storyFill"></span>' : ''}
          </div>
        `).join("")}
      </div>
      <div class="story-header">
        <div class="avatar-img" style="border-color:#fff; color:#000; font-size:16px;">${renderAvatarHTML(story.author_avatar)}</div>
        <div style="flex:1; font-size:13px; font-weight:600;">
          ${escapeHtml(story.author_name)}
          <div style="font-size:10px; opacity:0.7;">${getStoryTimeDisplay(story.expires_at, story.created_at)}</div>
        </div>
        ${story.is_mine ? `<button class="icon-btn" title="Supprimer ma story" onclick="deleteStory('${story.id}')">🗑️</button>` : ""}
        <button class="icon-btn" onclick="document.getElementById('storyViewer')?.remove(); clearInterval(storyTimer);">✕</button>
      </div>
      <div class="story-media-container">
        ${isVideo
          ? `<video src="${escapeAttr(story.media_url)}" autoplay playsinline controls></video>`
          : `<img src="${escapeAttr(story.media_url)}" alt="Story">`}
        <button class="story-tap-zone previous" aria-label="Story précédente"></button>
        <button class="story-tap-zone next" aria-label="Story suivante"></button>
      </div>
      ${story.is_mine ? `<button class="story-view-count-button" onclick="showStoryViewers('${escapeAttr(story.id)}')">👁 ${story.view_count || 0} vues</button>` : ""}
      ${story.caption ? `<div class="story-caption">${escapeHtml(story.caption)}</div>` : ""}
    `;

    viewer.querySelector(".story-tap-zone.previous")?.addEventListener("click", () => moveStory(-1));
    viewer.querySelector(".story-tap-zone.next")?.addEventListener("click", () => moveStory(1));

    if (!story.is_mine && !viewsRecorded.has(story.id)) {
      const media = viewer.querySelector(isVideo ? "video" : "img");
      const recordView = () => {
        if (viewsRecorded.has(story.id)) return;
        viewsRecorded.add(story.id);
        apiCall(`/api/stories/${story.id}/view`, { method: "POST" }).catch(() => {});
      };
      if (isVideo && media) {
        media.addEventListener("loadeddata", recordView, { once: true });
        if (media.readyState >= 2) recordView();
      } else if (media) {
        media.addEventListener("load", recordView, { once: true });
        if (media.complete && media.naturalWidth > 0) recordView();
      }
    }

    // Barre de progression + passage automatique à la story suivante
    const fill = document.getElementById("storyFill");
    if (fill && !isVideo) {
      const DURATION = 6000;
      fill.style.transition = "none"; fill.style.width = "0%";
      requestAnimationFrame(() => {
        fill.style.transition = `width ${DURATION}ms linear`;
        fill.style.width = "100%";
      });
      clearInterval(storyTimer);
      storyTimer = setTimeout(() => { index++; render(); }, DURATION);
    } else if (isVideo) {
      // Pour les vidéos : avance à la fin de la lecture
      const vid = viewer.querySelector("video");
      if (vid) vid.onended = () => { index++; render(); };
    }
  }

  render();
}

async function showStoryViewers(storyId) {
  const viewer = document.getElementById("storyViewer");
  if (!viewer) return;
  clearTimeout(storyTimer);
  document.getElementById("storyViewersPanel")?.remove();
  const panel = document.createElement("div");
  panel.id = "storyViewersPanel";
  panel.className = "story-viewers-overlay";
  panel.innerHTML = `<section class="story-viewers-sheet" role="dialog" aria-modal="true" aria-label="Vues de la story">
    <header><strong>Vues de la story</strong><button type="button" aria-label="Fermer">✕</button></header>
    <div class="story-viewers-list">Chargement...</div>
  </section>`;
  viewer.appendChild(panel);
  const close = () => panel.remove();
  panel.addEventListener("click", event => {
    if (event.target === panel || event.target.closest("button")) close();
  });

  try {
    const { views = [] } = await apiCall(`/api/stories/${storyId}/views`);
    const list = panel.querySelector(".story-viewers-list");
    list.innerHTML = views.length ? views.map(view => {
      const time = new Intl.DateTimeFormat(undefined, {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      }).format(new Date(view.viewed_at));
      return `<div class="story-viewer-row">
        <div class="avatar-img">${renderAvatarHTML(view.avatar)}</div>
        <strong>${escapeHtml(view.name)}</strong>
        <time>${escapeHtml(time)}</time>
      </div>`;
    }).join("") : "Personne n’a encore vu cette story.";
    const story = [...myStories, ...friendStoriesData].find(item => item.id === storyId);
    if (story) story.view_count = views.length;
    const countButton = viewer.querySelector(".story-view-count-button");
    if (countButton) countButton.textContent = `👁 ${views.length} vues`;
    renderFriendsStoriesBar();
    loadStoriesBar();
  } catch (error) {
    panel.querySelector(".story-viewers-list").textContent = friendlyError(error);
  }
}

// Supprime ma story (depuis la visionneuse)
async function deleteStory(storyId) {
  if (!confirm("Supprimer cette story ?")) return;
  try {
    await apiCall(`/api/stories/${storyId}`, { method: "DELETE" });
    clearInterval(storyTimer);
    document.getElementById("storyViewer")?.remove();
    loadStoriesBar();
    broadcastStoryUpdate();
  } catch (e) { alert(friendlyError(e)); }
}

/* ============================================================
   [ALBUM] Album souvenirs PERSISTANT des groupes (table
   group_memories). Ajout, grille, suppression de ses propres
   photos. Remplace l'ancien album factice en mémoire.
   ============================================================ */

async function openGroupMemories(groupId) {
  const screen = document.getElementById("screenBody");
  screen.innerHTML = `
    <div class="screen-scrollable">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
        <button class="icon-btn" onclick="openGroupChat('${groupId}')">←</button>
        <div style="flex:1;">
          <h2 style="font-family:var(--font-serif); font-size:20px; margin:0 0 2px;">📸 Album Souvenirs</h2>
          <p style="font-size:11px; color:var(--text-muted); margin:0;">Persistant — conservé pour toujours dans le groupe</p>
        </div>
        <button class="btn-primary" style="width:auto; padding:8px 14px; font-size:12px;" onclick="document.getElementById('memoryFileInput').click()">＋ Photo</button>
        <input type="file" id="memoryFileInput" accept="image/*" style="display:none;" onchange="handleMemoryUpload(event, '${groupId}')">
      </div>
      <div class="memories-grid" id="memoriesGrid">
        <div style="grid-column:1/-1; text-align:center; padding:24px; color:var(--text-muted); font-size:12px;">Chargement de l'album...</div>
      </div>
    </div>
  `;
  await loadGroupMemories(groupId);
}

async function loadGroupMemories(groupId) {
  try {
    const { memories } = await apiCall(`/api/groups/${groupId}/memories`);
    const grid = document.getElementById("memoriesGrid");
    if (!grid) return;
    if (!memories || memories.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted); font-size:12px;">
        Aucun souvenir pour le moment.<br>Ajoutez votre première photo ensemble ! 📷
      </div>`;
      return;
    }
    grid.innerHTML = memories.map((mem) => {
      const regId = registerMedia(mem.image_url);
      return `
        <div class="memory-card">
          <div style="position:relative; cursor:pointer;" onclick="openRegisteredMedia('${regId}', false, false)">
            <img class="memory-img" src="${escapeAttr(mem.image_url)}" alt="Souvenir">
            ${mem.is_mine ? `<button class="icon-btn" style="position:absolute; top:6px; right:6px; width:24px; height:24px; font-size:11px; background:rgba(0,0,0,0.5);" onclick="deleteMemory('${groupId}', '${mem.id}')">✕</button>` : ""}
          </div>
          <div class="memory-info">
            <div class="memory-title">${escapeHtml(mem.title || "Souvenir")}</div>
            <div class="memory-date">${new Date(mem.created_at).toLocaleDateString("fr-FR")} • par ${escapeHtml(mem.author)}</div>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    const grid = document.getElementById("memoriesGrid");
    if (grid) grid.innerHTML = `<div style="color:#ef4444; font-size:12px;">Erreur : ${friendlyError(e)}</div>`;
  }
}

async function handleMemoryUpload(event, groupId) {
  const file = event.target.files[0];
  if (!file) return;
  const title = prompt("Titre du souvenir (optionnel) :") || "Souvenir partagé";
  try {
    const dataUrl = await compressImageToDataUrl(file, 1080, 0.85) || await fileToDataUrl(file);
    await apiCall(`/api/groups/${groupId}/memories`, {
      method: "POST",
      body: { title, mediaDataUrl: dataUrl }
    });
    showToast("📸 Souvenir ajouté", title);
    loadGroupMemories(groupId);
  } catch (e) {
    alert(friendlyError(e));
  } finally {
    event.target.value = "";
  }
}

async function deleteMemory(groupId, memoryId) {
  if (!confirm("Supprimer ce souvenir ?")) return;
  try {
    await apiCall(`/api/groups/${groupId}/memories/${memoryId}`, { method: "DELETE" });
    loadGroupMemories(groupId);
  } catch (e) { alert(friendlyError(e)); }
}

/* ============================================================
   [PUSH] Notifications push natives (même app fermée).
   1. Enregistre le service worker (public/sw.js)
   2. Demande la permission système
   3. Souscrit l'appareil avec la clé VAPID du serveur
   ============================================================ */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Ton navigateur ne supporte pas les notifications push.");
    return;
  }
  try {
    // 1. Permission système
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Permission refusée. Active les notifications dans les réglages du navigateur.");
      return;
    }

    // 2. Service worker + souscription
    const reg = await navigator.serviceWorker.register("/service-worker.js");
    await navigator.serviceWorker.ready;

    const { publicKey } = await apiCall("/api/push/key");
    if (!publicKey) {
      alert("Push non configuré côté serveur (clés VAPID manquantes dans .env).");
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // 3. Enregistre l'abonnement côté serveur
    await apiCall("/api/push/subscribe", { method: "POST", body: { subscription: sub.toJSON() } });
    alert("🔔 Notifications activées ! Tu recevras les messages même app fermée.");
  } catch (e) {
    alert(friendlyError(e));
  }
}

/* ================= PARAMÈTRES & UPLOAD PHOTO EN DIRECT ================= */
function openSettingsModal() {
  document.getElementById("settingsMyNickname").value = myProfile.nickname || "";
  document.getElementById("settingsMyPhone").value = myProfile.phone || "";
  document.getElementById("settingsMyAvatarPreview").innerHTML = renderAvatarHTML(myProfile.avatar);

  // Infos partenaire (lecture seule ici — chacun gère son propre profil)
  document.getElementById("settingsPartnerName").textContent = partnerInfo.nickname || "Ta moitié";
  document.getElementById("settingsPartnerAvatar").innerHTML = renderAvatarHTML(partnerInfo.avatar);
  document.getElementById("settingsPartnerPhone").textContent = partnerInfo.phone || "—";

  const syncData = JSON.stringify({ coupleId, user: session.user.id });
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(syncData)}`;
  document.getElementById("qrCodeImage").src = qrUrl;

  document.getElementById("settingsModal").classList.add("active");
}
function closeSettingsModal() {
  document.getElementById("settingsModal").classList.remove("active");
}

function selectAvatar(icon) {
  myProfile.avatar = icon;
  document.getElementById("settingsMyAvatarPreview").innerHTML = renderAvatarHTML(icon);
}

async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Compresse l'image (max 512px, JPEG qualité 0.85) pour éviter le "Failed to fetch"
  const dataUrl = await compressImageToDataUrl(file, 512, 0.85);
  if (!dataUrl) {
    alert("Impossible de lire cette image. Essaie une autre photo (JPG/PNG).");
    return;
  }
  myProfile.avatar = dataUrl;
  document.getElementById("settingsMyAvatarPreview").innerHTML = `<img src="${escapeAttr(dataUrl)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;

  // Envoi immédiat au serveur et broadcast au partenaire en direct !
  try {
    await apiCall("/api/couple/profile", {
      method: "POST",
      body: { avatar: dataUrl, nickname: myProfile.nickname }
    });
    if (realtimeChatChannel) {
      realtimeChatChannel.send({
        type: "broadcast",
        event: "profile-update",
        payload: { userId: session.user.id, avatar: dataUrl, nickname: myProfile.nickname }
      });
    }
    alert("Photo de profil mise à jour et synchronisée avec ton/ta partenaire !");
  } catch (e) {
    console.log("Erreur sync avatar:", e);
  }
}

function applyTheme(themeName, persist = true) {
  document.body.className = themeName === "default" ? "" : `theme-${themeName}`;
  if (persist) localStorage.setItem("app_theme", themeName);
}

async function handleCustomBgUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  applyCustomBg(dataUrl);
  localStorage.setItem("app_custom_bg", dataUrl);
}

function applyCustomBg(url) {
  const frame = document.getElementById("phoneFrame");
  frame.style.backgroundImage = `url('${url}')`;
  frame.classList.add("custom-bg");
}

async function saveSettings() {
  const myNick = document.getElementById("settingsMyNickname").value.trim();
  const myPhone = document.getElementById("settingsMyPhone").value.trim();

  if (myNick) myProfile.nickname = myNick;
  if (myPhone !== undefined && myPhone !== myProfile.phone) myProfile.phone = myPhone;

  try {
    await apiCall("/api/couple/profile", {
      method: "POST",
      body: { nickname: myProfile.nickname, avatar: myProfile.avatar, phone: myProfile.phone || null }
    });

    if (realtimeChatChannel) {
      realtimeChatChannel.send({
        type: "broadcast",
        event: "profile-update",
        payload: { userId: session.user.id, nickname: myProfile.nickname, avatar: myProfile.avatar }
      });
    }
  } catch(e) {
    alert(friendlyError(e));
    return;
  }

  setupHeaderUI();
  closeSettingsModal();
  alert("Paramètres enregistrés avec succès !");
}

async function logout() {
  if (window._pairInterval) clearInterval(window._pairInterval);
  if (window._soloCheckInterval) clearInterval(window._soloCheckInterval);
  localStorage.removeItem("solo_mode");
  await sb.auth.signOut();
  session = null;
  coupleId = null;
  location.reload();
}

function openPartnerDetails() {
  if (soloMode) {
    renderPairingScreen();
    return;
  }
  openSettingsModal();
}

window.addEventListener("DOMContentLoaded", startApp);
