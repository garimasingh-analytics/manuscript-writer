import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Project } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, BookOpen, Clock, Trash2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard({ onSelectProject }: { onSelectProject: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { token, logout } = useAuth();

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ title: newTitle, description: newDesc })
      });
      if (res.ok) {
        const data = await res.json();
        setProjects([data, ...projects]);
        setIsCreateOpen(false);
        setNewTitle('');
        setNewDesc('');
        toast.success('Project created');
      }
    } catch (err) {
      toast.error('Failed to create project');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setProjects(projects.filter(p => p.id !== id));
        toast.success('Project deleted');
      }
    } catch (err) {
      toast.error('Failed to delete project');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFB] text-[#1A1A1A] font-sans">
      <div className="max-w-7xl mx-auto p-6 md:p-10">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-16">
          <div className="space-y-2">
            <h1 className="text-5xl font-serif font-medium tracking-tight leading-tight">Research Projects</h1>
            <p className="text-zinc-500 text-lg max-w-2xl">Manage your clinical manuscripts and literature searches in one place.</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger render={<Button className="rounded-full px-8 py-6 text-lg shadow-lg shadow-zinc-100"><Plus className="w-5 h-5 mr-2" /> New Project</Button>} />
              <DialogContent className="rounded-3xl p-8">
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-2xl font-serif">Create New Project</DialogTitle>
                  <DialogDescription className="text-zinc-500">Enter the details for your new research project.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Project Title</Label>
                    <Input id="title" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g., Efficacy of Drug X in Type 2 Diabetes" className="rounded-xl border-zinc-200 py-6" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desc" className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Description</Label>
                    <Input id="desc" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief overview of the study" className="rounded-xl border-zinc-200 py-6" />
                  </div>
                </div>
                <DialogFooter className="gap-3">
                  <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-full px-6">Cancel</Button>
                  <Button onClick={handleCreate} disabled={!newTitle} className="rounded-full px-8">Create Project</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={logout} className="rounded-full px-6 border-zinc-200 text-zinc-500 hover:text-zinc-900">Logout</Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-zinc-50 animate-pulse rounded-3xl border border-zinc-100" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-32 border-2 border-dashed border-zinc-100 rounded-3xl bg-white/50">
            <div className="max-w-sm mx-auto space-y-6">
              <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
                <BookOpen className="w-10 h-10 text-zinc-200" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif font-medium">No projects yet</h3>
                <p className="text-zinc-500">Create your first project to start writing your manuscript with AI assistance.</p>
              </div>
              <Button onClick={() => setIsCreateOpen(true)} className="rounded-full px-8 py-6 text-lg"><Plus className="w-5 h-5 mr-2" /> Create Project</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map(project => (
              <Card 
                key={project.id} 
                className="group border-none shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer bg-white rounded-3xl overflow-hidden" 
                onClick={() => onSelectProject(project)}
              >
                <CardHeader className="p-8 pb-4">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="line-clamp-2 text-xl font-serif font-medium leading-snug group-hover:text-zinc-900 transition-colors">{project.title}</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-300 hover:text-red-500 rounded-full"
                      onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <CardDescription className="line-clamp-2 text-zinc-500 text-base mt-2">{project.description || 'No description provided'}</CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                  <div className="flex items-center gap-4 text-sm text-zinc-400 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <Badge variant="secondary" className="px-3 py-0.5 rounded-full bg-zinc-50 text-zinc-500 border-none text-[10px] uppercase tracking-widest font-bold">
                      {project.status}
                    </Badge>
                  </div>
                </CardContent>
                <CardFooter className="px-8 py-6 bg-zinc-50/50 border-t border-zinc-50 flex justify-between items-center text-sm font-semibold text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                  <span>Open Project</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
