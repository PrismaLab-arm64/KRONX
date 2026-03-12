/* =============================================
   ECHO CHAT - Minimalist Core Logic 
   Version: 3.1.0 (Safety/Compatibility Patch)
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
  fileInput: document.getElementById('file-input')
};

let activeMessages = [];
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

/* =============================================
   INITIALIZATION
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  try {
    setupEventListeners();
    initSplashScreen();
    initSecurity();
  } catch (err) {
    alert("Error de Inicio Crítico (posible browser antiguo): " + err.message);
  }
});

function initSplashScreen() {
  setTimeout(() => {
    if (screens.splash) screens.splash.classList.remove('active');
    
    // Explicitly unhide terminal using standard display mechanics
    if (screens.terminal) {
      screens.terminal.classList.remove('hidden');
      screens.terminal.style.display = 'flex';
    }
    
    showScreen(screens.welcome);
  }, 1500);
}

function setupEventListeners() {
  if (UI.btnCreateRoom) UI.btnCreateRoom.addEventListener('click', createRoom);
  if (UI.btnJoinRoom) {
    UI.btnJoinRoom.addEventListener('click', () => {
      showScreen(screens.joinRoom);
      if (UI.peerIdInput) UI.peerIdInput.focus();
    });
  }

  if (UI.btnBackFromCreate) {
    UI.btnBackFromCreate.addEventListener('click', () => {
      destroyPeer();
      showScreen(screens.welcome);
    });
  }

  if (UI.btnBackFromJoin) {
    UI.btnBackFromJoin.addEventListener('click', () => {
      if (UI.peerIdInput) UI.peerIdInput.value = '';
      showScreen(screens.welcome);
    });
  }

  if (UI.btnConnect) UI.btnConnect.addEventListener('click', connectToPeer);
  if (UI.btnDisconnect) UI.btnDisconnect.addEventListener('click', disconnect);
  
  if (UI.btnCopyId) {
    UI.btnCopyId.addEventListener('click', () => {
      if (UI.roomIdInput && navigator.clipboard) {
        navigator.clipboard.writeText(UI.roomIdInput.value).then(() => {
          systemAlert('Enlace Copiado', 'success');
        });
      }
    });
  }

  if (UI.btnRegenerateId) {
    UI.btnRegenerateId.addEventListener('click', () => {
      destroyPeer();
      createRoom();
    });
  }

  if (UI.btnSend) UI.btnSend.addEventListener('click', sendMessage);
  if (UI.messageInput) {
    UI.messageInput.addEventListener('input', () => {
      if (UI.btnSend) UI.btnSend.classList.toggle('hidden', UI.messageInput.value.trim().length === 0);
    });
    UI.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }
  
  if (UI.peerIdInput) {
    UI.peerIdInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') connectToPeer();
    });
  }

  if (UI.btnUploadFile) {
    UI.btnUploadFile.addEventListener('click', () => {
      if (UI.fileInput) UI.fileInput.click();
    });
  }
  if (UI.fileInput) UI.fileInput.addEventListener('change', handleFileUpload);
  
  // Voice Recording
  if (UI.btnRecord) {
    UI.btnRecord.addEventListener('mousedown', startVoiceRecording);
    UI.btnRecord.addEventListener('mouseup', stopVoiceRecording);
    UI.btnRecord.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceRecording(); });
    UI.btnRecord.addEventListener('touchend', (e) => { e.preventDefault(); stopVoiceRecording(); });
  }
}

function showScreen(screen) {
  Object.values(screens).forEach(s => {
    if (s) s.classList.remove('active');
  });
  if (screen) screen.classList.add('active');
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
  return { 
    debug: 2,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } 
  };
}

function createRoom() {
  showScreen(screens.createRoom);
  myPeerId = generateUniqueId();
  if (UI.roomIdInput) UI.roomIdInput.value = "Generando...";
  
  if (peer) peer.destroy();

  peer = new Peer(myPeerId, initPeerOptions());
  
  peer.on('open', (id) => {
    console.log('[DEBUG] Peer open on HOST. Assigned ID:', id);
    isHost = true;
    if (UI.roomIdInput) UI.roomIdInput.value = id;
    updateStatus('ESPERANDO CONEXIÓN...', 'warning');
  });

  peer.on('connection', (conn) => {
    console.log('[DEBUG] Incoming connection event from peer:', conn.peer);
    if (currentConnection && currentConnection.open) {
      conn.close(); return;
    }
    // Auto-aceptar la conexión (El ID largo randomizado ya funge como autenticación)
    setupConnection(conn);
  });

  peer.on('error', (err) => {
    console.error('[DEBUG] Peer hosting error:', err);
    systemAlert('Error al crear sala.', 'error');
  });
}

function connectToPeer() {
  const targetId = UI.peerIdInput ? UI.peerIdInput.value.trim().toUpperCase() : '';
  if (!targetId || !targetId.startsWith('ECHO_')) return systemAlert('ID inválido.', 'error');

  myPeerId = generateUniqueId();
  peer = new Peer(myPeerId, initPeerOptions());
  
  peer.on('open', () => {
    console.log('[DEBUG] Peer open on CLIENT. Attempting connection to target:', targetId);
    updateStatus('CONECTANDO...', 'warning');
    const conn = peer.connect(targetId, { reliable: true });
    setupConnection(conn);
  });

  peer.on('error', (err) => {
    console.error('[DEBUG] Peer connecting error:', err);
    systemAlert('No se pudo conectar al peer.', 'error');
  });
}

function setupConnection(conn) {
  console.log('[DEBUG] Setting up local connection object for:', conn.peer);
  currentConnection = conn;
  
  const handleOpen = () => {
    console.log('[DEBUG] Connection formally OPENED dynamically with:', conn.peer);
    showScreen(screens.chat);
    if (UI.chatPeerId) UI.chatPeerId.textContent = isHost ? conn.peer : conn.peer;
    updateStatus('EN LÍNEA', 'success');
  };

  if (conn.open) {
    handleOpen();
  } else {
    conn.on('open', handleOpen);
  }

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
  if (currentConnection) currentConnection.close();
  currentConnection = null;
  destroyPeer();
  showScreen(screens.welcome);
  updateStatus('OFFLINE', 'error');
  if (UI.messagesContainer) UI.messagesContainer.innerHTML = '';
  activeMessages = [];
}

function destroyPeer() {
  if (peer) peer.destroy();
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
  alert(msg);
}

/* =============================================
   MESSAGING LOGIC
   ============================================= */
