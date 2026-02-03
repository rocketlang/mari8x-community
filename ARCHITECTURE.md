# Mari8XCE and Mari8XEE - Architecture & Strategy

**Mari8XCE** = Mari8X Community Edition (Free, Open Source)
**Mari8XEE** = Mari8X Enterprise Edition (Paid, Proprietary)

**Date:** February 3, 2026
**Status:** Architecture Design Document
**Model:** Odoo-style separation (Community core + Enterprise extensions)

---

## 📐 Architecture Overview

### Dual-Repository Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Mari8X Platform                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────┐   ┌─────────────────────┐   │
│  │   Mari8XCE               │   │   Mari8XEE          │   │
│  │   (Community Edition)    │◄──│   (Enterprise)      │   │
│  │                          │   │                     │   │
│  │  Public Repository       │   │  Private Repository │   │
│  │  github.com/rocketlang/  │   │  github.com/        │   │
│  │  mari8x-community        │   │  rocketlang/        │   │
│  │                          │   │  mari8x-enterprise  │   │
│  │  License: AGPLv3         │   │  License: Proprietary│   │
│  │  Free Forever            │   │  Paid Subscription  │   │
│  └──────────────────────────┘   └─────────────────────┘   │
│              ▲                            │                │
│              │                            │                │
│              └────────── Extends ─────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Mari8XCE (Community Edition)

### Purpose
- Free, open source maritime platform
- Self-hosted
- Basic vessel tracking and operations
- Community-driven development

### Repository Structure

```
rocketlang/mari8x-community/
├── backend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── schema/
│   │   │   ├── types/
│   │   │   │   ├── vessel.ts          # Vessel tracking
│   │   │   │   ├── port.ts            # Port database
│   │   │   │   ├── routing.ts         # Basic routing
│   │   │   │   ├── position.ts        # AIS positions
│   │   │   │   └── weather.ts         # Weather data
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── ais-ingestion.ts       # AIS WebSocket
│   │   │   ├── weather-api.ts         # Free weather APIs
│   │   │   └── alert-service.ts       # Basic alerts
│   │   └── lib/
│   │       ├── geo-utils.ts           # Haversine, waypoints
│   │       └── prisma.ts
│   └── prisma/
│       ├── schema.prisma              # Community schema
│       └── seed.ts
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx          # Basic dashboard
│       │   ├── Vessels.tsx            # Vessel list
│       │   ├── Ports.tsx              # Port list
│       │   └── Map.tsx                # Simple map view
│       └── components/
├── docs/
├── docker-compose.yml
├── LICENSE (AGPLv3)
└── README.md
```

### Features Included

**Core Tracking:**
- ✅ Real-time AIS ingestion (AISstream.io)
- ✅ Vessel position tracking
- ✅ Historical position storage
- ✅ Port database (UN/LOCODE)
- ✅ Basic vessel details (IMO, MMSI, name, type)

**Basic Operations:**
- ✅ Great circle route calculation
- ✅ Distance computation (Haversine)
- ✅ Simple port congestion (vessel count)
- ✅ Weather data integration (free APIs)
- ✅ Basic alerts (geofence, arrival)

**API & Integration:**
- ✅ GraphQL API
- ✅ REST API (basic endpoints)
- ✅ Webhook notifications
- ✅ CSV/JSON exports
- ✅ Docker deployment

**UI:**
- ✅ Basic web interface
- ✅ Vessel list & search
- ✅ Port directory
- ✅ Simple map visualization
- ✅ Route calculator

**Data Management:**
- ✅ PostgreSQL + TimescaleDB
- ✅ Database migrations
- ✅ Seed data scripts
- ✅ Backup/restore tools

### What's NOT in Community

❌ AI/ML features
❌ Automated workflows
❌ Advanced analytics
❌ Multi-tenant SaaS
❌ Port agency modules
❌ Document AI extraction
❌ Email intelligence
❌ Priority support
❌ White-labeling

---

## 🏢 Mari8XEE (Enterprise Edition)

### Purpose
- Paid enterprise features
- Extends Mari8XCE
- Advanced automation & AI
- Professional support

### Repository Structure

