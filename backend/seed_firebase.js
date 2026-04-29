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
        email: 'mangpedring@KalsadaKonek.local',
        address: 'San Pablo City, Laguna',
        latitude: 14.0680000,
        longitude: 121.4180000,
        status: 'active'
      },
      {
        name: 'Bay Vulcanizing Shop',
        owner_name: 'Ramon Diaz',
        contact_number: '0918-234-5678',
        email: 'bayvulcanizing@KalsadaKonek.local',
        address: 'Bay, Laguna',
        latitude: 14.0650000,
        longitude: 121.4200000,
        status: 'active'
      },
      {
        name: 'Calauan Towing Service',
        owner_name: 'Arnel Pineda',
        contact_number: '0919-345-6789',
        email: 'calauantowing@KalsadaKonek.local',
        address: 'Calauan, Laguna',
        latitude: 14.0700000,
        longitude: 121.4150000,
        status: 'active'
      },
      {
        name: 'Los Banos Auto Electric',
        owner_name: 'Efren Reyes',
        contact_number: '0920-456-7890',
        email: 'losbanos-electric@KalsadaKonek.local',
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
        full_name: 'KalsadaKonek Administrator',
        email: 'admin@KalsadaKonek.local',
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

    // Seed test motorist user
    console.log('👤 Seeding test motorist user...');
    const motoristExists = await db.collection(collections.users)
      .where('username', '==', 'motorist')
      .get();

    if (motoristExists.empty) {
      const motoristId = await db.collection(collections.users).add({
        username: 'motorist',
        full_name: 'Test Motorist',
        email: 'motorist@KalsadaKonek.local',
        password_hash: await bcrypt.hash('test123', 10),
        phone: '0917-123-4567',
        role: 'motorist',
        status: 'active',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      await db.collection(collections.motoristProfiles).doc(motoristId.id).set({
        user_id: motoristId.id,
        created_at: serverTimestamp()
      });

      console.log('✅ Created test motorist user: motorist / test123');
    } else {
      console.log('⏭️  Test motorist user already exists');
    }

    // Seed Test Responder user
    console.log('👤 Seeding Test Responder user...');
    const agentExists = await db.collection(collections.users)
      .where('username', '==', 'agent')
      .get();

    if (agentExists.empty) {
      const agentId = await db.collection(collections.users).add({
        username: 'agent',
        full_name: 'Test Responder',
        email: 'agent@KalsadaKonek.local',
        password_hash: await bcrypt.hash('test123', 10),
        phone: '0918-234-5678',
        role: 'agent',
        status: 'active',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      await db.collection(collections.agentProfiles).doc(agentId.id).set({
        user_id: agentId.id,
        business_name: 'Test Auto Repair',
        service_type: 'mechanic',
        service_area: 'San Pablo City, Laguna',
        verification_status: 'approved',
        is_available: true,
        current_latitude: 14.0680000,
        current_longitude: 121.4180000,
        created_at: serverTimestamp()
      });

      console.log('✅ Created Test Responder user: agent / test123');
    } else {
      console.log('⏭️  Test Responder user already exists');
    }

    console.log('🎉 Firebase seeding complete!');
    console.log('');
    console.log('📋 Test accounts:');
    console.log('   Admin: admin / admin123');
    console.log('   Motorist: motorist / test123');
    console.log('   Responder: agent / test123');
    console.log('   Motorist: Register new users via mobile app');
    console.log('   Responder: Apply via mobile app, approve via admin panel');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seedFirebaseData();