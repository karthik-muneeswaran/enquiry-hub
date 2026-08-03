/**
 * Placeholder interface for AuditService.
 * Will be implemented in the Audit module (task 10.3).
 * The tx parameter allows audit logging within the same transaction.
 */
export interface IAuditService {
  logChange(params: {
    entity: string;
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    performedBy: string;
    requestId: string;
    tx?: any;
  }): Promise<void>;
}

export const AUDIT_SERVICE = 'AUDIT_SERVICE';
