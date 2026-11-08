# 📄 DocuForge AI — Auto-generate Docs, Unit Tests & Diagrams with Code RAG

[![Featured on Product Hunt](https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1217464&theme=neutral&t=1786198837592)](https://www.producthunt.com/products/docuforge-ai?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-docuforge-ai)

DocuForge AI is an enterprise-grade AI technical writing & principal architect platform. Turn code changes, modules, or git diffs into production-ready READMEs, API specifications, unit tests, OWASP security audits, and interactive Mermaid flowcharts with an in-browser WASM SQLite Code RAG vector engine.


## Recommended Architecture

```mermaid
graph TD
    Client[Web App / Frontend] -->|1. Submit Code + Target Format| API[Backend: Express / FastAPI]
    API -->|2. Search & Fetch Template guidelines| DB[(Database: SQLite / Supabase)]
    API -->|3. System Instruction + User Prompt| LLM[LLM API: Gemini / Claude]
    LLM -->|4. Return Markdown Docs / JSDocs| API
    API -->|5. Return Output| Client
```

---

## 🛠️ Step-by-Step Implementation Guide

Follow these steps using Antigravity / Claude Code to build out the backend:

### 1. Initialize Server & Dependencies
Initialize a Node.js or Python backend. For example, using Python & FastAPI:
```bash
pip install fastapi uvicorn google-genai
```

### 2. Craft the Prompt Templates
Depending on the requested format, select the appropriate system instruction:
- **README.md**: "You are an technical writer. Analyze the code and generate a comprehensive user manual, installation guide, and setup instructions in clean Markdown format."
- **API Reference**: "You are an API designer. Output a structured API specification table showing each function, its parameters, return types, exceptions, and descriptions."
- **Inline Comments**: "You are a code refactoring tool. Take the input code and output it exactly, but insert standard JSDoc / Docstring headers before each class, interface, and method. Do not omit any code lines."

### 3. Connect the LLM API
Create a `/api/generate-docs` endpoint that runs the model:
```python
from google import genai
from google.genai import types

client = genai.Client()

@app.post("/api/generate-docs")
async def generate_docs(code: str, doc_format: str):
    # Select instruction based on doc_format
    if doc_format == "readme":
        instruction = "Generate a comprehensive README.md with headings, dependencies, code examples, and api references."
    elif doc_format == "api":
        instruction = "Generate a standard tabular API reference guide mapping signatures, arguments, and return models."
    else:
        instruction = "Inject clean JSDoc/docstrings directly into the provided code script. Keep all original code lines."

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=f"Document this code module:\n{code}",
        config=types.GenerateContentConfig(
            system_instruction=instruction
        ),
    )
    return {"documentation": response.text}
```

---

## 🚀 How to Run locally
Simply open `index.html` in your browser, or spin up a local development server:
```bash
npx live-server .
```

---

## Data storage
- **Supabase (recommended):** set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env` — docs history and RAG vectors persist to Postgres (`docuai_docs`, `docuai_vectors`).
- **Local dev (default):** with those unset, data lives in a local sql.js SQLite file and resets on redeploy — fine for demos, not for production.
