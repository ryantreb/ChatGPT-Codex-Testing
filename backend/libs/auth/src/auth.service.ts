import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@app/common';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            organization: true,
            role: true,
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: any) {
    const organizationIds = user.memberships.map((m: any) => m.organizationId);

    const payload = {
      sub: user.id,
      email: user.email,
      organizationIds,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizations: user.memberships.map((m: any) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role.name,
        })),
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      registerDto.password,
      parseInt(process.env.BCRYPT_ROUNDS || '10'),
    );

    // Create user and organization in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: registerDto.organizationName || `${registerDto.email}'s Organization`,
          slug: this.generateSlug(registerDto.organizationName || registerDto.email),
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email: registerDto.email,
          name: registerDto.name,
          passwordHash,
        },
      });

      // Create default admin role
      const adminRole = await tx.role.create({
        data: {
          organizationId: organization.id,
          name: 'OrgAdmin',
          description: 'Organization administrator with full access',
          isSystem: true,
        },
      });

      // Assign default permissions to admin role
      const permissions = await tx.permission.findMany();
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: adminRole.id,
            permissionId: p.id,
          })),
        });
      }

      // Create membership
      await tx.orgMembership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          roleId: adminRole.id,
        },
      });

      return { user, organization };
    });

    // Generate token
    return this.login({
      ...result.user,
      memberships: [
        {
          organizationId: result.organization.id,
          organization: result.organization,
          role: { name: 'OrgAdmin' },
        },
      ],
    });
  }

  async createApiKey(userId: string, organizationId: string, name: string) {
    // Generate API key
    const key = this.generateRandomKey();
    const keyHash = await bcrypt.hash(key, 10);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        organizationId,
        name,
        keyHash,
        createdByUserId: userId,
      },
    });

    // Return the plain key only once (won't be stored)
    return {
      id: apiKey.id,
      name: apiKey.name,
      key: `sk_${key}`, // Prefix for clarity
      createdAt: apiKey.createdAt,
    };
  }

  async validateApiKey(key: string): Promise<any> {
    // Remove prefix if present
    const plainKey = key.replace(/^sk_/, '');

    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        revokedAt: null,
      },
      include: {
        organization: true,
      },
    });

    for (const apiKey of apiKeys) {
      const isValid = await bcrypt.compare(plainKey, apiKey.keyHash);
      if (isValid) {
        // Update last used
        await this.prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        });

        return {
          organizationId: apiKey.organizationId,
          organization: apiKey.organization,
        };
      }
    }

    return null;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private generateRandomKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }
}
