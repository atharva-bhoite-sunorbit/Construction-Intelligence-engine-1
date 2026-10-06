import React, { useState } from 'react';
import { X, Bot, Send, Sparkles, User, HelpCircle, ArrowRight } from 'lucide-react';
import { apiClient } from '../api/client';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  time: string;
}

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: number;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  projectId,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: "Hello! I am your AI Construction Intelligence Assistant. I am directly connected to the active project's scheduling engine, ML delay predictions, and site logs. How can I assist your site operations today?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const sampleQuestions = [
    'Which activities are delayed?',
    'Which activities are at high risk?',
    'What is the predicted completion date?',
    'Which activities are on the critical path?',
    'How many workers are required?',
    'Which materials may become short?',
    'Which activities can run in parallel?',
    'What should the project manager investigate?',
  ];

  if (!isOpen) return null;

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await apiClient.askAIChat(textToSend, projectId);
      const aiMsg: Message = {
        sender: 'assistant',
        text: res.response,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Error connecting to the AI Construction Intelligence Engine.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white border-l border-slate-200 shadow-xs border border-slate-200 flex flex-col">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">AI Construction Assistant</h3>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected to Project Database & ML Engine
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Suggested Quick Prompt Pills */}
      <div className="p-3 border-b border-slate-200 bg-slate-50 overflow-x-auto">
        <div className="flex items-center gap-1.5 pb-1">
          <Sparkles className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">
            Suggested Inquiries:
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {sampleQuestions.slice(0, 4).map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              className="text-[11px] bg-slate-50 hover:bg-brand-600/20 hover:text-brand-300 border border-slate-200 hover:border-brand-500/40 text-slate-700 px-2.5 py-1 rounded-full transition-all text-left truncate max-w-full"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/10'
                  : 'bg-white border border-slate-200 text-slate-800 shadow-md'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
              <div
                className={`mt-1.5 text-[10px] text-right ${
                  m.sender === 'user' ? 'text-brand-200' : 'text-slate-500'
                }`}
              >
                {m.time}
              </div>
            </div>

            {m.sender === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 items-center text-slate-500 text-xs">
            <div className="w-7 h-7 rounded-lg bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <span>Analyzing database, CPM dependencies, and delay probabilities...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(inputQuery);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask anything about delays, schedule, critical path..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