```
rocketlang/mari8x-enterprise/ (Private)
├── addons/
│   ├── ai_engine/
│   │   ├── src/
│   │   │   ├── voyage-optimizer.ts
│   │   │   ├── eta-predictor.ts
│   │   │   └── route-recommender.ts
│   │   ├── schema/
│   │   │   └── types/
│   │   │       └── ai-engine.ts
│   │   └── package.json
│   │
│   ├── ml_eta/
│   │   ├── models/
│   │   │   └── eta-model.pkl
│   │   ├── src/
│   │   │   └── ml-eta-service.ts
│   │   └── schema/
│   │       └── types/
│   │           └── ml-eta.ts
│   │
│   ├── automation/
│   │   ├── src/
│   │   │   ├── da-desk-automation.ts
│   │   │   ├── workflow-engine.ts
│   │   │   └── notification-engine.ts
│   │   └── schema/
│   │
│   ├── port_agency/
│   │   ├── src/
│   │   │   ├── agent-appointment.ts
│   │   │   ├── proforma.ts
│   │   │   └── sof-management.ts
│   │   └── schema/
│   │
│   ├── advanced_analytics/
│   │   ├── src/
│   │   │   ├── revenue-forecasting.ts
│   │   │   ├── cost-optimization.ts
│   │   │   └── market-analysis.ts
│   │   └── dashboards/
│   │
│   ├── document_ai/
│   │   ├── src/
│   │   │   ├── pdf-extractor.ts
│   │   │   ├── email-parser.ts
│   │   │   └── ocr-service.ts
│   │   └── models/
│   │
│   └── multi_tenant/
│       ├── src/
│       │   ├── tenant-management.ts
│       │   ├── billing-engine.ts
│       │   └── white-label.ts
│       └── schema/
│
├── docker-compose.enterprise.yml
├── LICENSE (Proprietary)
└── README.md
```

### Features Included

**AI & Machine Learning:**
- 🔒 ML-powered ETA prediction (uses historical data)
- 🔒 AI route optimization (weather, traffic, fuel)
- 🔒 Predictive port congestion
- 🔒 Anomaly detection (vessel behavior)
- 🔒 Smart voyage recommendations

**Automation:**
- 🔒 Automated DA desk operations
- 🔒 Workflow engine (approval chains)
- 🔒 Auto-generated documents
- 🔒 Smart email responses
- 🔒 Scheduled tasks & reports

**Port Agency:**
- 🔒 Agent appointment management
- 🔒 Proforma disbursement accounts
- 🔒 SOF (Statement of Facts) automation
- 🔒 Port cost estimation
- 🔒 Cash-to-master tracking

**Advanced Analytics:**
- 🔒 Revenue forecasting
- 🔒 Cost optimization
- 🔒 Market analysis
- 🔒 Performance benchmarking
- 🔒 Custom dashboards

**Document Intelligence:**
- 🔒 PDF data extraction
- 🔒 Email intelligence
- 🔒 OCR for scanned docs
- 🔒 Auto-classification
- 🔒 Contract analysis

**Enterprise Features:**
- 🔒 Multi-tenant SaaS mode
- 🔒 White-labeling
- 🔒 SSO/SAML integration
- 🔒 Advanced RBAC
- 🔒 Audit logging
- 🔒 99.9% SLA
- 🔒 Priority support (24/7)
- 🔒 Dedicated account manager

---

## 🔧 Installation & Integration

### Community Edition Only

```bash
# Clone community repo
git clone https://github.com/rocketlang/mari8x-community.git
cd mari8x-community

# Configure
cp .env.example .env
# Add AISstream.io API key

# Deploy
docker-compose up -d

# Seed sample data
docker-compose exec backend npm run db:seed

# Access
open http://localhost:4001/graphql  # API
open http://localhost:3000          # UI
```

### Community + Enterprise (Odoo-Style)

```bash
# Clone community repo
git clone https://github.com/rocketlang/mari8x-community.git
cd mari8x-community

# Clone enterprise addons (requires access)
git clone git@github.com:rocketlang/mari8x-enterprise.git enterprise

# Configure
cp .env.example .env
# Add AISstream.io API key
# Add Mari8X license key: MARI8X_LICENSE_KEY=xxx

# Deploy with enterprise
docker-compose -f docker-compose.yml -f enterprise/docker-compose.enterprise.yml up -d

# Enterprise addons automatically loaded
# License verified on startup
```

### License Verification

