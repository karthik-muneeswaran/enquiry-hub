import { Global, Module } from '@nestjs/common';
import { AUDIT_SERVICE } from '@modules/enquiry/interfaces';
import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditRepository,
    AuditService,
    {
      provide: AUDIT_SERVICE,
      useExisting: AuditService,
    },
  ],
  exports: [AuditService, AuditRepository, AUDIT_SERVICE],
})
export class AuditModule {}
