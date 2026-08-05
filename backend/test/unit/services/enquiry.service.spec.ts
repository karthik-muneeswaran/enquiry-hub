import { ConflictException, NotFoundException } from '@nestjs/common';
import { EnquiryService } from '@/modules/enquiry/enquiry.service';
import { EnquiryRepository } from '@/modules/enquiry/enquiry.repository';
import { PrismaService } from '@/database/prisma.service';
import { CreateEnquiryDto } from '@/modules/enquiry/dto/create-enquiry.dto';

describe('EnquiryService', () => {
  let service: EnquiryService;
  let mockPrisma: any;
  let mockRepository: any;
  let mockRedis: any;
  let mockCacheService: any;
  let mockMetricsService: any;
  let mockNotificationProducer: any;

  const mockEnquiry = {
    id: 'enq-uuid-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+61412345678',
    propertyId: 'prop-123',
    propertyTitle: 'Nice Apartment',
    message: 'Interested in viewing',
    source: 'website',
    consentGiven: true,
    status: 'PENDING',
    idempotencyKey: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const validDto: CreateEnquiryDto = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+61412345678',
    propertyId: 'prop-123',
    propertyTitle: 'Nice Apartment',
    message: 'Interested in viewing',
    source: 'website',
    consentGiven: true,
  };

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn((fn) =>
        fn({
          enquiry: { create: jest.fn().mockResolvedValue(mockEnquiry) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };

    mockRepository = {
      findById: jest.fn(),
      findDuplicate: jest.fn(),
      findWithCursor: jest.fn(),
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
      isDuplicate: jest.fn().mockResolvedValue(null),
      getById: jest.fn().mockImplementation((_id, fetcher) => fetcher()),
      getList: jest.fn().mockImplementation((_params, fetcher) => fetcher()),
      onEnquiryCreated: jest.fn().mockResolvedValue(undefined),
      onEnquiryUpdated: jest.fn().mockResolvedValue(undefined),
      onEnquiryDeleted: jest.fn().mockResolvedValue(undefined),
      setDuplicateMarker: jest.fn().mockResolvedValue(undefined),
    };

    mockMetricsService = {
      incrementCounter: jest.fn(),
      recordHistogram: jest.fn(),
      setGauge: jest.fn(),
    };

    mockNotificationProducer = {
      enqueueConfirmationEmail: jest.fn().mockResolvedValue(undefined),
      enqueueAdminNotification: jest.fn().mockResolvedValue(undefined),
    };

    service = new EnquiryService(
      mockPrisma as unknown as PrismaService,
      mockRepository as unknown as EnquiryRepository,
      mockCacheService,
      mockRedis,
      mockMetricsService,
      mockNotificationProducer,
      undefined, // auditService
    );
  });

  describe('create', () => {
    it('should create an enquiry successfully', async () => {
      mockRepository.findDuplicate.mockResolvedValue(null);

      const result = await service.create(validDto);

      expect(result).toEqual(mockEnquiry);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should check for duplicate before creating', async () => {
      mockRepository.findDuplicate.mockResolvedValue(null);

      await service.create(validDto);

      expect(mockRepository.findDuplicate).toHaveBeenCalledWith('john@example.com', 'prop-123', 10);
    });

    it('should throw ConflictException for duplicate enquiry', async () => {
      mockRepository.findDuplicate.mockResolvedValue(mockEnquiry);

      await expect(service.create(validDto)).rejects.toThrow(ConflictException);
    });

    it('should return cached response for duplicate idempotency key', async () => {
      const cachedEnquiry = {
        ...mockEnquiry,
        createdAt: mockEnquiry.createdAt.toISOString(),
        updatedAt: mockEnquiry.updatedAt.toISOString(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedEnquiry));

      const result = await service.create(validDto, 'idem-key-1');

      expect(result).toEqual(cachedEnquiry);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should store idempotency key in Redis after creation', async () => {
      mockRepository.findDuplicate.mockResolvedValue(null);

      await service.create(validDto, 'idem-key-1');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'idempotency:idem-key-1',
        expect.any(String),
        'EX',
        86400,
      );
    });

    it('should not store idempotency key if none provided', async () => {
      mockRepository.findDuplicate.mockResolvedValue(null);

      await service.create(validDto);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should enqueue notifications after creation', async () => {
      mockRepository.findDuplicate.mockResolvedValue(null);

      await service.create(validDto);

      expect(mockNotificationProducer.enqueueConfirmationEmail).toHaveBeenCalledWith(mockEnquiry);
      expect(mockNotificationProducer.enqueueAdminNotification).toHaveBeenCalledWith(mockEnquiry);
    });

    it('should not fail if notification enqueue throws', async () => {
      mockRepository.findDuplicate.mockResolvedValue(null);
      mockNotificationProducer.enqueueConfirmationEmail.mockRejectedValue(new Error('Queue down'));

      const result = await service.create(validDto);

      expect(result).toEqual(mockEnquiry);
    });

    it('should not fail if Redis idempotency check throws', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection refused'));
      mockRepository.findDuplicate.mockResolvedValue(null);

      const result = await service.create(validDto, 'idem-key-1');

      expect(result).toEqual(mockEnquiry);
    });

    it('should work without NotificationProducer (optional dependency)', async () => {
      const serviceWithoutProducer = new EnquiryService(
        mockPrisma as unknown as PrismaService,
        mockRepository as unknown as EnquiryRepository,
        mockCacheService,
        mockRedis,
        mockMetricsService,
        undefined,
        undefined,
      );
      mockRepository.findDuplicate.mockResolvedValue(null);

      const result = await serviceWithoutProducer.create(validDto);

      expect(result).toEqual(mockEnquiry);
    });
  });

  describe('findById', () => {
    it('should return enquiry when found', async () => {
      mockRepository.findById.mockResolvedValue(mockEnquiry);

      const result = await service.findById('enq-uuid-1');

      expect(result).toEqual(mockEnquiry);
      expect(mockRepository.findById).toHaveBeenCalledWith('enq-uuid-1');
    });

    it('should throw NotFoundException when enquiry not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const paginatedResult = {
        data: [mockEnquiry],
        pagination: {
          nextCursor: null,
          previousCursor: null,
          hasMore: false,
          totalCount: 1,
        },
      };
      mockRepository.findWithCursor.mockResolvedValue(paginatedResult);

      const result = await service.findAll({ limit: 20, sortDir: 'desc' });

      expect(result).toEqual(paginatedResult);
      expect(mockRepository.findWithCursor).toHaveBeenCalledWith({
        limit: 20,
        sortDir: 'desc',
      });
    });
  });
});
