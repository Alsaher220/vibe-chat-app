// ====================================
// FIREBASE CONFIGURATION
// ====================================
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

// ====================================
// AGORA CONFIGURATION
// ====================================
const AGORA_APP_ID = "3b9822e28fc04a8bbccfc78314fda8f4";
const ADMIN_SECRET = "vibeadmin123";

// ====================================
// GLOBAL VARIABLES
// ====================================
let currentUser = null;
let isAdmin = false;
let activeChat = null;
let unsubscribeMessages = null;
let adminVideoUrls = [];
let agoraClient = null;
let localTracks = { videoTrack: null, audioTrack: null };

// Load admin videos
if (localStorage.getItem('adminVideos')) {
    adminVideoUrls = JSON.parse(localStorage.getItem('adminVideos'));
}

// ====================================
// AUTH STATE LISTENER
// ====================================
auth.onAuthStateChanged((user) => {
    if (user) {
        loadUserProfile(user.uid);
    } else {
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
    }
});

// ====================================
// AUTH FUNCTIONS
// ====================================
function showSignup() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.remove('hidden');
}

function showLogin() {
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
}

function previewProfilePic() {
    const file = document.getElementById('profilePicInput').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('profilePreview').innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }
}

async function signupUser() {
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const profilePicFile = document.getElementById('profilePicInput').files[0];

    if (!username || !email || !password) {
        alert('Please fill in all fields!');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters!');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        let profilePicUrl = 'https://via.placeholder.com/150?text=' + username.charAt(0).toUpperCase();
        if (profilePicFile) {
            const storageRef = storage.ref(`profilePics/${user.uid}`);
            await storageRef.put(profilePicFile);
            profilePicUrl = await storageRef.getDownloadURL();
        }

        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            username: username,
            email: email,
            profilePic: profilePicUrl,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Account created successfully! ✅');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loginUser() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const adminKey = document.getElementById('loginAdminKey').value.trim();

    if (!email || !password) {
        alert('Please enter email and password!');
        return;
    }

    if (adminKey === ADMIN_SECRET) {
        isAdmin = true;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function logoutUser() {
    auth.signOut();
}

async function loadUserProfile(uid) {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
        currentUser = userDoc.data();
        document.getElementById('currentUsername').textContent = currentUser.username;
        document.getElementById('currentUserPic').src = currentUser.profilePic;
        
        if (isAdmin) {
            document.getElementById('adminBadge').classList.remove('hidden');
            document.getElementById('adminPanel').classList.remove('hidden');
            loadAdminVideos();
        }
        
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('appSection').classList.remove('hidden');
        
        loadChatsList();
    }
}

// ====================================
// CHAT LIST FUNCTIONS
// ====================================
async function loadChatsList() {
    const chatsListDiv = document.getElementById('chatsList');
    
    db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                chatsListDiv.innerHTML = '<p class="empty-state">No conversations yet. Start chatting!</p>';
                return;
            }
            
            chatsListDiv.innerHTML = '';
            snapshot.forEach(async (doc) => {
                const chat = doc.data();
                const otherUserId = chat.participants.find(id => id !== currentUser.uid);
                const otherUserDoc = await db.collection('users').doc(otherUserId).get();
                const otherUser = otherUserDoc.data();
                
                const chatItem = document.createElement('div');
                chatItem.className = 'chat-item';
                chatItem.onclick = () => openChat(doc.id, otherUser);
                chatItem.innerHTML = `
                    <img src="${otherUser.profilePic}" class="chat-item-pic" alt="${otherUser.username}">
                    <div class="chat-item-info">
                        <div class="chat-item-name">${otherUser.username}</div>
                        <div class="chat-item-preview">${chat.lastMessage || 'Start chatting!'}</div>
                    </div>
                `;
                chatsListDiv.appendChild(chatItem);
            });
        });
}

// ====================================
// USER SEARCH
// ====================================
function showUserSearch() {
    document.getElementById('userSearchModal').classList.remove('hidden');
}

function closeUserSearch() {
    document.getElementById('userSearchModal').classList.add('hidden');
    document.getElementById('userSearchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

async function searchUsers() {
    const query = document.getElementById('userSearchInput').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    
    if (!query) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    const usersSnapshot = await db.collection('users').get();
    resultsDiv.innerHTML = '';
    
    usersSnapshot.forEach((doc) => {
        const user = doc.data();
        if (user.uid !== currentUser.uid && user.username.toLowerCase().includes(query)) {
            const userResult = document.createElement('div');
            userResult.className = 'user-result';
            userResult.onclick = () => startChatWith(user);
            userResult.innerHTML = `
                <img src="${user.profilePic}" class="user-result-pic" alt="${user.username}">
                <span>${user.username}</span>
            `;
            resultsDiv.appendChild(userResult);
        }
    });
}

async function startChatWith(otherUser) {
    const participants = [currentUser.uid, otherUser.uid].sort();
    const chatId = participants.join('_');
    
    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists) {
        await chatRef.set({
            participants: participants,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessage: null
        });
    }
    
    closeUserSearch();
    openChat(chatId, otherUser);
}

// ====================================
// OPEN CHAT
// ====================================
function openChat(chatId, otherUser) {
    activeChat = { id: chatId, user: otherUser };
    
    document.getElementById('noChatSelected').classList.add('hidden');
    document.getElementById('activeChat').classList.remove('hidden');
    document.getElementById('chatUsername').textContent = otherUser.username;
    document.getElementById('chatUserPic').src = otherUser.profilePic;
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }
    
    loadMessages(chatId);
}

