'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/store/auth-store';

export default function ChatPage() {
  const selectedOrganizationId = useAuthStore((state) => state.selectedOrganizationId);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const { data: chats, isLoading } = useQuery({
    queryKey: ['chats', selectedOrganizationId],
    queryFn: () => apiClient.listChats(selectedOrganizationId!),
    enabled: !!selectedOrganizationId,
  });

  return (
    <div className="flex h-full gap-6">
      {/* Chat list */}
      <div className="w-80 rounded-lg bg-white p-4 shadow">
        <h2 className="mb-4 text-lg font-semibold">Chats</h2>
        {isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-2">
            {chats?.data?.map((chat: any) => (
              <button
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={`w-full rounded-md border p-3 text-left hover:bg-gray-50 ${
                  selectedChatId === chat.id ? 'border-blue-500 bg-blue-50' : ''
                }`}
              >
                <div className="font-medium">{chat.title || 'New Chat'}</div>
                <div className="text-xs text-gray-500">
                  {new Date(chat.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat view */}
      <div className="flex-1 rounded-lg bg-white p-6 shadow">
        {selectedChatId ? (
          <div>
            <h2 className="text-lg font-semibold">Chat View</h2>
            <p className="mt-2 text-gray-500">Chat implementation here...</p>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            Select a chat to view
          </div>
        )}
      </div>
    </div>
  );
}
