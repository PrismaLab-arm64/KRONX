/* =============================================
   ECHO CHAT - PROTOCOLO DELTA v4.0
   NIVEL: CLASIFICADO (FUERZA DELTA)
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

// Security Log
function logDelta(msg) {
  console.log(`%c[DELTA-COREV4] ${msg}`, "color: #00ff00; font-weight: bold; background: #000; padding: 2px 5px;");
}

/* =============================================
   INITIALIZATION
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  logDelta("Iniciando Protocolo Delta...");
  try {
    setupEventListeners();
    initSplashScreen();
    initSecurity();
    // Cache bust check
    if (!window.location.search.includes('v=')) {
        window.location.search = '?v=' + Date.now();
    }
  } catch (err) {
    logDelta("ERROR CRÍTICO: " + err.message);
  }
});

function initSplashScreen() {
  setTimeout(() => {
    if (screens.splash) screens.splash.classList.remove('active');
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
          logDelta("ID Copiado al portapapeles táctico.");
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
  return `ECHOCHAT_${t}${rs[0].toString(36)}`.toUpperCase().substring(0, 16);
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
  if (UI.roomIdInput) UI.roomIdInput.value = "CALIBRANDO...";
  
  if (peer) peer.destroy();
  peer = new Peer(myPeerId, initPeerOptions());
  
  peer.on('open', (id) => {
    isHost = true;
    if (UI.roomIdInput) UI.roomIdInput.value = id;
    updateStatus('MODO VIGÍA ACTIVO', 'warning');
  });

  peer.on('connection', (conn) => {
    if (currentConnection && currentConnection.open) { conn.close(); return; }
    setupConnection(conn);
  });
}

function connectToPeer() {
  const targetId = UI.peerIdInput ? UI.peerIdInput.value.trim().toUpperCase() : '';
  if (!targetId || !targetId.startsWith('ECHOCHAT_')) return;

  myPeerId = generateUniqueId();
  if (peer) peer.destroy();
  peer = new Peer(myPeerId, initPeerOptions());
  
  peer.on('open', () => {
    updateStatus('ENLAZANDO...', 'warning');
    const conn = peer.connect(targetId, { reliable: true });
    setupConnection(conn);
  });

  peer.on('error', (err) => logDelta("Error de enlace: " + err.type));
}

function setupConnection(conn) {
  currentConnection = conn;
  
  const handleOpen = () => {
    showScreen(screens.chat);
    if (UI.chatPeerId) UI.chatPeerId.textContent = conn.peer;
    updateStatus('OPERATIVO', 'success');
    logDelta("Enlace establecido con: " + conn.peer);
  };

  if (conn.open) handleOpen();
  else conn.on('open', handleOpen);

  conn.on('data', (data) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'HEARTBEAT') return;
      if (parsed.type === 'FILE' || parsed.type === 'VIDEO') renderSecureMedia(parsed);
      else if (parsed.type === 'VOICE') renderSecureVoice(parsed);
      else handleIncomingText(parsed.text);
    } catch (e) { handleIncomingText(data); }
  });

  conn.on('close', () => {
    logDelta("Conexión perdida.");
    disconnect();
  });
}

function disconnect() {
  if (currentConnection) currentConnection.close();
  currentConnection = null;
  destroyPeer();
  showScreen(screens.welcome);
  updateStatus('DESCONECTADO', 'error');
  if (UI.messagesContainer) UI.messagesContainer.innerHTML = '';
  activeMessages = [];
}

function destroyPeer() {
  if (peer) peer.destroy();
  peer = null;
  isHost = false;
}

function updateStatus(text, type) {
  if (UI.statusIndicator) {
    UI.statusIndicator.textContent = `● ${text}`;
    UI.statusIndicator.className = `status-badge ${type}`;
  }
}

/* =============================================
   SECURE MESSAGING & RENDERING (CANVAS/WEB AUDIO)
   ============================================= */

