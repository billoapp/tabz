'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Clock, CheckCircle, AlertCircle, MessageCircle, User, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MessagePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tabId: string;
  initialMessages: any[];
  onMessageSent: () => void;
}

export default function MessagePanel({ isOpen, onClose, tabId, initialMessages, onMessageSent }: MessagePanelProps) {
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sort messages in ascending order (oldest first, newest last)
    const sortedMessages = [...initialMessages].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    setMessages(sortedMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (isOpen) {
      scrollToTop();
    }
  }, [messages, isOpen]);

  const scrollToTop = () => {
    setTimeout(() => {
      const container = document.querySelector('.messages-container');
      if (container) {
        container.scrollTop = 0;
      }
    }, 100);
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !tabId || sendingMessage) return;
    
    setSendingMessage(true);
    
    try {
      const { error: insertError } = await supabase
        .from('tab_telegram_messages')
        .insert({
          tab_id: tabId,
          message: messageInput.trim(),
          order_type: 'telegram',
          status: 'pending',
          message_metadata: {
            type: 'general',
            urgency: 'normal',
            character_count: messageInput.trim().length,
            platform: 'customer-web'
          },
          customer_notified: true,
          customer_notified_at: new Date().toISOString(),
          initiated_by: 'customer'
        } as any);

      if (insertError) throw insertError;
      
      // Clear input
      setMessageInput('');
      
      // Notify parent to refresh messages
      onMessageSent();
      
      // Add optimistic update
      const newMessage = {
        id: `temp-${Date.now()}`,
        tab_id: tabId,
        message: messageInput.trim(),
        status: 'pending',
        initiated_by: 'customer',
        created_at: new Date().toISOString(),
        message_metadata: {
          type: 'general',
          urgency: 'normal'
        }
      };
      
      setMessages(prev => [...prev, newMessage]);
      
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(`Failed to send message: ${error.message || 'Please try again.'}`);
    } finally {
      setSendingMessage(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={24} className="text-gray-500" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Messages</h2>
                <p className="text-sm text-gray-600">Chat with staff</p>
              </div>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageCircle size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="messages-container flex-1 overflow-y-auto h-[calc(100vh-180px)] p-4 flex flex-col">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No messages yet</h3>
              <p className="text-gray-500">Start a conversation with staff</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-end">
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.initiated_by === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
                        msg.initiated_by === 'customer'
                          ? 'bg-yellow-50 text-gray-900 rounded-br-none border border-yellow-200'
                          : 'bg-blue-50 text-gray-900 rounded-bl-none border border-blue-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {msg.initiated_by === 'staff' && (
                          <div className="p-1 bg-white rounded-full shadow-sm">
                            <User size={12} className="text-gray-600" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed">{msg.message}</p>
                          <div className={`flex items-center gap-2 mt-2 ${msg.initiated_by === 'customer' ? 'text-yellow-700' : 'text-blue-700'}`}>
                            <span className="text-xs font-medium">
                              {formatTime(msg.created_at)}
                            </span>
                            {msg.initiated_by === 'customer' && (
                              <>
                                <span className="text-xs">•</span>
                                {msg.status === 'pending' && <Clock size={12} className="text-yellow-600" />}
                                {msg.status === 'acknowledged' && <CheckCircle size={12} className="text-yellow-700" />}
                                {msg.status === 'completed' && <CheckCircle size={12} className="text-green-600" />}
                                <span className="text-xs capitalize font-medium">{msg.status}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {msg.initiated_by === 'customer' && (
                          <div className="p-1 bg-yellow-100 rounded-full shadow-sm">
                            <User size={12} className="text-yellow-700" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              maxLength={500}
            />
            <button
              onClick={sendMessage}
              disabled={!messageInput.trim() || sendingMessage}
              className="px-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {sendingMessage ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Staff typically respond within a few minutes
          </p>
        </div>
      </div>
    </>
  );
}
