"use client";

import React, { useState, useRef } from "react";

export default function Home() {
  // State for API key, file, paper ID, chat, summary, code, and loading/errors
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [paperId, setPaperId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  // Chat state for chat window
  type ChatRole = 'user' | 'assistant';
  const [chatMessages, setChatMessages] = useState<{ role: ChatRole; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [code, setCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [citation, setCitation] = useState<string | null>(null);
  const [citationLoading, setCitationLoading] = useState(false);
  const [citationError, setCitationError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false); // For copy-to-clipboard feedback
  const [copiedCitation, setCopiedCitation] = useState(false); // For citation copy feedback

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get the API base URL from environment or default to localhost
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  
  // Ensure the API URL doesn't have a trailing slash to avoid double slashes
  const cleanApiUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  
  // Debug: Log the API URL to console
  console.log("API_BASE_URL:", API_BASE_URL);
  console.log("Clean API URL:", cleanApiUrl);

  // Handle PDF file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      // Warn about large files
      const fileSizeMB = selectedFile.size / (1024 * 1024);
      if (fileSizeMB > 10) {
        setUploadError(`Large file detected (${fileSizeMB.toFixed(1)}MB). This may take longer to process.`);
      } else {
        setUploadError(null);
      }
    }
  };

  // Handle paper upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setUploadError(null);
    setUploadProgress("Starting upload...");
    setPaperId(null);
    setSummary(null);
    setCode(null);
    setCitation(null);
    setChatMessages([]);
    if (!file || !apiKey) {
      setUploadError("Please provide both an API key and a PDF file.");
      setUploading(false);
      setUploadProgress("");
      return;
    }
    try {
      setUploadProgress("Uploading PDF file...");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", apiKey);
      
      console.log("Uploading to:", `${cleanApiUrl}/api/upload-paper`);
      console.log("File:", file.name, "Size:", file.size);
      
      // Add a timeout to show progress
      const uploadPromise = fetch(`${cleanApiUrl}/api/upload-paper`, {
        method: "POST",
        body: formData,
      });

      // Show progress messages
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev.includes("Processing")) {
            const count = parseInt(prev.match(/\d+/)?.[0] || "0");
            return `Processing paper content... (${count + 1}s)`;
          }
          return "Processing paper content... (1s)";
        });
      }, 1000);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Upload timeout - please try again")), 120000) // 2 minutes
      );

      // Race between upload and timeout
      const res = await Promise.race([uploadPromise, timeoutPromise]) as Response;
      
      clearInterval(progressInterval);
      
      console.log("Response status:", res.status);
      console.log("Response headers:", Object.fromEntries(res.headers.entries()));
      
      const data = await res.json();
      console.log("Response data:", data);
      
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setPaperId(data.paper_id);
      setUploadProgress("Upload completed successfully!");
    } catch (err: unknown) {
      console.error("Upload error:", err);
      console.error("Error type:", typeof err);
      console.error("Error constructor:", err?.constructor?.name);
      
      let errorMessage = "Upload failed";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err instanceof TypeError) {
        errorMessage = "Network error - please check your connection";
      } else {
        errorMessage = String(err);
      }
      
      setUploadError(errorMessage);
      setUploadProgress("");
    } finally {
      setUploading(false);
      // Clear progress message after a delay
      setTimeout(() => setUploadProgress(""), 2000);
    }
  };

  // Handle click on the custom file upload button
  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle chat message send (streaming response)
  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !paperId) return;
    setChatLoading(true);
    setChatError(null);
    const newMessages = [...chatMessages, { role: 'user' as ChatRole, content: chatInput }];
    setChatMessages(newMessages);
    setChatInput("");
    try {
      // Prepare the chat history as context
      const developer_message = `You are a helpful research assistant. Answer questions and chat about the following research paper (paper_id: ${paperId}). If the user asks about the paper, use its content. If not, answer as a general assistant.`;
      const user_message = newMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      const res = await fetch(`${cleanApiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developer_message,
          user_message,
          model: "gpt-4",
          api_key: apiKey,
          paper_id: paperId,
        }),
      });
      // Streaming response
      let answer = "";
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) answer += decoder.decode(value);
        }
      }
      setChatMessages(msgs => [...msgs, { role: 'assistant' as ChatRole, content: answer.trim() }]);
    } catch {
      setChatError("Failed to get response from assistant.");
    } finally {
      setChatLoading(false);
    }
  };

  // Handle summary fetch
  const handleGetSummary = async () => {
    console.log("Get Summary button clicked, paperId:", paperId);
    if (!paperId) {
      console.log("No paperId found");
      return;
    }
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      console.log("Fetching summary from:", `${cleanApiUrl}/api/get-summary?paper_id=${paperId}`);
      const res = await fetch(`${cleanApiUrl}/api/get-summary?paper_id=${paperId}`);
      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Response data:", data);
      if (!res.ok) throw new Error(data.detail || "Failed to get summary");
      setSummary(data.summary);
    } catch (err: unknown) {
      console.error("Summary error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to get summary";
      setSummaryError(errorMessage);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Handle code fetch
  const handleGetCode = async () => {
    console.log("Get Code button clicked, paperId:", paperId);
    if (!paperId) {
      console.log("No paperId found");
      return;
    }
    setCodeLoading(true);
    setCodeError(null);
    try {
      console.log("Fetching code from:", `${cleanApiUrl}/api/get-code?paper_id=${paperId}`);
      const res = await fetch(`${cleanApiUrl}/api/get-code?paper_id=${paperId}`);
      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Response data:", data);
      if (!res.ok) throw new Error(data.detail || "Failed to get code");
      setCode(data.code);
    } catch (err: unknown) {
      console.error("Code error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to get code";
      setCodeError(errorMessage);
    } finally {
      setCodeLoading(false);
    }
  };

  // Fetch links for further learning
  const handleGetCitation = async () => {
    console.log("Get Citation button clicked, paperId:", paperId);
    if (!paperId) {
      console.log("No paperId found");
      return;
    }
    setCitationLoading(true);
    setCitationError(null);
    try {
      console.log("Fetching citation from:", `${cleanApiUrl}/api/get-citation?paper_id=${paperId}`);
      const res = await fetch(`${cleanApiUrl}/api/get-citation?paper_id=${paperId}`);
      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Response data:", data);
      if (!res.ok) throw new Error(data.detail || "Failed to get citation");
      setCitation(data.citation);
    } catch (err: unknown) {
      console.error("Citation error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to get citation";
      setCitationError(errorMessage);
    } finally {
      setCitationLoading(false);
    }
  };

  // Copy code to clipboard
  const handleCopyCode = async () => {
    if (code) {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Copy citation to clipboard
  const handleCopyCitation = async () => {
    if (citation) {
      await navigator.clipboard.writeText(citation);
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 1500);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-blue-50 via-purple-50 to-yellow-50">
      {/* Header/Intro Section */}
      <header className="w-full max-w-2xl text-center mb-8">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-purple-700 to-yellow-600 mb-2">Research Assistant</h1>
        <p className="text-lg text-gray-700 mb-4">
          Upload a research paper (PDF) and leverage AI to:
        </p>
        <ul className="text-base text-gray-600 mb-4 list-disc list-inside mx-auto max-w-lg text-left">
          <li>Ask questions about the paper in natural language</li>
          <li>Get a detailed summary of the paper&apos;s content</li>
          <li>Generate Python code for the key method or algorithm described</li>
        </ul>
        <p className="text-sm text-gray-500">
          Powered by OpenAI GPT-4 and state-of-the-art document understanding.
        </p>
      </header>

      {/* Upload Form */}
      <form
        className="flex flex-col gap-4 bg-white p-6 rounded-lg shadow-xl w-full max-w-md border border-gray-200"
        onSubmit={handleUpload}
      >
        <label className="font-medium text-gray-700">
          OpenAI API Key
          <input
            type="password"
            className="mt-1 block w-full rounded border border-gray-300 p-2 bg-gray-100 text-gray-900"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            autoComplete="off"
          />
        </label>
        {/* Custom file upload button with icon */}
        <label className="font-medium text-gray-700">
          Research Paper (PDF)
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={handleFileButtonClick}
              className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded cursor-pointer border border-gray-300"
            >
              {/* Upload icon (SVG) */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
              </svg>
              {file ? file.name : "Choose File"}
            </button>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
              ref={fileInputRef}
              required
            />
          </div>
        </label>
        {/* Loading bar or spinner when uploading */}
        {uploading && (
          <div className="w-full flex flex-col items-center my-4 space-y-3">
            <div className="w-2/3 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 animate-pulse" style={{ width: '100%' }}></div>
            </div>
            <div className="text-center">
              <div className="text-blue-700 text-sm font-medium">
                {uploadProgress || "Processing..."}
              </div>
              <div className="text-gray-500 text-xs mt-1">
                This may take 30-60 seconds for large papers
              </div>
            </div>
          </div>
        )}
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50 shadow"
          disabled={uploading}
        >
          {uploading ? "Analyzing..." : "Analyze Paper"}
        </button>
        {uploadError && <div className="text-red-600 text-sm">{uploadError}</div>}
        {paperId && <div className="text-green-600 text-sm">Paper processed! You can now ask questions, get a summary, or generate code.</div>}
      </form>

      {/* Actions after upload */}
      {paperId && (
        <div className="mt-8 w-full max-w-6xl">
          {/* Success Banner */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg shadow-lg mb-6 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold">Paper Successfully Analyzed!</h3>
              <p className="text-green-100 text-sm">You can now interact with your research assistant</p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Chat Section - Takes 2 columns on large screens */}
            <div className="lg:col-span-2">
              <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 h-96 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Research Assistant</h2>
                    <p className="text-sm text-gray-600">Ask questions about your paper</p>
                  </div>
                </div>
                
                {/* Chat Messages */}
                <div className="flex-1 flex flex-col gap-3 overflow-y-auto mb-4 px-2">
                  {chatMessages.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-sm">Start a conversation about your research paper</p>
                      </div>
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`rounded-2xl px-4 py-2 max-w-[80%] shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <div className="text-sm">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-2xl px-4 py-2 shadow-sm">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                          <span>Assistant is typing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <form className="flex gap-2" onSubmit={handleChatSend}>
                  <input
                    type="text"
                    className="flex-1 rounded-full border border-gray-300 p-3 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ask about your research paper..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatLoading}
                    required
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full disabled:opacity-50 transition-colors"
                    disabled={chatLoading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </form>
                {chatError && <div className="text-red-600 text-sm mt-2 text-center">{chatError}</div>}
              </section>
            </div>

            {/* Tools Section - Takes 1 column on large screens */}
            <div>
              <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Tools
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={handleGetSummary}
                    className="w-full flex items-center gap-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 shadow-md transition-all duration-200 transform hover:scale-105"
                    disabled={summaryLoading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {summaryLoading ? "Generating Summary..." : "Get Summary"}
                  </button>
                  
                  <button
                    onClick={handleGetCode}
                    className="w-full flex items-center gap-3 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 shadow-md transition-all duration-200 transform hover:scale-105"
                    disabled={codeLoading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    {codeLoading ? "Generating Code..." : "Get Code"}
                  </button>

                  <button
                    onClick={handleGetCitation}
                    className="w-full flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 shadow-md transition-all duration-200 transform hover:scale-105"
                    disabled={citationLoading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {citationLoading ? "Generating Citation..." : "Get Citation"}
                  </button>
                </div>
              </section>
            </div>
          </div>

          {/* Results Section - Full Width */}
          {(summary || code || citation) && (
            <section className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Analysis Results
              </h3>
              
              <div className="space-y-8">
                {summaryError && <div className="text-red-600 text-sm p-4 bg-red-50 rounded-lg">{summaryError}</div>}
                {summary && (
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg border-l-4 border-purple-500">
                    <h4 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Detailed Summary
                    </h4>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {summary}
                    </div>
                  </div>
                )}
                
                {codeError && <div className="text-red-600 text-sm p-4 bg-red-50 rounded-lg">{codeError}</div>}
                {code && (
                  <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-6 rounded-lg border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        Python Implementation
                      </h4>
                      <button
                        onClick={handleCopyCode}
                        className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded-lg transition-colors"
                      >
                        {copied ? (
                          <span className="text-green-600 font-medium">Copied!</span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8M8 12h8m-6 8h6a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v2" />
                            </svg>
                            Copy Code
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-green-200 p-6 rounded-lg overflow-x-auto text-sm leading-relaxed border border-gray-700">
                      <code>{code}</code>
                    </pre>
                  </div>
                )}

                {citationError && <div className="text-red-600 text-sm p-4 bg-red-50 rounded-lg">{citationError}</div>}
                {citation && (
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border-l-4 border-blue-500">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Citation & BibTeX
                      </h4>
                      <button
                        onClick={handleCopyCitation}
                        className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded-lg transition-colors"
                      >
                        {copiedCitation ? (
                          <span className="text-green-600 font-medium">Copied!</span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8M8 12h8m-6 8h6a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v2" />
                            </svg>
                            Copy Citation
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-blue-200 p-6 rounded-lg overflow-x-auto text-sm leading-relaxed border border-gray-700">
                      <code>{citation}</code>
                    </pre>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
