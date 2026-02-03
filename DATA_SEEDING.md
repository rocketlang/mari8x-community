# Data Seeding Guide

This document explains the sample data included in Mari8X Community Edition for testing and demonstration purposes.

---

## Overview

The seed script (`backend/prisma/seed.ts`) populates your database with:

- **1** demo organization
- **1** demo user account
- **33** major world ports (with coordinates)
- **8** sample vessels (real IMO numbers, realistic specifications)
- **192** vessel positions (24 hours of simulated tracking data per vessel)

**Total:** ~200 database records for immediate testing.

---

## Running the Seed

### Via Docker Compose (Recommended)

```bash
# After starting services
docker-compose exec backend npm run db:seed
```

### Via Local Development

```bash
cd backend
npm run db:seed
```

---

## Seed Data Contents

### 1. Organizations

**Demo Shipping Company** (`demo-org-1`)
- Purpose: Container for sample vessels and users
- Can be used for testing multi-tenant features

### 2. Users

**Demo User**
- Email: `demo@mari8x.community`
- Role: `admin`
- Purpose: Testing authentication and authorization

### 3. Ports (33 Major Ports)

**Asia-Pacific (11 ports)**
- Singapore (SGSIN)
- Shanghai (CNSHA)
- Hong Kong (HKHKG)
- Ningbo (CNNGB)
- Yantian (CNYTN)
- Busan (KRPUS)
- Nhava Sheva/JNPT (INNSA)
- Mumbai (INMUN)
- Chennai (INMAA)
- Kolkata (INCCU)
- Jebel Ali (AEJEA)

**Europe (7 ports)**
- Rotterdam (NLRTM)
- Antwerp (BEANR)
- Hamburg (DEHAM)
- Felixstowe (GBFXT)
- Valencia (ESVLC)
- Genoa (ITGOA)
- Piraeus (GRLGR)

**Americas (8 ports)**
- Los Angeles (USLAX)
- Long Beach (USLGB)
- New York (USNYC)
- Savannah (USSAV)
- Houston (USHOU)
- Manzanillo (MXZLO)
- Santos (BRSUA)
- Balboa/Cristobal (PABLB/PAMIT)

**Middle East & Africa (3 ports)**
- Suez (EGSUZ)
- Durban (ZADUR)
- Tanger Med (MAPTM)

**Oceania (2 ports)**
- Melbourne (AUMEL)
- Sydney (AUSYD)

All ports include:
- UN/LOCODE (unique identifier)
- Port name
- Country
- Latitude/Longitude coordinates

### 4. Vessels (8 Sample Vessels)

**Container Ships:**
1. **EVER GIVEN** (IMO: 9811000, MMSI: 477123400)
   - Flag: Hong Kong
   - DWT: 199,629 MT
   - Built: 2018
   - Famous for Suez Canal incident

2. **MSC GULSUN** (IMO: 9792819, MMSI: 563000000)
   - Flag: Panama
   - DWT: 228,283 MT
   - Built: 2019
   - One of world's largest container ships

3. **MAERSK EMDEN** (IMO: 9321483, MMSI: 477456200)
   - Flag: Hong Kong
   - DWT: 156,907 MT
   - Built: 2006

**Oil Tankers:**
4. **PIONEER** (IMO: 9632179, MMSI: 636018825)
   - Type: Crude Oil Tanker
   - Flag: Liberia
   - DWT: 307,284 MT
   - Built: 2013

5. **MINERVA GEORGIA** (IMO: 9468631, MMSI: 241533000)
   - Type: Crude Oil Tanker
   - Flag: Greece
   - DWT: 163,166 MT
   - Built: 2010

**Bulk Carriers:**
6. **ORE BRASIL** (IMO: 9775891, MMSI: 538005881)
   - Flag: Marshall Islands
   - DWT: 402,347 MT
   - Built: 2018
   - Vale-class ore carrier

7. **BIG ORANGE XVIII** (IMO: 9839187, MMSI: 636092237)
   - Flag: Liberia
   - DWT: 325,000 MT
   - Built: 2020
   - Capesize bulker

**Passenger Ship:**
8. **CARNIVAL VISTA** (IMO: 9700637, MMSI: 371259000)
   - Type: Passenger Ship
   - Flag: Panama
   - GRT: 133,596
   - Built: 2016
   - Cruise ship

### 5. Vessel Positions (192 total)

Each vessel has **24 position records** (1 per hour over 24 hours):

**Position Data Includes:**
- Latitude/Longitude (simulated movement near Singapore)
- Speed (5-25 knots, randomized)
- Heading (0-360 degrees)
- Course (0-360 degrees)
- Navigation Status (0 = Under way using engine)
- Timestamp (hourly for past 24h)
- Source: `ais_terrestrial`

