import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Product, Promo } from '@/models';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';

  if (q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const products = await Product.find({
    status: 'active',
    $or: [
      { productId: { $regex: q, $options: 'i' } },
      { brand: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } },
    ],
  })
    .limit(15)
    .lean();

  const now = new Date();
  const productIds = products.map((p) => p.productId);
  const activePromos = await Promo.find({
    productId: { $in: productIds },
    isDeleted: false,
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
  }).lean();

  const promoByProduct = new Map(activePromos.map((p) => [p.productId, p]));

  const data = products.map((p) => {
    const promo = promoByProduct.get(p.productId);
    return {
      productId: p.productId,
      brand: p.brand,
      name: p.name,
      color: p.color,
      size: p.size,
      description: `${p.brand} ${p.name} ${p.size} ${p.color}`.trim(),
      activePromo: promo
        ? {
            promoDescription: promo.promoDescription,
            promoValue: promo.promoValue,
            normalPrice: promo.normalPrice,
            finalPrice: promo.finalPrice,
          }
        : null,
    };
  });

  return NextResponse.json({ data });
}
