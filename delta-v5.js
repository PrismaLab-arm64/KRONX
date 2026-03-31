/* =============================================
   KRONX - PROTOCOLO DELTA v5.1
   NIVEL: CLASIFICADO (STREAK DE SEGURIDAD)
   ============================================= */

let peer = null;
let currentConnection = null;
let myPeerId = null;
let isHost = false;

let screens = {};
let UI = {};

let activeMessages = [];
let activeMediaObjects = []; // Guarda referencias a audio/video para detenerlos
let msgMap = new Map(); // Para rastrear ticks
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

function logDelta(msg) {
  console.log(`%c[DELTA-V5.1] ${msg}`, "color: #00ff00; font-weight: bold; background: #000; padding: 2px 5px;");
}

/* =============================================
   INITIALIZATION (ROBUSTA)
   ============================================= */
function initDelta() {
  logDelta("Delta V5.1 Online. Iniciando secuencia de arranque de alto nivel...");
  
  // Selección de elementos INSIDE init para evitar nulos por carga dinámica
  screens = {
    splash: document.getElementById('splash-screen'),
    terminal: document.getElementById('terminal'),
    welcome: document.getElementById('welcome-screen'),
    createRoom: document.getElementById('create-room-screen'),
    joinRoom: document.getElementById('join-room-screen'),
    chat: document.getElementById('chat-screen')
  };

  UI = {
    btnCreateRoom: document.getElementById('btn-create-room'),
    btnJoinRoom: document.getElementById('btn-join-room'),
    btnBackFromCreate: document.getElementById('btn-back-from-create'),
    btnBackFromJoin: document.getElementById('btn-back-from-join'),
    btnConnect: document.getElementById('btn-connect'),
    btnDisconnect: document.getElementById('btn-disconnect'),
    btnSend: document.getElementById('btn-send'),
    btnCopyId: document.getElementById('btn-copy-id'),
    btnRegenerateId: document.getElementById('btn-regenerate-id'),
    btnUploadFile: document.getElementById('btn-upload-file'),
    btnRecord: document.getElementById('btn-record'),
    roomIdInput: document.getElementById('room-id'),
    peerIdInput: document.getElementById('peer-id-input'),
    messageInput: document.getElementById('message-input'),
    messagesContainer: document.getElementById('messages-container'),
    statusIndicator: document.getElementById('status'),
    chatPeerId: document.getElementById('chat-peer-id'),
    fileInput: document.getElementById('file-input')
  };

  try {
    setupEventListeners();
    initSplashScreen();
    initSecurity();
    updateStatus('SISTEMA LISTO', 'success');
  } catch (err) {
    logDelta("Error de arranque: " + err.message);
  }
}

const SECRET_A = 191;
const SECRET_B = 8923;

function consumeUrlLicense() {
    const urlParams = new URLSearchParams(window.location.search);
    
    const keyFromUrl = urlParams.get('vip');
    if (keyFromUrl) {
        if (validateAndSaveToken(keyFromUrl)) {
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            alert("✓ ACCESO TÁCTICO VIP CONCEDIDO.");
            renderWelcomeView();
        }
    }
    
    // Auto-Join para el Invitado (Para que no tenga que escribir el código manualmente)
    const joinRoomId = urlParams.get('join');
    if (joinRoomId) {
        setTimeout(() => {
            showScreen(screens.joinRoom);
            if (UI.peerIdInput) UI.peerIdInput.value = joinRoomId;
            connectToPeer(); // Lanza el intento de conexión automático
        }, 1200);
    }
}

function hasValidLicense() {
    const validToken = localStorage.getItem('kronx_ops_lic');
    if (validToken) {
        const parsedExp = parseDecodedToken(validToken);
        if (parsedExp && parsedExp > Date.now()) return true;
        else localStorage.removeItem('kronx_ops_lic');
    }
    return false;
}

function parseDecodedToken(token) {
    if (!token || !token.startsWith('KX-')) return null;
    const parts = token.substring(3).split('-');
    if (parts.length !== 2) return null;
    
    const expDayStr = parts[0];
    const sigStr = parts[1];
    
    const expDay = parseInt(expDayStr, 16);
    if (isNaN(expDay)) return null;
    
    const expectedSigNum = (expDay * SECRET_A + SECRET_B) % 65536;
    const expectedSigStr = expectedSigNum.toString(16).toUpperCase().padStart(4, '0');
    
    if (sigStr !== expectedSigStr) return null; // Trampa detectada
    
    return expDay * 86400000;
}

