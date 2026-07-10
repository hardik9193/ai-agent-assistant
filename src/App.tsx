/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import "./App.css";
import { documents } from "./documents";

import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// API Key from .env file
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const WEATHER_KEY = import.meta.env.VITE_WEATHER_API_KEY;

// Gemini AI initialize
const genAI = new GoogleGenerativeAI(API_KEY);

// Embedding model - ek baar banao, sab jagah use
const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

// Text → numbers
const getEmbedding = async (text: string): Promise<number[]> => {
  const r = await embeddingModel.embedContent(text);
  return r.embedding.values;
};

// 2 arrays kitne similar (0-1)
const cosineSimilarity = (a: number[], b: number[]) => {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

// Tool definitions
const tools = [
  {
    functionDeclarations: [
      {
        name: "calculate",
        description:
          "Performs mathematical calculations. Use this for ANY math operations including addition, subtraction, multiplication, division, or complex expressions. ALWAYS use this tool when user asks for any calculation, even simple ones.",
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description:
                "A valid math expression. Examples: '2 + 2', '25 * 47', '(100 - 50) / 2', 'Math.sqrt(144)'",
            },
          },
          required: ["expression"],
        },
      },
      {
        name: "getCurrentTime",
        description:
          "Returns the current date and time in India (IST). Use when user asks about time, date, day, or 'kya time hai'.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "generateRandom",
        description:
          "Generates a random number between min and max values. Use when user asks for random number, lottery number, or 'random number do'.",
        parameters: {
          type: "object",
          properties: {
            min: { type: "number", description: "Minimum value (inclusive)" },
            max: { type: "number", description: "Maximum value (inclusive)" },
          },
          required: ["min", "max"],
        },
      },
      // Tool 4: Weather
      {
        name: "getWeather",
        description:
          "Gets current weather for a city. Use when user asks about weather, temperature, mausam of any city.",
        parameters: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name like 'Mumbai', 'Delhi', 'Rajkot'",
            },
          },
          required: ["city"],
        },
      },
      // Tool 5: Search HR Documents (RAG!)
      {
        name: "searchDocs",
        description:
          "Searches company HR policy documents. Use when user asks about leaves, work from home, working hours, holidays, insurance, or any HR policy question.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search keywords like 'leave', 'wfh', 'holiday'",
            },
          },
          required: ["query"],
        },
      },
    ],
  },
];

// Model with tools + system prompt
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  tools: tools as any,
  systemInstruction: `Tum Hardik ka personal AI coding mentor ho.
  Rules:
  - Hinglish mein baat karo (Hindi + English mix)
  - Frontend development (React, JavaScript, TypeScript) mein expert ho
  - Code examples hamesha do jab coding sawaal ho
  - Friendly aur encouraging raho
  - Short aur clear answers do, lambe nahi
  - Jab math/time/random chahiye, tools use karo`,
});