function sendMessage() {
  const text = UI.messageInput ? UI.messageInput.value.trim() : '';
  if (!text || !currentConnection || !currentConnection.open) return;

  activeMessages.forEach(el => el.remove());
  activeMessages = [];

  const msgPayload = { type: 'TEXT', text };
  currentConnection.send(JSON.stringify(msgPayload));
  appendMessage(text, 'sent');
  
  if (UI.messageInput) {
    UI.messageInput.value = '';
    UI.messageInput.focus();
  }
  if (UI.btnSend) UI.btnSend.classList.add('hidden');
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
  if (UI.messagesContainer) {
    UI.messagesContainer.appendChild(div);
    UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
  }
  activeMessages.push(div);
}

/* =============================================
   FILE & VOICE TRANSFERS
   ============================================= */
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file || !currentConnection || !currentConnection.open) return;
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

function handleIncomingFile(payload) {
  const name = payload.name;
  const data = payload.data;
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
  if (UI.messagesContainer) {
    UI.messagesContainer.appendChild(div);
    UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
  }
  activeMessages.push(div);
}

async function startVoiceRecording() {
  if (isRecording || !currentConnection || !currentConnection.open) return;
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
    if (UI.btnRecord) UI.btnRecord.style.backgroundColor = 'var(--danger)';
  } catch(e) {
    console.warn("Audio error: ", e);
  }
}

function stopVoiceRecording() {
  if (!isRecording) return;
  if (mediaRecorder) mediaRecorder.stop();
  isRecording = false;
  if (UI.btnRecord) UI.btnRecord.style.backgroundColor = 'var(--primary)';
}

function handleIncomingVoice(payload, isSent=false) {
  const data = payload.data;
  const div = document.createElement('div');
  div.className = `message voice-message ${isSent ? 'sent':'received'}`;
  div.innerHTML = `
    <div class="message-body">
      <audio controls src="${data}"></audio>
    </div>
  `;
  if (UI.messagesContainer) {
    UI.messagesContainer.appendChild(div);
    UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
  }
  if (!isSent) activeMessages.push(div);
}

/* =============================================
   SECURITY
   ============================================= */
function initSecurity() {
  setInterval(() => {
    if (currentConnection && currentConnection.open) {
      currentConnection.send(JSON.stringify({ type: 'HEARTBEAT' }));
    }
  }, 10000);

  // Panic button
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
