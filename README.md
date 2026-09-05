# Kunskapskampen

Flerspelar-frågesport på svenska för 2–4 spelare, designad för Full HD (1920x1080), paketerad som Docker-container.

## Köra

```bash
docker compose up --build
```

Öppna http://localhost:8101

Utan Docker (kräver Node >= 18):

```bash
npm install
npm start
```

## Spelregler

- 2–4 spelare, varje spelare har sin panel i ett hörn av skärmen.
- Vid varje tur snurrar ett kategorihjul med alla kategorier och landar på turens kategori.
- Varje fråga har en **nedräkningstimer med pendelltick**: 30 sekunder för den som först får frågan, 15 sekunder när frågan gått vidare.
- Utgår tiden räknas det som fel svar: frågan går vidare till nästa spelare (som kan stjäla 0,5 p); har alla svarat fel eller får timeout slängs frågan.
- Frågan visas med tre svarsalternativ (klick eller tangent 1/2/3) – eller sex alternativ (tangent 1–6) om svårighetsgraden Geni valts.
- Rätt svar på första försöket: **1 poäng**, turen går vidare med ny kategori.
- Fel svar: **buzzer-ljud**, 0 poäng, samma fråga går vidare till nästa spelare.
- Rätt svar på vidarebefordrad fråga: **0,5 poäng**, turen går vidare med ny kategori.
- Före start väljs antal spelare (2–4), svårighetsgrad och målpoäng (10–30, standard 20).
- Spelet slutar när någon når målpoängtalet; aktuellt varv spelas klart.
- Flera spelare över målpoängen efter avslutat varv avgörs med **utslagsfrågor på Elit-nivå** tills en vinnare återstår (30 s första frågaren, 15 s övriga; timeout = utslagen).
- **Paus**: klicka på Paus-knappen i HUD eller tryck **P/Esc** – timern, hjulet, väntan och tick-ljudet fryser och återstående tid bevaras.
- **Avbryt**: via pausmenyn (kräver bekräftelse) eller "Till menyn" på vinnarskärmen – spelet avslutas och menyn visas med spelarnamnen ifyllda.

## Svårighetsgrader

Global inställning före spelets start: **Lätt**, **Medel**, **Svår**, **Elit** eller **Geni**.

- **Geni**: extremt svåra frågor på ~140 IQ-nivå som alltid visas med **sex svarsalternativ**.
- Kategorin **Elit** innehåller alltid elitefrågor oberoende av den globala svårighetsgraden – utom när Geni valts (då serveras Geni-frågor även i Elit-kategorin).

## Kategorier

Natur, Teknik, Ljud, Musik, Bilar, Geografi, Musik från förr, Barnprogram, Dans, Brädspel, Elit.

## Frågebank

Frågorna lagras i SQLite (`better-sqlite3`) och seedas vid start från JSON-filer i `server/seed/fragor/` med namn `<kategori>.<svårighetsgrad>.json` (t.ex. `natur.latt.json`).

Format per fråga:

```json
{ "q": "Frågan?", "a": "Rätt svar", "w1": "Fel svar 1", "w2": "Fel svar 2" }
```

Geni-frågor (`<kategori>.geni.json`) kräver fem felaktiga alternativ och visas med sex svarsalternativ:

```json
{ "q": "Frågan?", "a": "Rätt svar", "w1": "Fel 1", "w2": "Fel 2", "w3": "Fel 3", "w4": "Fel 4", "w5": "Fel 5" }
```

Databasen seedas om automatiskt när antalet frågor i filerna skiljer sig från databasens. Frågebanken innehåller **60 frågor per kategori och svårighetsgrad**, totalt **3 120 frågor** (Elit-kategorin har bara Elit- och Geni-nivåerna eftersom övriga nivåer ändå alltid pekas om till elit där). Frågor återanvänds inte inom en session – poolen återställs automatiskt när den tar slut. Databasen migreras automatiskt med kolumner `wrong3`–`wrong5` och namnbytet mensa→geni vid uppgradering från äldre versioner.

## Teknik

- Backend: Node.js + Express + SQLite (better-sqlite3)
- Frontend: Vanilla HTML/CSS/JS, skalad 1920x1080-scen
- Ljud: Web Audio API (syntetiserade ljud, inga filer)
- Docker: node:22-bookworm-slim, databas i volumen `kk-data`

## API

- `GET /api/question?category=<kat>&difficulty=<nivå>` – slumpad fråga med blandade alternativ
- `POST /api/reset-used` – nollställer använda frågor
- `GET /api/meta` – kategorier, svårighetsgrader, frågeantal