```typescript
// backend/src/main.ts
import { verifyLicense } from './lib/license.js';

async function bootstrap() {
  const app = express();

  // Check for enterprise license
  const licenseKey = process.env.MARI8X_LICENSE_KEY;

  if (licenseKey) {
    const license = await verifyLicense(licenseKey);

    if (license.valid && license.tier === 'enterprise') {
      // Load enterprise addons
      await loadEnterpriseAddons(app);
      console.log('✅ Mari8XEE - Enterprise features enabled');
    } else {
      console.log('⚠️  Invalid license - Running as Mari8XCE (Community)');
    }
  } else {
    console.log('🚢 Mari8XCE - Community Edition');
  }

  // Load community features (always)
  await loadCommunityFeatures(app);

  app.listen(PORT);
}
```

### Dynamic Feature Loading

```typescript
// backend/src/lib/addon-loader.ts
export async function loadEnterpriseAddons(app: Express) {
  const addonPath = process.env.ENTERPRISE_ADDONS_PATH || '../enterprise/addons';

  if (!fs.existsSync(addonPath)) {
    console.log('ℹ️  No enterprise addons found');
    return;
  }

  const addons = [
    'ai_engine',
    'ml_eta',
    'automation',
    'port_agency',
    'advanced_analytics',
    'document_ai',
    'multi_tenant',
  ];

  for (const addon of addons) {
    try {
      const addonModule = await import(`${addonPath}/${addon}/src/index.js`);
      await addonModule.register(app);
      console.log(`  ✅ Loaded: ${addon}`);
    } catch (err) {
      console.log(`  ⚠️  Failed to load: ${addon}`);
    }
  }
}
```

---

## 📊 Feature Comparison Matrix

| Feature | Mari8XCE | Mari8XEE |
|---------|----------|----------|
| **Core Tracking** |
| Real-time AIS ingestion | ✅ | ✅ |
| Vessel tracking | ✅ | ✅ |
| Port database | ✅ | ✅ |
| Historical positions | ✅ | ✅ |
| **Routing & Navigation** |
| Great circle routing | ✅ | ✅ |
| Weather data | ✅ Basic | ✅ Advanced |
| Route optimization | ❌ | ✅ AI-powered |
| Traffic avoidance | ❌ | ✅ |
| **ETA & Predictions** |
| Simple ETA (distance/speed) | ✅ | ✅ |
| ML-powered ETA | ❌ | ✅ |
| Delay predictions | ❌ | ✅ |
| Arrival time optimization | ❌ | ✅ |
| **Port Operations** |
| Port congestion (basic) | ✅ Count | ❌ |
| Port congestion (predictive) | ❌ | ✅ |
| Port agency workflows | ❌ | ✅ |
| Agent appointments | ❌ | ✅ |
| Proforma DA | ❌ | ✅ |
| **Automation** |
| Basic alerts | ✅ | ✅ |
| Workflow automation | ❌ | ✅ |
| Email intelligence | ❌ | ✅ |
| Document extraction | ❌ | ✅ AI |
| Auto-responses | ❌ | ✅ |
| **Analytics** |
| Basic reports | ✅ | ✅ |
| Advanced dashboards | ❌ | ✅ |
| Revenue forecasting | ❌ | ✅ |
| Cost optimization | ❌ | ✅ |
| Market analysis | ❌ | ✅ |
| **API & Integration** |
| GraphQL API | ✅ | ✅ |
| REST API | ✅ Basic | ✅ Full |
| Webhooks | ✅ | ✅ |
| CSV/JSON exports | ✅ | ✅ |
| Custom integrations | ❌ | ✅ |
| **Deployment** |
| Self-hosted | ✅ | ✅ |
| Docker | ✅ | ✅ |
| Kubernetes | ❌ | ✅ |
| SaaS (multi-tenant) | ❌ | ✅ |
| White-labeling | ❌ | ✅ |
| **Support** |
| Community forums | ✅ | ✅ |
| Documentation | ✅ | ✅ |
| Email support | ❌ | ✅ |
| Priority support | ❌ | ✅ 24/7 |
| Dedicated account manager | ❌ | ✅ |
| SLA | ❌ | ✅ 99.9% |
| **Pricing** | Free | $499-$1,999/mo |
| **License** | AGPLv3 | Proprietary |

