// FIREBASE CONFIG
firebase.initializeApp({
    apiKey:"AIzaSyCU0Agq1CTsKS2YbO-mzXr2jOseQ49bp8k",
    authDomain:"vibechatapp-504eb.firebaseapp.com",
    projectId:"vibechatapp-504eb",
    storageBucket:"vibechatapp-504eb.firebasestorage.app",
    messagingSenderId:"447918097803",
    appId:"1:447918097803:web:b8d23000ff41b915eedb8e"
});
const auth=firebase.auth();
const db=firebase.firestore();
const st=firebase.storage();

// CONSTANTS
const AGORA="3b9822e28fc04a8bbccfc78314fda8f4";
const ADMIN="vibeadmin123";

// GLOBALS
let me,admin=false,chat,unsub,vids=localStorage.vids?JSON.parse(localStorage.vids):[],ag,tr={v:null,a:null};

// HELPERS
const $=(id)=>document.getElementById(id);
const h=(id)=>$(id).classList.add('hide');
const s=(id)=>$(id).classList.remove('hide');
const v=(id)=>$(id).value.trim();

// AUTH
auth.onAuthStateChanged(u=>u?init(u.uid):(h('main'),s('auth')));

function toSignup(){h('login');s('signup');}
function toLogin(){h('signup');s('login');}

function prev(){
    const f=$('sf').files[0];
    if(f){
        const r=new FileReader();
        r.onload=e=>$('prev').innerHTML=`<img src="${e.target.result}">`;
        r.readAsDataURL(f);
    }
}

