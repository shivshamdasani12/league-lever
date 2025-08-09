import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

type League = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

const Index = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState('');

  useEffect(() => {
    document.title = 'Leagues Dashboard | league-lever';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'Manage and view your fantasy leagues on league-lever.');
  }, []);

  const leaguesQuery = useQuery({
    queryKey: ['leagues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('id,name,created_at,updated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as League[];
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    try {
      const { error } = await supabase.from('leagues').insert({
        name: name.trim(),
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: 'League created', description: 'Your league has been created.' });
      setName('');
      await qc.invalidateQueries({ queryKey: ['leagues'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message });
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Leagues</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="secondary" onClick={() => signOut()}>Sign out</Button>
        </div>
      </header>

      <section className="container mx-auto px-4">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create a new league</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex gap-2">
              <Input placeholder="League name" value={name} onChange={(e) => setName(e.target.value)} />
              <Button type="submit">Create</Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leaguesQuery.isLoading && (
            <Card><CardContent className="p-6 text-muted-foreground">Loading leagues...</CardContent></Card>
          )}
          {leaguesQuery.isError && (
            <Card><CardContent className="p-6 text-destructive">Failed to load leagues.</CardContent></Card>
          )}
          {leaguesQuery.data?.length === 0 && !leaguesQuery.isLoading && (
            <Card><CardContent className="p-6 text-muted-foreground">No leagues yet. Create one above.</CardContent></Card>
          )}
          {leaguesQuery.data?.map((lg) => (
            <Card key={lg.id} className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">{lg.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Created {new Date(lg.created_at).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Index;