---

## 💰 Pricing Strategy

### Mari8XCE (Community Edition)
**Price:** Free forever
**License:** AGPLv3 (open source)
**Support:** Community forums, GitHub Discussions
**Best for:** Small operators, developers, learners, hobbyists

### Mari8XEE - Professional
**Price:** $99/month
**License:** Proprietary
**Includes:**
- All community features
- AI route optimization
- Basic automation
- Email support
- 10 users

**Best for:** Small shipping companies, port agents

### Mari8XEE - Enterprise
**Price:** $499/month
**License:** Proprietary
**Includes:**
- All Professional features
- ML-powered ETA
- Port agency workflows
- Advanced analytics
- Priority support
- 50 users

**Best for:** Medium shipping companies, freight forwarders

### Mari8XEE - Platform
**Price:** $1,999/month
**License:** Proprietary
**Includes:**
- All Enterprise features
- Multi-tenant SaaS
- White-labeling
- Custom integrations
- 99.9% SLA
- Dedicated account manager
- Unlimited users

**Best for:** Large operators, shipping platforms, resellers

---

## 🔐 License Management

### License Key Format

```
MARI8X-{TIER}-{ORG_ID}-{EXPIRY}-{SIGNATURE}

Example:
MARI8X-ENT-ABC123-20261231-a8f4e2d9c1b...
```

### License Verification

```typescript
// backend/src/lib/license.ts
import jwt from 'jsonwebtoken';

interface License {
  valid: boolean;
  tier: 'community' | 'professional' | 'enterprise' | 'platform';
  organization: string;
  expiry: Date;
  features: string[];
  users: number;
}

export async function verifyLicense(key: string): Promise<License> {
  try {
    // Verify signature with public key
    const decoded = jwt.verify(key, process.env.LICENSE_PUBLIC_KEY);

    // Check expiry
    if (new Date() > new Date(decoded.expiry)) {
      return { valid: false, tier: 'community' };
    }

    // Return license details
    return {
      valid: true,
      tier: decoded.tier,
      organization: decoded.org,
      expiry: new Date(decoded.expiry),
      features: decoded.features || [],
      users: decoded.users || 10,
    };
  } catch (err) {
    return { valid: false, tier: 'community' };
  }
}

export function hasFeature(license: License, feature: string): boolean {
  if (!license.valid) return false;
  return license.features.includes(feature);
}
```

### Feature Gates

```typescript
// backend/src/middleware/feature-gate.ts
export function requireFeature(featureName: string) {
  return async (req, res, next) => {
    const license = req.license; // Attached by auth middleware

    if (!license || !hasFeature(license, featureName)) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `This feature requires Mari8XEE ${featureName} addon`,
        upgrade: 'https://mari8x.com/pricing',
      });
    }

    next();
  };
}

// Usage in routes
app.post('/api/ml-eta', requireFeature('ml_eta'), async (req, res) => {
  // ML ETA prediction logic
});
```

---

## 🚀 Migration Path

### From Community to Enterprise

**Step 1: Continue using Community**
```bash
# Keep community running
cd mari8x-community
docker-compose up -d
```

**Step 2: Get Enterprise License**
- Sign up at https://mari8x.com/pricing
- Choose tier (Professional/Enterprise/Platform)
- Receive license key via email

**Step 3: Clone Enterprise Addons**
```bash
# Clone enterprise repo (access granted after purchase)
git clone git@github.com:rocketlang/mari8x-enterprise.git enterprise
```

**Step 4: Configure License**
```bash
# Add to .env
echo "MARI8X_LICENSE_KEY=MARI8X-ENT-..." >> .env
```

**Step 5: Deploy with Enterprise**
```bash
# Stop community-only
docker-compose down

# Start with enterprise
docker-compose -f docker-compose.yml -f enterprise/docker-compose.enterprise.yml up -d

# Enterprise features now available!
```

**Step 6: Migrate Data (Optional)**
```bash
# Run enterprise migrations
docker-compose exec backend npm run db:migrate

# Data from community edition preserved
```

---

## 🏗️ Development Workflow

### Community Development

**Anyone can contribute to Mari8XCE:**

1. Fork `rocketlang/mari8x-community`
2. Create feature branch
3. Make changes
4. Submit PR
5. Community review
6. Merge to main

