/* =============================================
   ECHO CHAT - Minimalist Core Logic 
   Version: 3.0.0
   ============================================= */

let peer = null;
let currentConnection = null;
let myPeerId = null;
let isHost = false;

// DOM Elements
const screens = {
  splash: document.getElementById('splash-screen'),
  terminal: document.getElementById('terminal'),
  welcome: document.getElementById('welcome-screen'),
  createRoom: document.getElementById('create-room-screen'),
  joinRoom: document.getElementById('join-room-screen'),
  chat: document.getElementById('chat-screen')
};

const UI = {
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
  fileInput: document.getElementById('file-input'),
  installPrompt: document.getElementById('install-prompt')
};

let activeMessages = [];
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

/* =============================================
   INITIALIZATION
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initSplashScreen();
  initSecurity();
});

function initSplashScreen() {
  setTimeout(() => {
    if(screens.splash) screens.splash.classList.remove('active');
    
    // Explicitly unhide terminal using standard display mechanics to override any CSS bugs
    if(screens.terminal) {
      screens.terminal.classList.remove('hidden');
      screens.terminal.style.display = 'flex';
    }
    
    showScreen(screens.welcome);
  }, 1500);
}

function setupEventListeners() {
  UI.btnCreateRoom?.addEventListener('click', createRoom);
  UI.btnJoinRoom?.addEventListener('click', () => {
    showScreen(screens.joinRoom);
    UI.peerIdInput?.focus();
  });

  UI.btnBackFromCreate?.addEventListener('click', () => {
    destroyPeer();
    showScreen(screens.welcome);
  });

  UI.btnBackFromJoin?.addEventListener('click', () => {
    UI.peerIdInput.value = '';
    showScreen(screens.welcome);
  });

  UI.btnConnect?.addEventListener('click', connectToPeer);
  UI.btnDisconnect?.addEventListener('click', disconnect);
  
  UI.btnCopyId?.addEventListener('click', () => {
    navigator.clipboard.writeText(UI.roomIdInput.value).then(() => {
      systemAlert('Enlace Copiado', 'success');
    });
  });

  UI.btnRegenerateId?.addEventListener('click', () => {
    destroyPeer();
    createRoom();
  });

  UI.btnSend?.addEventListener('click', sendMessage);
  UI.messageInput?.addEventListener('input', () => {
    UI.btnSend.classList.toggle('hidden', UI.messageInput.value.trim().length === 0);
  });
  UI.messageInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  UI.peerIdInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') connectToPeer();
  });

  UI.btnUploadFile?.addEventListener('click', () => UI.fileInput?.click());
  UI.fileInput?.addEventListener('change', handleFileUpload);
  
  // Voice Recording
  UI.btnRecord?.addEventListener('mousedown', startVoiceRecording);
  UI.btnRecord?.addEventListener('mouseup', stopVoiceRecording);
  UI.btnRecord?.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceRecording(); });
  UI.btnRecord?.addEventListener('touchend', (e) => { e.preventDefault(); stopVoiceRecording(); });
}

function showScreen(screen) {
  Object.values(screens).forEach(s => s?.classList.remove('active'));
  screen?.classList.add('active');
}

/* =============================================
   CORE P2P CONNECTION
   ============================================= */
function generateUniqueId() {
  const rs = crypto.getRandomValues(new Uint32Array(2));
  const t = Date.now().toString(36);
  return `ECHO_${t}${rs[0].toString(36)}${rs[1].toString(36)}`.toUpperCase().substring(0, 16);
}

function initPeerOptions() {
  return { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } };
}

function createRoom() {
  showScreen(screens.createRoom);
  myPeerId = generateUniqueId();
  if(UI.roomIdInput) UI.roomIdInput.value = "Generando...";
  
  // Destruir peer anterior si existe para evitar conflictos
  if(peer) peer.destroy();

  peer = new Peer(myPeerId, initPeerOptions());
  
  peer.on('open', (id) => {
    isHost = true;
    if(UI.roomIdInput) UI.roomIdInput.value = id;
    updateStatus('ESPERANDO CONEXIÓN...', 'warning');
  });

  peer.on('connection', (conn) => {
    if (currentConnection?.open) {
      conn.close(); return;
    }
    const approve = confirm(`¿Permitir conexión entrante de:\n${conn.peer}?`);
    if (!approve) { conn.close(); return; }

    setupConnection(conn);
  });

  peer.on('error', (err) => systemAlert('Error al crear sala.', 'error'));
}

function connectToPeer() {
  const targetId = UI.peerIdInput?.value.trim().toUpperCase();
  if (!targetId || !targetId.startsWith('ECHO_')) return systemAlert('ID inválido.', 'error');

  myPeerId = generateUniqueId();
  peer = new Peer(myPeerId, initPeerOptions());
  
  peer.on('open', () => {
    updateStatus('CONECTANDO...', 'warning');
    const conn = peer.connect(targetId);
    setupConnection(conn);
  });

  peer.on('error', (err) => systemAlert('No se pudo conectar al peer.', 'error'));
}

function setupConnection(conn) {
  currentConnection = conn;
  
  conn.on('open', () => {
    showScreen(screens.chat);
    if(UI.chatPeerId) UI.chatPeerId.textContent = isHost ? conn.peer : conn.peer;
    updateStatus('EN LÍNEA', 'success');
  });

  conn.on('data', (data) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'HEARTBEAT') return;
      if (parsed.type === 'FILE') handleIncomingFile(parsed);
      else if (parsed.type === 'VOICE') handleIncomingVoice(parsed);
      else handleIncomingText(parsed);
    } catch (e) { handleIncomingText(data); }
  });

  conn.on('close', () => {
    systemAlert('El contacto se ha desconectado.', 'error');
    disconnect();
  });
}

