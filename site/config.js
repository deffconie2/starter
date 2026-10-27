/* Konfiguracja tablicy.
   firebase: null  -> tryb demo, dane tylko w tej przeglądarce.
   firebase: {...} -> wspólna tablica dla zespołu (wklej config z konsoli Firebase, patrz README).
   emails: przypisuje konto do osoby, żeby nie trzeba było wybierać „Kim jesteś?”. */
window.ODPRAWY_CONFIG={
  firebase:null,
  // firebase:{
  //   apiKey:"...",
  //   authDomain:"twoj-projekt.firebaseapp.com",
  //   projectId:"twoj-projekt",
  //   appId:"...",
  // },
  emails:{
    // "paula@example.com":"paula",
    // "kamil@example.com":"kamil",
    // "michal@example.com":"michal",
  },
};
