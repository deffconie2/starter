/* Konfiguracja tablicy.
   firebase: null  -> tryb demo, dane tylko w tej przeglądarce.
   firebase: {...} -> wspólna tablica dla zespołu (config z konsoli Firebase, patrz README).
   emails: przypisuje konto do osoby (małymi literami), żeby nie trzeba było wybierać „Kim jesteś?”. */
window.ODPRAWY_CONFIG={
  firebase:{
    apiKey:"AIzaSyDAqHRR_hrpgGBCwD8IeEB-iqlZ9zk8HoQ",
    authDomain:"tablica-odpraw.firebaseapp.com",
    projectId:"tablica-odpraw",
    storageBucket:"tablica-odpraw.firebasestorage.app",
    messagingSenderId:"215706217288",
    appId:"1:215706217288:web:779517ad3e8b73d0be617d",
  },
  emails:{
    // "paula@...":"paula",
    // "kamil@...":"kamil",
    // "michal.chmielewski@...":"michal",
  },
};
