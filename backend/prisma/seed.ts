import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed sample enquiries for testing
  const enquiries = [
    {
      name: 'John Smith',
      email: 'john@example.com',
      phone: '+61412345678',
      propertyId: 'prop-001',
      propertyTitle: '3 Bed Apartment in Sydney CBD',
      message: 'I would like to schedule a viewing for this property.',
      source: 'website',
      consentGiven: true,
      status: 'PENDING' as const,
    },
    {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+61498765432',
      propertyId: 'prop-002',
      propertyTitle: 'Modern House in Bondi',
      message: 'Is this property still available? Interested in a private inspection.',
      source: 'website',
      consentGiven: true,
      status: 'COMPLETED' as const,
    },
  ];

  for (const enquiry of enquiries) {
    await prisma.enquiry.create({ data: enquiry });
  }

  console.log(`Seeded ${enquiries.length} enquiries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
