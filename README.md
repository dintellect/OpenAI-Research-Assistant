<p align = "center" draggable="false" ><img src="https://github.com/AI-Maker-Space/LLM-Dev-101/assets/37101144/d1343317-fa2f-41e1-8af1-1dbb18399719" 
     width="200px"
     height="auto"/>
</p>

## <h1 align="center" id="heading"> 🤖 Research Assistant - AI-Powered Paper Analysis</h1>

<p align="center">
  <strong>Upload research papers and leverage AI to extract insights, generate code, and get citations</strong>
</p>

---

## 📋 Project Overview

The Research Assistant is an intelligent application that helps researchers and students analyze academic papers using AI. Upload any research paper in PDF format, and the system will:

- **Extract and analyze** the paper's content using advanced NLP
- **Generate detailed summaries** with structured sections
- **Create Python code implementations** of described methods
- **Provide accurate citations** and BibTeX entries
- **Enable interactive chat** about the paper's content

## ✨ Features

### 🔍 **Smart Paper Analysis**
- PDF text extraction and processing
- Intelligent content chunking for optimal AI analysis
- Vector embeddings for semantic understanding

### 📝 **Detailed Summaries**
- Structured summaries with Introduction, Methods, Results, and Conclusion sections
- References and further reading suggestions
- Clear, academic-style formatting

### 💻 **Code Generation**
- Extracts existing code snippets from papers
- Auto-generates Python implementations from method descriptions
- Well-documented, production-ready code
- Follows Python best practices

### 📚 **Citation Management**
- Extracts author names, titles, journals, and publication details
- Generates formatted citations in standard academic format
- Provides complete BibTeX entries for reference management

### 💬 **Interactive Chat**
- Natural language Q&A about the uploaded paper
- Context-aware responses based on paper content
- Streaming responses for real-time interaction

### 🎨 **Modern UI/UX**
- Beautiful, responsive design
- Real-time loading indicators
- Copy-to-clipboard functionality
- Dark mode support

## 🛠️ Technology Stack

### Backend
- **FastAPI** - High-performance web framework
- **OpenAI GPT-4** - Advanced language model for analysis
- **PyPDF2** - PDF text extraction
- **FAISS** - Vector similarity search
- **NumPy** - Numerical computing

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **React Hooks** - State management

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- OpenAI API key

### Backend Setup

1. **Navigate to the API directory:**
   ```bash
   cd The-AI-Engineer-Challenge/api
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   pip install python-multipart
   ```

3. **Set your OpenAI API key:**
   - Get your API key from [OpenAI Platform](https://platform.openai.com/)
   - You'll enter it in the frontend when uploading papers

4. **Start the backend server:**
   ```bash
   python app.py
   ```
   The API will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd The-AI-Engineer-Challenge/frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`

## 📖 Usage Guide

### 1. **Upload a Paper**
- Enter your OpenAI API key (securely stored)
- Click "Choose File" to select a PDF research paper
- Click "Analyze Paper" to process the document

### 2. **Get Insights**
- **Chat**: Ask questions about the paper in natural language
- **Summary**: Get a detailed, structured summary
- **Code**: Extract or generate Python implementations
- **Citation**: Get formatted citations and BibTeX entries

### 3. **Copy and Use**
- All results can be copied to clipboard
- Code is ready to run
- Citations are properly formatted for academic use

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload-paper` | POST | Upload and process PDF papers |
| `/api/get-summary` | GET | Get detailed paper summary |
| `/api/get-code` | GET | Extract/generate Python code |
| `/api/get-citation` | GET | Get citations and BibTeX |
| `/api/chat` | POST | Interactive chat about paper |
| `/api/ask-question` | POST | Ask specific questions |

## 🎯 Use Cases

- **Researchers**: Quickly analyze papers and extract key findings
- **Students**: Understand complex research papers with AI assistance
- **Developers**: Generate code implementations from research methods
- **Academics**: Get properly formatted citations for papers
- **Reviewers**: Efficiently process and summarize research papers

## 🔒 Privacy & Security

- Your OpenAI API key is stored locally and not shared
- Paper content is processed securely through OpenAI's API
- No data is permanently stored on our servers
- All processing happens in real-time

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

---

## 🎉 Congratulations! 

You just deployed your first LLM-powered application! 🚀🚀🚀 Get on linkedin and post your results and experience! Make sure to tag us at @AIMakerspace!

Here's a template to get your post started!

```
🚀🎉 Exciting News! 🎉🚀

🏗️ Today, I'm thrilled to announce that I've successfully built and shipped my first-ever LLM-powered Research Assistant using FastAPI, Next.js, and the OpenAI API! 🖥️

Check it out 👇
[LINK TO APP]

A big shoutout to the @AI Makerspace for all making this possible. Couldn't have done it without the incredible community there. 🤗🙏

Looking forward to building with the community! 🙌✨ Here's to many more creations ahead! 🥂🎉

Who else is diving into the world of AI? Let's connect! 🌐💡

#FirstLLMApp #ResearchAssistant #AIEngineering
```