function disconnect() {
  currentConnection?.close();
  currentConnection = null;
  destroyPeer();
  showScreen(screens.welcome);
  updateStatus('OFFLINE', 'error');
  if(UI.messagesContainer) UI.messagesContainer.innerHTML = '';
  activeMessages = [];
}

function destroyPeer() {
  peer?.destroy();
  peer = null;
  isHost = false;
  myPeerId = null;
}

function updateStatus(text, type) {
  if (UI.statusIndicator) {
    UI.statusIndicator.textContent = `● ${text}`;
    UI.statusIndicator.className = `status-badge ${type}`;
  }
}

function systemAlert(msg, type='info') {
  alert(msg); // Reduced code: simple minimal alerts instead of complex custom toast
}

/* =============================================
   MESSAGING LOGIC
   ============================================= */
function sendMessage() {
  const text = UI.messageInput?.value.trim();
  if (!text || !currentConnection?.open) return;

  // Destruir mensajes previos al responder (feature mantenida)
  activeMessages.forEach(el => el.remove());
  activeMessages = [];

  const msgPayload = { type: 'TEXT', text };
  currentConnection.send(JSON.stringify(msgPayload));
  appendMessage(text, 'sent');
  
  UI.messageInput.value = '';
  UI.btnSend.classList.add('hidden');
  UI.messageInput.focus();
}

function handleIncomingText(data) {
  const text = typeof data === 'object' ? data.text : data;
  appendMessage(text, 'received');
}

function appendMessage(text, type) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  
  const body = document.createElement('div');
  body.className = 'message-body';
  body.textContent = text;
  
  const timer = document.createElement('span');
  timer.className = 'message-countdown';
  timer.textContent = 'Destrucción al responder';
  body.appendChild(timer);

  div.appendChild(body);
  UI.messagesContainer.appendChild(div);
  UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
  activeMessages.push(div);
}

/* =============================================
   FILE & VOICE TRANSFERS
   ============================================= */
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file || !currentConnection?.open) return;
  if (file.size > 20 * 1024 * 1024) return systemAlert('Archivo demasiado grande (max 20MB)');

  const reader = new FileReader();
  reader.onload = (ev) => {
    currentConnection.send(JSON.stringify({
      type: 'FILE', name: file.name, data: ev.target.result
    }));
    systemAlert('Archivo enviado', 'success');
  };
  reader.readAsDataURL(file);
}

function handleIncomingFile({ name, data }) {
  const div = document.createElement('div');
  div.className = 'message received file-message';
  div.innerHTML = `
    <div class="message-body">
      <div class="file-download">
        <span class="file-icon">📎</span>
        <span class="file-name">${name}</span>
        <a href="${data}" download="${name}" class="file-download-btn">Guardar</a>
      </div>
    </div>
  `;
  UI.messagesContainer.appendChild(div);
  UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
  activeMessages.push(div);
}

async function startVoiceRecording() {
  if (isRecording || !currentConnection?.open) return;
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
        handleIncomingVoice({ data: reader.result }, true);
      };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    isRecording = true;
    UI.btnRecord.style.backgroundColor = 'var(--danger)';
  } catch(e) {}
}

function stopVoiceRecording() {
  if (!isRecording) return;
  mediaRecorder.stop();
  isRecording = false;
  if(UI.btnRecord) UI.btnRecord.style.backgroundColor = 'var(--primary)';
}

function handleIncomingVoice({ data }, isSent=false) {
  const div = document.createElement('div');
  div.className = `message voice-message ${isSent ? 'sent':'received'}`;
  div.innerHTML = `
    <div class="message-body">
      <audio controls src="${data}"></audio>
    </div>
  `;
  UI.messagesContainer.appendChild(div);
  UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
  if(!isSent) activeMessages.push(div);
}

/* =============================================
   SECURITY (Minimal)
   ============================================= */
function initSecurity() {
  setInterval(() => {
    if (currentConnection?.open) currentConnection.send(JSON.stringify({ type: 'HEARTBEAT' }));
  }, 10000);

  // Panic button Escape x3
  let escCount = 0;
  let escTimer = null;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      escCount++;
      clearTimeout(escTimer);
      escTimer = setTimeout(() => { escCount = 0; }, 2000);
      if (escCount === 3) {
        document.body.innerHTML = '';
        window.location.href = 'https://google.com';
      }
    }
  });

  // Anti-Copy & Anti-Screenshot Protection
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  
  function isEditable(t) {
    if (!t) return false;
    const tag = (t.tagName || '').toLowerCase();
    return (tag === 'input' || tag === 'textarea' || t.isContentEditable);
  }

  document.addEventListener('copy', (e) => {
    if(!isEditable(e.target)) e.preventDefault();
  });
  document.addEventListener('cut', (e) => {
    if(!isEditable(e.target)) e.preventDefault();
  });
  document.addEventListener('contextmenu', (e) => {
    if(!isEditable(e.target)) e.preventDefault();
  });

  document.addEventListener('keydown', (e) => {
    if (isEditable(e.target)) return;
    if ((e.ctrlKey || e.metaKey) && ['c','x','a','p','s'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });

  let focusLostCount = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentConnection) {
      focusLostCount++;
      if (focusLostCount >= 3) {
        systemAlert('⚠ Advertencia: Posible intento de captura de pantalla o desenfoque detectado.');
        focusLostCount = 0;
      }
    }
  });
}
