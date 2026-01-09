import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Helper to ensure user has access to organization
   */
  async checkOrgAccess(userId: string, organizationId: string): Promise<boolean> {
    const membership = await this.orgMembership.findFirst({
      where: {
        userId,
        organizationId,
      },
    });
    return !!membership;
  }

  /**
   * Helper to get user's organization IDs
   */
  async getUserOrganizations(userId: string): Promise<string[]> {
    const memberships = await this.orgMembership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    return memberships.map((m) => m.organizationId);
  }

  /**
   * Helper to check if user has permission
   */
  async userHasPermission(
    userId: string,
    organizationId: string,
    permissionKey: string,
  ): Promise<boolean> {
    const membership = await this.orgMembership.findFirst({
      where: {
        userId,
        organizationId,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!membership) return false;

    return membership.role.permissions.some((rp) => rp.permission.key === permissionKey);
  }
}
