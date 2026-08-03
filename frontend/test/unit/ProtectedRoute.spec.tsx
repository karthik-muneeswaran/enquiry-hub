import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ProtectedRoute } from '../../src/auth/ProtectedRoute';
import { Permission, UserRole } from '../../src/auth/users';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithRouter(
  element: React.ReactNode,
  initialEntry: string = '/protected',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/protected" element={element} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('should render children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      hasPermission: () => true,
      hasRole: () => true,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      hasPermission: () => false,
      hasRole: () => false,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect to /unauthorized when permission check fails', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      hasPermission: (p: Permission) => p !== Permission.ADMIN_DASHBOARD,
      hasRole: () => true,
    });

    renderWithRouter(
      <ProtectedRoute permission={Permission.ADMIN_DASHBOARD}>
        <div>Admin Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('should redirect to /unauthorized when role check fails', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      hasPermission: () => true,
      hasRole: (r: UserRole) => r !== UserRole.ADMIN,
    });

    renderWithRouter(
      <ProtectedRoute role={UserRole.ADMIN}>
        <div>Admin Only</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
  });

  it('should render children when permission check passes', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      hasPermission: () => true,
      hasRole: () => true,
    });

    renderWithRouter(
      <ProtectedRoute permission={Permission.ENQUIRY_LIST}>
        <div>Enquiry List</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Enquiry List')).toBeInTheDocument();
  });

  it('should render children when role check passes', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      hasPermission: () => true,
      hasRole: () => true,
    });

    renderWithRouter(
      <ProtectedRoute role={UserRole.AGENT}>
        <div>Agent Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Agent Content')).toBeInTheDocument();
  });
});
