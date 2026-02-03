import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Mari8X Community Edition database...');

  // Create sample organization
  const org = await prisma.organization.upsert({
    where: { id: 'demo-org-1' },
    update: {},
    create: {
      id: 'demo-org-1',
      name: 'Demo Shipping Company',
    },
  });

  console.log('✅ Created organization:', org.name);

  // Create sample user
  const user = await prisma.user.upsert({
    where: { email: 'demo@mari8x.community' },
    update: {},
    create: {
      email: 'demo@mari8x.community',
      name: 'Demo User',
      organizationId: org.id,
      role: 'admin',
    },
  });

  console.log('✅ Created user:', user.email);

  // Major world ports with UN/LOCODE and coordinates
  const ports = [
    // Asia
    { unlocode: 'SGSIN', name: 'Singapore', country: 'Singapore', lat: 1.2644, lng: 103.8217 },
    { unlocode: 'CNSHA', name: 'Shanghai', country: 'China', lat: 31.2304, lng: 121.4737 },
    { unlocode: 'HKHKG', name: 'Hong Kong', country: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
    { unlocode: 'CNNGB', name: 'Ningbo', country: 'China', lat: 29.8683, lng: 121.544 },
    { unlocode: 'CNYTN', name: 'Yantian', country: 'China', lat: 22.5833, lng: 114.2667 },
    { unlocode: 'KRPUS', name: 'Busan', country: 'South Korea', lat: 35.1028, lng: 129.0403 },
    { unlocode: 'INNSA', name: 'Nhava Sheva (JNPT)', country: 'India', lat: 18.9388, lng: 72.9508 },
    { unlocode: 'INMUN', name: 'Mumbai', country: 'India', lat: 18.9388, lng: 72.8355 },
    { antml:parameter name: 'Chennai', country: 'India', lat: 13.0827, lng: 80.2707 },
    { unlocode: 'INCCU', name: 'Kolkata', country: 'India', lat: 22.5726, lng: 88.3639 },
    { unlocode: 'AEJEA', name: 'Jebel Ali', country: 'UAE', lat: 25.0117, lng: 55.1139 },

    // Europe
    { unlocode: 'NLRTM', name: 'Rotterdam', country: 'Netherlands', lat: 51.9225, lng: 4.4792 },
    { unlocode: 'BEANR', name: 'Antwerp', country: 'Belgium', lat: 51.2194, lng: 4.4025 },
    { unlocode: 'DEHAM', name: 'Hamburg', country: 'Germany', lat: 53.5488, lng: 9.9872 },
    { unlocode: 'GBFXT', name: 'Felixstowe', country: 'United Kingdom', lat: 51.9611, lng: 1.3517 },
    { unlocode: 'ESVLC', name: 'Valencia', country: 'Spain', lat: 39.4699, lng: -0.3763 },
    { unlocode: 'ITGOA', name: 'Genoa', country: 'Italy', lat: 44.4056, lng: 8.9463 },
    { unlocode: 'GRLGR', name: 'Piraeus', country: 'Greece', lat: 37.9456, lng: 23.6469 },

    // Americas
    { unlocode: 'USLAX', name: 'Los Angeles', country: 'United States', lat: 33.7361, lng: -118.2694 },
    { unlocode: 'USLGB', name: 'Long Beach', country: 'United States', lat: 33.7701, lng: -118.1937 },
    { unlocode: 'USNYC', name: 'New York', country: 'United States', lat: 40.7128, lng: -74.006 },
    { unlocode: 'USSAV', name: 'Savannah', country: 'United States', lat: 32.0809, lng: -81.0912 },
    { unlocode: 'USHOU', name: 'Houston', country: 'United States', lat: 29.7604, lng: -95.3698 },
    { unlocode: 'MXZLO', name: 'Manzanillo', country: 'Mexico', lat: 19.0543, lng: -104.3185 },
    { unlocode: 'BRSUA', name: 'Santos', country: 'Brazil', lat: -23.9608, lng: -46.3333 },
    { unlocode: 'PABLB', name: 'Balboa', country: 'Panama', lat: 8.9536, lng: -79.5672 },
    { unlocode: 'PAMIT', name: 'Cristobal', country: 'Panama', lat: 9.3592, lng: -79.9108 },

    // Middle East & Africa
    { unlocode: 'EGSUZ', name: 'Suez', country: 'Egypt', lat: 29.9669, lng: 32.5498 },
    { unlocode: 'ZADUR', name: 'Durban', country: 'South Africa', lat: -29.8587, lng: 31.0218 },
    { unlocode: 'MAPTM', name: 'Tanger Med', country: 'Morocco', lat: 35.8742, lng: -5.4194 },

    // Oceania
    { unlocode: 'AUMEL', name: 'Melbourne', country: 'Australia', lat: -37.8136, lng: 144.9631 },
    { unlocode: 'AUSYD', name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093 },
  ];

  for (const port of ports) {
    await prisma.port.upsert({
      where: { unlocode: port.unlocode },
      update: {},
      create: port,
    });
  }

  console.log(`✅ Created ${ports.length} major ports`);

  // Sample vessels (realistic IMO numbers and types)
  const vessels = [
    {
      imo: '9811000',
      mmsi: '477123400',
      name: 'EVER GIVEN',
      type: 'Container Ship',
      flag: 'Hong Kong',
      dwt: 199629,
      grt: 220940,
      yearBuilt: 2018,
    },
    {
      imo: '9792819',
      mmsi: '563000000',
      name: 'MSC GULSUN',
      type: 'Container Ship',
      flag: 'Panama',
      dwt: 228283,
      grt: 232618,
      yearBuilt: 2019,
    },
    {
      imo: '9321483',
      mmsi: '477456200',
      name: 'MAERSK EMDEN',
      type: 'Container Ship',
      flag: 'Hong Kong',
      dwt: 156907,
      grt: 151559,
      yearBuilt: 2006,
    },
    {
      imo: '9632179',
      mmsi: '636018825',
      name: 'PIONEER',
      type: 'Crude Oil Tanker',
      flag: 'Liberia',
      dwt: 307284,
      grt: 161070,
      yearBuilt: 2013,
    },
    {
      imo: '9468631',
      mmsi: '241533000',
      name: 'MINERVA GEORGIA',
      type: 'Crude Oil Tanker',
      flag: 'Greece',
      dwt: 163166,
      grt: 85942,
      yearBuilt: 2010,
    },
    {
      imo: '9775891',
      mmsi: '538005881',
      name: 'ORE BRASIL',
      type: 'Bulk Carrier',
      flag: 'Marshall Islands',
      dwt: 402347,
      grt: 221382,
      yearBuilt: 2018,
    },
    {
      imo: '9839187',
      mmsi: '636092237',
      name: 'BIG ORANGE XVIII',
      type: 'Bulk Carrier',
      flag: 'Liberia',
      dwt: 325000,
      grt: 179000,
      yearBuilt: 2020,
    },
    {
      imo: '9700637',
      mmsi: '371259000',
      name: 'CARNIVAL VISTA',
      type: 'Passenger Ship',
      flag: 'Panama',
      grt: 133596,
      yearBuilt: 2016,
    },
  ];

  for (const vesselData of vessels) {
    const vessel = await prisma.vessel.upsert({
      where: { imo: vesselData.imo },
      update: {},
      create: {
        ...vesselData,
        organizationId: org.id,
      },
    });

    // Create sample position history (last 24 hours)
    const now = new Date();
    const positions = [];

    // Generate 24 positions (1 per hour) with realistic movement
    let lat = 1.2644 + Math.random() * 10 - 5; // Starting near Singapore
    let lng = 103.8217 + Math.random() * 10 - 5;

    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000)); // Hours ago

      // Simulate movement
      lat += (Math.random() - 0.5) * 0.3; // Drift north/south
      lng += (Math.random() - 0.5) * 0.3; // Drift east/west

      positions.push({
        vesselId: vessel.id,
        latitude: lat,
        longitude: lng,
        speed: Math.random() * 20 + 5, // 5-25 knots
        heading: Math.floor(Math.random() * 360),
        course: Math.floor(Math.random() * 360),
        navigationStatus: 0, // Under way using engine
        timestamp,
        source: 'ais_terrestrial',
      });
    }

    await prisma.vesselPosition.createMany({
      data: positions,
      skipDuplicates: true,
    });
  }

  console.log(`✅ Created ${vessels.length} sample vessels with 24h position history`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
