// FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyCU0Agq1CTsKS2YbO-mzXr2jOseQ49bp8k",
    authDomain: "vibechatapp-504eb.firebaseapp.com",
    projectId: "vibechatapp-504eb",
    storageBucket: "vibechatapp-504eb.firebasestorage.app",
    messagingSenderId: "447918097803",
    appId: "1:447918097803:web:b8d23000ff41b915eedb8e"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// AGORA CONFIG
const AGORA_APP_ID = "3b9822e28fc04a8bbccfc78314fda8f4";
const ADMIN_SECRET = "vibeadmin123";

// GLOBALS
let currentUser = null;
let isAdmin = false;
let activeChat = null;
let unsubMessages = null;
let adminVids = [];
let agoraClient = null;
let localTracks = { video: null, audio: null };

// Load saved videos
if (localStorage.getItem('adminVids')) {
    adminVids = JSON.parse(localStorage.getItem('adminVids'));
}

// AUTH LISTENER
auth.onAuthStateChanged(user => {
    if (user) {
        loadUser(user.uid);
    } else {
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }
});

// ===== AUTH FUNCTIONS =====
function showSignup() {
    document.getElementById('loginBox').classList.add('hidden');
    document.getElementById('signupBox').classList.remove('hidden');
}

function showLogin() {
    document.getElementById('signupBox').classList.add('hidden');
    document.getElementById('loginBox').classList.remove('hidden');
}

function previewImage() {
    const file = document.getElementById('profilePic').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('profilePreview').innerHTML = `<img src="${e.target.result}">`;
        };
        reader.readAsDataURL(file);
    }
}

async function signup() {
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const picFile = document.getElementById('profilePic').files[0];

    if (!username || !email || !password) {
        alert('Please fill all fields!');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const uid = cred.user.uid;

        let picUrl = `https://ui-avatars.com/api/?name=${username}&size=200&background=random`;
        
        if (picFile) {
            const ref = storage.ref(`profiles/${uid}`);
            await ref.put(picFile);
            picUrl = await ref.getDownloadURL();
        }

        await db.collection('users').doc(uid).set({
            uid: uid,
            username: username,
            email: email,
            profilePic: picUrl,
            created: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Account created! ✅');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const adminKey = document.getElementById('loginAdminKey').value.trim();

    if (!email || !password) {
        alert('Enter email and password');
        return;
    }

    if (adminKey === ADMIN_SECRET) {
        isAdmin = true;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function logout() {
    auth.signOut();
    isAdmin = false;
    activeChat = null;
}

async function loadUser(uid) {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
        currentUser = doc.data();
        document.getElementById('currentUsername').textContent = currentUser.username;
        document.getElementById('currentUserPic').src = currentUser.profilePic;

        if (isAdmin) {
            document.getElementById('adminBadge').classList.remove('hidden');
            document.getElementById('adminVideos').classList.remove('hidden');
            loadAdminVids();
        }

        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        
        loadChats();
    }
}

// ===== CHAT LIST =====
function loadChats() {
    db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .onSnapshot(async snapshot => {
            const list = document.getElementById('chatsList');
            list.innerHTML = '';

            if (snapshot.empty) {
                list.innerHTML = '<p style="padding:20px;text-align:center;color:#999;">No chats yet</p>';
                return;
            }

            for (const doc of snapshot.docs) {
                const chat = doc.data();
                const otherUid = chat.participants.find(id => id !== currentUser.uid);
                const userDoc = await db.collection('users').doc(otherUid).get();
                const user = userDoc.data();

                const item = document.createElement('div');
                item.className = 'chat-item';
                item.onclick = () => openChat(doc.id, user);
                item.innerHTML = `
                    <img src="${user.profilePic}">
                    <div class="chat-item-info">
                        <div class="chat-item-name">${user.username}</div>
                        <div class="chat-item-msg">${chat.lastMessage || 'Say hi!'}</div>
                    </div>
                `;
                list.appendChild(item);
            }
        });
}

// ===== SEARCH USERS =====
function showSearchModal() {
    document.getElementById('searchModal').classList.remove('hidden');
}

function closeSearch() {
    document.getElementById('searchModal').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

async function searchUsers() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const results = document.getElementById('searchResults');
    
    if (!query) {
        results.innerHTML = '';
        return;
    }

    const snapshot = await db.collection('users').get();
    results.innerHTML = '';

    snapshot.forEach(doc => {
        const user = doc.data();
        if (user.uid !== currentUser.uid && user.username.toLowerCase().includes(query)) {
            const item = document.createElement('div');
            item.className = 'user-result';
            item.onclick = () => startChat(user);
            item.innerHTML = `
                <img src="${user.profilePic}">
                <span>${user.username}</span>
            `;
            results.appendChild(item);
        }
    });
}

async function startChat(user) {
    const participants = [currentUser.uid, user.uid].sort();
    const chatId = participants.join('_');
    
    const ref = db.collection('chats').doc(chatId);
    const doc = await ref.get();
    
    if (!doc.exists) {
        await ref.set({
            participants: participants,
            created: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessage: null
        });
    }
    
    closeSearch();
    openChat(chatId, user);
}

// ===== OPEN CHAT =====
function openChat(chatId, user) {
    activeChat = { id: chatId, user: user };
    
    document.getElementById('noChat').classList.add('hidden');
    document.getElementById('activeChat').classList.remove('hidden');
    document.getElementById('chatName').textContent = user.username;
    document.getElementById('chatPic').src = user.profilePic;
    
    // Mobile: hide sidebar
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.add('hide-mobile');
        document.querySelector('.btn-back').classList.remove('hidden');
    }
    
    if (unsubMessages) unsubMessages();
    loadMessages(chatId);
}

function backToList() {
    document.getElementById('sidebar').classList.remove('hide-mobile');
    document.getElementById('chatArea').classList.add('hide-mobile');
    document.querySelector('.btn-back').classList.add('hidden');
}

// ===== MESSAGES =====
function loadMessages(chatId) {
    const container = document.getElementById('messages');
    
    unsubMessages = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const msg = doc.data();
                showMessage(msg);
            });
            container.scrollTop = container.scrollHeight;
        });
}

