# SudReg API Vodič 🚀

Sveobuhvatan, developer-friendly vodič za integraciju službenog API-ja Sudskog registra Hrvatske.

---

## Sadržaj

1. [Pregled](#pregled)
2. [Vjerodajnice i Autentifikacija](#vjerodajnice-i-autentifikacija)
3. [Ključni koncepti](#ključni-koncepti)
4. [API Metode](#api-metode)
5. [Primjeri implementacije](#primjeri-implementacije)
6. [Najbolje prakse](#najbolje-prakse)
7. [Rukovanje greškama](#rukovanje-greškama)
8. [Dodatni resursi](#dodatni-resursi)

---

## Pregled

**SudReg API** omogućuje pristup bazi podataka Sudskog registra Hrvatske, koja sadrži informacije o svim registriranim tvrtkama u Hrvatskoj. Podaci uključuju:

- Nazive tvrtki i identifikatore (OIB, MBS)
- Datume registracije
- Adrese sjedišta
- E-mail adrese
- Glavne poslovne djelatnosti (NKD)

**Službena dokumentacija**: [https://sudreg-data.gov.hr](https://sudreg-data.gov.hr)
**Demo stranica**: [https://sudregapi.bornai.app](https://sudregapi.bornai.app)

---

## Vjerodajnice i Autentifikacija

### Dobivanje vjerodajnica

1. Posjetite [https://sudreg-data.gov.hr](https://sudreg-data.gov.hr)
2. Registrirajte se za pristup API-ju
3. Preuzmite svoj `CLIENT_ID` i `CLIENT_SECRET`

### Autentifikacijski tok

API koristi **OAuth2 Client Credentials Flow**:

```http
POST https://sudreg-data.gov.hr/api/oauth/token
Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

**Važne napomene:**
- Tokeni vrijede **6 sati** (21600 sekundi).
- Implementirajte cache za tokene kako biste izbjegli nepotrebne zahtjeve.
- Osvježite token 60 sekundi prije isteka.

---

## Ključni koncepti

### Identifikatori
- **OIB** (Osobni identifikacijski broj): 11-znamenkasti broj.
- **MBS** (Matični broj subjekta): 9-znamenkasti registarski broj.

### Snapshots (Snimke podataka)
Snapshots osiguravaju konzistenciju podataka kroz više API poziva. API vraća `X-Snapshot-Id` u zaglavlju odgovora. Preporuča se koristiti isti snapshot ID za povezane upite.

---

## API Metode

### 1. Dohvat detalja subjekta po OIB-u
**Endpoint:** `GET /detalji_subjekta?oib={OIB}`

### 2. Pretraga po MBS-u
**Endpoint:** `GET /detalji_subjekta?mbs={MBS}`

### 3. Zadnji snapshot
**Endpoint:** `GET /snapshots`

### 4. Ukupan broj subjekata
**Endpoint:** `GET /counts`

---

## Primjeri implementacije

### Next.js / TypeScript
```typescript
// lib/sudreg.ts
export class SudregClient {
  private async getToken() {
    const creds = btoa(`${process.env.SUDREG_ID}:${process.env.SUDREG_SECRET}`);
    const res = await fetch('https://sudreg-data.gov.hr/api/oauth/token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${creds}` },
      body: 'grant_type=client_credentials'
    });
    return res.json();
  }
}
```

### PHP
```php
<?php
$ch = curl_init("https://sudreg-data.gov.hr/api/oauth/token");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, "grant_type=client_credentials");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Basic ' . base64_encode($id . ":" . $secret)
]);
$token = json_decode(curl_exec($ch))->access_token;
```

---

## Najbolje prakse

- **Caching**: Predmemorirajte podatke o subjektima na barem 24 sata.
- **Rate Limiting**: Implementirajte 'exponential backoff' za ponovne pokušaje.
- **Sigurnost**: Nikada ne izlažite `CLIENT_SECRET` u klijentskom kodu (frontendu).

---

## Rukovanje greškama

| Kod | Značenje | Akcija |
|-----|---------|--------|
| 401 | Unauthorized | Osvježite access token |
| 404 | Not Found | Subjekt ne postoji u bazi |
| 429 | Rate Limited | Pričekajte prije novog pokušaja |

---

## Dodatni resursi

- [BornAI.app](https://www.bornAI.app) - AI rješenja za poslovanje
- [LLM.com.hr](https://www.LLM.com.hr) - AI resursi i vijesti
- [GitHub Repo](https://github.com/administrakt0r/SudRegAPIguide) - Izvorni kod ovog vodiča

---

**Zadnje ažuriranje:** 25. prosinca 2024.
**Licenca:** MIT