**Contribution areas:**
- Bug fixes
- New community features
- Documentation
- Translations
- Sample data

### Enterprise Development

**Private development (rocketlang team only):**

1. Clone `mari8x-enterprise` (private)
2. Create addon or enhance existing
3. Test against community base
4. Internal code review
5. Deploy to staging
6. Release to customers

**Enterprise addons:**
- Must work as extensions of community
- No modifications to community code
- Clean addon interface
- Backwards compatible

---

## 📦 Addon Interface

### Enterprise Addon Structure

```typescript
// enterprise/addons/ai_engine/src/index.ts
import { Express } from 'express';
import { builder } from '@mari8x/community/schema/builder';

export async function register(app: Express) {
  console.log('🤖 Registering AI Engine addon...');

  // Register GraphQL types
  registerGraphQLTypes();

  // Register routes
  registerRoutes(app);

  // Register background jobs
  registerJobs();

  console.log('✅ AI Engine addon registered');
}

function registerGraphQLTypes() {
  // Extend community schema
  builder.queryFields((t) => ({
    mlRouteRecommendation: t.field({
      type: MLRouteResult,
      args: {
        fromUnlocode: t.arg.string({ required: true }),
        toUnlocode: t.arg.string({ required: true }),
        vesselType: t.arg.string({ required: true }),
      },
      resolve: async (_, args) => {
        // ML routing logic
        return await generateMLRoute(args);
      },
    }),
  }));
}

function registerRoutes(app: Express) {
  // REST endpoints
  app.post('/api/ai/optimize-voyage', async (req, res) => {
    // Voyage optimization logic
  });
}

function registerJobs() {
  // Background jobs
  cron.schedule('0 */6 * * *', async () => {
    // Retrain ML models every 6 hours
    await retrainModels();
  });
}
```

---

## 🔄 Upgrade & Maintenance

### Community Edition Updates

```bash
cd mari8x-community

# Pull latest
git pull origin main

# Rebuild
docker-compose build

# Restart
docker-compose up -d

# Run migrations
docker-compose exec backend npm run db:migrate
```

### Enterprise Edition Updates

```bash
cd mari8x-community

# Update community base
git pull origin main

# Update enterprise addons
cd enterprise
git pull origin main
cd ..

# Rebuild all
docker-compose -f docker-compose.yml -f enterprise/docker-compose.enterprise.yml build

# Restart
docker-compose -f docker-compose.yml -f enterprise/docker-compose.enterprise.yml up -d

# Run migrations (community + enterprise)
docker-compose exec backend npm run db:migrate
```

---

## 📈 Success Metrics

### Mari8XCE Metrics
- GitHub stars
- Docker pulls
- Community contributors
- Forum activity
- Deployment count (estimated)

### Mari8XEE Metrics
- Trial signups
- Conversion rate (trial → paid)
- Monthly recurring revenue (MRR)
- Churn rate
- Customer lifetime value (LTV)
- Support ticket volume

---

## 🎯 Strategic Goals

### Year 1 (2026)
- **Mari8XCE:** 5,000+ GitHub stars, 2,000+ deployments
- **Mari8XEE:** 50 paying customers, $25K MRR

### Year 2 (2027)
- **Mari8XCE:** 20,000+ GitHub stars, strong community
- **Mari8XEE:** 500 customers, $250K MRR

### Year 3 (2028)
- **Mari8XCE:** Industry-standard open source platform
- **Mari8XEE:** 2,000 customers, $1M MRR, profitable

---

## 📞 Contact & Resources

**Community (Mari8XCE):**
- GitHub: https://github.com/rocketlang/mari8x-community
- Discussions: https://github.com/rocketlang/mari8x-community/discussions
- Discord: https://discord.gg/mari8x
- Email: captain@mari8X.com

**Enterprise (Mari8XEE):**
- Website: https://mari8x.com
- Pricing: https://mari8x.com/pricing
- Sales: captain@mari8X.com
- Support: captain@mari8X.com (enterprise customers)

---

**Architecture Status:** 📐 Design Document
**Community Edition:** ✅ Ready to Launch
**Enterprise Edition:** 🔜 Future Development

---

**Mari8XCE + Mari8XEE = Complete Maritime Platform** 🚢

Open source foundation + Enterprise power = Industry leadership 🌊
