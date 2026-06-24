/**
 * Seed script — run with: npm run seed
 * Creates an initial super_admin user and a few sample products so the
 * app is usable immediately after setup.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User, Product } from '../src/models';

dotenv.config({ path: '.env.local' });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI tidak ditemukan di .env.local');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Terhubung ke MongoDB');

  // 1. Super Admin
  const existingAdmin = await User.findOne({ userId: '0000001' });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await User.create({
      userId: '0000001',
      name: 'Super Admin',
      role: 'super_admin',
      passwordHash,
      status: 'active',
    });
    console.log('Super Admin dibuat: userId=0000001, password=admin123');
  } else {
    console.log('Super Admin sudah ada, dilewati.');
  }

  // 2. Sample SPV
  const existingSpv = await User.findOne({ userId: '2405004' });
  if (!existingSpv) {
    const passwordHash = await bcrypt.hash('spv123', 10);
    await User.create({
      userId: '2405004',
      name: 'Budi Supervisor',
      role: 'spv',
      passwordHash,
      counterId: '0E1',
      status: 'active',
    });
    console.log('SPV dibuat: userId=2405004, password=spv123');
  }

  // 3. Sample SA
  const existingSa = await User.findOne({ userId: '2212010' });
  if (!existingSa) {
    const passwordHash = await bcrypt.hash('sa123', 10);
    await User.create({
      userId: '2212010',
      name: 'Siti Sales',
      role: 'sa',
      passwordHash,
      counterId: '0E1',
      status: 'active',
    });
    console.log('SA dibuat: userId=2212010, password=sa123');
  }

  // 4. Sample products
  const sampleProducts = [
    { productId: '901222050', brand: 'NIKE', name: 'AIR MAX 270', color: 'BLACK', size: '42' },
    { productId: '071253123', brand: 'ADIDAS', name: 'ULTRABOOST 22', color: 'WHITE', size: '40' },
    { productId: '301122087', brand: 'PUMA', name: 'SUEDE CLASSIC', color: 'RED', size: '39' },
  ];

  for (const p of sampleProducts) {
    const exists = await Product.findOne({ productId: p.productId });
    if (!exists) {
      await Product.create({
        ...p,
        status: 'active',
        createdBy: '0000001',
        updatedBy: '0000001',
      });
      console.log(`Produk dibuat: ${p.productId} - ${p.brand} ${p.name}`);
    }
  }

  console.log('\nSeed selesai.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