interface Message {
  role: "user" | "ai";
  text: string;
}

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [cache, setCache] = useState<{ [key: string]: string }>({});
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  const [pdfDocs, setPdfDocs] = useState<
    { topic: string; text: string; embedding: number[] }[]
  >([]);
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Tool executor
  const executeFunctionCall = async (
    functionName: string,
    args: any,
  ): Promise<string> => {
    console.log("🔧 Tool called:", functionName, args);
    if (functionName === "calculate") {
      try {
        const result = eval(args.expression || "");
        console.log("✅ Calculate result:", result);
        return JSON.stringify({ result: result });
      } catch (error: any) {
        console.error("❌ Math error:", error);
        return JSON.stringify({ error: "Invalid math expression" });
      }
    }
    if (functionName === "getCurrentTime") {
      const now = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "full",
        timeStyle: "medium",
      });
      console.log("✅ Time result:", now);
      return JSON.stringify({ time: now });
    }
    if (functionName === "generateRandom") {
      const min = args.min || 0;
      const max = args.max || 100;
      const random = Math.floor(Math.random() * (max - min + 1)) + min;
      console.log("✅ Random result:", random);
      return JSON.stringify({ number: random, range: `${min} to ${max}` });
    }
    // Tool 4: Weather - REAL API call
    if (functionName === "getWeather") {
      try {
        const city = args.city;
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_KEY}&units=metric`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.cod !== 200) {
          return JSON.stringify({ error: "City not found" });
        }

        console.log("✅ Weather result:", data);
        return JSON.stringify({
          city: data.name,
          temp: data.main.temp,
          feels_like: data.main.feels_like,
          condition: data.weather[0].description,
          humidity: data.main.humidity,
        });
      } catch (error: any) {
        console.error("❌ Weather error:", error);
        return JSON.stringify({ error: "Weather fetch failed" });
      }
    }

    // Tool 5: Search Docs (RAG - Retrieve!)
    if (functionName === "searchDocs") {
      // Koi PDF nahi to bolo
      if (pdfDocs.length === 0) {
        return JSON.stringify({
          result: "Koi document upload nahi hua. Pehle PDF upload karein.",
        });
      }

      // 1. Query ka embedding banao
      const queryEmbedding = await getEmbedding(args.query);

      // 2. Har chunk ka similarity score nikaalo
      const scored = pdfDocs.map((doc) => ({
        text: doc.text,
        score: cosineSimilarity(queryEmbedding, doc.embedding),
      }));

      // 3. Sabse HIGH score wale upar (sort)
      scored.sort((a, b) => b.score - a.score);

      // 4. Top 2 chunks lo
      const top = scored.slice(0, 2);

      console.log(
        "📚 Top matches (score):",
        top.map((d) => d.score.toFixed(3)),
      );

      return JSON.stringify({ documents: top });
    }

    return JSON.stringify({ error: "Unknown function" });
  };

  // Auto-scroll
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTo({
        top: chatBoxRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  // 🆕 Typing effect - word by word
  const typewriterEffect = async (fullText: string) => {
    const words = fullText.split(" ");
    let currentText = "";

    setMessages((prev) => [...prev, { role: "ai", text: "" }]);
    for (let i = 0; i < words.length; i++) {
      currentText += (i === 0 ? "" : " ") + words[i];

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "ai", text: currentText };
        return updated;
      });

      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  };

  // PDF se text nikaalne wala function
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfLoading(true);

    console.log("📄 PDF loading:", file.name);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    // Har page ka text nikaalo
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    console.log("✅ PDF text extracted:", fullText.length, "characters");
    console.log("Preview:", fullText.substring(0, 200));

    //PDF text ko chunk mein thodo
    const chunks = [];
    for (let i = 0; i < fullText.length; i += 200) {
      const text = fullText.substring(i, i + 200);
      const embedding = await getEmbedding(text); // 🆕 har chunk ka embedding
      chunks.push({
        topic: `pdf-part-${i / 200 + 1}`,
        text,
        embedding, // 🆕 store karo
      });
    }
    setPdfDocs(chunks);
    setPdfFileName(file.name);
    setCache({});
    setChatHistory((prev) => [
      ...prev,
      {
        role: "user",
        parts: [
          {
            text: `Maine ab "${file.name}" document upload kiya hai. Mere pichle aur aage ke sawaalon ka jawab ab is document se searchDocs use karke do.`,
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: `Theek hai Hardik! "${file.name}" ready hai. Ab main aapke sawaalon ka jawab is document se dhund ke dunga.`,
          },
        ],
      },
    ]);
    setPdfLoading(false);

    e.target.value = "";
    console.log("📚 PDF chunks banaye:", chunks.length);
  };

  // Send message (agent loop + cache + memory)
  const sendMessage = async () => {
    if (loading) return;
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", text: input };
    setMessages([...messages, userMessage]);
    const currentInput = input;
    setInput("");

    const cacheKey = currentInput.toLowerCase().trim();

    if (cache[cacheKey]) {
      console.log("💾 Cache HIT! No API call:", cacheKey);
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: cache[cacheKey] + "\n\n*💾 (From cache)*" },
      ]);
      return;
    }

    console.log("🌐 Cache MISS - API call:", cacheKey);
    setLoading(true);

    try {
      const chat = model.startChat({ history: chatHistory });
      let chatResult = await chat.sendMessage(currentInput);
      let response = chatResult.response;

      while (response.functionCalls() && response.functionCalls()!.length > 0) {
        const functionCalls = response.functionCalls()!;
        console.log("🤖 AI wants to use tools:", functionCalls);

        const functionResponses = await Promise.all(
          functionCalls.map(async (call) => {
            const toolResult = await executeFunctionCall(
              call.name,
              call.args as any,
            );
            return {
              functionResponse: {
                name: call.name,
                response: JSON.parse(toolResult),
              },
            };
          }),
        );

        console.log("📤 Sending results back:", functionResponses);
        chatResult = await chat.sendMessage(functionResponses);
        response = chatResult.response;
      }

      const aiText = response.text();
      console.log("✅ Final AI response:", aiText);

      setCache((prev) => ({ ...prev, [cacheKey]: aiText }));

      setChatHistory((prev) => [
        ...prev,
        { role: "user", parts: [{ text: currentInput }] },
        { role: "model", parts: [{ text: aiText }] },
      ]);

      await typewriterEffect(aiText);
    } catch (error: any) {
      console.error("Error:", error);
      let userFriendlyError = "Kuch galat ho gaya. Please try again.";
      if (error.message?.includes("429")) {
        userFriendlyError = "⏰ Rate limit hit! Wait 1 minute.";
      } else if (error.message?.includes("503")) {
        userFriendlyError = "🔄 Server busy hai abhi. 5 second baad try karo.";
      } else if (error.message?.includes("API key")) {
        userFriendlyError = "🔑 API key invalid.";
      }
      setMessages((prev) => [...prev, { role: "ai", text: userFriendlyError }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus(); // 🆕 focus wapas input pe
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setChatHistory([]);
  };

  const suggestions = [
    {
      icon: "⚛️",
      title: "React Hooks",
      desc: "useState, useEffect with examples",
      prompt: "Mujhe React hooks sikhao with examples",
    },
    {
      icon: "📘",
      title: "TypeScript",
      desc: "Basics, types aur interfaces",
      prompt: "TypeScript basics samjhao",
    },
    {
      icon: "🚀",
      title: "Project Ideas",
      desc: "Portfolio-worthy React projects",
      prompt: "Mujhe ek React project idea do",
    },
    {
      icon: "🤖",
      title: "AI Agents",
      desc: "Function calling kaise kaam karta",
      prompt: "AI agent kya hota hai? Detail mein samjhao",
    },
  ];

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="chat-header">
        <div className="header-brand">
          <div className="brand-avatar">
            <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
              <rect y="0" width="42" height="14" fill="#FF9933" />
              <rect y="14" width="42" height="14" fill="#fff" />
              <rect y="28" width="42" height="14" fill="#138808" />
              <circle
                cx="21"
                cy="21"
                r="5"
                fill="none"
                stroke="#000080"
                strokeWidth="0.8"
              />
              <circle cx="21" cy="21" r="1" fill="#000080" />
              {Array.from({ length: 24 }).map((_, i) => (
                <line
                  key={i}
                  x1="21"
                  y1="21"
                  x2="21"
                  y2="16"
                  stroke="#000080"
                  strokeWidth="0.4"
                  transform={`rotate(${i * 15} 21 21)`}
                />
              ))}
            </svg>
          </div>
          <div>
            <div className="brand-name">Hardik's AI Assistant</div>
            <div className="brand-status">
              <span className="status-dot" /> Online · 3 tools active
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            className="clear-btn"
            onClick={() => {
              setMessages([]);
              setChatHistory([]);
              setCache({});
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New chat
          </button>
        )}
      </header>

      {/* Chat Area */}
      <div
        ref={chatBoxRef}
        className="chat-area"
        style={{ overflowY: messages.length === 0 ? "hidden" : "auto" }}
      >
        {messages.length === 0 ? (
          <div className="welcome">
            <div className="welcome-badge">AI CODING MENTOR</div>
            <h1 className="welcome-title">
              Namaste Hardik <span className="wave">👋</span>
            </h1>
            <p className="welcome-sub">
              Aaj kya seekhna hai? Neeche se choose karo ya khud poochho.
            </p>
            <div className="suggestion-grid">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-card"
                  onClick={() => setInput(s.prompt)}
                >
                  <span className="suggestion-emoji">{s.icon}</span>
                  <span className="suggestion-text">
                    <strong>{s.title}</strong>
                    <small>{s.desc}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((msg, index) =>
              msg.role === "user" ? (
                <div key={index} className="row user-row">
                  <div className="bubble user-bubble">{msg.text}</div>
                </div>
              ) : (
                <div key={index} className="row ai-row">
                  <div className="ai-avatar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2L14.4 8.6L21 9.2L16.2 13.6L17.8 20.4L12 16.8L6.2 20.4L7.8 13.6L3 9.2L9.6 8.6L12 2Z"
                        fill="white"
                      />
                    </svg>
                  </div>
                  <div className="bubble ai-bubble">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              ),
            )}

            {loading && (
              <div className="row ai-row">
                <div className="ai-avatar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L14.4 8.6L21 9.2L16.2 13.6L17.8 20.4L12 16.8L6.2 20.4L7.8 13.6L3 9.2L9.6 8.6L12 2Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <div className="bubble ai-bubble typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="input-zone">
        {pdfLoading && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#f0f1fa",
              borderRadius: "8px",
              padding: "8px 12px",
              marginBottom: "8px",
              fontSize: "12px",
              color: "#2526B3",
            }}
          >
            <span
              style={{
                width: "14px",
                height: "14px",
                border: "2px solid #c9cbf5",
                borderTopColor: "#2526B3",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.7s linear infinite",
              }}
            />
            PDF processing...
          </div>
        )}

        {pdfFileName && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#eafaf1",
              border: "1px solid #35c47d",
              borderRadius: "8px",
              padding: "6px 10px",
              marginBottom: "8px",
              maxWidth: "220px",
            }}
          >
            <span style={{ fontSize: "16px" }}>✅</span>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#171713",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {pdfFileName}
              </div>
              <div
                style={{ fontSize: "10px", color: "#35c47d", fontWeight: 500 }}
              >
                Uploaded successfully
              </div>
            </div>
            <button
              onClick={() => {
                setPdfFileName("");
                setPdfDocs([]);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                color: "#8a8d98",
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        )}
        <div className="input-pill">
          <label
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "#f0f1fa",
              border: "1px solid #e2e3ee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: "20px",
              color: "#2526B3",
              fontWeight: 400,
            }}
          >
            +
            <input
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              style={{ display: "none" }}
            />
          </label>
          <input
            type="text"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask anything..."
          />
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12L20 4L13.5 20L11.5 13L4 12Z"
                fill="white"
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="footnote">AI can make mistakes. Verify important info.</p>
      </div>

      {/* Styles */}
      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .app-shell {
          display: flex;
          flex-direction: column;
          height: 100%;
          max-width: 860px;
          margin: 0 auto;
          background: #fff;
          font-family: 'Roboto', system-ui, sans-serif;
          box-shadow: 0 0 40px rgba(37, 38, 179, 0.06);
          border-radius: 8px;
          overflow: hidden;
        }

        /* ---------- Header ---------- */
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 24px;
          border-bottom: 1px solid #edeef5;
          background: #fff;
          flex-shrink: 0;
        }
        .header-brand { display: flex; align-items: center; gap: 12px; }
        .brand-avatar {
          width: 35px; height: 35px;
          border-radius: 13px;
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(37, 38, 179, 0.25);
        }
        .brand-avatar svg { width: 100%; height: 100%; }
        .brand-name { font-size: 15.5px; font-weight: 600; color: #171713; letter-spacing: -0.2px; }
        .brand-status { font-size: 12px; color: #8a8d98; display: flex; align-items: center; gap: 6px; margin-top: 2px; }
        .status-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #35c47d;
          box-shadow: 0 0 0 3px rgba(53, 196, 125, 0.15);
        }
        .clear-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  color: #55586a;
  background: #fff;
  border: 1px solid #e2e3ee;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.clear-btn:hover {
  background: #eef0ff;
  color: #2526B3;
  border-color: #c9cbf5;
}
.clear-btn svg {
  flex-shrink: 0;
  display: block;
}

        /* ---------- Chat Area ---------- */
       .chat-area {
  flex: 1;
  background: #fff;
}

        /* ---------- Welcome ---------- */
        .welcome {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          text-align: center;
        }
        .welcome-badge {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2px;
          color: #2526B3;
          background: #eef0ff;
          padding: 7px 14px;
          border-radius: 100px;
          margin-bottom: 20px;
        }
        .welcome-title {
          font-size: 32px;
          font-weight: 700;
          color: #171713;
          margin: 0 0 10px;
          letter-spacing: -0.5px;
        }
        .wave { display: inline-block; animation: wave 1.8s ease-in-out infinite; transform-origin: 70% 70%; }
        @keyframes wave {
          0%, 60%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-8deg); }
          30% { transform: rotate(14deg); }
          40% { transform: rotate(-4deg); }
          50% { transform: rotate(10deg); }
        }
        .welcome-sub { font-size: 14.5px; color: #8a8d98; margin: 0 0 36px; }
        .suggestion-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          width: 100%;
          max-width: 560px;
        }
        .suggestion-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          background: #fff;
          border: 1px solid #e7e8f0;
          border-radius: 14px;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: all 0.18s ease;
        }
        .suggestion-card:hover {
          border-color: #2526B3;
          box-shadow: 0 6px 20px rgba(37, 38, 179, 0.12);
          transform: translateY(-2px);
        }
        .suggestion-emoji {
          width: 42px; height: 42px;
          border-radius: 11px;
          background: #f2f3ff;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }
        .suggestion-text { display: flex; flex-direction: column; gap: 2px; }
        .suggestion-text strong { font-size: 14px; color: #171713; font-weight: 600; }
        .suggestion-text small { font-size: 12px; color: #8a8d98; }

        /* ---------- Messages ---------- */
        .messages {
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .row { display: flex; align-items: flex-end; gap: 10px; }
        .user-row { justify-content: flex-end; }
        .ai-row { justify-content: flex-start; }
        .ai-avatar {
          width: 30px; height: 30px;
          border-radius: 9px;
          background: linear-gradient(135deg, #2526B3 0%, #5a5be0 100%);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          margin-bottom: 4px;
        }
        .bubble {
          font-size: 15px;
          line-height: 1.65;
          animation: pop 0.25s ease;
        }
        @keyframes pop {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .user-bubble {
          background: linear-gradient(135deg, #2526B3 0%, #4344cf 100%);
          color: #fff;
          padding: 13px 18px;
          border-radius: 18px 18px 5px 18px;
          max-width: 70%;
          box-shadow: 0 3px 10px rgba(37, 38, 179, 0.2);
        }
        .ai-bubble {
          background: #fff;
          color: #24252d;
          padding: 6px 20px;
          border-radius: 18px 18px 18px 5px;
          max-width: 78%;
          border: 1px solid #ebecf3;
          box-shadow: 0 2px 8px rgba(20, 20, 60, 0.04);
        }
        .ai-bubble pre {
          background: #171725;
          color: #e8e8f0;
          padding: 14px;
          border-radius: 10px;
          overflow-x: auto;
          font-size: 13px;
        }
        .ai-bubble code { font-size: 13.5px; }
        .ai-bubble p code {
          background: #f0f1fa;
          color: #2526B3;
          padding: 2px 6px;
          border-radius: 5px;
        }

        /* Typing dots */
        .typing { display: flex; gap: 5px; align-items: center; padding: 16px 20px; }
        .dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #2526B3;
          animation: bounce 1.2s infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.15s; }
        .dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-6px); opacity: 1; }
        }

        /* ---------- Input ---------- */
        .input-zone {
          padding: 16px 24px 10px;
          background: #fff;
          border-top: 1px solid #edeef5;
          flex-shrink: 0;
        }
        .input-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          border: 1.5px solid #e2e3ee;
          border-radius: 16px;
          padding: 8px 8px 8px 10px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 10px rgba(20, 20, 60, 0.04);
        }
        .input-pill:focus-within {
          border-color: #2526B3;
          box-shadow: 0 0 0 4px rgba(37, 38, 179, 0.08);
        }
        .input-pill input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 15px;
          padding: 12px 0;
          color: #171713;
          font-family: inherit;
        }
        .input-pill input::placeholder { color: #a2a5b3; }
        .send-btn {
          width: 44px; height: 44px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #2526B3 0%, #4344cf 100%);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: all 0.18s ease;
          box-shadow: 0 3px 10px rgba(37, 38, 179, 0.3);
        }
        .send-btn:hover:not(:disabled) { transform: scale(1.05); }
        .send-btn:disabled {
          background: #d4d5e3;
          box-shadow: none;
          cursor: not-allowed;
        }
        .footnote {
          text-align: center;
          font-size: 11px;
          color: #b0b3c0;
          margin: 10px 0 0;
        }

        /* Scrollbar */
        .chat-area::-webkit-scrollbar { width: 6px; }
        .chat-area::-webkit-scrollbar-track { background: transparent; }
        .chat-area::-webkit-scrollbar-thumb { background: #d8d9e6; border-radius: 10px; }

        /* Mobile */
        @media (max-width: 640px) {
          .suggestion-grid { grid-template-columns: 1fr; }
          .welcome-title { font-size: 26px; }
          .user-bubble, .ai-bubble { max-width: 85%; }
        }
      `}</style>
    </div>
  );
}

export default App;