function validateAndSaveToken(token) {
    if (parseDecodedToken(token)) {
        localStorage.setItem('kronx_ops_lic', token);
        return token;
    }
    return null;
}

function bloquearAccesoHost() {
    alert("❌ ACCESO DENEGADO.\\nPor favor ingresa tu Llave VIP en la pantalla principal para activar el Modo Anfitrión.");
    showScreen(screens.welcome);
}

function renderWelcomeView() {
    const vipForm = document.getElementById('vip-auth-box');
    const vipActive = document.getElementById('vip-active-box');
    
    if (hasValidLicense()) {
        if(vipForm) vipForm.style.display = 'none';
        if(vipActive) vipActive.style.display = 'block';
    } else {
        if(vipForm) vipForm.style.display = 'block';
        if(vipActive) vipActive.style.display = 'none';
    }
}

function bloquearAccesoClonado() {
    document.body.innerHTML = `
        <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0b141a;color:red;font-family:monospace;text-align:center;padding:20px;z-index:99999;">
            <svg viewBox="0 0 24 24" width="80" style="margin-bottom:20px;"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <h1 style="color:#fa383e; margin:0 0 10px 0;">PIRATERÍA DETECTADA</h1>
            <p style="color:#e9edef; font-size:16px;">Licencia Clonada o Compartida.</p>
            <p style="color:#8696a0; font-size:14px; max-width:400px; margin-top:20px;">Usted y el receptor están utilizando exactamente la misma llave de acceso VIP. La comunicación ha sido denegada irreversiblemente.</p>
        </div>
    `;
}

// Check ReadyState for immediate execution
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  consumeUrlLicense();
  initDelta();
} else {
  document.addEventListener('DOMContentLoaded', () => { consumeUrlLicense(); initDelta(); });
}

function initSplashScreen() {
  logDelta("Limpiando Splash Screen...");
  setTimeout(() => {
    if (screens.splash) {
        screens.splash.classList.remove('active');
        screens.splash.style.opacity = '0';
        setTimeout(() => screens.splash.style.display = 'none', 500);
    }
    if (screens.terminal) {
      screens.terminal.classList.remove('hidden');
      screens.terminal.style.display = 'flex';
      screens.terminal.style.opacity = '1';
    }
    renderWelcomeView();
    showScreen(screens.welcome);
  }, 800);
}

function setupEventListeners() {
  if (UI.btnCreateRoom) UI.btnCreateRoom.addEventListener('click', createRoom);
  if (UI.btnJoinRoom) {
    UI.btnJoinRoom.addEventListener('click', () => {
      showScreen(screens.joinRoom);
      setTimeout(() => { if (UI.peerIdInput) UI.peerIdInput.focus(); }, 300);
    });
  }
  
  const btnLoginVip = document.getElementById('btn-login-vip');
  if (btnLoginVip) {
      btnLoginVip.addEventListener('click', () => {
          const input = document.getElementById('unified-vip-input');
          const manualCode = input ? input.value.trim().toUpperCase() : '';
          if (validateAndSaveToken(manualCode)) {
              alert("✓ MODO ANFITRIÓN ACTIVADO EXITOSAMENTE.");
              renderWelcomeView();
              createRoom(); 
          } else {
              alert("❌ LLAVE INVÁLIDA O EXPIRADA.\\nVerifica que la hayas escrito correctamente.");
          }
      });
  }

  if (UI.btnBackFromCreate) UI.btnBackFromCreate.addEventListener('click', () => { destroyPeer(); showScreen(screens.welcome); });
  if (UI.btnBackFromJoin) UI.btnBackFromJoin.addEventListener('click', () => { if (UI.peerIdInput) UI.peerIdInput.value = ''; showScreen(screens.welcome); });
  if (UI.btnConnect) UI.btnConnect.addEventListener('click', connectToPeer);
  if (UI.btnDisconnect) UI.btnDisconnect.addEventListener('click', disconnect);
  
  if (UI.btnCopyId) {
    UI.btnCopyId.addEventListener('click', () => {
      if (UI.roomIdInput) {
        // En lugar de copiar solo el texto, crea el Enlace Mágico de Invitado
        const baseUrl = window.location.origin + window.location.pathname;
        const inviteLink = `${baseUrl}?join=${UI.roomIdInput.value}`;
        
        navigator.clipboard.writeText(inviteLink);
        logDelta("Enlace de Sala copiado.");
        updateStatus('ENLACE COPIADO', 'success');
        setTimeout(() => updateStatus('SALA ABIERTA', 'warning'), 1500);
        
        alert("¡Enlace de Invitación Copiado!\n\nPégalo en WhatsApp. Tu invitado solo tendrá que hacer 1 clic en este enlace para entrar a la sala secreta.");
      }
    });
  }
  
  if (UI.btnRegenerateId) UI.btnRegenerateId.addEventListener('click', () => { destroyPeer(); createRoom(); });
  if (UI.btnSend) UI.btnSend.addEventListener('click', sendMessage);
  
  if (UI.messageInput) {
    UI.messageInput.addEventListener('input', () => {
      const hasText = UI.messageInput.value.trim().length > 0;
      if (UI.btnSend) UI.btnSend.classList.toggle('hidden', !hasText);
      if (UI.btnRecord) UI.btnRecord.classList.toggle('hidden', hasText);
    });
    UI.messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
  }
  
  if (UI.btnUploadFile) UI.btnUploadFile.addEventListener('click', () => UI.fileInput.click());
  if (UI.fileInput) UI.fileInput.addEventListener('change', handleFileUpload);
  
  if (UI.btnRecord) {
    UI.btnRecord.addEventListener('mousedown', startVoiceRecording);
    UI.btnRecord.addEventListener('mouseup', stopVoiceRecording);
    UI.btnRecord.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceRecording(); }, {passive: false});
    UI.btnRecord.addEventListener('touchend', (e) => { e.preventDefault(); stopVoiceRecording(); }, {passive: false});
  }
}

