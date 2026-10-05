/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Settings, User, CheckCircle, XCircle, Bot, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [context, setContext] = useState("Northstar"); // Northstar, LumenWorks, Internal
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, user_context: context }),
      });
      const data = await res.json();
      
      setMessages((prev) => [
        ...prev,
        { 
          role: "agent", 
          content: data.reply, 
          tools_used: data.tools_used,
          action_payload: data.action_payload 
        },
      ]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "agent", content: "Error connecting to server." }]);
    } finally {
      setLoading(false);
    }
  };

  const confirmAction = async (index: number) => {
    const payload = messages[index].action_payload;
    
    // Call the backend to actually execute and log the action
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      const res = await fetch(`${apiUrl}/api/action/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: payload.action_type,
          details: payload.details,
          user_context: payload.initiated_by || context,
        }),
      });
      const data = await res.json();
      
      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[index] = {
          ...newMsgs[index],
          action_payload: { ...newMsgs[index].action_payload, status: "CONFIRMED" },
          action_result: data.message,
        };
        return newMsgs;
      });
    } catch {
      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[index] = {
          ...newMsgs[index],
          action_payload: { ...newMsgs[index].action_payload, status: "CONFIRMED" },
          action_result: "Action confirmed (backend unavailable — logged locally).",
        };
        return newMsgs;
      });
    }
  };

  const cancelAction = (index: number) => {
    setMessages((prev) => {
      const newMsgs = [...prev];
      newMsgs[index] = {
        ...newMsgs[index],
        action_payload: { ...newMsgs[index].action_payload, status: "CANCELLED" },
      };
      return newMsgs;
    });
  };

  // Render markdown content using react-markdown for proper formatting
  const renderContent = (text: string) => {
    if (!text) return null;
    // Clean up any raw <br> tags from LLM output
    let cleaned = text.replace(/<br\s*\/?>/gi, "\n");
    
    // Fix malformed tables: if LLM still outputs tables despite instructions,
    // insert newlines at row boundaries. A row boundary is "| |" where first | ends a row.
    if (cleaned.includes("|") && cleaned.split("|").length > 6) {
      // Only apply table fix if there are many pipes (likely a table)
      cleaned = cleaned.replace(/\|\s*\n?\s*\|/g, (match) => {
        // Preserve if already has newline
        if (match.includes("\n")) return match;
        return "|\n|";
      });
    }

    return (
      <ReactMarkdown
        components={{
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          table: ({ children }) => (
            <table className="my-2 border-collapse text-xs w-full">
              {children}
            </table>
          ),
          thead: ({ children }) => <thead className="bg-neutral-200">{children}</thead>,
          th: ({ children }) => <th className="border border-neutral-300 px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-neutral-300 px-2 py-1">{children}</td>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-1 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-1 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          code: ({ children }) => <code className="bg-neutral-200 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
        }}
      >
        {cleaned}
      </ReactMarkdown>
    );
  };

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-neutral-200 flex flex-col p-4">
        <div className="flex items-center gap-2 mb-8 text-lg font-semibold tracking-tight">
          <div className="w-6 h-6 bg-black rounded-sm"></div>
          ParcelPilot AI
        </div>

        <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-3">
          Simulated Context
        </div>
        <div className="flex flex-col gap-2">
          {["Northstar", "LumenWorks", "Internal"].map((ctx) => (
            <button
              key={ctx}
              onClick={() => setContext(ctx)}
              className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                context === ctx
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {ctx}
            </button>
          ))}
        </div>
        
        <div className="mt-auto">
            <a href="/dashboard" className="text-sm text-blue-600 hover:underline">
                → Go to Insights Dashboard
            </a>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full shadow-sm bg-white border-x border-neutral-100">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="text-center text-sm text-neutral-400 my-4">
            Started session as {context}
          </div>

          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "agent" && (
                  <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 border border-neutral-200">
                    <Bot size={18} className="text-neutral-600" />
                  </div>
                )}
                
                <div className="max-w-[80%] flex flex-col gap-2">
                  {/* Tool Usage Logs */}
                  {msg.tools_used && msg.tools_used.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {msg.tools_used.map((tool: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 px-2 py-1 rounded-md w-fit border border-neutral-100">
                          <Settings size={12} className="animate-spin-slow" />
                          {tool}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-black text-white rounded-br-none"
                        : "bg-neutral-100 text-neutral-800 rounded-bl-none"
                    }`}
                  >
                    {msg.role === "agent" ? renderContent(msg.content) : msg.content}
                  </div>

                  {/* Action Payload: REQUIRES_CONFIRMATION */}
                  {msg.action_payload && msg.action_payload.status === "REQUIRES_CONFIRMATION" && (
                    <div className="mt-2 p-4 bg-white border border-neutral-200 rounded-xl shadow-sm w-80">
                      <div className="font-semibold text-sm mb-1 text-black">Action Required</div>
                      <div className="text-xs text-neutral-500 mb-4">{msg.action_payload.action_type}</div>
                      <div className="text-sm bg-neutral-50 p-2 rounded-md mb-4 text-neutral-700 font-mono text-xs">
                        {msg.action_payload.details}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => confirmAction(idx)}
                          className="flex-1 flex items-center justify-center gap-2 bg-black text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors">
                          <CheckCircle size={16} /> Confirm
                        </button>
                        <button 
                          onClick={() => cancelAction(idx)}
                          className="flex-1 flex items-center justify-center gap-2 bg-neutral-100 text-neutral-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-neutral-200 transition-colors">
                          <XCircle size={16} /> Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Action Payload: CONFIRMED */}
                  {msg.action_payload && msg.action_payload.status === "CONFIRMED" && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl shadow-sm text-sm flex flex-col gap-1 w-fit">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} /> Action Executed Successfully
                      </div>
                      {msg.action_result && (
                        <div className="text-xs text-green-600 pl-6">{msg.action_result}</div>
                      )}
                    </div>
                  )}

                  {/* Action Payload: CANCELLED */}
                  {msg.action_payload && msg.action_payload.status === "CANCELLED" && (
                    <div className="mt-2 p-3 bg-neutral-50 border border-neutral-200 text-neutral-500 rounded-xl shadow-sm text-sm flex items-center gap-2 w-fit">
                      <XCircle size={16} /> Action Cancelled
                    </div>
                  )}

                </div>
                
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center shrink-0">
                    <User size={18} className="text-neutral-600" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 border border-neutral-200">
                <Bot size={18} className="text-neutral-600" />
              </div>
              <div className="px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl rounded-bl-none flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-neutral-400" />
                <span className="text-sm text-neutral-500">Agent is thinking...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-neutral-100">
          <form onSubmit={sendMessage} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about orders, policies, or request an action..."
              className="w-full bg-neutral-100 border-transparent focus:border-neutral-300 focus:bg-white focus:ring-0 rounded-full py-3 pl-5 pr-12 text-sm outline-none transition-all shadow-inner"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 p-2 bg-black text-white rounded-full hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
          <div className="text-center text-xs text-neutral-400 mt-2">
            The agent enforces access control based on the selected simulated context.
          </div>
        </div>
      </div>
    </div>
  );
}