function showMessage(msg) {
    const container = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${msg.senderId === currentUser.uid ? 'own' : 'other'}`;
    
    let time = 'Now';
    if (msg.timestamp) {
        const date = msg.timestamp.toDate();
        time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    div.innerHTML = `
        <div class="msg-bubble">
            ${msg.text}
            <div class="msg-time">${time}</div>
        </div>
    `;
    container.appendChild(div);
}

function checkEnter(e) {
    if (e.key === 'Enter') sendMsg();
}

async function sendMsg() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    
    if (!text || !activeChat) return;
    
    await db.collection('chats').doc(activeChat.id).collection('messages').add({
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await db.collection('chats').doc(activeChat.id).update({
        lastMessage: text,
        lastTime: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    input.value = '';
}

// ===== VIDEO CALL =====
async function startCall() {
    document.getElementById('videoModal').classList.remove('hidden');
    
    if (isAdmin) {
        showAdminVideo();
    } else {
        await startRealCall();
    }
}

function showAdminVideo() {
    const video = document.getElementById('adminVideo');
    document.getElementById('localVideoDiv').style.display = 'none';
    video.classList.remove('hidden');
    
    const vid = adminVids[Math.floor(Math.random() * adminVids.length)];
    video.src = vid || 'video1.mp4';
}

async function startRealCall() {
    try {
        agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        await agoraClient.join(AGORA_APP_ID, activeChat.id, null, currentUser.uid);
        
        localTracks.audio = await AgoraRTC.createMicrophoneAudioTrack();
        localTracks.video = await AgoraRTC.createCameraVideoTrack();
        
        localTracks.video.play('localVideoDiv');
        await agoraClient.publish([localTracks.audio, localTracks.video]);
        
        agoraClient.on('user-published', async (user, mediaType) => {
            await agoraClient.subscribe(user, mediaType);
            if (mediaType === 'video') {
                const div = document.createElement('div');
                div.id = `remote-${user.uid}`;
                div.style = 'width:100%;height:100%;';
                document.getElementById('remoteVideoDiv').appendChild(div);
                user.videoTrack.play(div.id);
            }
            if (mediaType === 'audio') {
                user.audioTrack.play();
            }
        });
    } catch (err) {
        console.error('Video error:', err);
        alert('Could not start video call');
    }
}

async function endCall() {
    document.getElementById('videoModal').classList.add('hidden');
    
    if (isAdmin) {
        const video = document.getElementById('adminVideo');
        video.pause();
        video.src = '';
        video.classList.add('hidden');
        document.getElementById('localVideoDiv').style.display = 'block';
    } else {
        if (localTracks.audio) localTracks.audio.close();
        if (localTracks.video) localTracks.video.close();
        document.getElementById('remoteVideoDiv').innerHTML = '';
        if (agoraClient) await agoraClient.leave();
    }
}

// ===== ADMIN VIDEOS =====
function loadAdminVids() {
    if (localStorage.getItem('adminVids')) {
        const vids = JSON.parse(localStorage.getItem('adminVids'));
        document.getElementById('vid1').value = vids[0] || '';
        document.getElementById('vid2').value = vids[1] || '';
        document.getElementById('vid3').value = vids[2] || '';
    }
}

function saveVideos() {
    const v1 = document.getElementById('vid1').value.trim();
    const v2 = document.getElementById('vid2').value.trim();
    const v3 = document.getElementById('vid3').value.trim();
    
    const vids = [
        convertDriveLink(v1),
        convertDriveLink(v2),
        convertDriveLink(v3)
    ].filter(v => v !== '');
    
    if (vids.length === 0) {
        alert('Add at least one video!');
        return;
    }
    
    adminVids = vids;
    localStorage.setItem('adminVids', JSON.stringify(vids));
    alert('✅ Videos saved!');
}

function convertDriveLink(url) {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/uc?export=download&id=${match[1]}`;
        }
    }
    return url;
}
