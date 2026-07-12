import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Send, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  context: 'dashboard' | 'reports';
  data: any;
}

// Small client-side cache to avoid re-hitting the function for identical payloads.
const clientCache = new Map<string, { at: number; text: string }>();
const CLIENT_CACHE_TTL = 5 * 60 * 1000;

export const AIInsightsPanel = ({ context, data }: Props) => {
  const { profile, isSuperAdmin, isAdmin, isManager, adminId } = useAuth();
  const [summary, setSummary] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [answerLoading, setAnswerLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [tenantAiEnabled, setTenantAiEnabled] = useState<boolean | null>(null);

  // Role gate: only admin/manager/super_admin see the panel.
  const roleAllowed = isSuperAdmin || isAdmin || isManager;

  // For non-super users, verify their tenant admin has AI enabled.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!roleAllowed) { setTenantAiEnabled(false); return; }
      if (isSuperAdmin) { setTenantAiEnabled(true); return; }
      if (isAdmin) { setTenantAiEnabled((profile as any)?.ai_enabled !== false); return; }
      const tenantId = adminId;
      if (!tenantId) { setTenantAiEnabled(false); return; }
      const { data: row } = await supabase
        .from('profiles').select('ai_enabled').eq('id', tenantId).maybeSingle();
      if (!cancelled) setTenantAiEnabled((row as any)?.ai_enabled !== false);
    })();
    return () => { cancelled = true; };
  }, [roleAllowed, isSuperAdmin, isAdmin, profile, adminId]);

  const generate = useCallback(async (mode: 'summary' | 'ask', q?: string) => {
    const setLoading = mode === 'summary' ? setSummaryLoading : setAnswerLoading;
    const cacheKey = `${mode}|${context}|${q || ''}|${JSON.stringify(data).slice(0, 4000)}`;
    const hit = clientCache.get(cacheKey);
    if (hit && Date.now() - hit.at < CLIENT_CACHE_TTL) {
      if (mode === 'summary') setSummary(hit.text); else setAnswer(hit.text);
      return;
    }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('gd-ai-insights', {
        body: { mode, context, data, question: q },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      const text = (res as any)?.text || 'No response';
      clientCache.set(cacheKey, { at: Date.now(), text });
      if (mode === 'summary') setSummary(text);
      else setAnswer(text);
    } catch (e: any) {
      toast.error(e?.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  }, [context, data]);

  if (!roleAllowed || tenantAiEnabled === false) return null;
  if (tenantAiEnabled === null) return null; // loading gate

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Insights
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => generate('summary')} disabled={summaryLoading}>
              {summaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Auto Summary</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setChatOpen(v => !v)}>
              <MessageSquare className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Ask AI</span>
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary && (
          <div className="text-sm whitespace-pre-wrap bg-background/60 rounded-md p-3 border">
            {summary}
          </div>
        )}
        {!summary && !summaryLoading && (
          <p className="text-xs text-muted-foreground">
            Click <b>Auto Summary</b> for AI-generated insights & suggestions. Or ask specific questions.
          </p>
        )}
        {chatOpen && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
                placeholder="Ask anything (e.g. Which shop damages most?)"
                onKeyDown={(e) => { if (e.key === 'Enter' && question.trim()) generate('ask', question.trim()); }}
              />
              <Button size="icon" onClick={() => question.trim() && generate('ask', question.trim())} disabled={answerLoading || !question.trim()}>
                {answerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {answer && (
              <div className="text-sm whitespace-pre-wrap bg-background/60 rounded-md p-3 border">
                {answer}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
