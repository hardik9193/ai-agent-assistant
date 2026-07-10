# 🤖 AI Agent Assistant

🔗 **Live Demo:** https://ai-agent-assistant-y275.vercel.app

An AI-powered assistant built with **React + TypeScript + Google Gemini**, featuring function calling, a semantic RAG pipeline for chatting with your PDFs, conversation memory, and real-time weather data.

---

## ✨ Features

- **AI Agent with Function Calling** — 5 working tools:
  - 🧮 Calculator (math expressions)
  - 🕐 Current time (IST)
  - 🎲 Random number generator
  - 🌤️ Real-time weather (OpenWeatherMap API)
  - 📄 Document search (semantic RAG over uploaded PDFs)
- **Chat with PDF (Semantic RAG)** — upload a PDF and ask questions about it
  - PDF text extraction with `pdfjs-dist`
  - Text chunking for efficient retrieval
  - **Embeddings-based semantic search** (`gemini-embedding-001`)
  - **Cosine similarity** to retrieve the most relevant chunks — matches by _meaning_, not just keywords
- **Conversation Memory** — remembers context across messages
- **Response Caching** — saves API calls for repeated queries
- **Streaming Effect** — ChatGPT-style typing animation
- **Custom System Prompt** — personalized AI personality
- **Modern UI** — ChatGPT-inspired design with file upload, loading states, and success indicators

---

## 🛠️ Tech Stack

- React 18 + TypeScript
- Vite
- Google Gemini API (`gemini-2.5-flash` for chat, `gemini-embedding-001` for embeddings)
- OpenWeatherMap API
- `pdfjs-dist` (PDF parsing)
- Deployed on Vercel

---

## 🧠 How the RAG Pipeline Works

**Indexing (on PDF upload):**

1. Extract text from the PDF
2. Split text into small chunks
3. Generate an embedding (vector) for each chunk
4. Store chunks with their embeddings

**Retrieval (on each question):**

1. Generate an embedding for the user's question
2. Compare it against every chunk using cosine similarity
3. Retrieve the top most-similar chunks
4. Pass them to Gemini to generate a grounded answer

This means paraphrased questions still find the right content — something keyword search can't do.

---

## 🚀 Setup

1. Clone the repo
   ```bash
   git clone https://github.com/hardik9193/ai-agent-assistant.git
   cd ai-agent-assistant
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Create a `.env` file in the root:
   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_WEATHER_API_KEY=your_openweathermap_api_key
   ```
4. Run the dev server
   ```bash
   npm run dev
   ```

---

## 👨‍💻 Author

**Hardik Trada** — Senior Frontend Developer transitioning to AI Engineering
