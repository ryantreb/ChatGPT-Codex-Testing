'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/store/auth-store';

export default function AgentsPage() {
  const selectedOrganizationId = useAuthStore((state) => state.selectedOrganizationId);

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents', selectedOrganizationId],
    queryFn: () => apiClient.listAgents(selectedOrganizationId!),
    enabled: !!selectedOrganizationId,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agents</h1>
        <button className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          Create Agent
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents?.map((agent: any) => (
            <div key={agent.id} className="rounded-lg border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">{agent.name}</h3>
              <p className="mt-2 text-sm text-gray-600">{agent.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                  {agent.type}
                </span>
                <span className="text-xs text-gray-500">{agent.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
