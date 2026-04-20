import { db, collections, serverTimestamp } from './src/firebase.js';
import bcrypt from 'bcryptjs';

async function seedFirebaseData() {
  try {
    console.log('🌱 Seeding Firebase data...');

    // Seed repair shops
    const repairShops = [
      {
        name: 'Mang Pedring Auto Repair',
        owner_name: 'Pedro Cruz',
        contact_number: '0917-123-4567',
        email: 'mangpedring@roadresq.local',
        address: 'San Pablo City, Laguna',
        latitude: 14.0680000,
        longitude: 121.4180000,
        status: 'active'
      },
      {
        name: 'Bay Vulcanizing Shop',
        owner_name: 'Ramon Diaz',
        contact_number: '0918-234-5678',
        email: 'bayvulcanizing@roadresq.local',
        address: 'Bay, Laguna',
        latitude: 14.0650000,
        longitude: 121.4200000,
        status: 'active'
      },
      {
        name: 'Calauan Towing Service',
        owner_name: 'Arnel Pineda',
        contact_number: '0919-345-6789',
        email: 'calauantowing@roadresq.local',
        address: 'Calauan, Laguna',
        latitude: 14.0700000,
        longitude: 121.4150000,
        status: 'active'
      },
      {
        name: 'Los Banos Auto Electric',
        owner_name: 'Efren Reyes',
        contact_number: '0920-456-7890',
        email: 'losbanos-electric@roadresq.local',
        address: 'Los Banos, Laguna',
        latitude: 14.0630000,
        longitude: 121.4220000,
        status: 'inactive'
      }
    ];

    console.log('🏪 Seeding repair shops...');
    for (const shop of repairShops) {
      // Check if shop already exists
      const existing = await db.collection(collections.repairShops)
        .where('name', '==', shop.name)
        .get();

      if (existing.empty) {
        await db.collection(collections.repairShops).add({
          ...shop,
          created_at: serverTimestamp()
        });
        console.log(`✅ Added: ${shop.name}`);
      } else {
        console.log(`⏭️  Skipped: ${shop.name} (already exists)`);
      }
    }

    // Seed admin user
    console.log('👤 Seeding admin user...');
    const adminExists = await db.collection(collections.users)
      .where('role', '==', 'admin')
      .get();

    if (adminExists.empty) {
      const adminId = await db.collection(collections.users).add({
        username: 'admin',
        full_name: 'RoadResQ Administrator',
        email: 'admin@roadresq.local',
        password_hash: await bcrypt.hash('admin123', 10),
        phone: null,
        role: 'admin',
        status: 'active',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      await db.collection(collections.adminProfiles).doc(adminId.id).set({
        user_id: adminId.id,
        position: 'System Administrator',
        created_at: serverTimestamp()
      });

      console.log('✅ Created admin user: admin / admin123');
    } else {
      console.log('⏭️  Admin user already exists');
    }

    console.log('🎉 Firebase seeding complete!');
    console.log('');
    console.log('📋 Test accounts:');
    console.log('   Admin: admin / admin123');
    console.log('   Motorist: Register new users via mobile app');
    console.log('   Agent: Apply via mobile app, approve via admin panel');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seedFirebaseData();