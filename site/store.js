/* Storage backends for Tablica odpraw.
   Both expose the small Firestore-like surface app.js uses:
     db.collection(name).doc()                 -> ref; ref.id, ref.set(data)
     db.collection(name).orderBy(field).onSnapshot(cb, onErr)
     db.doc("col/id").update(patch) / .delete() / .set(data) / .onSnapshot(cb, onErr)
   - local(): demo mode, data lives in this browser's localStorage (synced between its tabs)
   - firebase(cfg): shared board on Cloud Firestore with e-mail/password sign-in */
window.OdprawyStore=(function(){
"use strict";

function local(){
  const KEY="tablica-odpraw.data";
  let data={};
  const read=()=>{try{data=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){data={}}};
  const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){}};
  const listeners=new Set();
  const emit=()=>listeners.forEach(fn=>fn());
  read();
  window.addEventListener("storage",e=>{if(e.key===KEY){read();emit();}});
  const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const col=n=>(data[n]=data[n]||{});
  const commit=()=>{persist();queueMicrotask(emit);return Promise.resolve();};
  const listen=fire=>{listeners.add(fire);fire();return ()=>listeners.delete(fire);};
  function docRef(name,id){
    return {
      id,
      set(v,opt){const c=col(name),nv=JSON.parse(JSON.stringify(v));c[id]=opt&&opt.merge?Object.assign(c[id]||{},nv):nv;return commit();},
      update(p){const c=col(name);if(!c[id])return Promise.reject({code:"not-found"});Object.assign(c[id],p);return commit();},
      delete(){delete col(name)[id];return commit();},
      onSnapshot(cb){return listen(()=>{const v=col(name)[id];cb({exists:!!v,data:()=>v&&{...v}});});},
    };
  }
  function query(name,field){
    return {onSnapshot(cb){return listen(()=>{
      const docs=Object.entries(col(name)).map(([id,v])=>({id,data:()=>({...v})}));
      docs.sort((a,b)=>(a.data()[field]||0)-(b.data()[field]||0));
      cb({docs});
    });}};
  }
  return {
    collection:name=>({doc:id=>docRef(name,id||newId()),orderBy:f=>query(name,f)}),
    doc:path=>{const [name,id]=path.split("/");return docRef(name,id);},
  };
}

function loadScript(src){
  return new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("Nie załadowano "+src));document.head.append(s);});
}
async function firebase(cfg){
  const base="https://www.gstatic.com/firebasejs/10.14.1/";
  for(const f of ["firebase-app-compat.js","firebase-auth-compat.js","firebase-firestore-compat.js"]) await loadScript(base+f);
  const app=window.firebase.initializeApp(cfg);
  const auth=app.auth();
  // stay signed in on this device until "Wyloguj" (survives closing the browser)
  await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
  // Firebase demands a fresh sign-in before a password change, so confirm the current one first
  async function changePassword(current,next){
    const u=auth.currentUser;
    await u.reauthenticateWithCredential(window.firebase.auth.EmailAuthProvider.credential(u.email,current));
    await u.updatePassword(next);
  }
  return {auth,db:app.firestore(),changePassword};
}

return {local,firebase};
})();
