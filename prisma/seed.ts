import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed test user
  await prisma.user.upsert({
    where: { githubUsername: 'testuser' },
    update: {},
    create: {
      githubUsername: 'testuser',
      email: 'test@example.com',
      isPro: true,
    },
  });

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
