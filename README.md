# Kunskapskampen

Flerspelar-frågesport på svenska för 2–5 spelare, designad för Full HD (1920x1080), paketerad som Docker-container.

## Köra

```bash
docker compose up --build
```

Öppna http://localhost:8080

Utan Docker (kräver Node >= 18):

```bash
npm install
npm start
```

## Spelregler

- 2–5 spelare, varje spelare har sin panel i ett hörn av skärmen.
- Vid varje tur slumpas en kategori som visas innan frågan.
- Frågan visas med tre svarsalternativ (klick eller tangent 1/2/3).
- Rätt svar på första försöket: **1 poäng**, turen går vidare med ny kategori.
- Fel svar: **buzzer-ljud**, 0 poäng, samma fråga går vidare till nästa spelare.
- Rätt svar på vidarebefordrad fråga: **0,5 poäng**, turen går vidare med ny kategori.
- Spelet slutar när någon når minst 20 poäng; aktuellt varv spelas klart.
- Flera spelare över 20 poäng efter avslutat varv avgörs med **utslagsfrågor på Elit-nivå** tills en vinnare återstår.

## Svårighetsgrader

Global inställning före spelets start: **Lätt**, **Medel**, **Svår** eller **Elit**.

Kategorin **Elit** innehåller alltid elitefrågor oberoende av den globala svårighetsgraden.

## Kategorier

Natur, Teknik, Ljud, Musik, Bilar, Geografi, Musik från förr, Barnprogram, Dans, Brädspel, Elit.

## Frågebank

Frågorna lagras i SQLite (`better-sqlite3`) och seedas vid start från JSON-filer i `server/seed/fragor/` med namn `<kategori>.<svårighetsgrad>.json` (t.ex. `natur.latt.json`).

Format per fråga:

```json
{ "q": "Frågan?", "a": "Rätt svar", "w1": "Fel svar 1", "w2": "Fel svar 2" }
```

Databasen seedas om automatiskt när antalet frågor i filerna skiljer sig från databasens. Frågebanken innehåller 40 frågor per svårighetsgrad och kategori (1 640 totalt; för Elit-kategorin endast elit-nivån). Frågor återanvänds inte inom en session – poolen återställs automatiskt när den tar slut.

## Teknik

- Backend: Node.js + Express + SQLite (better-sqlite3)
- Frontend: Vanilla HTML/CSS/JS, skalad 1920x1080-scen
- Ljud: Web Audio API (syntetiserade ljud, inga filer)
- Docker: node:22-bookworm-slim, databas i volumen `kk-data`

## API

- `GET /api/question?category=<kat>&difficulty=<nivå>` – slumpad fråga med blandade alternativ
- `POST /api/reset-used` – nollställer använda frågor
- `GET /api/meta` – kategorier, svårighetsgrader, frågeantal
