from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from openai import OpenAI
import PyPDF2
import io
import uuid
import numpy as np
import faiss
import datetime

app = FastAPI(title="Research Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage of papers and embeddings
papers_db = {}

class ChatRequest(BaseModel):
    developer_message: str
    user_message: str
    model: Optional[str] = "gpt-4"
    api_key: str
    paper_id: Optional[str] = None

class QuestionRequest(BaseModel):
    paper_id: str
    question: str

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok", 
        "timestamp": str(datetime.datetime.now()),
        "papers_loaded": len(papers_db),
        "memory_usage": "Available"
    }

# Upload a PDF paper, extract content, and build embeddings
@app.post("/api/upload-paper")
async def upload_paper(file: UploadFile = File(...), api_key: str = Form(...)):
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required.")
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        # Read and validate file size (max 50MB)
        contents = await file.read()
        if len(contents) > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB.")
        
        reader = PyPDF2.PdfReader(io.BytesIO(contents))
        text = "".join([page.extract_text() or "" for page in reader.pages])

        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF.")

        # Optimize: Use larger chunks and limit the number of embeddings
        chunk_size = 2000  # Increased from 1000
        chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
        
        # Limit to first 8 chunks to speed up processing
        chunks = chunks[:8]
        
        if not chunks:
            raise HTTPException(status_code=400, detail="No text content found in PDF.")

        client = OpenAI(api_key=api_key)
        
        # Create embeddings in batches to avoid rate limits
        embeddings = []
        for i, chunk in enumerate(chunks):
            try:
                embedding = client.embeddings.create(
                    input=chunk, 
                    model="text-embedding-ada-002"
                ).data[0].embedding
                embeddings.append(embedding)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error creating embedding for chunk {i+1}: {str(e)}")

        if not embeddings:
            raise HTTPException(status_code=500, detail="Failed to create embeddings.")

        # Create FAISS index
        index = faiss.IndexFlatL2(len(embeddings[0]))
        index.add(np.array(embeddings).astype("float32"))

        paper_id = str(uuid.uuid4())
        papers_db[paper_id] = {
            "chunks": chunks,
            "embeddings": np.array(embeddings),
            "index": index,
            "api_key": api_key,
            "text_length": len(text)  # Store text length for reference
        }

        return {"paper_id": paper_id, "message": "Paper uploaded successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

# Summarize paper
@app.get("/api/get-summary")
async def get_summary(paper_id: str):
    paper = papers_db.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    client = OpenAI(api_key=paper["api_key"])
    context = "\n\n".join(paper["chunks"][:6])
    prompt = (
        "Provide a detailed summary of the following research paper. "
        "Organize the summary into clear sections such as Introduction, Methods, Results, and Conclusion. "
        "At the end, include a 'References and Further Reading' section with 2-3 relevant resources for someone who wants to learn more. "
        "\n\nPaper Content:\n\n" + context
    )

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return {"summary": response.choices[0].message.content.strip()}

# Generate Python code
@app.get("/api/get-code")
async def get_code(paper_id: str):
    paper = papers_db.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    client = OpenAI(api_key=paper["api_key"])
    context = "\n\n".join(paper["chunks"][:6])
    prompt = (
        "Analyze the following research paper and provide Python code implementation. "
        "Follow these steps:\n\n"
        "1. FIRST, extract any existing code snippets, algorithms, or pseudocode from the paper content. "
        "2. If code snippets are found, convert them to proper Python code with clear comments and structure.\n"
        "3. If no code snippets are found, analyze the method descriptions and auto-generate Python code based on the described algorithms or methods.\n"
        "4. Ensure the code is well-documented, follows Python best practices, and includes necessary imports.\n"
        "5. If the paper describes multiple methods, implement the most important or central one.\n\n"
        "RETURN ONLY THE CODE, MAKE SURE TO USE COMMENTS for any extra text or explanation. "
        "Ensure the code block only contains the code and any other details should be in the comments.\n"
        "Include appropriate COMMENTS to explain the implementation.\n\n"
        "Paper Content:\n\n" + context
    )

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "system", "content": "You are an expert Python developer. Provide clean, well-documented code that follows best practices."},
                  {"role": "user", "content": prompt}]
    )
    return {"code": response.choices[0].message.content.strip()}

# Ask a question about the paper
@app.post("/api/ask-question")
async def ask_question(request: QuestionRequest):
    paper = papers_db.get(request.paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    client = OpenAI(api_key=paper["api_key"])
    query_embedding = client.embeddings.create(
        input=request.question, model="text-embedding-ada-002"
    ).data[0].embedding

    D, I = paper["index"].search(np.array([query_embedding]).astype("float32"), k=3)
    context = "\n\n".join([paper["chunks"][i] for i in I[0]])

    prompt = f"Use the following research paper excerpts to answer the question:\n\n{context}\n\nQuestion: {request.question}"

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return {"answer": response.choices[0].message.content.strip()}

# General chat endpoint with streaming response
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        client = OpenAI(api_key=request.api_key)
        
        # If paper_id is provided in the user message, include paper content
        paper_content = ""
        if hasattr(request, 'paper_id') and request.paper_id:
            paper = papers_db.get(request.paper_id)
            if paper:
                paper_content = "\n\nPaper Content:\n" + "\n\n".join(paper["chunks"][:6])

        async def generate():
            stream = client.chat.completions.create(
                model=request.model,
                messages=[
                    {"role": "system", "content": request.developer_message + paper_content},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True
            )
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get citation and BibTeX
@app.get("/api/get-citation")
async def get_citation(paper_id: str):
    paper = papers_db.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    client = OpenAI(api_key=paper["api_key"])
    context = "\n\n".join(paper["chunks"][:6])
    prompt = (
        "Extract citation information from the following research paper and provide both a formatted citation and BibTeX entry. "
        "Analyze the paper content to identify:\n"
        "- Author names\n"
        "- Paper title\n"
        "- Publication year\n"
        "- Journal/conference name\n"
        "- DOI or URL if available\n\n"
        "Provide the citation in two formats:\n"
        "1. A properly formatted citation (e.g., APA style)\n"
        "2. A complete BibTeX entry\n\n"
        "If you cannot find complete information, make reasonable assumptions based on the paper content and indicate what information is estimated.\n\n"
        "Paper Content:\n\n" + context
    )

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return {"citation": response.choices[0].message.content.strip()}

# For running locally
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Research Assistant API"}