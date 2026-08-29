import * as argon from 'argon2';
import { AuthService } from './auth';
import { ProfileService } from './profile';

describe('Auth and profile flow', () => {
  const prisma: any = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
    },
  };

  const jwt: any = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.signAsync.mockResolvedValue('signed-token');
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt_1' });
  });

  it('creates a session for a new user signup', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user_1',
      name: 'Ada Lovelace',
      username: 'ada',
      email: 'ada@example.com',
      role: 'USER',
      onboardingCompleted: false,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: 'Ada Lovelace',
      username: 'ada',
      email: 'ada@example.com',
      avatarUrl: null,
      preferredGenres: [],
      preferredCreationType: null,
      subscriptionTier: 'FREE',
    });

    const auth = new AuthService(prisma, jwt);
    const result = await auth.signup({
      email: 'ada@example.com',
      password: 'SecurePass123',
      name: 'Ada Lovelace',
      username: 'ada',
      bio: 'builder',
    });

    expect(prisma.user.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('signed-token');
    expect(result.user).not.toBeNull();
    expect(result.user?.username).toBe('ada');
  });

  it('validates login credentials for signin', async () => {
    jest.spyOn(argon, 'verify').mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'ada@example.com',
      passwordHash: 'hash',
      name: 'Ada Lovelace',
      username: 'ada',
      role: 'USER',
      onboardingCompleted: true,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user_1',
      email: 'ada@example.com',
      passwordHash: 'hash',
      name: 'Ada Lovelace',
      username: 'ada',
      role: 'USER',
      onboardingCompleted: true,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user_1',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      username: 'ada',
      avatarUrl: null,
      preferredGenres: [],
      preferredCreationType: null,
      subscriptionTier: 'FREE',
    });

    const auth = new AuthService(prisma, jwt);
    const result = await auth.signin({
      email: 'ada@example.com',
      password: 'SecurePass123',
    });

    expect(argon.verify).toHaveBeenCalled();
    expect(result.user).not.toBeNull();
    expect(result.user?.email).toBe('ada@example.com');
  });

  it('creates a profile for a signed-in user', async () => {
    prisma.user.update.mockResolvedValue({
      id: 'user_1',
      name: 'Ada Lovelace',
      username: 'ada',
      bio: 'builder',
      avatarUrl: 'https://example.com/avatar.png',
      preferredGenres: ['AI'],
      preferredCreationType: 'TEXT',
      onboardingCompleted: true,
    });

    const profile = new ProfileService(prisma);
    const result = await profile.createProfile('user_1', {
      name: 'Ada Lovelace',
      username: 'ada',
      bio: 'builder',
      avatarUrl: 'https://example.com/avatar.png',
      preferredGenres: ['AI'],
      preferredCreationType: 'TEXT',
    });

    expect(prisma.user.update).toHaveBeenCalled();
    expect(result.bio).toBe('builder');
  });
});
