import React, { useState, useRef, useEffect } from 'react';
import {
  askFleetAI,
  FLEET_AI_UNAVAILABLE_MESSAGE,
  isStrictFleetText
} from '../../services/snsApi';
import { useFleet } from '../../context/FleetContext';
import {
  Sparkles,
  Send,
  Bot,
  User,
  CornerDownLeft,
  AlertCircle,
  RotateCcw,
  HelpCircle,
  Clock,
  X,
  MessageSquare,
  Navigation
} from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'What is the current fleet health?',
  'Which vehicles are under maintenance?',
  'Which drivers are currently active?',
  'Which vehicles have critical fuel anomalies?',
  'Show critical safety alerts.',
  'Analyze fleet performance.',
  'What are the active trips?',
  'Optimize the route from Coimbatore to Chennai.'
];

/**
 * Stable session ID generator for current browser session
 */
const getBrowserSessionId = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      let sid = window.sessionStorage.getItem('fleet_ai_session_id');

      if (!sid) {
        sid = `fleet-admin-${Math.random().toString(36).substring(2, 9)}`;
        window.sessionStorage.setItem('fleet_ai_session_id', sid);
      }

      return sid;
    }
  } catch {
    // SessionStorage access error fallback
  }

  return 'fleet-admin-default-session';
};

