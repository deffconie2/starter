/* Konfiguracja tablicy.
   firebase: null  -> tryb demo, dane tylko w tej przeglądarce.
   firebase: {...} -> wspólna tablica dla zespołu (config z konsoli Firebase, patrz README).
   emails: przypisuje konto do osoby. Klucz to SHA-256 e-maila małymi literami (repo jest publiczne,
           więc bez jawnych adresów): printf '%s' 'jan.kowalski@urw.com' | sha256sum */
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
    "2b6fe33347aed09724c29c9dc280250d77592f7b5837f859323326c99313f8cf":"michal",
    "314c7135e6bb911876e61ddf546cdd438a2e0c65cf1ff028368440bd9e399055":"paula",
    "35888fcbb3935dce44e16e55b51a15cc3eb8990e7f79c618148ac484a60d32e2":"kamil",
  },
};