**Movement Simulation:**
- Starting point: Near Singapore (1.26°N, 103.82°E ±5°)
- Drift: ±0.3° per hour (realistic vessel movement)
- Speed variation: 5-25 knots
- All vessels use "Under way using engine" status

---

## Testing the Seed Data

### GraphQL Queries

**List all vessels:**
```graphql
query {
  vessels {
    name
    imo
    type
    flag
  }
}
```

**Get vessel with recent positions:**
```graphql
query {
  vessel(imo: "9811000") {
    name
    type
    positions(take: 10) {
      latitude
      longitude
      speed
      timestamp
    }
  }
}
```

**List ports:**
```graphql
query {
  ports(take: 10) {
    unlocode
    name
    country
    lat
    lng
  }
}
```

**Calculate route:**
```graphql
query {
  calculateRoute(
    fromUnlocode: "INMUN"
    toUnlocode: "SGSIN"
    speedKnots: 14
  ) {
    distanceNm
    distanceKm
    estimatedDays
    fromPort {
      name
    }
    toPort {
      name
    }
  }
}
```

### SQL Queries

```sql
-- Count records
SELECT COUNT(*) FROM vessels;        -- 8
SELECT COUNT(*) FROM vessel_positions; -- 192
SELECT COUNT(*) FROM ports;          -- 33
SELECT COUNT(*) FROM organizations;  -- 1
SELECT COUNT(*) FROM users;          -- 1

-- View recent positions
SELECT v.name, vp.latitude, vp.longitude, vp.speed, vp.timestamp
FROM vessel_positions vp
JOIN vessels v ON v.id = vp."vesselId"
ORDER BY vp.timestamp DESC
LIMIT 10;

-- Ports by region
SELECT country, COUNT(*) as port_count
FROM ports
GROUP BY country
ORDER BY port_count DESC;
```

---

## Re-running the Seed

The seed script uses `upsert`, so it's safe to run multiple times:

```bash
# It will skip existing records and only add new ones
docker-compose exec backend npm run db:seed
```

**To completely reset:**
```bash
# Delete all data
docker-compose exec backend npx prisma migrate reset

# Re-run seed
docker-compose exec backend npm run db:seed
```

---

## Customizing Seed Data

Edit `backend/prisma/seed.ts` to:

1. **Add more ports:**
   ```typescript
   { unlocode: 'USOAK', name: 'Oakland', country: 'United States', lat: 37.8, lng: -122.3 }
   ```

2. **Add more vessels:**
   ```typescript
   {
     imo: '1234567',
     mmsi: '123456789',
     name: 'YOUR VESSEL',
     type: 'Container Ship',
     flag: 'Panama',
     dwt: 50000,
     grt: 40000,
     yearBuilt: 2020,
   }
   ```

3. **Change position generation:**
   - Modify starting coordinates
   - Adjust drift rate
   - Change speed ranges
   - Add more hours of history

After editing, re-run:
```bash
docker-compose exec backend npm run db:seed
```

---

## Production Considerations

**This seed data is for TESTING ONLY.**

In production:
1. **Delete sample data:**
   ```sql
   DELETE FROM vessel_positions WHERE source = 'ais_terrestrial';
   DELETE FROM vessels WHERE "organizationId" = 'demo-org-1';
   DELETE FROM users WHERE email = 'demo@mari8x.community';
   DELETE FROM organizations WHERE id = 'demo-org-1';
   ```

2. **Keep port data** (it's useful)

3. **Start collecting real AIS data:**
   - Configure your AISstream.io API key
   - Backend will automatically start ingesting live positions
   - Historical data accumulates over time

---

## Data Sources

- **Port coordinates:** OpenSeaMap, UN/LOCODE database
- **Vessel specs:** Publicly available IMO database, VesselFinder
- **Position simulation:** Great circle movement with random drift

**All data is publicly available and used for educational purposes.**

---

## Troubleshooting

**Error: "Unique constraint failed"**
- Seed has already run
- Solution: It's safe to ignore, or run `prisma migrate reset` to start fresh

**Error: "Cannot connect to database"**
- Database not running
- Solution: `docker-compose up -d postgres`

**Error: "Module not found: @prisma/client"**
- Dependencies not installed
- Solution: `cd backend && npm install`

---

## Next Steps

After seeding:
1. Open GraphQL Playground: http://localhost:4001/graphql
2. Try the example queries above
3. Explore the frontend: http://localhost:3000
4. Start ingesting real AIS data

---

**Sample data loaded. Ready to explore!** 🚢
