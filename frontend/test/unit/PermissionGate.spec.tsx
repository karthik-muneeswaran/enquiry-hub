import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PermissionGate } from '../../src/auth/PermissionGate';
import { Permission } from '../../src/auth/users';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('PermissionGate', () => {
  it('should render children when user has the required permission', () => {
    mockUseAuth.mockReturnValue({
      hasPermission: () => true,
    });

    render(
      <PermissionGate permission={Permission.ENQUIRY_CREATE}>
        <button>Create Enquiry</button>
      </PermissionGate>,
    );

    expect(screen.getByRole('button', { name: /create enquiry/i })).toBeInTheDocument();
  });

  it('should not render children when user lacks the permission', () => {
    mockUseAuth.mockReturnValue({
      hasPermission: () => false,
    });

    render(
      <PermissionGate permission={Permission.ADMIN_DASHBOARD}>
        <button>Admin Panel</button>
      </PermissionGate>,
    );

    expect(screen.queryByRole('button', { name: /admin panel/i })).not.toBeInTheDocument();
  });

  it('should render fallback when user lacks permission and fallback is provided', () => {
    mockUseAuth.mockReturnValue({
      hasPermission: () => false,
    });

    render(
      <PermissionGate
        permission={Permission.GDPR_ERASE}
        fallback={<span>Access Denied</span>}
      >
        <button>Erase Data</button>
      </PermissionGate>,
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /erase data/i })).not.toBeInTheDocument();
  });

  it('should render null (nothing) when no fallback and permission denied', () => {
    mockUseAuth.mockReturnValue({
      hasPermission: () => false,
    });

    const { container } = render(
      <PermissionGate permission={Permission.QUEUE_MANAGE}>
        <button>Manage Queue</button>
      </PermissionGate>,
    );

    expect(container.innerHTML).toBe('');
  });

  it('should check the correct permission', () => {
    const mockHasPermission = vi.fn((p: Permission) => p === Permission.ENQUIRY_READ);
    mockUseAuth.mockReturnValue({ hasPermission: mockHasPermission });

    render(
      <PermissionGate permission={Permission.ENQUIRY_READ}>
        <span>Visible</span>
      </PermissionGate>,
    );

    expect(mockHasPermission).toHaveBeenCalledWith(Permission.ENQUIRY_READ);
    expect(screen.getByText('Visible')).toBeInTheDocument();
  });
});
