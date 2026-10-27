# Tablica odpraw

Wspólna tablica zadań i notatek z odpraw zespołu (Paula, Kamil, Michał): kolumny Pilne / Ważne / Bieżące, terminy, komentarze, rotacja prowadzącego odprawę, punkty i odznaki.

Strona to czysty HTML/JS w katalogu `site/` — bez builda.

## Uruchomienie lokalnie

```bash
cd site && python3 -m http.server 8080
# http://localhost:8080
```

Bez konfiguracji działa **tryb demo**: dane zapisują się tylko w tej przeglądarce (localStorage).

## Wspólna tablica dla zespołu (Firebase, ~15 min, plan darmowy)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Dodaj projekt** (Analytics niepotrzebne).
2. **Build → Authentication → Get started → Email/Password → Enable**.
   W zakładce **Users** dodaj 3 konta (e-mail + hasło) dla zespołu.
3. **Build → Firestore Database → Create database** (region `eur3` / `europe-central2`, tryb produkcyjny).
   W zakładce **Rules** wklej zawartość `firestore.rules` z prawdziwymi e-mailami → **Publish**.
4. **Project settings → Your apps → Web (`</>`)** → zarejestruj aplikację, skopiuj obiekt `firebaseConfig`
   i wklej go w `site/config.js` w miejsce `firebase:null`. Uzupełnij `emails` (małymi literami), żeby każdy był od razu przypisany do siebie.
5. **Authentication → Settings → Authorized domains** → dodaj domenę strony (np. `deffconie2.github.io`).

`apiKey` z Firebase nie jest sekretem — dostęp chronią reguły Firestore (tylko e-maile z listy).

## Publikacja na GitHub Pages

Repo → **Settings → Pages → Source: GitHub Actions**. Każdy push zmieniający `site/` publikuje stronę
(workflow `.github/workflows/pages.yml`). Adres: `https://<użytkownik>.github.io/<repo>/`.
