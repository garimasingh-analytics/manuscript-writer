import { toast } from "sonner"

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface StudySummary {
  population_setting: string;
  sample_size: string;
  study_design: string;
  interventions: string;
  comparators: string;
  outcomes: string;
  effect_sizes: string;
  conclusions: string;
}

export interface Paper {
  id: string;
  title: string;
  authors: string;
  year: number;
  journal: string;
  doi: string;
  abstract: string;
  selected: boolean;
  classification: 'supporting' | 'contradicting' | 'background';
  database_source: string;
}

export interface Manuscript {
  title: string;
  abstract: string;
  introduction: string;
  methods: string;
  results: string;
  evidence_comparison: string;
  discussion: string;
  conclusion: string;
  references: string[];
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  study_summary: StudySummary | null;
  papers: Paper[];
  manuscript: Manuscript | null;
  keyword_config: {
    main_keywords: string[];
    exclusion_keywords: string[];
    mesh_terms: string[];
  };
  createdAt: string;
}
