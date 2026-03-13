/* =============================================
   ECHO CHAT - PROTOCOLO DELTA v5.1
   NIVEL: CLASIFICADO (STREAK DE SEGURIDAD)
   ============================================= */

let peer = null;
let currentConnection = null;
let myPeerId = null;
let isHost = false;

let screens = {};
let UI = {};

let activeMessages = [];
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

// Check ReadyState for immediate execution
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initDelta();
} else {
  document.addEventListener('DOMContentLoaded', initDelta);
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
    showScreen(screens.welcome);
  }, 800);
}

function setupEventListeners() {
  if (UI.btnCreateRoom) UI.btnCreateRoom.onclick = createRoom;
  if (UI.btnJoinRoom) {
    UI.btnJoinRoom.onclick = () => {
      showScreen(screens.joinRoom);
      if (UI.peerIdInput) UI.peerIdInput.focus();
    };
  }
  if (UI.btnBackFromCreate) UI.btnBackFromCreate.onclick = () => { destroyPeer(); showScreen(screens.welcome); };
  if (UI.btnBackFromJoin) UI.btnBackFromJoin.onclick = () => { if (UI.peerIdInput) UI.peerIdInput.value = ''; showScreen(screens.welcome); };
  if (UI.btnConnect) UI.btnConnect.onclick = connectToPeer;
  if (UI.btnDisconnect) UI.btnDisconnect.onclick = disconnect;
  if (UI.btnCopyId) {
    UI.btnCopyId.onclick = () => {
      if (UI.roomIdInput) {
        navigator.clipboard.writeText(UI.roomIdInput.value);
        logDelta("ID copiado.");
      }
    };
  }
  if (UI.btnRegenerateId) UI.btnRegenerateId.onclick = () => { destroyPeer(); createRoom(); };
  if (UI.btnSend) UI.btnSend.onclick = sendMessage;
  if (UI.messageInput) {
    UI.messageInput.oninput = () => {
      const hasText = UI.messageInput.value.trim().length > 0;
      if (UI.btnSend) UI.btnSend.classList.toggle('hidden', !hasText);
      if (UI.btnRecord) UI.btnRecord.classList.toggle('hidden', hasText);
    };
    UI.messageInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
  }
  if (UI.btnUploadFile) UI.btnUploadFile.onclick = () => UI.fileInput.click();
  if (UI.fileInput) UI.fileInput.onchange = handleFileUpload;
  if (UI.btnRecord) {
    UI.btnRecord.onmousedown = startVoiceRecording;
    UI.btnRecord.onmouseup = stopVoiceRecording;
    UI.btnRecord.ontouchstart = (e) => { e.preventDefault(); startVoiceRecording(); };
    UI.btnRecord.ontouchend = (e) => { e.preventDefault(); stopVoiceRecording(); };
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
  return `ECHOCHAT_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function createRoom() {
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

  peer.on('connection', (conn) => setupConnection(conn));
  peer.on('error', (err) => logDelta("Peer Error: " + err.type));
}

function connectToPeer() {
  const targetId = UI.peerIdInput.value.trim().toUpperCase();
  if (!targetId.startsWith('ECHOCHAT_')) return;
  myPeerId = generateUniqueId();
  if (peer) peer.destroy();
  peer = new Peer(myPeerId, { 
    debug: 2,
    config: { 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
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
    showScreen(screens.chat);
    if (UI.chatPeerId) UI.chatPeerId.textContent = conn.peer;
    updateStatus('EN LÍNEA', 'success');
  });
  conn.on('data', (data) => {
    try {
        const payload = JSON.parse(data);
        if (payload.type === 'TEXT') appendMessage(payload.text, 'received');
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
  
  activeMessages.forEach(el => {
    el.classList.add('destructive-glitch');
    setTimeout(() => el.remove(), 500);
  });
  activeMessages = [];
  
  currentConnection.send(JSON.stringify({ type: 'TEXT', text }));
  appendMessage(text, 'sent');
  UI.messageInput.value = '';
  if (UI.btnSend) UI.btnSend.classList.add('hidden');
  if (UI.btnRecord) UI.btnRecord.classList.remove('hidden');
}

function appendMessage(text, type) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  const body = document.createElement('div');
  body.className = 'message-body';
  body.textContent = text;
  div.appendChild(body);
  UI.messagesContainer.appendChild(div);
  UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
  activeMessages.push(div);
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
    } else {
        const img = new Image();
        img.src = payload.data;
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        };
    }
    
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
}
