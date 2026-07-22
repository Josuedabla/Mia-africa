/**
 * Seed Script for MIA Marketplace
 * Initializes sample data in Firestore
 *
 * Usage: node scripts/seed-data.mjs
 *
 * Fix: this script read process.env.REACT_APP_FIREBASE_* directly, but
 * (a) those variables were renamed to VITE_FIREBASE_* for Vite compatibility,
 * and (b) plain `node` never loaded the .env file in the first place - there
 * was no dotenv/--env-file mechanism, so every value here was always
 * `undefined` even before the renaming. This now loads .env manually and
 * reads the VITE_ prefixed variables.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  try {
    const content = readFileSync(path, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    console.warn(`[seed] Could not read ${path} - relying on already-exported env vars.`);
  }
}

loadEnvFile(join(__dirname, '..', '.env'));

// Firebase configuration (reads from .env / VITE_ prefixed vars)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('[seed] Missing VITE_FIREBASE_* values - check your .env file.');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample data
const sampleUsers = [
  {
    email: 'vendor1@mia.com',
    phone: '+22891234567',
    name: 'Vendor One',
    country: 'TG',
    role: 'vendor',
    reputation: { score: 95, totalReviews: 150, averageRating: 4.8 },
  },
  {
    email: 'vendor2@mia.com',
    phone: '+22892345678',
    name: 'Vendor Two',
    country: 'BJ',
    role: 'vendor',
    reputation: { score: 88, totalReviews: 100, averageRating: 4.6 },
  },
];

const sampleShops = [
  {
    vendorId: 'vendor1',
    name: 'Fashion Hub Togo',
    slug: 'fashion-hub-togo',
    description: 'Les meilleures collections de mode africaine',
    country: 'TG',
    whatsappNumber: '+22891234567',
    reputation: { score: 95, totalReviews: 150, totalSales: 500, averageRating: 4.8 },
    stats: { totalProducts: 45, totalLikes: 1200, totalViews: 15000 },
    badges: ['verified', 'popular', 'fast_delivery'],
  },
  {
    vendorId: 'vendor2',
    name: 'Electronics Benin',
    slug: 'electronics-benin',
    description: 'Électronique de qualité à prix compétitifs',
    country: 'BJ',
    whatsappNumber: '+22892345678',
    reputation: { score: 88, totalReviews: 100, totalSales: 350, averageRating: 4.6 },
    stats: { totalProducts: 60, totalLikes: 800, totalViews: 10000 },
    badges: ['verified', 'trusted'],
  },
];

const sampleProducts = [
  {
    shopId: 'shop1',
    name: 'Robe Africaine Traditionnelle',
    slug: 'robe-africaine-traditionnelle',
    description: 'Belle robe africaine avec motifs traditionnels',
    category: 'Mode',
    price: 25000,
    oldPrice: 30000,
    currency: 'XOF',
    images: ['https://via.placeholder.com/300x300?text=Robe+Africaine'],
    stock: 15,
    status: 'active',
    tags: ['mode', 'africain', 'femme', 'traditionnel'],
    country: 'TG',
    stats: { totalViews: 450, totalLikes: 120, totalSales: 45 },
    isTrending: true,
    isNew: false,
  },
  {
    shopId: 'shop2',
    name: 'Téléphone Smartphone Android',
    slug: 'smartphone-android',
    description: 'Smartphone dernière génération avec écran AMOLED',
    category: 'Électronique',
    price: 150000,
    oldPrice: 180000,
    currency: 'XOF',
    images: ['https://via.placeholder.com/300x300?text=Smartphone'],
    stock: 8,
    status: 'active',
    tags: ['téléphone', 'smartphone', 'android', 'électronique'],
    country: 'BJ',
    stats: { totalViews: 890, totalLikes: 250, totalSales: 32 },
    isTrending: true,
    isNew: true,
  },
];

const sampleCategories = [
  { name: 'Mode', emoji: '👗' },
  { name: 'Électronique', emoji: '📱' },
  { name: 'Beauté', emoji: '💄' },
  { name: 'Maison', emoji: '🏠' },
  { name: 'Santé', emoji: '💊' },
];

async function seedData() {
  try {
    console.log('🌱 Starting data seeding...\n');

    // Seed users
    console.log('📝 Seeding users...');
    for (const user of sampleUsers) {
      const docRef = await addDoc(collection(db, 'users'), {
        ...user,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`  ✓ User created: ${docRef.id}`);
    }

    // Seed shops
    console.log('\n🏪 Seeding shops...');
    for (const shop of sampleShops) {
      const docRef = await addDoc(collection(db, 'shops'), {
        ...shop,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`  ✓ Shop created: ${docRef.id}`);
    }

    // Seed products
    console.log('\n📦 Seeding products...');
    for (const product of sampleProducts) {
      const docRef = await addDoc(collection(db, 'products'), {
        ...product,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`  ✓ Product created: ${docRef.id}`);
    }

    console.log('\n✅ Data seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
