import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create permissions
  console.log('Creating permissions...');
  const permissions = await Promise.all([
    // Agents
    prisma.permission.upsert({
      where: { key: 'agents.create' },
      update: {},
      create: {
        key: 'agents.create',
        module: 'agents',
        action: 'create',
        description: 'Create new agents',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'agents.read' },
      update: {},
      create: {
        key: 'agents.read',
        module: 'agents',
        action: 'read',
        description: 'View agents',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'agents.update' },
      update: {},
      create: {
        key: 'agents.update',
        module: 'agents',
        action: 'update',
        description: 'Update agents',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'agents.delete' },
      update: {},
      create: {
        key: 'agents.delete',
        module: 'agents',
        action: 'delete',
        description: 'Delete agents',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'agents.run' },
      update: {},
      create: {
        key: 'agents.run',
        module: 'agents',
        action: 'run',
        description: 'Execute agent runs',
      },
    }),
    // Detections
    prisma.permission.upsert({
      where: { key: 'detections.create' },
      update: {},
      create: {
        key: 'detections.create',
        module: 'detections',
        action: 'create',
        description: 'Create detections',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'detections.read' },
      update: {},
      create: {
        key: 'detections.read',
        module: 'detections',
        action: 'read',
        description: 'View detections',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'detections.update' },
      update: {},
      create: {
        key: 'detections.update',
        module: 'detections',
        action: 'update',
        description: 'Update detections',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'detections.delete' },
      update: {},
      create: {
        key: 'detections.delete',
        module: 'detections',
        action: 'delete',
        description: 'Delete detections',
      },
    }),
    // Audit
    prisma.permission.upsert({
      where: { key: 'audit.view' },
      update: {},
      create: {
        key: 'audit.view',
        module: 'audit',
        action: 'view',
        description: 'View audit logs',
      },
    }),
    // Settings
    prisma.permission.upsert({
      where: { key: 'settings.manage_users' },
      update: {},
      create: {
        key: 'settings.manage_users',
        module: 'settings',
        action: 'manage_users',
        description: 'Manage organization users',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'settings.manage_roles' },
      update: {},
      create: {
        key: 'settings.manage_roles',
        module: 'settings',
        action: 'manage_roles',
        description: 'Manage organization roles',
      },
    }),
  ]);

  console.log(`✅ Created ${permissions.length} permissions`);

  // Create sample MITRE techniques
  console.log('Creating MITRE ATT&CK techniques...');
  const mitreTechniques = await Promise.all([
    prisma.mitreTechnique.upsert({
      where: { id: 'T1566' },
      update: {},
      create: {
        id: 'T1566',
        name: 'Phishing',
        tactic: 'Initial Access',
        description: 'Adversaries may send phishing messages to gain access to victim systems.',
        url: 'https://attack.mitre.org/techniques/T1566/',
      },
    }),
    prisma.mitreTechnique.upsert({
      where: { id: 'T1078' },
      update: {},
      create: {
        id: 'T1078',
        name: 'Valid Accounts',
        tactic: 'Initial Access, Persistence, Privilege Escalation, Defense Evasion',
        description: 'Adversaries may obtain and abuse credentials of existing accounts.',
        url: 'https://attack.mitre.org/techniques/T1078/',
      },
    }),
    prisma.mitreTechnique.upsert({
      where: { id: 'T1059' },
      update: {},
      create: {
        id: 'T1059',
        name: 'Command and Scripting Interpreter',
        tactic: 'Execution',
        description: 'Adversaries may abuse command and script interpreters to execute commands.',
        url: 'https://attack.mitre.org/techniques/T1059/',
      },
    }),
    prisma.mitreTechnique.upsert({
      where: { id: 'T1003' },
      update: {},
      create: {
        id: 'T1003',
        name: 'OS Credential Dumping',
        tactic: 'Credential Access',
        description: 'Adversaries may attempt to dump credentials to obtain account login information.',
        url: 'https://attack.mitre.org/techniques/T1003/',
      },
    }),
    prisma.mitreTechnique.upsert({
      where: { id: 'T1071' },
      update: {},
      create: {
        id: 'T1071',
        name: 'Application Layer Protocol',
        tactic: 'Command and Control',
        description: 'Adversaries may communicate using application layer protocols.',
        url: 'https://attack.mitre.org/techniques/T1071/',
      },
    }),
  ]);

  console.log(`✅ Created ${mitreTechniques.length} MITRE techniques`);

  // Create demo organization
  console.log('Creating demo organization...');
  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org',
      defaultModelAlias: 'claude-3-5-sonnet',
    },
  });

  console.log(`✅ Created organization: ${demoOrg.name}`);

  // Create admin role
  console.log('Creating admin role...');
  const adminRole = await prisma.role.upsert({
    where: {
      organizationId_name: {
        organizationId: demoOrg.id,
        name: 'OrgAdmin',
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      name: 'OrgAdmin',
      description: 'Organization administrator with full access',
      isSystem: true,
    },
  });

  // Assign all permissions to admin role
  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      })
    )
  );

  console.log('✅ Created admin role with all permissions');

  // Create demo user
  console.log('Creating demo user...');
  const passwordHash = await bcrypt.hash('demo123', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash,
    },
  });

  console.log(`✅ Created user: ${demoUser.email}`);

  // Create membership
  await prisma.orgMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: demoOrg.id,
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      userId: demoUser.id,
      roleId: adminRole.id,
    },
  });

  console.log('✅ Created org membership');

  // Create sample agents
  console.log('Creating sample agents...');

  const alertEnrichmentAgent = await prisma.agent.create({
    data: {
      organizationId: demoOrg.id,
      createdByUserId: demoUser.id,
      name: 'Alert Enrichment Agent',
      description: 'Enriches security alerts with contextual information from SIEM and threat intelligence',
      type: 'webhook',
      planningMode: 'single_step',
      status: 'active',
      defaultModelAlias: 'claude-3-5-sonnet',
      systemPrompts: {
        create: {
          description: 'Initial system prompt',
          prompt: `You are a security analyst AI assistant specialized in alert enrichment.

Your role is to:
1. Analyze incoming security alerts
2. Query relevant data sources (SIEM, EDR, threat intelligence)
3. Provide context about the alert (user history, asset information, similar incidents)
4. Assess the severity and potential impact
5. Recommend next steps for the security team

Always be concise, accurate, and prioritize actionable information.`,
          status: 'active',
          changedByUserId: demoUser.id,
          changedByEmail: demoUser.email,
        },
      },
    },
  });

  const threatHuntingAgent = await prisma.agent.create({
    data: {
      organizationId: demoOrg.id,
      createdByUserId: demoUser.id,
      name: 'Threat Hunting Agent',
      description: 'Proactively hunts for threats based on MITRE ATT&CK techniques',
      type: 'scheduled',
      planningMode: 'plan_and_execute',
      status: 'active',
      defaultModelAlias: 'claude-3-5-sonnet',
      maxSteps: 10,
      systemPrompts: {
        create: {
          description: 'Initial system prompt',
          prompt: `You are a threat hunting specialist AI assistant.

Your role is to:
1. Query security logs and telemetry for suspicious patterns
2. Look for indicators of compromise (IOCs) and tactics aligned with MITRE ATT&CK
3. Correlate findings across multiple data sources
4. Identify anomalous behavior that may indicate a threat
5. Document your findings with evidence and recommended actions

Be thorough, methodical, and explain your reasoning.`,
          status: 'active',
          changedByUserId: demoUser.id,
          changedByEmail: demoUser.email,
        },
      },
    },
  });

  const incidentResponseAgent = await prisma.agent.create({
    data: {
      organizationId: demoOrg.id,
      createdByUserId: demoUser.id,
      name: 'Incident Response Copilot',
      description: 'Interactive agent to assist with incident response investigations',
      type: 'copilot',
      planningMode: 'loop_with_limits',
      status: 'active',
      defaultModelAlias: 'claude-3-5-sonnet',
      maxSteps: 15,
      systemPrompts: {
        create: {
          description: 'Initial system prompt',
          prompt: `You are an incident response expert AI assistant.

Your role is to:
1. Help security analysts investigate incidents
2. Provide guidance on containment and remediation steps
3. Query relevant tools and data sources
4. Document the incident timeline
5. Recommend actions based on best practices and your analysis

Be interactive, ask clarifying questions when needed, and provide step-by-step guidance.`,
          status: 'active',
          changedByUserId: demoUser.id,
          changedByEmail: demoUser.email,
        },
      },
    },
  });

  console.log('✅ Created 3 sample agents');

  // Create sample detection
  console.log('Creating sample detection...');
  await prisma.detection.create({
    data: {
      organizationId: demoOrg.id,
      title: 'Suspicious PowerShell Execution',
      description: 'Detects potentially malicious PowerShell command execution patterns',
      type: 'pattern-agent',
      status: 'active',
      linkedAgentId: threatHuntingAgent.id,
      mitreTechniqueIds: ['T1059'],
      severity: 'high',
    },
  });

  await prisma.detection.create({
    data: {
      organizationId: demoOrg.id,
      title: 'Credential Dumping Attempt',
      description: 'Detects attempts to dump credentials from LSASS or registry',
      type: 'rule',
      status: 'active',
      mitreTechniqueIds: ['T1003'],
      severity: 'critical',
    },
  });

  console.log('✅ Created sample detections');

  console.log('\n✨ Seeding complete!');
  console.log('\n📝 Demo credentials:');
  console.log('   Email: demo@example.com');
  console.log('   Password: demo123');
  console.log('\n🚀 You can now run the application and login with these credentials.\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
