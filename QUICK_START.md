# Quick Start Guide

Get Mari8X Community Edition running in **5 minutes**! ⚡

---

## Prerequisites

- Docker & Docker Compose installed
- Free AIS API key from [aisstream.io](https://aisstream.io)

---

## Installation

### 1. Get the Code

```bash
# Clone repository
git clone https://github.com/rocketlang/mari8x-community.git
cd mari8x-community
```

### 2. Configure

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your AIS API key
nano .env  # or use your preferred editor

# Required: Set AISSTREAM_API_KEY
AISSTREAM_API_KEY=your_actual_key_here
```

**Get AIS Key:**
1. Go to https://aisstream.io
2. Sign up (free)
3. Copy API key from dashboard
4. Paste into `.env`

### 3. Start Services

```bash
# Start all services (PostgreSQL, Backend, Frontend)
docker-compose up -d

# Wait 30 seconds for database initialization

# Run database migrations
docker-compose exec backend npm run db:migrate

# Load sample data (optional - includes 8 sample vessels and 30+ major ports)
docker-compose exec backend npm run db:seed
```

### 4. Verify

```bash
# Check services are running
docker-compose ps

# Should see:
# mari8x-postgres   Up (healthy)
# mari8x-backend    Up (healthy)
# mari8x-frontend   Up
```

### 5. Access

**GraphQL API:**
- Open: http://localhost:4001/graphql
- Try query:
  ```graphql
  query {
    vessels(take: 5) {
      name
      imo
      type
    }
  }
  ```

**Web UI:**
- Open: http://localhost:3000
- View live vessel map

---

## First Steps

### 1. Explore the API

**Get a specific vessel:**
```graphql
query {
  vessel(imo: "9863903") {
    name
    type
    flag
    positions(take: 1) {
      latitude
      longitude
      speed
      timestamp
    }
  }
}
```

**Calculate a route:**
```graphql
query {
  calculateRoute(
    fromUnlocode: "INMUN"
    toUnlocode: "SGSIN"
    speedKnots: 14
  ) {
    distanceNm
    estimatedDays
  }
}
```

**List ports:**
```graphql
query {
  ports(take: 5) {
    unlocode
    name
    country
    lat
    lng
  }
}
```

### 2. View Logs

```bash
# All services
docker-compose logs -f

# Just backend
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100
```

### 3. Stop Services

```bash
# Stop (keeps data)
docker-compose stop

# Stop and remove (deletes data)
docker-compose down

# Stop and remove including volumes (complete reset)
docker-compose down -v
```

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using ports 3000, 4001, 5432
lsof -i :3000
lsof -i :4001
lsof -i :5432

# Kill process or change ports in docker-compose.yml
```

### Database Connection Failed

```bash
# Wait for Postgres to be healthy
docker-compose logs postgres

# If stuck, restart
docker-compose restart postgres
```

### AIS Data Not Coming In

```bash
# Check backend logs
docker-compose logs backend | grep AIS

# Verify API key is set
docker-compose exec backend env | grep AISSTREAM

# Test API key manually
curl -H "Authorization: Bearer YOUR_KEY" https://stream.aisstream.io/v0/health
```

### Container Won't Start

```bash
# View detailed logs
docker-compose logs backend

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## Next Steps

1. **Read the docs:** [API.md](./API.md)
2. **Explore the code:** `backend/src/`
3. **Join Discord:** https://discord.gg/mari8x
4. **Contribute:** [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## Common Tasks

### Update to Latest Version

```bash
git pull origin main
docker-compose down
docker-compose build
docker-compose up -d
```

### View Database

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U mari8x mari8x_community

# Run queries
SELECT COUNT(*) FROM vessels;
SELECT COUNT(*) FROM vessel_positions;
```

### Export Data

```bash
# Backup database
docker-compose exec postgres pg_dump -U mari8x mari8x_community > backup.sql

# Restore
docker-compose exec -T postgres psql -U mari8x mari8x_community < backup.sql
```

---

## Performance Tips

1. **Enable Redis** (optional):
   ```yaml
   # In docker-compose.yml, uncomment redis service
   # In .env, add:
   REDIS_URL=redis://redis:6379
   ```

2. **Increase Database Resources**:
   ```yaml
   # In docker-compose.yml under postgres service:
   deploy:
     resources:
       limits:
         memory: 2G
       reservations:
         memory: 1G
   ```

3. **Prune Old AIS Data**:
   ```bash
   # Keep only last 30 days
   docker-compose exec postgres psql -U mari8x mari8x_community -c \
     "DELETE FROM vessel_positions WHERE timestamp < NOW() - INTERVAL '30 days';"
   ```

---

## Need Help?

- **Documentation:** [docs.mari8x.com](https://docs.mari8x.com)
- **Discord:** [discord.gg/mari8x](https://discord.gg/mari8x)
- **GitHub Issues:** [Report a bug](https://github.com/rocketlang/mari8x-community/issues)
- **Email:** captain@mari8X.com

---

**That's it! You're now running Mari8X Community Edition.** 🚢

Happy tracking! ⚓
