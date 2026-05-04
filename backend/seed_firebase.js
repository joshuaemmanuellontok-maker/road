import { db, collections, serverTimestamp } from './src/firebase.js';
import bcrypt from 'bcryptjs';

async function seedFirebaseData() {
  try {
    console.log('🌱 Seeding Firebase data...');

    // Seed repair shops
    const repairShops = [
      {
        name: 'Siniloan Roadside Auto Care',
        owner_name: 'Pedro Cruz',
        contact_number: '0917-123-4567',
        email: 'siniloan-autocare@Soteria.local',
        address: 'Siniloan, Laguna',
        latitude: 14.4211000,
        longitude: 121.4461000,
        category: 'mechanical',
        rating: 4.8,
        distance_km: 1.4,
        response_time: '~15 min',
        open_now: true,
        services: ['Mechanical', 'Engine repair', 'Brake service', 'Diagnostic scan'],
        status: 'active',
      },
      {
        name: 'Famy Tire and Vulcanizing Center',
        owner_name: 'Ramon Diaz',
        contact_number: '0918-234-5678',
        email: 'famy-vulcanizing@Soteria.local',
        address: 'Famy, Laguna',
        latitude: 14.4379000,
        longitude: 121.4486000,
        category: 'vulcanizing',
        rating: 4.7,
        distance_km: 2.1,
        response_time: '~20 min',
        open_now: true,
        services: ['Vulcanizing', 'Tire repair', 'Wheel balancing', 'Patch and inflate'],
        status: 'active',
      },
      {
        name: 'Santa Maria Laguna Towing and Auto Electric',
        owner_name: 'Arnel Pineda',
        contact_number: '0919-345-6789',
        email: 'santamaria-towing@Soteria.local',
        address: 'Santa Maria, Laguna',
        latitude: 14.4719000,
        longitude: 121.4281000,
        category: 'towing',
        rating: 4.6,
        distance_km: 3.5,
        response_time: '~25 min',
        open_now: true,
        services: ['Mechanical', 'Vulcanizing', 'Towing', 'Electrical', 'Battery service', 'General roadside assistance'],
        status: 'active',
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
        full_name: 'Soteria Administrator',
        email: 'admin@Soteria.local',
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
        email: 'motorist@Soteria.local',
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
        email: 'agent@Soteria.local',
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
