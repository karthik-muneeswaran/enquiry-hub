export enum UserRole {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
}

export enum Permission {
  ENQUIRY_CREATE = 'ENQUIRY_CREATE',
  ENQUIRY_READ = 'ENQUIRY_READ',
  ENQUIRY_LIST = 'ENQUIRY_LIST',
  ENQUIRY_UPDATE_STATUS = 'ENQUIRY_UPDATE_STATUS',
  WEBHOOK_VIEW = 'WEBHOOK_VIEW',
  PROPERTY_VIEW = 'PROPERTY_VIEW',
  GDPR_EXPORT = 'GDPR_EXPORT',
  GDPR_ERASE = 'GDPR_ERASE',
  QUEUE_MANAGE = 'QUEUE_MANAGE',
  AUDIT_VIEW = 'AUDIT_VIEW',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
}

export interface StaticUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
}

export const STATIC_USERS: StaticUser[] = [
  {
    id: 'user-admin-001',
    email: 'admin@enquiry.dev',
    password: 'admin123',
    name: 'Admin User',
    role: UserRole.ADMIN,
    permissions: Object.values(Permission),
  },
  {
    id: 'user-agent-001',
    email: 'agent@enquiry.dev',
    password: 'agent123',
    name: 'Agent User',
    role: UserRole.AGENT,
    permissions: [
      Permission.ENQUIRY_CREATE,
      Permission.ENQUIRY_READ,
      Permission.ENQUIRY_LIST,
      Permission.ENQUIRY_UPDATE_STATUS,
      Permission.PROPERTY_VIEW,
      Permission.WEBHOOK_VIEW,
    ],
  },
  {
    id: 'user-viewer-001',
    email: 'viewer@enquiry.dev',
    password: 'viewer123',
    name: 'Viewer User',
    role: UserRole.VIEWER,
    permissions: [Permission.ENQUIRY_READ, Permission.PROPERTY_VIEW],
  },
];
