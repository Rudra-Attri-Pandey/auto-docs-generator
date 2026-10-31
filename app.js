document.addEventListener('DOMContentLoaded', () => {
  // XSS guard: escape user-supplied / AI-generated strings before innerHTML.
  // Escaping before marked.parse() neutralizes embedded HTML while keeping markdown syntax working.
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Initialize Mermaid
  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
  }

  // Elements
  const codeInput = document.getElementById('code-input');
  const generateBtn = document.getElementById('generate-btn');
  const outputDocContent = document.getElementById('output-doc-content');
  
  const outputRawWrapper = document.getElementById('output-raw-wrapper');
  const outputPreviewWrapper = document.getElementById('output-preview-wrapper');
  const outputJsonWrapper = document.getElementById('output-json-wrapper');
  const outputCliWrapper = document.getElementById('output-cli-wrapper');
  const outputDiagramWrapper = document.getElementById('output-diagram-wrapper');

  const outputJsonContent = document.getElementById('output-json-content');
  const outputCliContent = document.getElementById('output-cli-content');
  const mermaidTarget = document.getElementById('mermaid-target');

  const tabRawBtn = document.getElementById('tab-raw-btn');
  const tabPreviewBtn = document.getElementById('tab-preview-btn');
  const tabJsonBtn = document.getElementById('tab-json-btn');
  const tabCliBtn = document.getElementById('tab-cli-btn');
  const tabDiagramBtn = document.getElementById('tab-diagram-btn');

  // Diagram Sub-Type Controls
  const diagFlowBtn = document.getElementById('diag-flow-btn');
  const diagSeqBtn = document.getElementById('diag-seq-btn');
  const diagErBtn = document.getElementById('diag-er-btn');
  const diagClassBtn = document.getElementById('diag-class-btn');
  const copyMermaidBtn = document.getElementById('copy-mermaid-btn');
  const downloadSvgBtn = document.getElementById('download-svg-btn');

  const copyBtn = document.getElementById('copy-btn');
  const exportTxtBtn = document.getElementById('export-txt-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');

  const navDashboard = document.getElementById('nav-dashboard');
  const navHistory = document.getElementById('nav-history');
  const viewDashboard = document.getElementById('view-dashboard-container');
  const viewHistory = document.getElementById('view-history-container');
  const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
  const historyListContainer = document.getElementById('history-list-container');

  // Modal Elements
  const userProfileTrigger = document.getElementById('user-profile-trigger');
  const profileModal = document.getElementById('profile-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const modalUserName = document.getElementById('modal-user-name');
  const modalApiKey = document.getElementById('modal-api-key');
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const userDisplayName = document.getElementById('user-display-name');
  const userAvatarInitial = document.getElementById('user-avatar-initial');

  const sampleJsBtn = document.getElementById('sample-js-btn');
  const samplePythonBtn = document.getElementById('sample-python-btn');
  const sampleRustBtn = document.getElementById('sample-rust-btn');

  // State
  let currentResponseData = null;
  let currentDiagramType = 'flowchart';
  let currentMermaidCode = `graph TD\n    Client["📱 Client Request"] --> API["⚡ Express API"]\n    API --> DB[("🗄️ WASM SQLite")]`;

  // Preset Samples
  const SAMPLE_JS = `// User Authentication Controller
export class AuthController {
  constructor(databaseService, hashService) {
    this.db = databaseService;
    this.hash = hashService;
  }

  async login(email, password) {
    const user = await this.db.findUserByEmail(email);
    if (!user) throw new Error('User not found');
    const isValid = await this.hash.compare(password, user.passwordHash);
    if (!isValid) throw new Error('Invalid credentials');
    return this.generateToken(user.id);
  }

  generateToken(userId) {
    return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
  }
}`;

  const SAMPLE_PYTHON = `# FastAPI User Registration Service
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import bcrypt

app = FastAPI(title="User Auth API")

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str

@app.post("/api/v1/auth/register", status_code=201)
async def register_user(payload: UserRegister):
    hashed_pwd = bcrypt.hashpw(payload.password.encode('utf-8'), bcrypt.gensalt())
    # Save user to DB logic...
    return {"status": "success", "user_email": payload.email}`;

  const SAMPLE_RUST = `// WASM High-Speed Vector Math Engine
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct VectorMathEngine {
    dimension: usize,
}

#[wasm_bindgen]
impl VectorMathEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(dimension: usize) -> Self {
        Self { dimension }
    }

    pub fn dot_product(&self, vec_a: &[f64], vec_b: &[f64]) -> Result<f64, JsValue> {
        if vec_a.len() != vec_b.len() {
            return Err(JsValue::from_str("Vector dimensions must match"));
        }
        Ok(vec_a.iter().zip(vec_b.iter()).map(|(a, b)| a * b).sum())
    }
}`;

  // Pre-fill input
  if (!codeInput.value) {
    codeInput.value = SAMPLE_JS;
  }

  sampleJsBtn.addEventListener('click', () => { codeInput.value = SAMPLE_JS; });
  samplePythonBtn.addEventListener('click', () => { codeInput.value = SAMPLE_PYTHON; });
  sampleRustBtn.addEventListener('click', () => { codeInput.value = SAMPLE_RUST; });

  // Load Saved Theme
  const savedTheme = localStorage.getItem('docuforge-theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggleBtn.textContent = '☀️ Light Mode';
  } else {
    themeToggleBtn.textContent = '🌙 Dark Mode';
  }

  // Theme Toggle Handler
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    if (document.body.classList.contains('light-theme')) {
      localStorage.setItem('docuforge-theme', 'light');
      themeToggleBtn.textContent = '☀️ Light Mode';
    } else {
      localStorage.setItem('docuforge-theme', 'dark');
      themeToggleBtn.textContent = '🌙 Dark Mode';
    }
    renderMermaidDiagram();
  });

  // Load Saved Profile
  const savedName = localStorage.getItem('docuforge-username') || 'Dev Workspace';
  const savedApiKey = localStorage.getItem('docuforge-apikey') || '';
  userDisplayName.textContent = savedName;
  modalUserName.value = savedName;
  modalApiKey.value = savedApiKey;
  userAvatarInitial.textContent = savedName.charAt(0).toUpperCase();

  // Modal Handlers
  userProfileTrigger.addEventListener('click', () => { profileModal.classList.remove('hidden'); });
  closeModalBtn.addEventListener('click', () => { profileModal.classList.add('hidden'); });
  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) profileModal.classList.add('hidden');
  });

  saveProfileBtn.addEventListener('click', () => {
    const newName = modalUserName.value.trim() || 'Dev Workspace';
    const newKey = modalApiKey.value.trim();
    localStorage.setItem('docuforge-username', newName);
    localStorage.setItem('docuforge-apikey', newKey);
    userDisplayName.textContent = newName;
    userAvatarInitial.textContent = newName.charAt(0).toUpperCase();
    profileModal.classList.add('hidden');
  });

  // Output View Tab Switching
  function hideAllOutputTabs() {
    outputRawWrapper.classList.add('hidden');
    outputPreviewWrapper.classList.add('hidden');
    outputJsonWrapper.classList.add('hidden');
    outputCliWrapper.classList.add('hidden');
    outputDiagramWrapper.classList.add('hidden');

    [tabRawBtn, tabPreviewBtn, tabJsonBtn, tabCliBtn, tabDiagramBtn].forEach(btn => {
      btn.style.borderColor = 'var(--border)';
      btn.style.color = 'var(--text-muted)';
    });
  }

  tabRawBtn.addEventListener('click', () => {
    hideAllOutputTabs();
    outputRawWrapper.classList.remove('hidden');
    tabRawBtn.style.borderColor = 'var(--neon-lime)';
    tabRawBtn.style.color = 'var(--neon-lime)';
  });

  tabPreviewBtn.addEventListener('click', () => {
    hideAllOutputTabs();
    outputPreviewWrapper.classList.remove('hidden');
    tabPreviewBtn.style.borderColor = 'var(--neon-magenta)';
    tabPreviewBtn.style.color = 'var(--neon-magenta)';
    
    if (window.marked) {
      outputPreviewWrapper.innerHTML = marked.parse(escapeHtml(outputDocContent.value || '# No Output Generated Yet'));
    } else {
      outputPreviewWrapper.innerHTML = `<pre>${escapeHtml(outputDocContent.value)}</pre>`;
    }
  });

  tabJsonBtn.addEventListener('click', () => {
    hideAllOutputTabs();
    outputJsonWrapper.classList.remove('hidden');
    tabJsonBtn.style.borderColor = 'var(--neon-lime)';
    tabJsonBtn.style.color = 'var(--neon-lime)';

    if (currentResponseData && currentResponseData.jsonSchemaDoc) {
      outputJsonContent.textContent = JSON.stringify(currentResponseData.jsonSchemaDoc, null, 2);
    } else {
      outputJsonContent.textContent = JSON.stringify({
        status: "ready",
        format: "README",
        length: outputDocContent.value.length
      }, null, 2);
    }
  });

  tabCliBtn.addEventListener('click', () => {
    hideAllOutputTabs();
    outputCliWrapper.classList.remove('hidden');
    tabCliBtn.style.borderColor = 'var(--neon-magenta)';
    tabCliBtn.style.color = 'var(--neon-magenta)';

    const docFormats = document.getElementsByName('doc-format');
    let activeFormat = 'readme';
    for (const f of docFormats) { if (f.checked) { activeFormat = f.value; break; } }
    outputCliContent.textContent = `npx docuforge-ai generate --format=${activeFormat} --input="./module.js" --output="DOCUMENTATION.md"`;
  });

  tabDiagramBtn.addEventListener('click', () => {
    hideAllOutputTabs();
    outputDiagramWrapper.classList.remove('hidden');
    tabDiagramBtn.style.borderColor = 'var(--neon-purple)';
    tabDiagramBtn.style.color = 'var(--neon-lime)';
    renderMermaidDiagram();
  });

  // Diagram Sub-Type Switching
  function resetDiagBtns() {
    [diagFlowBtn, diagSeqBtn, diagErBtn, diagClassBtn].forEach(b => {
      b.style.borderColor = 'var(--border)';
      b.style.color = 'var(--text-muted)';
    });
  }

  diagFlowBtn.addEventListener('click', () => {
    resetDiagBtns();
    diagFlowBtn.style.borderColor = 'var(--neon-lime)';
    diagFlowBtn.style.color = 'var(--neon-lime)';
    currentDiagramType = 'flowchart';
    generateMermaidCodeForType();
  });

  diagSeqBtn.addEventListener('click', () => {
    resetDiagBtns();
    diagSeqBtn.style.borderColor = 'var(--neon-magenta)';
    diagSeqBtn.style.color = 'var(--neon-magenta)';
    currentDiagramType = 'sequence';
    generateMermaidCodeForType();
  });

  diagErBtn.addEventListener('click', () => {
    resetDiagBtns();
    diagErBtn.style.borderColor = 'var(--neon-purple)';
    diagErBtn.style.color = 'var(--neon-purple)';
    currentDiagramType = 'er';
    generateMermaidCodeForType();
  });

  diagClassBtn.addEventListener('click', () => {
    resetDiagBtns();
    diagClassBtn.style.borderColor = 'var(--neon-lime)';
    diagClassBtn.style.color = 'var(--neon-lime)';
    currentDiagramType = 'class';
    generateMermaidCodeForType();
  });

  function generateMermaidCodeForType() {
    if (currentDiagramType === 'sequence') {
      currentMermaidCode = `sequenceDiagram\n    autonumber\n    Client->>Express Server: Submit Code Payload\n    Express Server->>LLM Engine: Dispatch Context Prompt\n    LLM Engine-->>Express Server: Return Structured Doc\n    Express Server->>WASM SQLite: Persist History\n    Express Server-->>Client: Render Output View`;
    } else if (currentDiagramType === 'er') {
      currentMermaidCode = `erDiagram\n    USER ||--o{ DOCS_HISTORY : generates\n    USER {\n        int id PK\n        string name\n        string email\n    }\n    DOCS_HISTORY {\n        int id PK\n        string format\n        text raw_code\n        text generated_doc\n    }`;
    } else if (currentDiagramType === 'class') {
      currentMermaidCode = `classDiagram\n    class AuthController {\n        +DatabaseService db\n        +HashService hash\n        +login(email, password)\n        +generateToken(userId)\n    }\n    class DatabaseService {\n        +findUserByEmail(email)\n    }\n    AuthController --> DatabaseService`;
    } else {
      currentMermaidCode = `graph TD\n    Client["📱 Web Client / UI"] -->|"1. Submit Payload"| API["⚡ Express Server"]\n    API -->|"2. Dispatch to LLM"| NIM["🧠 Nemotron-4 LLM"]\n    NIM -->|"3. Return Structured Markdown"| API\n    API -->|"4. Persist Scan History"| DB[("🗄️ WASM SQLite DB")]\n    API -->|"5. Render Output"| Client`;
    }
    renderMermaidDiagram();
  }

  async function renderMermaidDiagram() {
    if (!window.mermaid) return;
    try {
      mermaidTarget.innerHTML = `<div class="mermaid">${currentMermaidCode}</div>`;
      await mermaid.run({ nodes: [mermaidTarget.querySelector('.mermaid')] });
    } catch (err) {
      mermaidTarget.innerHTML = `<pre style="color:var(--neon-magenta);">${escapeHtml(currentMermaidCode)}</pre>`;
    }
  }

  copyMermaidBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentMermaidCode);
    const orig = copyMermaidBtn.textContent;
    copyMermaidBtn.textContent = '✅ Copied Code!';
    setTimeout(() => { copyMermaidBtn.textContent = orig; }, 2000);
  });

  downloadSvgBtn.addEventListener('click', () => {
    const svgEl = mermaidTarget.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DOCUFORGE_DIAGRAM.svg';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Generate Action
  generateBtn.addEventListener('click', async () => {
    const rawCode = codeInput.value.trim();
    if (!rawCode) {
      alert('Please paste some code or technical notes first.');
      return;
    }

    const docFormats = document.getElementsByName('doc-format');
    let activeFormat = 'readme';
    for (const f of docFormats) {
      if (f.checked) {
        activeFormat = f.value;
        break;
      }
    }

    generateBtn.disabled = true;
    generateBtn.textContent = '⚡ Forging Enterprise Docs...';

    const userKey = localStorage.getItem('docuforge-apikey') || '';

    try {
      const response = await fetch('/api/generate-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: rawCode,
          format: activeFormat,
          title: 'Code Module',
          userApiKey: userKey
        })
      });

      const data = await response.json();
      currentResponseData = data;

      if (data.generatedDoc) {
        outputDocContent.value = data.generatedDoc;
        if (window.marked) {
          outputPreviewWrapper.innerHTML = marked.parse(escapeHtml(data.generatedDoc));
        }
        if (data.jsonSchemaDoc) {
          outputJsonContent.textContent = JSON.stringify(data.jsonSchemaDoc, null, 2);
        }
        if (data.cliCommand) {
          outputCliContent.textContent = data.cliCommand;
        }

        // Extract Mermaid block if present
        const mermaidMatch = data.generatedDoc.match(/```mermaid([\s\S]*?)```/);
        if (mermaidMatch && mermaidMatch[1]) {
          currentMermaidCode = mermaidMatch[1].trim();
          renderMermaidDiagram();
        }
      } else {
        alert('Failed to generate documentation.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend API.');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = '⚡ Forge Documentation';
    }
  });

  // Copy & Export
  copyBtn.addEventListener('click', () => {
    if (!outputDocContent.value) return;
    navigator.clipboard.writeText(outputDocContent.value);
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
  });

  exportTxtBtn.addEventListener('click', () => {
    if (!outputDocContent.value) return;
    const blob = new Blob([outputDocContent.value], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DOCUMENTATION.md';
    a.click();
    URL.revokeObjectURL(url);
  });

  const navRag = document.getElementById('nav-rag');
  const viewRag = document.getElementById('view-rag-container');

  const ragQueryInput = document.getElementById('rag-query-input');
  const ragSearchBtn = document.getElementById('rag-search-btn');
  const ragAnswerContainer = document.getElementById('rag-answer-container');
  const ragAnswerText = document.getElementById('rag-answer-text');
  const ragMatchesCount = document.getElementById('rag-matches-count');
  const ragCitationsGrid = document.getElementById('rag-citations-grid');
  const ragCountNum = document.getElementById('rag-count-num');

  const ragSourceTitle = document.getElementById('rag-source-title');
  const ragSourceFormat = document.getElementById('rag-source-format');
  const ragBatchInput = document.getElementById('rag-batch-input');
  const ragIndexNowBtn = document.getElementById('rag-index-now-btn');
  const clearRagBtn = document.getElementById('clear-rag-btn');

  // SPA View Routing
  function hideAllViews() {
    [viewDashboard, viewHistory, viewRag].forEach(v => { if (v) v.classList.add('hidden'); });
    [navDashboard, navHistory, navRag].forEach(n => { if (n) n.classList.remove('active'); });
  }

  function showDashboard() {
    hideAllViews();
    viewDashboard.classList.remove('hidden');
    navDashboard.classList.add('active');
  }

  async function showHistory() {
    hideAllViews();
    viewHistory.classList.remove('hidden');
    navHistory.classList.add('active');

    historyListContainer.innerHTML = '<p class="text-muted-theme">Loading saved documentations...</p>';

    try {
      const res = await fetch('/api/history');
      const items = await res.json();

      if (!items || items.length === 0) {
        historyListContainer.innerHTML = '<p class="text-muted-theme">No saved documentations found in history.</p>';
        return;
      }

      historyListContainer.innerHTML = items.map(item => `
        <div style="background: rgba(11, 7, 25, 0.8); border: 1px solid var(--border); padding: 1.25rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
          <div>
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; color: var(--neon-lime);">${escapeHtml(item.title)}</span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: 20px; background: rgba(238, 41, 255, 0.2); color: var(--neon-magenta); border: 1px solid rgba(238, 41, 255, 0.4);">${escapeHtml(String(item.format || '').toUpperCase())}</span>
              <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(item.created_at || '')}</span>
            </div>
            <pre style="font-size: 11px; color: var(--text-muted); max-height: 80px; overflow: hidden; background: rgba(0,0,0,0.4); padding: 8px; border-radius: 4px;">${escapeHtml(String(item.generated_doc || '').slice(0, 180))}...</pre>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn secondary btn-sm" onclick="loadHistoryItem(${Number(item.id)})">Load</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      historyListContainer.innerHTML = '<p style="color: red;">Failed to load saved history.</p>';
    }
  }

  function showRag() {
    hideAllViews();
    if (viewRag) viewRag.classList.remove('hidden');
    if (navRag) navRag.classList.add('active');
    fetchRagStats();
  }

  navDashboard.addEventListener('click', showDashboard);
  navHistory.addEventListener('click', showHistory);
  if (navRag) navRag.addEventListener('click', showRag);
  backToDashboardBtn.addEventListener('click', showDashboard);

  // ==========================================
  // 🧠 RAG (RETRIEVAL-AUGMENTED GENERATION) HANDLERS
  // ==========================================

  async function fetchRagStats() {
    try {
      const res = await fetch('/api/rag/stats');
      if (res.ok) {
        const data = await res.json();
        if (ragCountNum) ragCountNum.textContent = data.totalIndexed || 0;
      }
    } catch (e) {
      console.warn('Failed to fetch RAG stats:', e);
    }
  }

  async function executeCodeRagSearch(queryText) {
    if (!queryText || !queryText.trim()) {
      alert('Please enter a question to query the codebase vector store!');
      return;
    }

    if (ragSearchBtn) {
      ragSearchBtn.disabled = true;
      ragSearchBtn.textContent = '🧠 Searching Codebase...';
    }

    try {
      const res = await fetch('/api/rag/query-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText.trim(), top_k: 5 })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'RAG Query Failed');

      // Render Answer Box
      if (ragAnswerContainer && ragAnswerText) {
        ragAnswerContainer.classList.remove('hidden');
        ragAnswerText.textContent = data.answer || 'No response generated.';
        if (ragMatchesCount) ragMatchesCount.textContent = `${data.citations ? data.citations.length : 0} Sources`;
      }

      // Render Citations Cards Grid
      if (ragCitationsGrid) {
        if (!data.citations || data.citations.length === 0) {
          ragCitationsGrid.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 2rem; text-align: center; grid-column: span 3;">No matching vector sources found in RAG database. Try indexing more code files!</div>`;
        } else {
          ragCitationsGrid.innerHTML = data.citations.map(c => `
            <div class="citation-card">
              <div class="citation-header">
                <span class="citation-title">📌 ${escapeHtml(c.citation_id)} (${escapeHtml(c.format || 'CODE')})</span>
                <span class="citation-match-badge">${Number(c.similarity_pct)}% Vector Match</span>
              </div>
              <div style="font-size: 0.8rem; font-weight: 700; color: var(--neon-lime); margin-bottom: 4px;">${escapeHtml(c.title)}</div>
              <div class="citation-text">${escapeHtml(c.text)}</div>
              <div class="citation-footer">
                <span>Format: <strong>${escapeHtml(c.format)}</strong></span>
                <span>Cos Similarity: <strong>${(Number(c.similarity_pct) / 100).toFixed(2)}</strong></span>
              </div>
            </div>
          `).join('');
        }
      }

      if (ragCountNum) ragCountNum.textContent = data.totalIndexed || 0;

    } catch (err) {
      alert(`RAG Search Error: ${err.message}`);
    } finally {
      if (ragSearchBtn) {
        ragSearchBtn.disabled = false;
        ragSearchBtn.textContent = '🔍 Ask RAG AI';
      }
    }
  }

  async function indexCodeBatch(codeText, formatTag, titleText) {
    if (!codeText || !codeText.trim()) {
      alert('Please paste code or technical documentation text to index!');
      return;
    }

    if (ragIndexNowBtn) {
      ragIndexNowBtn.disabled = true;
      ragIndexNowBtn.textContent = '⚡ Vectorizing Code...';
    }

    try {
      const res = await fetch('/api/rag/index-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code_text: codeText.trim(),
          format: formatTag || 'RAW_CODE',
          title: titleText || 'Custom Code File'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Indexing Failed');

      alert(`✅ Success: ${data.message}`);
      if (ragBatchInput) ragBatchInput.value = '';
      fetchRagStats();
    } catch (err) {
      alert(`RAG Indexing Error: ${err.message}`);
    } finally {
      if (ragIndexNowBtn) {
        ragIndexNowBtn.disabled = false;
        ragIndexNowBtn.textContent = '⚡ Vectorize & Index Code';
      }
    }
  }

  // Event Listeners for RAG UI
  if (ragSearchBtn) {
    ragSearchBtn.addEventListener('click', () => {
      executeCodeRagSearch(ragQueryInput ? ragQueryInput.value : '');
    });
  }

  if (ragQueryInput) {
    ragQueryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        executeCodeRagSearch(ragQueryInput.value);
      }
    });
  }

  // Quick Query Tag Clicks
  document.querySelectorAll('.rag-quick-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const query = tag.getAttribute('data-query');
      if (ragQueryInput) ragQueryInput.value = query;
      executeCodeRagSearch(query);
    });
  });

  if (ragIndexNowBtn) {
    ragIndexNowBtn.addEventListener('click', () => {
      indexCodeBatch(
        ragBatchInput ? ragBatchInput.value : '',
        ragSourceFormat ? ragSourceFormat.value : 'RAW_CODE',
        ragSourceTitle ? ragSourceTitle.value : 'Code File'
      );
    });
  }

  if (clearRagBtn) {
    clearRagBtn.addEventListener('click', async () => {
      if (confirm('Clear all indexed codebase vector entries from your RAG database?')) {
        try {
          await fetch('/api/rag/clear', { method: 'POST' });
          alert('RAG database cleared!');
          if (ragCountNum) ragCountNum.textContent = '0';
          if (ragAnswerContainer) ragAnswerContainer.classList.add('hidden');
          if (ragCitationsGrid) ragCitationsGrid.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 2rem; text-align: center; grid-column: span 3;">Submit a RAG query above to inspect matching code and documentation citations.</div>`;
        } catch(e) {}
      }
    });
  }

  // Initial stats fetch
  fetchRagStats();
});