function showScreen(screen) {
  Object.values(screens).forEach(s => { if (s) s.classList.remove('active'); });
  if (screen) screen.classList.add('active');
}

/* =============================================
   P2P LOGIC
   ============================================= */
function generateUniqueId() {
  const gods = ["ARES", "HADES", "ZEUS", "LOKI", "ODIN", "THOR", "ANUBIS", "HORUS", "SETH", "SHIVA", "KALI", "RA", "OSIRIS", "APOLO", "NEXUS", "NOVA", "ORION", "TITAN", "CRONOS", "FENRIX"];
  const randomGod = gods[Math.floor(Math.random() * gods.length)];
  const hexPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KX_${randomGod}_${hexPart}_${Date.now().toString(36).substring(3,7).toUpperCase()}`;
}

function createRoom() {
  if (!hasValidLicense()) {
      bloquearAccesoHost();
      return;
  }
  
  showScreen(screens.createRoom);
  myPeerId = generateUniqueId();
  if (UI.roomIdInput) UI.roomIdInput.value = "CONNECTING...";
  
  if (peer) peer.destroy();
  peer = new Peer(myPeerId, { 
    debug: 2, 
    config: { 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ] 
    } 
  });
  
  peer.on('open', (id) => {
    isHost = true;
    if (UI.roomIdInput) UI.roomIdInput.value = id;
    updateStatus('SALA ABIERTA', 'warning');
  });

  peer.on('connection', (conn) => {
    setupConnection(conn);
    // Notificar que estamos online al recibir conexión
    setTimeout(() => {
        if (conn.open) conn.send(JSON.stringify({ type: 'STATUS', status: 'online' }));
    }, 1000);
  });
  peer.on('error', (err) => {
    logDelta("Peer Error: " + err.type);
    updateStatus('ERROR: ' + err.type.toUpperCase(), 'error');
  });
}

function connectToPeer() {
  const targetId = UI.peerIdInput.value.trim().toUpperCase();
  if (!targetId.startsWith('KX_') && !targetId.startsWith('KRONX_')) {
    updateStatus('ID INVÁLIDO', 'error');
    return;
  }
  updateStatus('CONECTANDO...', 'warning');
  myPeerId = generateUniqueId();
  if (peer) peer.destroy();
  
  peer = new Peer(myPeerId, { 
    debug: 2,
    config: { 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ] 
    }
  });
  peer.on('open', () => {
    updateStatus('ENLAZANDO...', 'warning');
    const conn = peer.connect(targetId, {
      reliable: true,
      metadata: { version: '5.1' }
    });
    setupConnection(conn);
  });
}

function setupConnection(conn) {
  currentConnection = conn;
  conn.on('open', () => {
    // --- ANTI-CLONING P2P DRM ---
    const myLic = localStorage.getItem('kronx_ops_lic') || 'none';
    conn.send(JSON.stringify({ type: 'LICENSE_CHECK', data: myLic }));

    showScreen(screens.chat);
    if (UI.chatPeerId) UI.chatPeerId.textContent = conn.peer;
    updateStatus('EN LÍNEA', 'success');
    
    // Aplicar estilos del anfitrión o invitado para los Patterns de fondo
    if (isHost) {
        document.body.classList.add('host-mode');
        document.body.classList.remove('guest-mode');
    } else {
        document.body.classList.add('guest-mode');
        document.body.classList.remove('host-mode');
    }
  });
  conn.on('data', (data) => {
    try {
        const payload = JSON.parse(data);
        
        // INTERCEPTAR VERIFICACIÓN ANTIPIRATERÍA (Ignorar 'none')
        if (payload.type === 'LICENSE_CHECK') {
            const myLocalLic = localStorage.getItem('kronx_ops_lic');
            if (myLocalLic && payload.data === myLocalLic && payload.data !== 'none') {
                // Hay un clon
                conn.close();
                bloquearAccesoClonado();
            }
            return;
        }

        if (payload.type === 'TEXT') {
            appendMessage(payload.text, 'received', payload.msgId);
            conn.send(JSON.stringify({ type: 'ACK', msgId: payload.msgId }));
        }
        else if (payload.type === 'ACK') markAsDelivered(payload.msgId);
        else if (payload.type === 'STATUS') updateSubStatus(payload.status);
        else if (payload.type === 'MEDIA' || payload.type === 'VIDEO') renderDeltaMedia(payload);
        else if (payload.type === 'VOICE') renderDeltaVoice(payload);
    } catch(e) { logDelta("Data error."); }
  });
  conn.on('close', disconnect);
}

function disconnect() {
  if (currentConnection) currentConnection.close();
  destroyPeer();
  showScreen(screens.welcome);
  updateStatus('SISTEMA LISTO', 'success');
}

function destroyPeer() {
  if (peer) peer.destroy();
  peer = null;
}

function updateStatus(text, type) {
  if (UI.statusIndicator) {
    UI.statusIndicator.textContent = `● ${text}`;
    UI.statusIndicator.className = `status-badge ${type}`;
  }
}

/* =============================================
   DELTA RENDERER (BLINDADO)
   ============================================= */
function sendMessage() {
  const text = UI.messageInput.value.trim();
  if (!text || !currentConnection) return;

  // Detener audios y videos en memoria evitando fantasmas sonoros
  activeMediaObjects.forEach(m => {
    try {
      m.pause();
      m.src = "";
      m.removeAttribute('src');
      m.load();
    } catch(e) {}
  });
  activeMediaObjects = [];

  // Destrucción animada de mensajes previos (Modo efímero/WhatsApp Delete)
  activeMessages.forEach(el => {
    el.classList.add('destructive-glitch');
    setTimeout(() => el.remove(), 400);
  });
  activeMessages = [];
  
  const msgId = 'msg_' + Date.now();
  currentConnection.send(JSON.stringify({ type: 'TEXT', text, msgId }));
  appendMessage(text, 'sent', msgId);
  
  UI.messageInput.value = '';
  if (UI.btnSend) UI.btnSend.classList.add('hidden');
  if (UI.btnRecord) UI.btnRecord.classList.remove('hidden');
}

function appendMessage(text, type, msgId) {
  const div = document.createElement('div');
  div.id = msgId;
  div.className = `message ${type}`;
  
  const body = document.createElement('div');
  body.className = 'message-body';
  body.textContent = text;
  
  if (type === 'sent') {
    const ticks = document.createElement('div');
    ticks.className = 'tick-container';
    ticks.innerHTML = `<svg class="status-tick" viewBox="0 0 24 24"><path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>`;
    body.appendChild(ticks);
  }
  
  div.appendChild(body);
  UI.messagesContainer.appendChild(div);
  UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
  activeMessages.push(div);
}

function markAsDelivered(msgId) {
  const msgEl = document.getElementById(msgId);
  if (msgEl) {
    const ticks = msgEl.querySelector('.tick-container');
    if (ticks) {
        ticks.innerHTML = `
            <svg class="status-tick read" viewBox="0 0 24 24" style="margin-right:-8px;"><path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>
            <svg class="status-tick read" viewBox="0 0 24 24"><path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>
        `;
    }
  }
}

function updateSubStatus(status) {
    const el = document.getElementById('chat-sub-status');
    if (el) el.textContent = status;
}

function renderDeltaMedia(payload) {
    const isVideo = payload.type === 'VIDEO' || payload.data.startsWith('data:video');
    const div = document.createElement('div');
    div.className = `message received secure-media`;
    const body = document.createElement('div');
    body.className = 'message-body secure-container';
    
    const canvas = document.createElement('canvas');
    canvas.className = 'delta-canvas';
    const ctx = canvas.getContext('2d');
    
    if (isVideo) {
        const video = document.createElement('video');
        video.src = payload.data;
        video.muted = true;
        video.playsInline = true;
        video.loop = true;
        
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            video.play();
            const draw = () => {
                if (!video.paused && !video.ended) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    requestAnimationFrame(draw);
                }
            };
            draw();
        };

        const overlay = document.createElement('button');
        overlay.className = 'delta-video-overlay';
        overlay.innerHTML = '🔊';
        overlay.onclick = () => {
            video.muted = !video.muted;
            overlay.innerHTML = video.muted ? '🔊' : '🔈';
            if (video.paused) video.play();
        };
        body.appendChild(overlay);
        activeMediaObjects.push(video);
    } else {
        const img = new Image();
        img.src = payload.data;
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        };
    }
    
    // Anti-descarga
    canvas.oncontextmenu = (e) => e.preventDefault();
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    
    body.appendChild(canvas);
    div.appendChild(body);
    UI.messagesContainer.appendChild(div);
    UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
    activeMessages.push(div);
}

function renderDeltaVoice(payload) {
    const div = document.createElement('div');
    div.className = `message received secure-media`;
    const player = document.createElement('div');
    player.className = 'delta-audio-v5';
    const btn = document.createElement('button');
    btn.innerHTML = '▶️';
    const audio = new Audio(payload.data);
    activeMediaObjects.push(audio);
    
    btn.onclick = () => {
        if (audio.paused) { audio.play(); btn.innerHTML = '⏹️'; }
        else { audio.pause(); btn.innerHTML = '▶️'; }
    };
    audio.onended = () => btn.innerHTML = '▶️';
    player.appendChild(btn);
    div.appendChild(player);
    UI.messagesContainer.appendChild(div);
    UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
    activeMessages.push(div);
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file || !currentConnection) return;
  const isVideo = file.type.startsWith('video/');
  const reader = new FileReader();
  reader.onload = (ev) => {
    const payload = { type: isVideo ? 'VIDEO' : 'MEDIA', data: ev.target.result };
    currentConnection.send(JSON.stringify(payload));
    renderDeltaMedia(payload);
  };
  reader.readAsDataURL(file);
}

async function startVoiceRecording() {
  if (isRecording || !currentConnection) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        currentConnection.send(JSON.stringify({ type: 'VOICE', data: reader.result }));
        renderDeltaVoice({ data: reader.result });
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorder.start();
    isRecording = true;
  } catch(e) {}
}

function stopVoiceRecording() {
  if (isRecording && mediaRecorder) mediaRecorder.stop();
  isRecording = false;
}

function initSecurity() {
  document.body.oncontextmenu = (e) => e.preventDefault();
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['c','s','p','u','i'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  
  // Anti-Screenshot & Blur when losing focus
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'hidden') {
      document.body.style.filter = 'blur(15px) contrast(0)';
      document.body.style.opacity = '0';
      logDelta("Previniendo captura de pantalla / visor...");
    } else {
      setTimeout(() => {
        document.body.style.filter = 'none';
        document.body.style.opacity = '1';
      }, 300);
    }
  });

  // Ocultar al hacer PrintScreen / blur
  window.addEventListener('blur', () => {
      document.body.style.filter = 'blur(15px) contrast(0)';
      document.body.style.opacity = '0';
  });
  window.addEventListener('focus', () => {
      setTimeout(() => {
        document.body.style.filter = 'none';
        document.body.style.opacity = '1';
      }, 300);
  });
}
