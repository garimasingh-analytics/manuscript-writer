import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini with the API key from environment
// In AI Studio Build, process.env.GEMINI_API_KEY is available to the frontend
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function parseReportWithAI(text: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract PICO elements and study details from the following research report text. Return as JSON.
    Text: ${text.substring(0, 15000)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          population_setting: { type: Type.STRING },
          sample_size: { type: Type.STRING },
          study_design: { type: Type.STRING },
          interventions: { type: Type.STRING },
          comparators: { type: Type.STRING },
          outcomes: { type: Type.STRING },
          effect_sizes: { type: Type.STRING },
          conclusions: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text);
}

export async function searchLiteratureWithAI(keywords: string[], mesh: string[], exclude: string[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Perform a comprehensive clinical literature search across multiple databases including PubMed, PMC, Europe PMC, Semantic Scholar, arXiv, Cochrane Library, Embase, Scopus, and Web of Science.
    
    Keywords: ${keywords.join(", ")}
    MeSH Terms: ${mesh.join(", ")}
    Exclusion Criteria: ${exclude.join(", ")}
    
    Find the 20 most relevant and recent research papers. 
    Sort the results from most relevant to least relevant based on the keywords provided.
    
    Return the results as a JSON array of objects with the following fields: 
    - title (string)
    - authors (string)
    - year (number)
    - journal (string)
    - doi (string)
    - abstract (string, summary of findings)
    - classification (string: 'supporting', 'contradicting', or 'background' relative to the keywords)
    - database_source (string, e.g., 'PubMed', 'Semantic Scholar', etc.)`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            authors: { type: Type.STRING },
            year: { type: Type.NUMBER },
            journal: { type: Type.STRING },
            doi: { type: Type.STRING },
            abstract: { type: Type.STRING },
            classification: { type: Type.STRING },
            database_source: { type: Type.STRING }
          },
          required: ["title", "authors", "year", "journal", "abstract", "classification", "database_source"]
        }
      }
    }
  });

  return JSON.parse(response.text);
}

export async function generateManuscriptWithAI(studySummary: any, selectedPapers: any[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Generate a full IMRaD manuscript based on the following study summary and selected literature.
    Study Summary: ${JSON.stringify(studySummary)}
    Selected Papers: ${JSON.stringify(selectedPapers)}
    Return as JSON with sections: title, abstract, introduction, methods, results, evidence_comparison, discussion, conclusion, references (array of strings).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          abstract: { type: Type.STRING },
          introduction: { type: Type.STRING },
          methods: { type: Type.STRING },
          results: { type: Type.STRING },
          evidence_comparison: { type: Type.STRING },
          discussion: { type: Type.STRING },
          conclusion: { type: Type.STRING },
          references: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  });

  return JSON.parse(response.text);
}
