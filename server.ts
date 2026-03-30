import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET || "manuscript-writer-secret-key";
// AI Setup - REMOVED FROM BACKEND as per guidelines
// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// In-memory storage for demo purposes (since we don't have MongoDB/Firebase yet)
// In a real app, these would be in a database.
const users: any[] = [];
const projects: any[] = [];

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- Auth Middleware ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- Auth Routes ---
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    if (users.find(u => u.email === email)) return res.status(400).json({ error: "User already exists" });
    
    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: Math.random().toString(36).substr(2, 9), email, passwordHash, name, createdAt: new Date() };
    users.push(user);
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  app.get("/api/auth/me", authenticateToken, (req: any, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.sendStatus(404);
    res.json({ id: user.id, email: user.email, name: user.name });
  });

  // --- Project Routes ---
  app.get("/api/projects", authenticateToken, (req: any, res) => {
    const userProjects = projects.filter(p => p.userId === req.user.id);
    res.json(userProjects);
  });

  app.post("/api/projects", authenticateToken, (req: any, res) => {
    const project = {
      id: Math.random().toString(36).substr(2, 9),
      userId: req.user.id,
      title: req.body.title,
      description: req.body.description,
      status: "Draft",
      study_summary: null,
      papers: [],
      manuscript: null,
      keyword_config: { main_keywords: [], exclusion_keywords: [], mesh_terms: [] },
      createdAt: new Date()
    };
    projects.push(project);
    res.json(project);
  });

  app.get("/api/projects/:id", authenticateToken, (req: any, res) => {
    const project = projects.find(p => p.id === req.params.id && p.userId === req.user.id);
    if (!project) return res.sendStatus(404);
    res.json(project);
  });

  app.patch("/api/projects/:id", authenticateToken, (req: any, res) => {
    const index = projects.findIndex(p => p.id === req.params.id && p.userId === req.user.id);
    if (index === -1) return res.sendStatus(404);
    projects[index] = { ...projects[index], ...req.body };
    res.json(projects[index]);
  });

  app.delete("/api/projects/:id", authenticateToken, (req: any, res) => {
    const index = projects.findIndex(p => p.id === req.params.id && p.userId === req.user.id);
    if (index === -1) return res.sendStatus(404);
    projects.splice(index, 1);
    res.sendStatus(204);
  });

  // --- Agent 1: Parse Report ---
  app.post("/api/agents/parse-report/:projectId", authenticateToken, upload.single('file'), async (req: any, res) => {
    const project = projects.find(p => p.id === req.params.projectId && p.userId === req.user.id);
    if (!project) return res.sendStatus(404);

    try {
      let text = "";
      if (req.file.mimetype === "application/pdf") {
        const parser = new PDFParse({ data: req.file.buffer });
        const result = await parser.getText();
        text = result.text;
      } else if (req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const data = await mammoth.extractRawText({ buffer: req.file.buffer });
        text = data.value;
      } else {
        text = req.file.buffer.toString();
      }

      // Return extracted text to frontend for AI processing
      res.json({ text: text.substring(0, 30000) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to extract text from report" });
    }
  });

  // Save study summary from frontend
  app.post("/api/projects/:projectId/summary", authenticateToken, (req: any, res) => {
    const project = projects.find(p => p.id === req.params.projectId && p.userId === req.user.id);
    if (!project) return res.sendStatus(404);
    project.study_summary = req.body;
    res.json(project.study_summary);
  });

  // Save papers from frontend
  app.post("/api/projects/:projectId/papers", authenticateToken, (req: any, res) => {
    const project = projects.find(p => p.id === req.params.projectId && p.userId === req.user.id);
    if (!project) return res.sendStatus(404);
    project.papers = req.body;
    res.json(project.papers);
  });

  // Save manuscript from frontend
  app.post("/api/projects/:projectId/manuscript", authenticateToken, (req: any, res) => {
    const project = projects.find(p => p.id === req.params.projectId && p.userId === req.user.id);
    if (!project) return res.sendStatus(404);
    project.manuscript = req.body;
    res.json(project.manuscript);
  });

  // --- Agent 2: Literature Search ---
  // This endpoint now just updates keywords, frontend will call Gemini
  app.post("/api/agents/search-literature/:projectId", authenticateToken, async (req: any, res) => {
    const project = projects.find(p => p.id === req.params.projectId && p.userId === req.user.id);
    if (!project) return res.sendStatus(404);

    const { main_keywords, exclusion_keywords, mesh_terms } = req.body;
    project.keyword_config = { main_keywords, exclusion_keywords, mesh_terms };
    
    res.json({ status: "ready" });
  });

  // --- Agent 3: Manuscript Generation ---
  // Frontend will handle generation and save result
  app.post("/api/agents/generate-manuscript/:projectId", authenticateToken, async (req: any, res) => {
    const project = projects.find(p => p.id === req.params.projectId && p.userId === req.user.id);
    if (!project) return res.sendStatus(404);
    res.json({ status: "ready" });
  });

  // --- Vite middleware for development ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
