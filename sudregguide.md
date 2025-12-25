# Sudreg API Integration Guide

Complete guide for integrating the Croatian Court Registry (Sudski registar) API into any framework.

---

## Table of Contents

1. [Overview](#overview)
2. [API Credentials & Authentication](#api-credentials--authentication)
3. [Core Concepts](#core-concepts)
4. [API Methods](#api-methods)
5. [Implementation Examples](#implementation-examples)
   - [Next.js / React](#nextjs--react)
   - [PHP](#php)
   - [Angular](#angular)
   - [Node.js / Express](#nodejs--express)
6. [Best Practices](#best-practices)
7. [Error Handling](#error-handling)
8. [Rate Limiting & Performance](#rate-limiting--performance)

---

## Overview

The **Sudreg API** provides access to the Croatian Court Registry database, containing information about all registered companies in Croatia. This includes:

- Company names and identifiers (OIB, MBS)
- Registration dates
- Business addresses
- Email addresses
- Primary business activities (djelatnost)

**Official Documentation**: https://sudreg-data.gov.hr

---

## API Credentials & Authentication

### Getting Credentials

1. Visit https://sudreg-data.gov.hr
2. Register for API access
3. Obtain your `CLIENT_ID` and `CLIENT_SECRET`

### Authentication Flow

The API uses **OAuth2 Client Credentials Flow**:

```
POST https://sudreg-data.gov.hr/api/oauth/token
Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 21600
}
```

**Important Notes:**
- Tokens expire after **6 hours** (21600 seconds)
- Implement token caching to avoid unnecessary requests
- Refresh tokens 60 seconds before expiry to prevent edge cases

---

## Core Concepts

### Key Identifiers

- **OIB** (Osobni identifikacijski broj): 11-digit tax identification number
- **MBS** (Matični broj subjekta): 9-digit registry number

### Data Tables

The API exposes several tables:

- `subjekti` - Core company data (OIB, MBS, founding date, status)
- `tvrtke` - Company names
- `email_adrese` - Email addresses
- `sjedista` - Registered addresses
- `snapshots` - Data snapshots for consistency

### Snapshots

Snapshots ensure data consistency across multiple API calls:
- Each snapshot has a unique `snapshot_id`
- Use the same snapshot ID for related queries
- The API returns `X-Snapshot-Id` in response headers
- Fresh snapshots have `staleness: 1`

---

## API Methods

### Base URL
```
https://sudreg-data.gov.hr/api/javni
```

### 1. Get Latest Snapshot

**Endpoint:** `GET /snapshots`

**Purpose:** Get the latest data snapshot for consistent queries

**Example Response:**
```json
[
  {
    "snapshot_id": 12345,
    "timestamp": "2025-12-25T00:00:00Z",
    "available_until": "2025-12-26T00:00:00Z",
    "staleness": 1
  }
]
```

### 2. Get Total Counts

**Endpoint:** `GET /counts`

**Purpose:** Get total number of records in each table

**Example Response:**
```json
[
  {
    "table_name": "SRC_SUBJEKTI",
    "count_aktivni": 185000,
    "count_ukupno": 200000
  },
  {
    "table_name": "SRC_EMAIL_ADRESE",
    "count_aktivni": 136000
  }
]
```

### 3. Get Company by OIB

**Endpoint:** `GET /detalji_subjekta?oib={OIB}`

**Purpose:** Fetch complete company details by OIB

**Example:**
```
GET /detalji_subjekta?oib=12345678901
```

**Response:**
```json
{
  "subjekt": {
    "mbs": 123456789,
    "oib": 12345678901,
    "datum_osnivanja": "2020-01-15T00:00:00Z",
    "status": 1,
    "glavna_djelatnost": 6201
  },
  "tvrtka": {
    "ime": "EXAMPLE d.o.o.",
    "naznaka_imena": "EXAMPLE"
  },
  "sjediste": {
    "ulica": "Ilica",
    "kucni_broj": 123,
    "naziv_naselja": "Zagreb"
  },
  "email_adrese": [
    {
      "adresa": "info@example.hr"
    }
  ]
}
```

### 4. Get Company by MBS

**Endpoint:** `GET /detalji_subjekta?mbs={MBS}`

**Purpose:** Fetch complete company details by MBS

**Example:**
```
GET /detalji_subjekta?mbs=123456789
```

### 5. Get Recent Companies

**Endpoint:** `GET /subjekti?offset={offset}&limit={limit}&only_active=true`

**Purpose:** Fetch companies registered within a specific timeframe

**Parameters:**
- `offset` - Starting position (use high offset for recent companies)
- `limit` - Number of records (max 500 recommended)
- `only_active` - Filter to active companies only

**Strategy for Recent Companies:**

Since companies are roughly ordered by registration date, newest companies are at the highest offsets:

1. Get total count from `/counts`
2. Calculate starting offset: `totalCount - batchSize`
3. Fetch batches working backwards
4. Filter by `datum_osnivanja` date

---

## Implementation Examples

### Next.js / React

#### 1. Create the Sudreg Client

**File:** `lib/sudreg-client.ts`

```typescript
interface Company {
  oib: string;
  mbs: string;
  naziv: string;
  kratki_naziv?: string;
  email?: string;
  adresa?: string;
  mjesto?: string;
  datum_osnivanja: string;
  djelatnost?: string;
}

class SudregClient {
  private baseUrl = 'https://sudreg-data.gov.hr/api/javni';
  private tokenUrl = 'https://sudreg-data.gov.hr/api/oauth/token';
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.clientId = process.env.SUDREG_CLIENT_ID || '';
    this.clientSecret = process.env.SUDREG_CLIENT_SECRET || '';
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Get new token
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString('base64');

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // Expire 60 seconds early
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

    return this.accessToken;
  }

  async getCompanyByOib(oib: string): Promise<Company | null> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/detalji_subjekta?oib=${oib}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const subj = data.subjekt || data;
    const tvrtka = data.tvrtka || data.tvrtke?.[0];
    const sjediste = data.sjediste || data.sjedista?.[0];
    const email = data.email_adrese?.[0];

    if (!tvrtka) return null;

    const address = sjediste
      ? `${sjediste.ulica || ''} ${sjediste.kucni_broj || ''}`.trim()
      : undefined;

    return {
      oib: String(subj.oib).padStart(11, '0'),
      mbs: String(subj.mbs).padStart(9, '0'),
      naziv: tvrtka.ime || tvrtka.naziv,
      kratki_naziv: tvrtka.naznaka_imena,
      email: email?.adresa,
      adresa: address,
      mjesto: sjediste?.naziv_naselja,
      datum_osnivanja: subj.datum_osnivanja?.split('T')[0] || '',
      djelatnost: subj.glavna_djelatnost 
        ? String(subj.glavna_djelatnost) 
        : undefined,
    };
  }

  async getRecentCompanies(days: number = 7): Promise<Company[]> {
    const token = await this.getAccessToken();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get total count
    const countsRes = await fetch(`${this.baseUrl}/counts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    const counts = await countsRes.json();
    const totalCount = counts.find(
      (c: any) => c.table_name === 'SRC_SUBJEKTI'
    )?.count_aktivni || 180000;

    // Fetch from high offset (newest companies)
    const offset = Math.max(0, totalCount - 500);
    const subjRes = await fetch(
      `${this.baseUrl}/subjekti?offset=${offset}&limit=500&only_active=true`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    const subjects = await subjRes.json();

    // Filter by date
    const recent = subjects.filter((s: any) => {
      if (!s.datum_osnivanja) return false;
      return new Date(s.datum_osnivanja) >= cutoffDate;
    });

    // Fetch details for each company
    const companies = await Promise.all(
      recent.map((s: any) => this.getCompanyByMbs(String(s.mbs)))
    );

    return companies.filter((c): c is Company => c !== null);
  }
}

export const sudregClient = new SudregClient();
export type { Company };
```

#### 2. Create API Route

**File:** `app/api/companies/recent/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { sudregClient } from '@/lib/sudreg-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const companies = await sudregClient.getRecentCompanies(days);

    return NextResponse.json({
      success: true,
      count: companies.length,
      companies,
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
```

#### 3. Environment Variables

**File:** `.env.local`

```bash
SUDREG_CLIENT_ID=your_client_id_here
SUDREG_CLIENT_SECRET=your_client_secret_here
```

#### 4. Usage in Components

```typescript
'use client';

import { useState, useEffect } from 'react';

interface Company {
  naziv: string;
  oib: string;
  email?: string;
  datum_osnivanja: string;
}

export default function RecentCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/companies/recent?days=7')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCompanies(data.companies);
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Recently Registered Companies</h2>
      <ul>
        {companies.map(company => (
          <li key={company.oib}>
            <strong>{company.naziv}</strong>
            <br />
            OIB: {company.oib}
            <br />
            Founded: {company.datum_osnivanja}
            {company.email && <><br />Email: {company.email}</>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

### PHP

#### 1. Create Sudreg Client Class

**File:** `SudregClient.php`

```php
<?php

class SudregClient {
    private $baseUrl = 'https://sudreg-data.gov.hr/api/javni';
    private $tokenUrl = 'https://sudreg-data.gov.hr/api/oauth/token';
    private $clientId;
    private $clientSecret;
    private $accessToken = null;
    private $tokenExpiry = null;

    public function __construct($clientId, $clientSecret) {
        $this->clientId = $clientId;
        $this->clientSecret = $clientSecret;
    }

    private function getAccessToken() {
        // Return cached token if valid
        if ($this->accessToken && $this->tokenExpiry && time() < $this->tokenExpiry) {
            return $this->accessToken;
        }

        // Get new token
        $credentials = base64_encode($this->clientId . ':' . $this->clientSecret);
        
        $ch = curl_init($this->tokenUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Basic ' . $credentials,
            'Content-Type: application/x-www-form-urlencoded'
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials');

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception('Failed to get access token: ' . $httpCode);
        }

        $data = json_decode($response, true);
        $this->accessToken = $data['access_token'];
        // Expire 60 seconds early
        $this->tokenExpiry = time() + $data['expires_in'] - 60;

        return $this->accessToken;
    }

    public function getCompanyByOib($oib) {
        $token = $this->getAccessToken();
        
        $url = $this->baseUrl . '/detalji_subjekta?oib=' . urlencode($oib);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Accept: application/json'
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 404) {
            return null;
        }

        if ($httpCode !== 200) {
            throw new Exception('API error: ' . $httpCode);
        }

        $data = json_decode($response, true);
        
        $subj = $data['subjekt'] ?? $data;
        $tvrtka = $data['tvrtka'] ?? ($data['tvrtke'][0] ?? null);
        $sjediste = $data['sjediste'] ?? ($data['sjedista'][0] ?? null);
        $email = $data['email_adrese'][0] ?? null;

        if (!$tvrtka) {
            return null;
        }

        $address = $sjediste 
            ? trim(($sjediste['ulica'] ?? '') . ' ' . ($sjediste['kucni_broj'] ?? ''))
            : null;

        return [
            'oib' => str_pad($subj['oib'], 11, '0', STR_PAD_LEFT),
            'mbs' => str_pad($subj['mbs'], 9, '0', STR_PAD_LEFT),
            'naziv' => $tvrtka['ime'] ?? $tvrtka['naziv'],
            'kratki_naziv' => $tvrtka['naznaka_imena'] ?? null,
            'email' => $email['adresa'] ?? null,
            'adresa' => $address,
            'mjesto' => $sjediste['naziv_naselja'] ?? null,
            'datum_osnivanja' => explode('T', $subj['datum_osnivanja'] ?? '')[0],
            'djelatnost' => isset($subj['glavna_djelatnost']) 
                ? (string)$subj['glavna_djelatnost'] 
                : null,
        ];
    }

    public function getRecentCompanies($days = 7) {
        $token = $this->getAccessToken();
        $cutoffDate = new DateTime();
        $cutoffDate->modify("-{$days} days");

        // Get total count
        $countsUrl = $this->baseUrl . '/counts';
        $ch = curl_init($countsUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Accept: application/json'
        ]);
        $countsResponse = curl_exec($ch);
        curl_close($ch);

        $counts = json_decode($countsResponse, true);
        $totalCount = 180000; // Default
        foreach ($counts as $count) {
            if ($count['table_name'] === 'SRC_SUBJEKTI') {
                $totalCount = $count['count_aktivni'];
                break;
            }
        }

        // Fetch from high offset
        $offset = max(0, $totalCount - 500);
        $subjUrl = $this->baseUrl . '/subjekti?offset=' . $offset . '&limit=500&only_active=true';
        
        $ch = curl_init($subjUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Accept: application/json'
        ]);
        $subjResponse = curl_exec($ch);
        curl_close($ch);

        $subjects = json_decode($subjResponse, true);

        // Filter by date
        $recent = array_filter($subjects, function($s) use ($cutoffDate) {
            if (!isset($s['datum_osnivanja'])) return false;
            $founded = new DateTime($s['datum_osnivanja']);
            return $founded >= $cutoffDate;
        });

        // Fetch details for each
        $companies = [];
        foreach ($recent as $subj) {
            $company = $this->getCompanyByOib($subj['oib']);
            if ($company) {
                $companies[] = $company;
            }
        }

        return $companies;
    }
}
```

#### 2. Usage Example

**File:** `recent_companies.php`

```php
<?php
require_once 'SudregClient.php';

// Load credentials from environment or config
$clientId = getenv('SUDREG_CLIENT_ID');
$clientSecret = getenv('SUDREG_CLIENT_SECRET');

$client = new SudregClient($clientId, $clientSecret);

try {
    // Get companies from last 7 days
    $companies = $client->getRecentCompanies(7);
    
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'count' => count($companies),
        'companies' => $companies
    ]);
} catch (Exception $e) {
    header('Content-Type: application/json', true, 500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
```

---

### Angular

#### 1. Create Service

**File:** `src/app/services/sudreg.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Company {
  oib: string;
  mbs: string;
  naziv: string;
  kratki_naziv?: string;
  email?: string;
  adresa?: string;
  mjesto?: string;
  datum_osnivanja: string;
  djelatnost?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SudregService {
  private apiUrl = '/api/companies'; // Your backend API

  constructor(private http: HttpClient) {}

  getRecentCompanies(days: number = 7): Observable<Company[]> {
    return this.http.get<any>(`${this.apiUrl}/recent?days=${days}`)
      .pipe(
        map(response => response.companies || [])
      );
  }

  getCompanyByOib(oib: string): Observable<Company | null> {
    return this.http.get<any>(`${this.apiUrl}/oib/${oib}`)
      .pipe(
        map(response => response.company || null)
      );
  }
}
```

#### 2. Create Component

**File:** `src/app/components/recent-companies/recent-companies.component.ts`

```typescript
import { Component, OnInit } from '@angular/core';
import { SudregService, Company } from '../../services/sudreg.service';

@Component({
  selector: 'app-recent-companies',
  templateUrl: './recent-companies.component.html',
  styleUrls: ['./recent-companies.component.css']
})
export class RecentCompaniesComponent implements OnInit {
  companies: Company[] = [];
  loading = true;
  error: string | null = null;

  constructor(private sudregService: SudregService) {}

  ngOnInit(): void {
    this.sudregService.getRecentCompanies(7).subscribe({
      next: (companies) => {
        this.companies = companies;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load companies';
        this.loading = false;
        console.error(err);
      }
    });
  }
}
```

#### 3. Template

**File:** `src/app/components/recent-companies/recent-companies.component.html`

```html
<div class="recent-companies">
  <h2>Recently Registered Companies</h2>

  <div *ngIf="loading" class="loading">
    Loading companies...
  </div>

  <div *ngIf="error" class="error">
    {{ error }}
  </div>

  <ul *ngIf="!loading && !error" class="companies-list">
    <li *ngFor="let company of companies" class="company-item">
      <h3>{{ company.naziv }}</h3>
      <p><strong>OIB:</strong> {{ company.oib }}</p>
      <p><strong>Founded:</strong> {{ company.datum_osnivanja }}</p>
      <p *ngIf="company.email"><strong>Email:</strong> {{ company.email }}</p>
      <p *ngIf="company.adresa"><strong>Address:</strong> {{ company.adresa }}, {{ company.mjesto }}</p>
    </li>
  </ul>
</div>
```

---

### Node.js / Express

#### 1. Create Client Module

**File:** `lib/sudregClient.js`

```javascript
const fetch = require('node-fetch');

class SudregClient {
  constructor(clientId, clientSecret) {
    this.baseUrl = 'https://sudreg-data.gov.hr/api/javni';
    this.tokenUrl = 'https://sudreg-data.gov.hr/api/oauth/token';
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    // Return cached token if valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Get new token
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString('base64');

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // Expire 60 seconds early
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

    return this.accessToken;
  }

  async getCompanyByOib(oib) {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/detalji_subjekta?oib=${oib}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const subj = data.subjekt || data;
    const tvrtka = data.tvrtka || data.tvrtke?.[0];
    const sjediste = data.sjediste || data.sjedista?.[0];
    const email = data.email_adrese?.[0];

    if (!tvrtka) return null;

    const address = sjediste
      ? `${sjediste.ulica || ''} ${sjediste.kucni_broj || ''}`.trim()
      : undefined;

    return {
      oib: String(subj.oib).padStart(11, '0'),
      mbs: String(subj.mbs).padStart(9, '0'),
      naziv: tvrtka.ime || tvrtka.naziv,
      kratki_naziv: tvrtka.naznaka_imena,
      email: email?.adresa,
      adresa: address,
      mjesto: sjediste?.naziv_naselja,
      datum_osnivanja: subj.datum_osnivanja?.split('T')[0] || '',
      djelatnost: subj.glavna_djelatnost 
        ? String(subj.glavna_djelatnost) 
        : undefined,
    };
  }
}

module.exports = SudregClient;
```

#### 2. Create Express Routes

**File:** `routes/companies.js`

```javascript
const express = require('express');
const router = express.Router();
const SudregClient = require('../lib/sudregClient');

const client = new SudregClient(
  process.env.SUDREG_CLIENT_ID,
  process.env.SUDREG_CLIENT_SECRET
);

// Get company by OIB
router.get('/oib/:oib', async (req, res) => {
  try {
    const company = await client.getCompanyByOib(req.params.oib);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.json({
      success: true,
      company
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

#### 3. Main App

**File:** `app.js`

```javascript
require('dotenv').config();
const express = require('express');
const companiesRouter = require('./routes/companies');

const app = express();

app.use(express.json());
app.use('/api/companies', companiesRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## Best Practices

### 1. Token Management

✅ **DO:**
- Cache tokens in memory
- Refresh tokens before expiry (60s buffer)
- Handle token expiration gracefully

❌ **DON'T:**
- Request a new token for every API call
- Store tokens in client-side code
- Ignore token expiration

### 2. Snapshot Consistency

✅ **DO:**
- Use the same snapshot ID for related queries
- Store snapshot ID from `X-Snapshot-Id` header
- Reset snapshot when you need fresh data

❌ **DON'T:**
- Mix data from different snapshots
- Ignore snapshot staleness

### 3. Error Handling

✅ **DO:**
- Handle 404 (not found) separately from other errors
- Implement retry logic for transient failures
- Log errors with context

❌ **DON'T:**
- Assume all errors are the same
- Expose internal errors to users
- Ignore error responses

### 4. Performance

✅ **DO:**
- Use pagination (offset/limit)
- Batch related requests
- Cache frequently accessed data
- Use `only_active=true` to filter inactive companies

❌ **DON'T:**
- Fetch all records at once
- Make sequential requests when parallel is possible
- Request more data than needed

---

## Error Handling

### Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Refresh access token |
| 404 | Not Found | Company doesn't exist |
| 429 | Rate Limited | Implement backoff |
| 500 | Server Error | Retry with exponential backoff |
| 505 | No Results | Return empty array |

### Example Error Handler

```typescript
async function handleApiError(error: any, context: string) {
  if (error.message?.includes('505')) {
    // No results - not really an error
    return [];
  }

  if (error.message?.includes('401')) {
    // Token expired - retry once
    console.log('Token expired, refreshing...');
    this.accessToken = null;
    // Retry the request
  }

  if (error.message?.includes('429')) {
    // Rate limited - wait and retry
    console.log('Rate limited, waiting...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Retry the request
  }

  // Log and rethrow
  console.error(`${context} error:`, error);
  throw error;
}
```

---

## Rate Limiting & Performance

### API Limits

- **Token Lifetime:** 6 hours
- **Recommended Batch Size:** 500 records
- **Max Concurrent Requests:** Not officially documented, use caution

### Optimization Strategies

#### 1. Smart Offset Calculation

For recent companies, start from the end:

```typescript
const totalCount = await getTotalCount();
const offset = Math.max(0, totalCount - 500);
```

#### 2. Parallel Fetching

Fetch different tables in parallel:

```typescript
const [subjects, names, emails] = await Promise.all([
  fetchSubjects(),
  fetchNames(),
  fetchEmails(),
]);
```

#### 3. Caching

Cache company data to reduce API calls:

```typescript
const cache = new Map<string, Company>();

async function getCachedCompany(oib: string): Promise<Company | null> {
  if (cache.has(oib)) {
    return cache.get(oib)!;
  }

  const company = await sudregClient.getCompanyByOib(oib);
  if (company) {
    cache.set(oib, company);
  }

  return company;
}
```

---

## Complete Working Example

Here's a minimal working example that fetches and displays recent companies:

```typescript
// sudreg-demo.ts
import fetch from 'node-fetch';

const CLIENT_ID = 'your_client_id';
const CLIENT_SECRET = 'your_client_secret';

async function getAccessToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch('https://sudreg-data.gov.hr/api/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

async function getCompanyByOib(oib: string, token: string) {
  const response = await fetch(
    `https://sudreg-data.gov.hr/api/javni/detalji_subjekta?oib=${oib}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  return await response.json();
}

async function main() {
  try {
    // Get token
    const token = await getAccessToken();
    console.log('✓ Got access token');

    // Fetch a company (example OIB)
    const company = await getCompanyByOib('12345678901', token);
    
    if (company) {
      console.log('✓ Found company:', company.tvrtka?.ime);
    } else {
      console.log('✗ Company not found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

---

## Additional Resources

- **Official API Docs:** https://sudreg-data.gov.hr
- **OAuth2 Spec:** https://oauth.net/2/
- **Croatian Business Registry:** https://sudreg.pravosudje.hr

---

## Support & Troubleshooting

### Common Issues

**Issue:** "Failed to get access token: 401"
- **Solution:** Check your CLIENT_ID and CLIENT_SECRET

**Issue:** "Company not found (404)"
- **Solution:** Verify the OIB is correct (11 digits)

**Issue:** "Token expired during request"
- **Solution:** Implement token refresh 60s before expiry

**Issue:** "No recent companies found"
- **Solution:** Increase the `days` parameter or check offset calculation

---

## Conclusion

The Sudreg API provides powerful access to Croatian company data. Key takeaways:

1. **Use OAuth2** for authentication with token caching
2. **Leverage snapshots** for data consistency
3. **Smart offset calculation** for finding recent companies
4. **Parallel requests** for better performance
5. **Proper error handling** for production reliability

This guide provides everything needed to integrate Sudreg API into any framework. Adapt the examples to your specific use case and framework requirements.

---

**Last Updated:** December 25, 2025
**API Version:** Public API v1