function loadMessages(chatId) {
    const messagesArea = document.getElementById('messagesArea');
    
    unsubscribeMessages = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            messagesArea.innerHTML = '';
            snapshot.forEach((doc) => {
                const msg = doc.data();
                displayMessage(msg);
            });
            messagesArea.scrollTop = messagesArea.scrollHeight;
        });
}

function displayMessage(msg) {
    const messagesArea = document.getElementById('messagesArea');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.senderId === currentUser.uid ? 'own' : 'other'}`;
    
    let timeString = 'Just now';
    if (msg.timestamp) {
        const date = msg.timestamp.toDate();
        timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    messageDiv.innerHTML = `
        <div class="message-content">
            ${msg.text}
            <div class="message-time">${timeString}</div>
        </div>
    `;
    messagesArea.appendChild(messageDiv);
}

function handleEnter(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !activeChat) return;
    
    await db.collection('chats').doc(activeChat.id).collection('messages').add({
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await db.collection('chats').doc(activeChat.id).update({
        lastMessage: text,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    input.value = '';
}

// ====================================
// VIDEO CALL FUNCTIONS
// ====================================
async function startVideoCall() {
    document.getElementById('videoSection').classList.remove('hidden');
    
    if (isAdmin) {
        showAdminFakeVideo();
    } else {
        await startRealVideoCall();
    }
}

function showAdminFakeVideo() {
    const fakeVideo = document.getElementById('adminFakeVideo');
    document.getElementById('localVideo').style.display = 'none';
    fakeVideo.classList.remove('hidden');
    
    const randomVideo = adminVideoUrls[Math.floor(Math.random() * adminVideoUrls.length)];
    fakeVideo.src = randomVideo || 'video1.mp4';
}

async function startRealVideoCall() {
    try {
        agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        await agoraClient.join(AGORA_APP_ID, activeChat.id, null, currentUser.uid);
        
        localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
        
        localTracks.videoTrack.play('localVideo');
        await agoraClient.publish([localTracks.audioTrack, localTracks.videoTrack]);
        
        agoraClient.on('user-published', async (user, mediaType) => {
            await agoraClient.subscribe(user, mediaType);
            if (mediaType === 'video') {
                const remoteDiv = document.createElement('div');
                remoteDiv.id = `player-${user.uid}`;
                remoteDiv.style = 'width:200px;height:150px;background:#222;border-radius:10px;';
                document.getElementById('remoteVideos').appendChild(remoteDiv);
                user.videoTrack.play(`player-${user.uid}`);
            }
            if (mediaType === 'audio') {
                user.audioTrack.play();
            }
        });
    } catch (error) {
        console.error('Video call error:', error);
        alert('Could not start video call');
    }
}

async function endCall() {
    document.getElementById('videoSection').classList.add('hidden');
    
    if (isAdmin) {
        const fakeVideo = document.getElementById('adminFakeVideo');
        fakeVideo.pause();
        fakeVideo.src = '';
        fakeVideo.classList.add('hidden');
        document.getElementById('localVideo').style.display = 'block';
    } else {
        if (localTracks.audioTrack) localTracks.audioTrack.close();
        if (localTracks.videoTrack) localTracks.videoTrack.close();
        document.getElementById('remoteVideos').innerHTML = '';
        if (agoraClient) await agoraClient.leave();
    }
}

// ====================================
// ADMIN VIDEO PANEL
// ====================================
function toggleAdminPanel() {
    const content = document.querySelector('.admin-panel-content');
    const btn = document.querySelector('.collapse-btn');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        btn.textContent = '−';
    } else {
        content.style.display = 'none';
        btn.textContent = '+';
    }
}

function loadAdminVideos() {
    if (localStorage.getItem('adminVideos')) {
        const videos = JSON.parse(localStorage.getItem('adminVideos'));
        document.getElementById('videoUrl1').value = videos[0] || '';
        document.getElementById('videoUrl2').value = videos[1] || '';
        document.getElementById('videoUrl3').value = videos[2] || '';
    }
}

function saveAdminVideos() {
    const url1 = document.getElementById('videoUrl1').value.trim();
    const url2 = document.getElementById('videoUrl2').value.trim();
    const url3 = document.getElementById('videoUrl3').value.trim();
    
    const videos = [
        convertGoogleDriveLink(url1),
        convertGoogleDriveLink(url2),
        convertGoogleDriveLink(url3)
    ].filter(url => url !== '');
    
    if (videos.length === 0) {
        alert('Please add at least one video URL!');
        return;
    }
    
    adminVideoUrls = videos;
    localStorage.setItem('adminVideos', JSON.stringify(videos));
    alert('✅ Videos saved successfully!');
}

function convertGoogleDriveLink(url) {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/uc?export=download&id=${match[1]}`;
        }
    }
    return url;
}