async function signup(){
    const n=v('sn'),e=v('se'),p=v('sp'),f=$('sf').files[0];
    if(!n||!e||!p)return alert('Fill all fields');
    if(p.length<6)return alert('Password min 6 chars');
    try{
        const c=await auth.createUserWithEmailAndPassword(e,p);
        let pic=`https://ui-avatars.com/api/?name=${n}&size=200`;
        if(f){
            const r=st.ref(`pics/${c.user.uid}`);
            await r.put(f);
            pic=await r.getDownloadURL();
        }
        await db.collection('users').doc(c.user.uid).set({
            uid:c.user.uid,
            name:n,
            email:e,
            pic,
            t:firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('✅ Account created!');
    }catch(x){alert(x.message);}
}

async function login(){
    const e=v('le'),p=v('lp'),k=v('ak');
    if(!e||!p)return alert('Enter email & password');
    if(k===ADMIN)admin=true;
    try{await auth.signInWithEmailAndPassword(e,p);}
    catch(x){alert(x.message);}
}

function logout(){auth.signOut();admin=false;chat=null;}

async function init(uid){
    const d=await db.collection('users').doc(uid).get();
    if(!d.exists)return;
    me=d.data();
    $('mn').textContent=me.name;
    $('mp').src=me.pic;
    if(admin){s('ab');s('av');loadV();}
    h('auth');s('main');loadChats();
}

// CHATS
function loadChats(){
    db.collection('chats').where('u','array-contains',me.uid).onSnapshot(async snap=>{
        const list=$('list');
        list.innerHTML='';
        if(snap.empty){
            list.innerHTML='<p style="padding:20px;text-align:center;color:#999">No chats yet</p>';
            return;
        }
        for(const d of snap.docs){
            const c=d.data();
            const ouid=c.u.find(id=>id!==me.uid);
            const ou=(await db.collection('users').doc(ouid).get()).data();
            const div=document.createElement('div');
            div.className='ci';
            div.onclick=()=>openChat(d.id,ou);
            div.innerHTML=`<img src="${ou.pic}"><div><strong>${ou.name}</strong><span>${c.l||'Say hi!'}</span></div>`;
            list.appendChild(div);
        }
    });
}

// FIND
function openFind(){s('find');}
function closeFind(){h('find');$('fi').value='';$('fr').innerHTML='';}

async function findU(){
    const q=v('fi').toLowerCase();
    const list=$('fr');
    if(!q){list.innerHTML='';return;}
    const snap=await db.collection('users').get();
    list.innerHTML='';
    snap.forEach(d=>{
        const u=d.data();
        if(u.uid!==me.uid&&u.name.toLowerCase().includes(q)){
            const div=document.createElement('div');
            div.className='ui';
            div.onclick=()=>startChat(u);
            div.innerHTML=`<img src="${u.pic}"><span>${u.name}</span>`;
            list.appendChild(div);
        }
    });
}

async function startChat(u){
    const users=[me.uid,u.uid].sort();
    const id=users.join('_');
    const ref=db.collection('chats').doc(id);
    const d=await ref.get();
    if(!d.exists){
        await ref.set({
            u:users,
            t:firebase.firestore.FieldValue.serverTimestamp(),
            l:null
        });
    }
    closeFind();
    openChat(id,u);
}

// CHAT
function openChat(id,u){
    chat={id,u};
    h('empty');s('active');
    $('cn').textContent=u.name;
    $('cp').src=u.pic;
    if(window.innerWidth<=768){
        $('right').classList.add('show');
        $('.bb').classList.remove('hide');
    }
    if(unsub)unsub();
    loadMsgs(id);
}

function back(){
    $('right').classList.remove('show');
    h('active');s('empty');
}

function loadMsgs(id){
    const area=$('msgs');
    unsub=db.collection('chats').doc(id).collection('m').orderBy('t','asc').onSnapshot(snap=>{
        area.innerHTML='';
        snap.forEach(d=>{
            const m=d.data();
            showMsg(m);
        });
        area.scrollTop=area.scrollHeight;
    });
}

function showMsg(m){
    const area=$('msgs');
    const div=document.createElement('div');
    div.className=`m ${m.f===me.uid?'me':'them'}`;
    let tm='Now';
    if(m.t){
        const d=m.t.toDate();
        tm=d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    }
    div.innerHTML=`<div class="b">${m.tx}<div class="t">${tm}</div></div>`;
    area.appendChild(div);
}

function ck(e){if(e.key==='Enter')send();}

async function send(){
    const txt=v('mi');
    if(!txt||!chat)return;
    await db.collection('chats').doc(chat.id).collection('m').add({
        tx:txt,
        f:me.uid,
        t:firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('chats').doc(chat.id).update({
        l:txt,
        lt:firebase.firestore.FieldValue.serverTimestamp()
    });
    $('mi').value='';
}

// VIDEO
async function call(){
    s('vid');
    admin?fakeVid():realVid();
}

function fakeVid(){
    const vid=$('fv');
    h('lv');s('fv');
    const v=vids[Math.floor(Math.random()*vids.length)];
    vid.src=v||'';
}

async function realVid(){
    try{
        ag=AgoraRTC.createClient({mode:"rtc",codec:"vp8"});
        await ag.join(AGORA,chat.id,null,me.uid);
        tr.a=await AgoraRTC.createMicrophoneAudioTrack();
        tr.v=await AgoraRTC.createCameraVideoTrack();
        tr.v.play('lv');
        await ag.publish([tr.a,tr.v]);
        ag.on('user-published',async(user,type)=>{
            await ag.subscribe(user,type);
            if(type==='video'){
                const div=document.createElement('div');
                div.id=`r-${user.uid}`;
                div.style='width:100%;height:100%';
                $('rv').appendChild(div);
                user.videoTrack.play(div.id);
            }
            if(type==='audio')user.audioTrack.play();
        });
    }catch(e){alert('Video error');}
}

async function endC(){
    h('vid');
    if(admin){
        const vid=$('fv');
        vid.pause();
        vid.src='';
        h('fv');s('lv');
    }else{
        if(tr.a)tr.a.close();
        if(tr.v)tr.v.close();
        $('rv').innerHTML='';
        if(ag)await ag.leave();
    }
}

// ADMIN
function loadV(){
    if(localStorage.vids){
        const v=JSON.parse(localStorage.vids);
        $('v1').value=v[0]||'';
        $('v2').value=v[1]||'';
        $('v3').value=v[2]||'';
    }
}

function saveV(){
    const v1=v('v1'),v2=v('v2'),v3=v('v3');
    const arr=[fix(v1),fix(v2),fix(v3)].filter(x=>x);
    if(arr.length===0)return alert('Add at least 1 video');
    vids=arr;
    localStorage.vids=JSON.stringify(arr);
    alert('✅ Videos saved!');
}

function fix(url){
    if(!url)return'';
    if(url.includes('drive.google.com')){
        const m=url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if(m&&m[1])return`https://drive.google.com/uc?export=download&id=${m[1]}`;
    }
    return url;
}
