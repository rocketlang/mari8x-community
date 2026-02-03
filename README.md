# Mari8X Community Edition

**Open source maritime operations platform powered by real-time AIS data**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/node.js-20+-green.svg)](https://nodejs.org/)

---

## 🚢 What is Mari8X?

Mari8X Community Edition is an **open source maritime tracking and routing platform** that provides:

- **Real-time vessel tracking** powered by [AISstream.io](https://aisstream.io)
- **Historical track replay** (data accumulates over time)
- **Intelligent routing** that learns from actual vessel behavior
- **Port intelligence** with arrival/departure detection
- **Traffic density analysis** along shipping routes
- **GraphQL API** for easy integration

Built with a modern tech stack and designed to be self-hosted, Mari8X gives you complete control over your maritime data.

---

## ⚡ Quick Start (5 Minutes)

```bash
# 1. Clone repository
git clone https://github.com/rocketlang/mari8x-community.git
cd mari8x-community

# 2. Get free AIS API key
# Sign up at https://aisstream.io (free tier available)

# 3. Configure
cp .env.example .env
# Edit .env and add your AISSTREAM_API_KEY

# 4. Start with Docker
docker-compose up -d

# 5. Open in browser
# Backend: http://localhost:4001/graphql
# Frontend: http://localhost:3000
```

---

## 🎯 Features

### ✅ Community Edition (FREE)

**Core Tracking:**
- [x] Real-time vessel tracking (powered by AISstream.io free tier)
- [x] Historical track replay (builds up over time)
- [x] Port arrival/departure detection
- [x] Basic route calculation (great circle)
- [x] Live vessel map with clustering
- [x] Continuous AIS data ingestion

**Data & API:**
- [x] GraphQL API (read-only, rate-limited)
- [x] Vessel database (IMO, MMSI, name, type)
- [x] Port database (worldwide ports with UN/LOCODE)
- [x] PostgreSQL + TimescaleDB storage
- [x] Docker deployment

**Community Features:**
- [x] Contribute port data
- [x] Report vessel sightings
- [x] Share bunker prices
- [x] Open source integrations

### 💎 Enterprise Edition (Paid)

For advanced features like ML-powered ETA prediction, automated operations, AI engine, and enterprise support, see [Mari8X Enterprise](https://mari8x.com/enterprise).

---

## 🌊 About the Data

**AIS Source:** [AISstream.io](https://aisstream.io) provides free real-time terrestrial AIS data.

**How it works:**
1. You sign up for a free account at aisstream.io
2. Mari8X connects and starts collecting position updates
3. Historical data accumulates over time as your deployment runs
4. The longer you run it, the more historical insights you get

**Note:** You start with a fresh database. Historical data builds up naturally as vessels transmit their positions. This is normal and expected!

---

## 🏗️ Architecture

```
┌─────────────────┐
│  AISstream.io   │  (FREE tier - real-time AIS)
│   (WebSocket)   │  You bring your own API key
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Mari8X Backend │
│   (Node.js +    │  ◄── GraphQL API (port 4001)
│   TypeScript)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  TimescaleDB    │  (Your data, grows over time)
│  (PostgreSQL)   │
└─────────────────┘

┌─────────────────┐
│  Mari8X Web UI  │  (React + Vite)
│  (Frontend)     │  ◄── http://localhost:3000
└─────────────────┘
```

---

## 📦 Installation

### Prerequisites

- Docker & Docker Compose (recommended)
- **OR** Node.js 20+, PostgreSQL 16+, TimescaleDB
- Free AIS API key from [aisstream.io](https://aisstream.io)

### Option 1: Docker (Recommended)

```bash
# Clone repo
git clone https://github.com/rocketlang/mari8x-community.git
cd mari8x-community

# Configure
cp .env.example .env
# Add your AISSTREAM_API_KEY to .env

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Manual Setup

See [INSTALL.md](./INSTALL.md) for detailed manual installation.

---

## 🔌 API Usage

### GraphQL Playground

Open http://localhost:4001/graphql

### Example Queries

**Get vessels:**
```graphql
query {
  vessels(take: 10) {
    name
    imo
    type
    flag
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
    estimatedDays
    waypoints {
      lat
      lng
    }
  }
}
```

**ML-powered route (learns from your accumulated data):**
```graphql
query {
  mlRouteRecommendation(
    fromUnlocode: "INMUN"
    toUnlocode: "SGSIN"
    vesselType: "container"
  ) {
    totalDistanceNm
    estimatedDays
    averageSpeedKnots
    confidence
    basedOnVesselCount
  }
}
```

See [API.md](./API.md) for complete API documentation.

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

**Ways to contribute:**
- 🐛 Report bugs via [GitHub Issues](https://github.com/rocketlang/mari8x-community/issues)
- 💡 Suggest features via [Discussions](https://github.com/rocketlang/mari8x-community/discussions)
- 📝 Improve documentation
- 🔧 Submit pull requests
- 🌍 Add port data (tariffs, restrictions)
- 📊 Share vessel sightings

**Community Rewards:**
- **Bronze** (10 contributions): 500 API calls/day
- **Silver** (50 contributions): 2,000 API calls/day
- **Gold** (200 contributions): 10,000 API calls/day

---

## 📖 Documentation

- [Quick Start Guide](./QUICK_START.md)
- [Installation Guide](./INSTALL.md)
- [API Reference](./API.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)

---

## 🛠️ Tech Stack

**Backend:**
- Node.js 20+ (TypeScript)
- GraphQL (Pothos)
- Prisma ORM
- PostgreSQL 16 + TimescaleDB
- WebSocket (AIS streaming)

**Frontend:**
- React 18
- Vite
- MapLibre GL (maps)
- Apollo Client (GraphQL)
- TailwindCSS

**Infrastructure:**
- Docker + Docker Compose
- TimescaleDB (time-series)

---

## 🌐 Use Cases

- **Vessel tracking:** Monitor vessels in real-time
- **Route planning:** Calculate optimal routes
- **Port operations:** Track arrivals/departures
- **Maritime research:** Analyze shipping patterns
- **Integration:** Build apps on top of GraphQL API
- **Education:** Learn about maritime operations

---

## 📊 Data Sources

**AIS Data:**
- [AISstream.io](https://aisstream.io) - Real-time terrestrial AIS (free tier)
- Updates: Real-time via WebSocket
- Coverage: Global (terrestrial stations)
- **Note:** You need your own free API key

**Port Data:**
- Worldwide ports
- UN/LOCODE standard
- Coordinates, names, countries

---

## 🔒 License

Mari8X Community Edition is licensed under **AGPLv3**.

This means:
- ✅ Free to use, modify, and distribute
- ✅ Can run for personal or commercial use
- ✅ Must open source any modifications
- ✅ Must open source if running as SaaS

See [LICENSE](./LICENSE) for details.

---

## 💰 Pricing

| Edition | Price | Use Case |
|---------|-------|----------|
| **Community** | FREE | Self-hosted, basic tracking |
| **Professional** | $99/mo | Advanced routing, automation |
| **Enterprise** | $499/mo | AI engine, full operations suite |
| **Platform** | $1,999/mo | Multi-tenant, white-label |

See [mari8x.com/pricing](https://mari8x.com/pricing) for details.

---

## 🚀 Roadmap

**v1.0 (Current):**
- [x] Real-time AIS tracking
- [x] Basic routing
- [x] GraphQL API
- [x] Docker deployment

**v1.1 (Next):**
- [ ] Automated port congestion detection
- [ ] Deviation alerts
- [ ] Traffic density heatmaps
- [ ] Enhanced route analysis

**v2.0 (Future):**
- [ ] Weather routing integration
- [ ] Fuel optimization
- [ ] Mobile apps (iOS, Android)
- [ ] Plugin marketplace

---

## 🤔 FAQ

**Q: Is this really free?**  
A: Yes! Community Edition is 100% free and open source (AGPLv3). Self-host and use forever at no cost.

**Q: How much data will I have?**  
A: You start with zero. As your deployment runs, AIS positions accumulate naturally. The longer you run it, the more historical data you'll have.

**Q: Do I need to pay for AIS data?**  
A: No! AISstream.io offers a free tier. Just sign up and get your own API key.

**Q: How is this different from MarineTraffic?**  
A: Mari8X is open source, self-hostable, and you own your data. MarineTraffic is closed-source SaaS.

**Q: Can I use this commercially?**  
A: Yes, under AGPLv3. If you modify and run as a service, you must open source your changes.

**Q: How accurate is the data?**  
A: AIS data quality depends on vessel transmissions and receiver coverage. Terrestrial AIS typically updates every 2-3 minutes.

---

## 🙏 Acknowledgments

- [AISstream.io](https://aisstream.io) for providing free AIS data access
- [TimescaleDB](https://www.timescale.com) for time-series database
- [OpenStreetMap](https://www.openstreetmap.org) for map tiles
- All contributors and community members

---

## 📞 Support

- **Community:** [Discord](https://discord.gg/mari8x) | [GitHub Discussions](https://github.com/rocketlang/mari8x-community/discussions)
- **Documentation:** [docs.mari8x.com](https://docs.mari8x.com)
- **Issues:** [GitHub Issues](https://github.com/rocketlang/mari8x-community/issues)
- **Contact:** captain@mari8X.com

---

## 📜 Legal

Mari8X is not affiliated with any official maritime authority. AIS data is provided for informational purposes. Always verify critical information with official sources.

---

**Made with ❤️ by the Mari8X Community**

[Website](https://mari8x.com) • [Docs](https://docs.mari8x.com) • [Discord](https://discord.gg/mari8x) • [Twitter](https://twitter.com/mari8x)