export const FleetAIChatView = ({ onNavigateTab = null }) => {
  const { setHighlightMapEntity, setActiveRoute } = useFleet();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const messageIdCounterRef = useRef(0);
  const sessionIdRef = useRef(getBrowserSessionId());

  // Auto-scroll to latest message when panel is open
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';

      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        100
      )}px`;
    }
  }, [input]);

  /**
   * Extract only the actual FleetAI text response.
   *
   * Production webhook response:
   * {
   *   success: true,
   *   executionId: "...",
   *   result: {
   *     output: "FleetAI response..."
   *   }
   * }
   */
  const extractFleetAIText = (response) => {
    if (!response || response.isUnavailable) {
      return FLEET_AI_UNAVAILABLE_MESSAGE;
    }

    const possibleOutput =
      response?.data?.result?.output ??
      response?.result?.output ??
      response?.data?.output ??
      response?.data?.data?.output ??
      response?.data?.text ??
      response?.data?.answer ??
      response?.answer ??
      response?.output ??
      response?.message ??
      null;

    let candidate = '';
    // Normal expected case
    if (typeof possibleOutput === 'string') {
      candidate = possibleOutput;
    } else if (possibleOutput && typeof possibleOutput === 'object') {
      if (typeof possibleOutput.output === 'string') {
        candidate = possibleOutput.output;
      } else if (typeof possibleOutput.text === 'string') {
        candidate = possibleOutput.text;
      } else if (typeof possibleOutput.message === 'string') {
        candidate = possibleOutput.message;
      } else if (
        possibleOutput.result &&
        typeof possibleOutput.result.output === 'string'
      ) {
        candidate = possibleOutput.result.output;
      }
    }

    if (candidate && isStrictFleetText(candidate)) {
      return candidate;
    }

    return FLEET_AI_UNAVAILABLE_MESSAGE;
  };

  /**
   * Send handler for FleetAI Copilot
   */
  const handleSend = async (textToSend = null) => {
    const query = (
      typeof textToSend === 'string' ? textToSend : input
    ).trim();

    if (!query || isLoading) return;

    messageIdCounterRef.current += 1;

    const userMessage = {
      id: `user-msg-${messageIdCounterRef.current}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Immediately append user message
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    try {
      const response = await askFleetAI(
        query,
        sessionIdRef.current
      );

      // Extract ONLY the actual AI text with strict fleet validation
      const aiAnswer = extractFleetAIText(response);

      messageIdCounterRef.current += 1;

      const vehicleMatch = aiAnswer.match(/VH\d{3}/i);
      const driverMatch = aiAnswer.match(/DR\d{3}/i);

      // Check for route optimization result in response payload
      const rawRoutePayload = 
        response?.data?.intent === 'ROUTE' || 
        response?.data?.operation === 'OPTIMIZE_ROUTE' || 
        response?.data?.data?.optimizedStops || 
        response?.data?.optimizedStops ||
        response?.intent === 'ROUTE'
          ? (response?.data?.data || response?.data || {})
          : null;

      let routeInfo = null;
      if (rawRoutePayload && (rawRoutePayload.origin || rawRoutePayload.optimizedStops)) {
        const origin = rawRoutePayload.origin || (Array.isArray(rawRoutePayload.optimizedStops) ? rawRoutePayload.optimizedStops[0] : null);
        const destination = rawRoutePayload.destination || (Array.isArray(rawRoutePayload.optimizedStops) ? rawRoutePayload.optimizedStops[rawRoutePayload.optimizedStops.length - 1] : null);
        const waypoints = Array.isArray(rawRoutePayload.waypoints) && rawRoutePayload.waypoints.length > 0
          ? rawRoutePayload.waypoints
          : (Array.isArray(rawRoutePayload.optimizedStops) && rawRoutePayload.optimizedStops.length > 2
             ? rawRoutePayload.optimizedStops.slice(1, -1)
             : []);
        const optimizedStops = Array.isArray(rawRoutePayload.optimizedStops)
          ? rawRoutePayload.optimizedStops
          : [origin, ...waypoints, destination].filter(Boolean);
        const routeGeometry = rawRoutePayload.routeGeometry || null;

        if (origin && destination) {
          routeInfo = {
            type: 'route',
            origin,
            destination,
            waypoints,
            optimizedStops,
            routeGeometry,
            distanceKm: rawRoutePayload.distanceKm,
            duration: rawRoutePayload.duration,
            statusSource: rawRoutePayload.statusSource,
            timestamp: Date.now()
          };

          // Automatically synchronize with Dispatch & Routing map
          if (setActiveRoute) setActiveRoute(routeInfo);
          setHighlightMapEntity(routeInfo);
          if (onNavigateTab) onNavigateTab('dispatch');
        }
      }

      const aiMessage = {
        id: `ai-msg-${messageIdCounterRef.current}`,
        sender: 'ai',
        text: aiAnswer,
        referencedVehicle: vehicleMatch ? vehicleMatch[0].toUpperCase() : null,
        referencedDriver: driverMatch ? driverMatch[0].toUpperCase() : null,
        referencedRoute: routeInfo,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      // NEVER leak technical details, internal URLs, status codes or stack traces
      setError(FLEET_AI_UNAVAILABLE_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <>
      {/* 1. Floating Circular AI Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          data-testid="ai-chat-launcher"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#1A1A1D] hover:bg-[#252528] text-white border border-[#3F3F46] hover:border-indigo-500/60 shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          title="Open Intelligent Fleet Assistant"
          aria-label="Open Intelligent Fleet Assistant"
        >
          <div className="relative flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-indigo-400 group-hover:text-indigo-300 transition-colors" />

            <span className="absolute -top-2 -right-2 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#1A1A1D] animate-pulse"></span>
          </div>
        </button>
      )}

      {/* 2. Floating Compact Chat Panel */}
      {isOpen && (
        <div
          data-testid="ai-chat-panel"
          className="fixed bottom-6 right-6 z-50 w-[390px] sm:w-[420px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-5rem)] bg-[#1A1A1D] border border-[#2A2A2E] shadow-2xl rounded-2xl flex flex-col overflow-hidden select-none animate-fadeIn backdrop-blur-xl"
        >

          {/* Header */}
          <div className="px-4 py-3.5 border-b border-[#2A2A2E] bg-[#1A1A1D] flex items-center justify-between flex-shrink-0">

            <div className="flex items-center space-x-3">

              <div className="p-2 rounded-xl bg-[#252528] text-indigo-400 border border-[#2A2A2E] flex items-center justify-center shadow-inner">
                <Bot className="w-4 h-4" />
              </div>

              <div>
                <div className="flex items-center space-x-2">

                  <h3 className="text-sm font-bold text-[#F5F5F5] tracking-tight">
                    Intelligent Fleet Assistant
                  </h3>

                  <span className="px-1.5 py-0.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 text-[9px] font-bold uppercase tracking-wider flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Ready</span>
                  </span>

                </div>

                <p className="text-[11px] text-[#9CA3AF]">
                  AI Fleet Intelligence & Operations
                </p>
              </div>

            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-1">

              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#252528] transition-colors"
                  title="Clear conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#252528] transition-colors"
                title="Close FleetAI"
              >
                <X className="w-4 h-4" />
              </button>

            </div>
          </div>

          {/* Scrollable Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">

            {/* Empty State */}
            {messages.length === 0 ? (

              <div className="h-full flex flex-col justify-center items-center text-center py-4 space-y-4">

                <div className="w-12 h-12 rounded-2xl bg-[#252528] border border-[#2A2A2E] flex items-center justify-center text-indigo-400 shadow-md">
                  <MessageSquare className="w-6 h-6" />
                </div>

                <div className="space-y-1">

                  <h4 className="text-sm font-bold text-[#F5F5F5]">
                    Ask Intelligent Fleet Assistant anything about your fleet
                  </h4>

                  <p className="text-[11px] text-[#9CA3AF] max-w-[260px] mx-auto">
                    Real-time telemetry, vehicle health, driver duty & trip dispatches.
                  </p>

                </div>

                {/* Suggested Questions */}
                <div className="w-full text-left space-y-2 pt-1">

                  <div className="flex items-center space-x-1.5 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider px-1">

                    <HelpCircle className="w-3 h-3 text-indigo-400" />

                    <span>Suggested Questions:</span>

                  </div>

                  <div className="grid grid-cols-1 gap-1.5">

                    {SUGGESTED_QUESTIONS.slice(0, 5).map((q, idx) => (

                      <button
                        key={idx}
                        onClick={() => handleSend(q)}
                        className="p-2.5 rounded-xl bg-[#252528] hover:bg-[#2F2F34] border border-[#2A2A2E] hover:border-indigo-500/40 text-[11px] text-[#F5F5F5] text-left transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between group shadow-sm"
                      >

                        <span className="font-medium text-[#E5E7EB] group-hover:text-white line-clamp-1">
                          {q}
                        </span>

                        <CornerDownLeft className="w-3 h-3 text-[#9CA3AF] group-hover:text-indigo-400 opacity-60 group-hover:opacity-100 flex-shrink-0 ml-2 transition-colors" />

                      </button>

                    ))}

                  </div>

                </div>

              </div>

            ) : (

              /* Message Bubbles */
              <div className="space-y-3 w-full">

                {messages.map((msg) => {

                  const isUser = msg.sender === 'user';

                  return (
                    <div
                      key={msg.id}
                      data-testid="ai-chat-message"
                      data-sender={msg.sender}
                      className={`flex items-start space-x-2 ${isUser
                        ? 'justify-end'
                        : 'justify-start'
                        }`}
                    >

                      {!isUser && (
                        <div className="w-7 h-7 rounded-xl bg-[#252528] border border-[#2A2A2E] text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div
                        className={`rounded-2xl p-3 max-w-[85%] shadow-md transition-all ${isUser
                          ? 'bg-blue-600 text-white rounded-tr-sm border border-blue-500/40'
                          : 'bg-[#0D0D0F] text-[#F5F5F5] rounded-tl-sm border border-[#2A2A2E]'
                          }`}
                      >

                        <div
                          className={`flex items-center space-x-1.5 text-[9px] mb-1 ${isUser
                            ? 'text-blue-200 justify-end'
                            : 'text-[#9CA3AF]'
                            }`}
                        >

                          <span className="font-bold">
                            {isUser
                              ? 'Fleet Manager'
                              : 'Intelligent Assistant'}
                          </span>

                          <span>•</span>

                          <span className="font-mono flex items-center space-x-1">

                            <Clock className="w-2 h-2 inline" />

                            <span>
                              {msg.timestamp}
                            </span>

                          </span>

                        </div>

                        <p className="text-xs whitespace-pre-wrap leading-relaxed">
                          {msg.text}
                        </p>

                        {(msg.referencedRoute || msg.referencedVehicle || msg.referencedDriver) && (
                          <div className="mt-2.5 pt-2 border-t border-[#2A2A2E]/60 flex flex-wrap gap-2">
                            {msg.referencedRoute && (
                              <button
                                type="button"
                                onClick={() => {
                                  const payload = {
                                    type: 'route',
                                    origin: msg.referencedRoute.origin,
                                    destination: msg.referencedRoute.destination,
                                    waypoints: msg.referencedRoute.waypoints,
                                    optimizedStops: msg.referencedRoute.optimizedStops,
                                    routeGeometry: msg.referencedRoute.routeGeometry,
                                    distanceKm: msg.referencedRoute.distanceKm,
                                    duration: msg.referencedRoute.duration,
                                    statusSource: msg.referencedRoute.statusSource,
                                    timestamp: Date.now()
                                  };
                                  if (setActiveRoute) setActiveRoute(payload);
                                  setHighlightMapEntity(payload);
                                  if (onNavigateTab) onNavigateTab('dispatch');
                                }}
                                data-testid="chat-view-focus-route"
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/50 text-[10px] font-bold transition-all shadow cursor-pointer"
                              >
                                <Navigation className="w-3 h-3 text-cyan-400" />
                                <span>View / Focus Optimized Route on Map</span>
                              </button>
                            )}
                            {msg.referencedVehicle && (
                              <button
                                type="button"
                                onClick={() => {
                                  setHighlightMapEntity({ type: 'vehicle', id: msg.referencedVehicle });
                                  if (onNavigateTab) onNavigateTab('dispatch');
                                }}
                                data-testid={`chat-view-map-${msg.referencedVehicle}`}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/50 text-[10px] font-bold transition-all shadow cursor-pointer"
                              >
                                <Navigation className="w-3 h-3 text-indigo-400" />
                                <span>Focus {msg.referencedVehicle} on Map</span>
                              </button>
                            )}
                            {msg.referencedDriver && (
                              <button
                                type="button"
                                onClick={() => {
                                  setHighlightMapEntity({ type: 'driver', id: msg.referencedDriver });
                                  if (onNavigateTab) onNavigateTab('dispatch');
                                }}
                                data-testid={`chat-view-map-${msg.referencedDriver}`}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold transition-all shadow cursor-pointer"
                              >
                                <User className="w-3 h-3 text-emerald-400" />
                                <span>Focus {msg.referencedDriver} on Map</span>
                              </button>
                            )}
                          </div>
                        )}

                      </div>

                      {isUser && (
                        <div className="w-7 h-7 rounded-xl bg-blue-700/60 border border-blue-500/40 text-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                          <User className="w-3.5 h-3.5" />
                        </div>
                      )}

                    </div>
                  );
                })}

                {/* AI Thinking State */}
                {isLoading && (

                  <div
                    data-testid="ai-chat-loading"
                    className="flex items-start space-x-2 justify-start animate-fadeIn"
                  >

                    <div className="w-7 h-7 rounded-xl bg-[#252528] border border-[#2A2A2E] text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>

                    <div className="bg-[#0D0D0F] border border-[#2A2A2E] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs text-[#9CA3AF] flex items-center space-x-2.5 shadow-md">

                      <div className="flex space-x-1">

                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>

                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse delay-150"></span>

                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse delay-300"></span>

                      </div>

                      <span className="font-semibold text-[#F5F5F5] text-xs">
                        FleetAI is thinking...
                      </span>

                    </div>

                  </div>
                )}

                {/* Error Banner */}
                {error && (

                  <div
                    data-testid="ai-chat-error"
                    className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center space-x-2 shadow-sm"
                  >

                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />

                    <span className="font-medium flex-1 text-[11px]">
                      {error}
                    </span>

                    <button
                      onClick={() => setError(null)}
                      className="text-[10px] font-bold text-rose-300 hover:text-white underline"
                    >
                      Dismiss
                    </button>

                  </div>
                )}

                <div ref={messagesEndRef} />

              </div>
            )}

          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-[#2A2A2E] bg-[#1A1A1D] flex-shrink-0">

            <div className="relative flex items-center rounded-xl bg-[#0D0D0F] border border-[#2A2A2E] focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/40 transition-all p-1 shadow-inner">

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                data-testid="ai-chat-input"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask FleetAI about your fleet..."
                className="flex-1 px-3 py-2 bg-transparent text-[#F5F5F5] placeholder-[#9CA3AF] text-xs focus:outline-none resize-none max-h-24 overflow-y-auto"
              />

              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                data-testid="ai-chat-send"
                className={`p-2 rounded-lg transition-all flex items-center justify-center flex-shrink-0 ${input.trim() && !isLoading
                  ? 'bg-white hover:bg-neutral-200 text-[#0D0D0F] shadow-md hover:scale-105 active:scale-95'
                  : 'bg-[#252528] text-[#9CA3AF] opacity-40 cursor-not-allowed'
                  }`}
                title="Send Message (Enter)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>

            </div>

            <div className="flex items-center justify-between text-[9px] text-[#9CA3AF] px-1 pt-1.5 font-medium">

              <span>
                Press{' '}
                <kbd className="px-1 py-0.5 rounded bg-[#252528] border border-[#2A2A2E] font-mono text-zinc-300">
                  Enter
                </kbd>{' '}
                to send
              </span>

              <span className="font-mono">
                FleetAI Assistant
              </span>

            </div>

          </div>

        </div>
      )}
    </>
  );
};