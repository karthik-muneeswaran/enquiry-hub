import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext';
import { Permission, UserRole } from '../../src/auth/users';

function TestConsumer() {
  const { user, isAuthenticated, login, logout, hasPermission, hasRole } = useAuth();
  return (
    <div>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user-name">{user?.name ?? 'none'}</span>
      <span data-testid="has-admin-dash">
        {String(hasPermission(Permission.ADMIN_DASHBOARD))}
      </span>
      <span data-testid="is-admin">{String(hasRole(UserRole.ADMIN))}</span>
      <button onClick={() => login('admin@enquiry.dev', 'admin123')}>Login Admin</button>
      <button onClick={() => login('wrong@test.com', 'bad')}>Login Bad</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AuthContext', () => {
  it('starts unauthenticated with no user', () => {
    renderWithAuth();
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user-name')).toHaveTextContent('none');
  });

  it('login with valid credentials sets user and isAuthenticated', () => {
    renderWithAuth();
    act(() => {
      screen.getByText('Login Admin').click();
    });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Admin User');
  });

  it('login with invalid credentials keeps user unauthenticated', () => {
    renderWithAuth();
    act(() => {
      screen.getByText('Login Bad').click();
    });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user-name')).toHaveTextContent('none');
  });

  it('hasPermission and hasRole return correct values for admin', () => {
    renderWithAuth();
    act(() => {
      screen.getByText('Login Admin').click();
    });
    expect(screen.getByTestId('has-admin-dash')).toHaveTextContent('true');
    expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
  });
});
