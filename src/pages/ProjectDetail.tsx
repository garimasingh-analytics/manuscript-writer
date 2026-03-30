import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Project, Paper, StudySummary, Manuscript } from '../types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Search, FileText, Download, Loader2, ArrowLeft, Plus, X, ChevronRight, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { parseReportWithAI, searchLiteratureWithAI, generateManuscriptWithAI } from '../lib/gemini';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

export default function ProjectDetail({ project: initialProject, onBack }: { project: Project, onBack: () => void }) {
  const [project, setProject] = useState<Project>(initialProject);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [keywords, setKeywords] = useState(project.keyword_config.main_keywords);
  const [newKeyword, setNewKeyword] = useState('');
  const { token } = useAuth();

  const handleExportPDF = () => {
    if (!project.manuscript) return;
    const doc = new jsPDF();
    const margin = 20;
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(project.manuscript.title, maxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 10 + 10;

    const addSection = (title: string, content: string) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(content, maxWidth);
      doc.text(lines, margin, y);
      y += lines.length * 6 + 10;
    };

    addSection('Abstract', project.manuscript.abstract);
    addSection('Introduction', project.manuscript.introduction);
    addSection('Methods', project.manuscript.methods);
    addSection('Results', project.manuscript.results);
    addSection('Evidence Comparison', project.manuscript.evidence_comparison);
    addSection('Discussion', project.manuscript.discussion);
    addSection('Conclusion', project.manuscript.conclusion);

    // References
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('References', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    project.manuscript.references.forEach((ref, i) => {
      const refText = `${i + 1}. ${ref}`;
      const lines = doc.splitTextToSize(refText, maxWidth);
      if (y + lines.length * 5 > 280) { doc.addPage(); y = 20; }
      doc.text(lines, margin, y);
      y += lines.length * 5 + 2;
    });

    doc.save(`${project.title.replace(/\s+/g, '_')}_Manuscript.pdf`);
    toast.success('PDF exported successfully');
  };

  const handleExportDOCX = async () => {
    if (!project.manuscript) return;
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: project.manuscript.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "", spacing: { after: 400 } }),
          
          new Paragraph({ text: "Abstract", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun(project.manuscript.abstract)] }),
          
          new Paragraph({ text: "Introduction", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun(project.manuscript.introduction)] }),
          
          new Paragraph({ text: "Methods", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun(project.manuscript.methods)] }),
          
          new Paragraph({ text: "Results", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun(project.manuscript.results)] }),
          
          new Paragraph({ text: "Evidence Comparison", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun(project.manuscript.evidence_comparison)] }),
          
          new Paragraph({ text: "Discussion", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun(project.manuscript.discussion)] }),
          
          new Paragraph({ text: "Conclusion", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun(project.manuscript.conclusion)] }),
          
          new Paragraph({ text: "References", heading: HeadingLevel.HEADING_1 }),
          ...project.manuscript.references.map((ref, i) => 
            new Paragraph({
              children: [new TextRun(`${i + 1}. ${ref}`)],
              spacing: { before: 100 }
            })
          ),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${project.title.replace(/\s+/g, '_')}_Manuscript.docx`);
    toast.success('DOCX exported successfully');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/agents/parse-report/${project.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const { text } = await res.json();
        toast.info('Extracting PICO elements with AI...');
        const summary = await parseReportWithAI(text);
        
        // Save summary to backend
        await fetch(`/api/projects/${project.id}/summary`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(summary)
        });

        setProject(prev => ({ ...prev, study_summary: summary }));
        toast.success('Report parsed successfully');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse report');
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    try {
      // First update keywords on backend
      await fetch(`/api/agents/search-literature/${project.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          main_keywords: keywords,
          exclusion_keywords: [],
          mesh_terms: []
        })
      });

      toast.info('Searching databases with AI...');
      const rawPapers = await searchLiteratureWithAI(keywords, [], []);
      const papers = rawPapers.map((p: any) => ({ ...p, id: Math.random().toString(36).substr(2, 9), selected: false }));

      // Save papers to backend
      await fetch(`/api/projects/${project.id}/papers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(papers)
      });

      setProject(prev => ({ ...prev, papers }));
      toast.success('Search completed');
    } catch (err) {
      console.error(err);
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const togglePaperSelection = (paperId: string) => {
    setProject(prev => ({
      ...prev,
      papers: prev.papers.map(p => p.id === paperId ? { ...p, selected: !p.selected } : p)
    }));
  };

  const handleGenerate = async () => {
    const selectedCount = project.papers.filter(p => p.selected).length;
    if (selectedCount === 0) {
      toast.error('Please select at least one paper');
      return;
    }

    setGenerating(true);
    try {
      // First update the project with selected papers on backend
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ papers: project.papers })
      });

      toast.info('Generating manuscript with AI (this may take a minute)...');
      const manuscript = await generateManuscriptWithAI(project.study_summary, project.papers.filter(p => p.selected));
      
      // Save manuscript to backend
      await fetch(`/api/projects/${project.id}/manuscript`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(manuscript)
      });

      setProject(prev => ({ ...prev, manuscript }));
      toast.success('Manuscript generated successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate manuscript');
    } finally {
      setGenerating(false);
    }
  };

  const addKeyword = () => {
    if (newKeyword && !keywords.includes(newKeyword)) {
      setKeywords([...keywords, newKeyword]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (k: string) => {
    setKeywords(keywords.filter(kw => kw !== k));
  };

  return (
    <div className="min-h-screen bg-[#FDFDFB] text-[#1A1A1A] font-sans">
      <div className="max-w-7xl mx-auto p-6 md:p-10">
        <Button variant="ghost" onClick={onBack} className="mb-8 hover:bg-zinc-100 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>

        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-12">
          <div className="space-y-2">
            <h1 className="text-4xl font-serif font-medium tracking-tight leading-tight">{project.title}</h1>
            <p className="text-zinc-500 text-lg max-w-2xl">{project.description}</p>
          </div>
          <div className="flex gap-3">
            {project.manuscript && (
              <>
                <Button variant="outline" onClick={handleExportPDF} className="rounded-full border-zinc-200">
                  <FileDown className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button variant="outline" onClick={handleExportDOCX} className="rounded-full border-zinc-200">
                  <FileDown className="w-4 h-4 mr-2" /> DOCX
                </Button>
              </>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
          <TabsList className="flex w-full justify-start gap-8 bg-transparent border-b border-zinc-200 rounded-none h-auto p-0 mb-8">
            <TabsTrigger value="upload" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 rounded-none px-0 pb-4 text-base font-medium transition-all">
              1. Study Report
            </TabsTrigger>
            <TabsTrigger value="search" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 rounded-none px-0 pb-4 text-base font-medium transition-all">
              2. Literature Search
            </TabsTrigger>
            <TabsTrigger value="manuscript" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 rounded-none px-0 pb-4 text-base font-medium transition-all">
              3. Manuscript
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-1 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-serif font-medium">Upload Report</h2>
                  <p className="text-zinc-500">Upload your clinical study report to extract PICO elements automatically.</p>
                </div>
                
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-zinc-200 rounded-2xl cursor-pointer bg-white hover:bg-zinc-50 hover:border-zinc-400 transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {uploading ? (
                      <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Upload className="w-6 h-6 text-zinc-600" />
                        </div>
                        <p className="text-sm font-medium text-zinc-900">Click to upload</p>
                        <p className="text-xs text-zinc-400 mt-1">PDF, DOCX, or TXT</p>
                      </>
                    )}
                  </div>
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>

                {project.study_summary && (
                  <Button onClick={() => setActiveTab('search')} className="w-full rounded-full py-6 text-lg">
                    Next: Literature Search <ChevronRight className="ml-2 w-5 h-5" />
                  </Button>
                )}
              </div>

              <div className="lg:col-span-2">
                {project.study_summary ? (
                  <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
                    <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
                      <CardTitle className="text-lg font-serif">Extracted Study Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                        {Object.entries(project.study_summary).map(([key, value]) => (
                          <div key={key} className="space-y-2">
                            <Label className="capitalize text-xs font-bold tracking-widest text-zinc-400 uppercase">{key.replace(/_/g, ' ')}</Label>
                            <p className="text-zinc-800 leading-relaxed">{value}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-100 rounded-2xl p-12 text-center">
                    <div className="max-w-xs space-y-4">
                      <FileText className="w-12 h-12 mx-auto text-zinc-200" />
                      <p className="text-zinc-400">Your extracted PICO elements will appear here once you upload a report.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="search" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
              <div className="lg:col-span-1 space-y-8">
                <div className="space-y-2">
                  <h2 className="text-2xl font-serif font-medium">Literature Search</h2>
                  <p className="text-zinc-500">Define keywords to find supporting or contradicting evidence.</p>
                </div>

                <div className="space-y-4">
                  <Label className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Search Keywords</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Add keyword..." 
                      value={newKeyword} 
                      onChange={e => setNewKeyword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addKeyword()}
                      className="rounded-full border-zinc-200"
                    />
                    <Button onClick={addKeyword} variant="secondary" className="rounded-full w-10 h-10 p-0">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keywords.map(k => (
                      <Badge key={k} variant="secondary" className="px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-700 border-none">
                        {k}
                        <button onClick={() => removeKeyword(k)} className="ml-2 hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Button 
                    onClick={handleSearch} 
                    disabled={searching || keywords.length === 0} 
                    className="w-full rounded-full py-6 text-lg mt-4"
                  >
                    {searching ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Searching...</> : 'Run Search'}
                  </Button>
                </div>

                {project.papers.some(p => p.selected) && (
                  <Button onClick={() => setActiveTab('manuscript')} className="w-full rounded-full py-6 text-lg border-2 border-zinc-900 bg-transparent text-zinc-900 hover:bg-zinc-900 hover:text-white transition-all">
                    Next: Generate Manuscript <ChevronRight className="ml-2 w-5 h-5" />
                  </Button>
                )}
              </div>

              <div className="lg:col-span-3">
                {project.papers.length > 0 ? (
                  <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
                    <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg font-serif">Search Results</CardTitle>
                      <Badge variant="outline" className="rounded-full">{project.papers.length} papers found</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-zinc-100">
                            <TableHead className="w-12 pl-6 text-xs font-bold tracking-widest text-zinc-400 uppercase">Select</TableHead>
                            <TableHead className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Research Paper</TableHead>
                            <TableHead className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Journal</TableHead>
                            <TableHead className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Source</TableHead>
                            <TableHead className="text-xs font-bold tracking-widest text-zinc-400 uppercase pr-6">Evidence</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {project.papers.map((paper, index) => (
                            <TableRow key={paper.id} className="group hover:bg-zinc-50/50 border-zinc-50 transition-colors">
                              <TableCell className="pl-6">
                                <Checkbox 
                                  checked={paper.selected} 
                                  onCheckedChange={() => togglePaperSelection(paper.id)}
                                  className="rounded-md border-zinc-300"
                                />
                              </TableCell>
                              <TableCell className="py-6">
                                <div className="space-y-1">
                                  <div className="font-medium text-zinc-900 line-clamp-2 leading-snug">
                                    <span className="text-zinc-300 mr-2 font-mono text-xs">#{index + 1}</span>
                                    {paper.title}
                                  </div>
                                  <div className="text-xs text-zinc-400 font-mono">{paper.authors}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm font-medium text-zinc-700">{paper.journal}</div>
                                <div className="text-xs text-zinc-400">{paper.year}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-500 text-[10px] uppercase tracking-tighter border-none">
                                  {paper.database_source}
                                </Badge>
                              </TableCell>
                              <TableCell className="pr-6">
                                <Badge 
                                  variant="outline"
                                  className={cn(
                                    "rounded-full px-3 py-0.5 border-none text-[10px] uppercase font-bold tracking-wider",
                                    paper.classification === 'supporting' ? 'bg-emerald-50 text-emerald-700' : 
                                    paper.classification === 'contradicting' ? 'bg-rose-50 text-rose-700' : 
                                    'bg-zinc-100 text-zinc-600'
                                  )}
                                >
                                  {paper.classification}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-100 rounded-2xl p-12 text-center">
                    <div className="max-w-xs space-y-4">
                      <Search className="w-12 h-12 mx-auto text-zinc-200" />
                      <p className="text-zinc-400">Search results will appear here. Select the most relevant papers to include in your manuscript.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manuscript" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
              <CardHeader className="p-10 border-b border-zinc-100 flex flex-row items-center justify-between bg-zinc-50/30">
                <div className="space-y-1">
                  <CardTitle className="text-3xl font-serif">Manuscript Draft</CardTitle>
                  <CardDescription className="text-base">IMRaD structured draft based on your study and selected evidence.</CardDescription>
                </div>
                <Button 
                  onClick={handleGenerate} 
                  disabled={generating || project.papers.filter(p => p.selected).length === 0}
                  className="rounded-full px-8 py-6 text-lg shadow-lg shadow-zinc-200"
                >
                  {generating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</> : 'Regenerate Draft'}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {project.manuscript ? (
                  <ScrollArea className="h-[800px]">
                    <div className="max-w-4xl mx-auto p-12 md:p-20 space-y-12 font-serif text-lg leading-relaxed text-zinc-800">
                      <div className="text-center space-y-6 mb-16">
                        <h2 className="text-4xl font-bold text-zinc-900 leading-tight">{project.manuscript.title}</h2>
                        <div className="w-24 h-1 bg-zinc-900 mx-auto rounded-full"></div>
                      </div>
                      
                      <section className="space-y-4">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">Abstract</h3>
                        <p className="first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left">{project.manuscript.abstract}</p>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">Introduction</h3>
                        <p>{project.manuscript.introduction}</p>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">Methods</h3>
                        <p>{project.manuscript.methods}</p>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">Results</h3>
                        <p>{project.manuscript.results}</p>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">Evidence Comparison</h3>
                        <p className="p-8 bg-zinc-50 rounded-2xl border border-zinc-100 italic">{project.manuscript.evidence_comparison}</p>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">Discussion</h3>
                        <p>{project.manuscript.discussion}</p>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">Conclusion</h3>
                        <p>{project.manuscript.conclusion}</p>
                      </section>

                      <section className="space-y-6 pt-12 border-t border-zinc-100">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">References</h3>
                        <ul className="space-y-4 text-sm text-zinc-500 font-sans">
                          {project.manuscript.references.map((ref, i) => (
                            <li key={i} className="flex gap-4">
                              <span className="font-mono text-zinc-300">[{i + 1}]</span>
                              <span>{ref}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-40">
                    <div className="max-w-sm mx-auto space-y-6">
                      <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
                        <FileText className="w-10 h-10 text-zinc-200" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-medium">Ready to generate</h3>
                        <p className="text-zinc-500">Complete the previous steps to generate your first manuscript draft.</p>
                      </div>
                      <Button 
                        onClick={handleGenerate} 
                        disabled={generating || project.papers.filter(p => p.selected).length === 0}
                        className="rounded-full px-8"
                      >
                        {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : 'Generate Manuscript'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
