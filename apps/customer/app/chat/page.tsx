'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Mic } from 'lucide-react';

const MOCK_MENU = [
  { id: 1, name: "Tusker", price: 300 },
  { id: 2, name: "White Cap", price: 280 },
  { id: 3, name: "Guinness", price: 350 },
  { id: 4, name: "Whiskey Coke", price: 700 },
  { id: 5, name: "Vodka Redbull", price: 600 },
  { id: 6, name: "Water", price: 80 },
];

export default function ChatPage() {
  const router = useRouter();
  const [tab, setTab] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tabData = sessionStorage.getItem('currentTab');
    if (tabData) {
      setTab(JSON.parse(tabData));
      // Welcome message
      setMessages([{
        id: '1',
        text: `Welcome! 🍻 You can browse the menu or just tell me what you'd like to order.`,
        sender: 'staff',
        timestamp: new Date()
      }]);
    }

    const cartData = sessionStorage.getItem('cart');
    if (cartData) {
      setCart(JSON.parse(cartData));
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const parseOrder = (text: string) => {
    const normalizedText = text.toLowerCase();
    const foundItems: any[] = [];
    
    MOCK_MENU.forEach((item: any) => {
      const itemName = item.name.toLowerCase();
      if (normalizedText.includes(itemName)) {
        const quantityMatch = normalizedText.match(new RegExp(`(\\d+)\\s*x?\\s*${itemName}|${itemName}\\s*x?\\s*(\\d+)`));
        const quantity = quantityMatch ? parseInt(quantityMatch[1] || quantityMatch[2]) : 1;
        foundItems.push({ ...item, quantity });
      }
    });

    // Shortcuts
    if (normalizedText.includes('beer') || normalizedText.includes('tusker')) {
      const tusker = MOCK_MENU.find((i: any) => i.name === 'Tusker');
      if (tusker && !foundItems.find((i: any) => i.id === tusker.id)) {
        const quantityMatch = normalizedText.match(/(\d+)\s*beer|beer\s*(\d+)/);
        const quantity = quantityMatch ? parseInt(quantityMatch[1] || quantityMatch[2]) : 1;
        foundItems.push({ ...tusker, quantity });
      }
    }

    return foundItems;
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMsg = {
      id: Math.random().toString(36).substring(2, 11),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages([...messages, userMsg]);

    const foundItems = parseOrder(inputMessage);

    setTimeout(() => {
      if (foundItems.length > 0) {
        // Add to cart
        const newCart = [...cart];
        foundItems.forEach((item: any) => {
          const existing = newCart.find((c: any) => c.id === item.id);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            newCart.push(item);
          }
        });
        setCart(newCart);
        sessionStorage.setItem('cart', JSON.stringify(newCart));

        const itemsList = foundItems.map((i: any) => `${i.quantity}x ${i.name}`).join(', ');
        const total = foundItems.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
        
        const staffMsg = {
          id: Math.random().toString(36).substring(2, 11),
          text: `Perfect! I've added ${itemsList} to your cart. Total: KSh ${total}. Coming right up! 🍺`,
          sender: 'staff',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, staffMsg]);
      } else {
        const staffMsg = {
          id: Math.random().toString(36).substring(2, 11),
          text: "Sorry, I didn't catch that. Could you try again? You can say things like '2 Tusker' or 'one whiskey coke' 😊",
          sender: 'staff',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, staffMsg]);
      }
    }, 800);

    setInputMessage('');
  };

  const quickReplies = ["2 Tusker", "Guinness", "Vodka Redbull", "Water"];

  if (!tab) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 flex items-center gap-3 shadow-lg">
        <button 
          onClick={() => router.push('/menu')}
          className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Chat Order</h1>
          <p className="text-sm text-green-100">Just tell us what you want</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-green-100">Tab</p>
          <p className="font-bold">#{tab.number}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {messages.map((msg: any) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
              msg.sender === 'user' 
                ? 'bg-orange-500 text-white rounded-br-sm' 
                : 'bg-white shadow-sm rounded-bl-sm'
            }`}>
              <p className={msg.sender === 'user' ? 'text-white' : 'text-gray-800'}>{msg.text}</p>
              <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-orange-100' : 'text-gray-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {messages.length > 0 && (
        <div className="px-4 py-2 bg-white border-t">
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {quickReplies.map((reply: any, idx: number) => (
              <button
                key={idx}
                onClick={() => setInputMessage(reply)}
                className="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium whitespace-nowrap hover:bg-gray-200"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center gap-2">
          <button className="p-3 bg-gray-100 rounded-full hover:bg-gray-200">
            <Mic size={20} className="text-gray-600" />
          </button>
          <input
            type="text"
            value={inputMessage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputMessage(e.target.value)}
            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your order... (e.g., '2 Tusker')"
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-full focus:border-green-500 focus:outline-none"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim()}
            className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:bg-gray-300"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}