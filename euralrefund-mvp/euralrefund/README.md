# EU Rail Refund — MVP

Automatisk togkompensation under EU-forordning 2021/782 og 2024/949.

## Deploy på 5 minutter

### 1. Opret GitHub repo

Gå på github.com/new og opret et nyt **public** repo kaldet `euralrefund`.

### 2. Upload filerne

```bash
# Download og unzip projektet, åbn terminal i mappen, kør:
git init
git add .
git commit -m "Initial MVP"
git branch -M main
git remote add origin https://github.com/2026in2026/euralrefund.git
git push -u origin main
```

### 3. Deploy på Vercel

1. Gå på [vercel.com](https://vercel.com)
2. Klik **"Add New Project"**
3. Vælg dit `euralrefund` repo
4. Klik **Deploy** — Vercel finder automatisk Next.js og Python

Din app er live på `euralrefund.vercel.app` inden for 2 minutter.

## Struktur

```
euralrefund/
├── pages/
│   ├── index.jsx          ← Hele frontend-appen
│   ├── _app.jsx           ← Next.js app wrapper
│   └── api/
│       └── generate-pdfs.py  ← PDF-generering (Python/ReportLab)
├── styles/
│   └── globals.css
├── requirements.txt       ← reportlab
├── next.config.js
├── vercel.json            ← Python runtime config
└── package.json
```

## Hvad appen gør

1. Bruger uploader togbillet (PDF/billede)
2. Claude AI læser og auto-udfylder rejsedetaljer
3. Bruger vælger forsinkelse og bekræfter data
4. Systemet beregner kompensation (EU 2021/782)
5. Bruger udfylder personoplysninger og underskriver digitalt
6. To PDF-filer genereres og downloades:
   - **EU-blanket** (Forordning 2024/949) — officiel kompensationsformular
   - **Fuldmagt** — bemyndiger EU Rail Refund ApS til at indsende

## Tech stack

- **Frontend**: Next.js 14 + React
- **PDF-generering**: Python + ReportLab (Vercel serverless)
- **AI**: Anthropic Claude API (billetlæsning)
- **Hosting**: Vercel (gratis plan)