function sendMessage() {
  const text = UI.messageInput ? UI.messageInput.value.trim() : '';
  if (!text || !currentConnection || !currentConnection.open) return;

  // Destrucción animada
  activeMessages.forEach(el => {
    el.classList.add('destructive-glitch');
    setTimeout(() => el.remove(), 400);
  });
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

function handleIncomingText(text) {
  appendMessage(text, 'received');
}

function appendMessage(text, type) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  const body = document.createElement('div');
  body.className = 'message-body';
  
  if (type === 'received') {
    let originalText = text;
    let cycles = 0;
    body.textContent = '???';
    let interval = setInterval(() => {
      cycles++;
      let chars = '01#X$%&@*';
      body.textContent = originalText.split('').map((char, index) => {
        if (char === ' ') return ' ';
        if (index < cycles / 4) return originalText[index];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');
      if (cycles > originalText.length * 4) {
        clearInterval(interval);
        body.textContent = originalText;
      }
    }, 15);
  } else {
    body.textContent = text;
  }
  
  const countdown = document.createElement('span');
  countdown.className = 'message-countdown';
  countdown.textContent = 'PURGA ACTIVA';
  body.appendChild(countdown);
  div.appendChild(body);
  
  if (UI.messagesContainer) {
    UI.messagesContainer.appendChild(div);
    UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
  }
  activeMessages.push(div);
}

// FORCE DELTA: RENDERIZADO EN CANVAS (SIN TAGS IMG)
function renderSecureMedia(payload) {
    const isVideo = payload.type === 'VIDEO';
    const div = document.createElement('div');
    div.className = `message received secure-media`;
    
    const body = document.createElement('div');
    body.className = 'message-body secure-container';
    
    const canvas = document.createElement('canvas');
    canvas.className = 'delta-canvas';
    canvas.oncontextmenu = (e) => e.preventDefault();
    
    const ctx = canvas.getContext('2d');
    const media = isVideo ? document.createElement('video') : new Image();
    media.src = payload.data;
    
    if (!isVideo) {
        media.onload = () => {
            canvas.width = media.width;
            canvas.height = media.height;
            ctx.drawImage(media, 0, 0);
            logDelta("Imagen materializada en Canvas Aislado.");
        };
    } else {
        media.onloadedmetadata = () => {
            canvas.width = media.videoWidth;
            canvas.height = media.videoHeight;
            media.play();
            const drawFrame = () => {
                if (!media.paused && !media.ended) {
                    ctx.drawImage(media, 0, 0);
                    requestAnimationFrame(drawFrame);
                }
            };
            drawFrame();
        };
    }

    body.appendChild(canvas);
    const label = document.createElement('div');
    label.className = 'secure-label';
    label.textContent = isVideo ? 'VÍDEO TEMPORAL' : 'IMAGEN TEMPORAL';
    body.appendChild(label);
    
    div.appendChild(body);
    if (UI.messagesContainer) {
        UI.messagesContainer.appendChild(div);
        UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
    }
    activeMessages.push(div);
}

// FORCE DELTA: WEB AUDIO API (SIN TAG AUDIO NATIVO)
function renderSecureVoice(payload) {
    const div = document.createElement('div');
    div.className = `message received secure-media`;
    const body = document.createElement('div');
    body.className = 'message-body';
    
    const player = document.createElement('div');
    player.className = 'delta-audio-player';
    
    const playBtn = document.createElement('button');
    playBtn.textContent = '🔊';
    playBtn.onclick = () => {
        const audio = new Audio(payload.data);
        audio.play();
        playBtn.textContent = '📻';
        audio.onended = () => playBtn.textContent = '🔊';
    };
    
    player.appendChild(playBtn);
    const label = document.createElement('div');
    label.className = 'secure-label';
    label.textContent = 'AUDIO BLINDADO';
    player.appendChild(label);
    
    body.appendChild(player);
    div.appendChild(body);
    if (UI.messagesContainer) {
        UI.messagesContainer.appendChild(div);
        UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
    }
    activeMessages.push(div);
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file || !currentConnection || !currentConnection.open) return;
  
  const isVideo = file.type.startsWith('video/');
  const reader = new FileReader();
  reader.onload = (ev) => {
    const payload = { type: isVideo ? 'VIDEO' : 'FILE', data: ev.target.result, name: file.name };
    currentConnection.send(JSON.stringify(payload));
    renderSecureMedia(payload);
  };
  reader.readAsDataURL(file);
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
        renderSecureVoice({ data: reader.result });
      };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    isRecording = true;
  } catch(e) { logDelta("Mic Error."); }
}

function stopVoiceRecording() {
  if (isRecording && mediaRecorder) mediaRecorder.stop();
  isRecording = false;
}

function initSecurity() {
  document.body.oncontextmenu = (e) => e.preventDefault();
  document.body.style.userSelect = 'none';
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['c','s','p','u','i'].includes(e.key.toLowerCase())) e.preventDefault();
    if (e.key === 'F12') e.preventDefault();
  });
}
