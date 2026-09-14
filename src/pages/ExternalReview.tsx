import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, AlertTriangle, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PostPreview } from '@/components/marketing/PostPreview';
import { api, SocialPost } from '@/services/api';

type Step =
  | 'review'
  | 'approve'
  | 'schedule'
  | 'reject'
  | 'done-approve'
  | 'done-schedule'
  | 'done-reject'
  | 'invalid';

export default function ExternalReview() {
  const { token } = useParams<{ token: string }>();

  const [post, setPost] = useState<SocialPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('review');

  const [reviewerName, setReviewerName] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [comment, setComment] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleComment, setScheduleComment] = useState('');
  const [scheduleDateError, setScheduleDateError] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) { setStep('invalid'); setLoading(false); return; }
      const data = await api.getPostByToken(token);
      if (!data) { setStep('invalid'); setLoading(false); return; }
      setPost(data);
      setLoading(false);
    };
    load();
  }, [token]);

  const handleApprove = async () => {
    if (!token) return;
    setSubmitting(true);
    const ok = await api.submitExternalApproval(
      token, 'approved', comment || undefined,
      reviewerName || undefined, reviewerEmail || undefined
    );
    setSubmitting(false);
    setStep(ok ? 'done-approve' : 'review');
  };

  const handleSchedule = async () => {
    if (!token) return;
    if (!scheduleDate) { setScheduleDateError(true); return; }
    setScheduleDateError(false);
    const time = scheduleTime || '09:00';
    const scheduledAt = new Date(`${scheduleDate}T${time}:00`).toISOString();
    setSubmitting(true);
    const ok = await api.submitExternalApproval(
      token, 'scheduled', scheduleComment || undefined,
      reviewerName || undefined, reviewerEmail || undefined,
      scheduledAt
    );
    setSubmitting(false);
    setStep(ok ? 'done-schedule' : 'schedule');
  };

  const handleReject = async () => {
    if (!token) return;
    if (!feedback.trim()) { setFeedbackError(true); return; }
    setFeedbackError(false);
    setSubmitting(true);
    const ok = await api.submitExternalApproval(
      token, 'changes_requested', feedback,
      reviewerName || undefined, reviewerEmail || undefined
    );
    setSubmitting(false);
    setStep(ok ? 'done-reject' : 'reject');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          {post?.workspace_logo_url ? (
            <img src={post.workspace_logo_url} alt={post.workspace_name ?? 'Logo'} className="h-8 w-auto max-w-[120px] object-contain" />
          ) : (
            <img src="/favicon.svg" alt="Logo" className="h-8 w-8" />
          )}
          <div>
            <span className="font-semibold text-lg">Revisão de Conteúdo</span>
            {post?.workspace_name && (
              <p className="text-xs text-muted-foreground">{post.workspace_name}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : step === 'invalid' ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-16 text-center space-y-3">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
              <h2 className="text-xl font-semibold">Link inválido ou expirado</h2>
              <p className="text-muted-foreground text-sm">
                Este link de revisão não é válido ou o post já foi revisado.
              </p>
            </CardContent>
          </Card>
        ) : step === 'done-approve' ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-16 text-center space-y-3">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold">Post aprovado!</h2>
              <p className="text-muted-foreground text-sm">
                Sua aprovação foi registrada. A equipe responsável será notificada.
              </p>
            </CardContent>
          </Card>
        ) : step === 'done-schedule' ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-16 text-center space-y-3">
              <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold">Post agendado!</h2>
              <p className="text-muted-foreground text-sm">
                O agendamento foi registrado. A equipe responsável será notificada.
              </p>
            </CardContent>
          </Card>
        ) : step === 'done-reject' ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-16 text-center space-y-3">
              <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-semibold">Ajustes solicitados</h2>
              <p className="text-muted-foreground text-sm">
                Seu feedback foi enviado. A equipe responsável irá revisar e retornar.
              </p>
            </CardContent>
          </Card>
        ) : post ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            {/* Left: Post preview (60%) */}
            <div className="lg:col-span-3">
              <PostPreview post={post} />
            </div>

            {/* Right: Reviewer actions (40%) */}
            <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-6">
              {/* Reviewer identity */}
              <Card>
                <CardContent className="p-5 space-y-4">
                  <h2 className="font-semibold text-base">
                    Suas informações{' '}
                    <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                  </h2>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reviewer-name">Nome</Label>
                      <Input
                        id="reviewer-name"
                        placeholder="Seu nome"
                        value={reviewerName}
                        onChange={e => setReviewerName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reviewer-email">E-mail</Label>
                      <Input
                        id="reviewer-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={reviewerEmail}
                        onChange={e => setReviewerEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action buttons — initial step */}
              {step === 'review' && (
                <div className="flex flex-col gap-3">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 w-full"
                    onClick={() => setStep('approve')}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Aprovar
                  </Button>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 w-full"
                    onClick={() => setStep('schedule')}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Aprovar e Agendar
                  </Button>
                  <Button
                    variant="outline"
                    className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 w-full"
                    onClick={() => setStep('reject')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Solicitar Ajustes
                  </Button>
                </div>
              )}

              {/* Approve confirmation */}
              {step === 'approve' && (
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h2 className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                      <Check className="h-4 w-4" /> Confirmar aprovação
                    </h2>
                    <div className="space-y-1.5">
                      <Label htmlFor="approve-comment">
                        Comentário{' '}
                        <span className="text-xs text-muted-foreground">(opcional)</span>
                      </Label>
                      <Textarea
                        id="approve-comment"
                        placeholder="Alguma observação para a equipe?"
                        rows={3}
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep('review')} disabled={submitting}>
                        Voltar
                      </Button>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                        onClick={handleApprove}
                        disabled={submitting}
                      >
                        {submitting
                          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          : <Check className="h-4 w-4 mr-2" />}
                        Confirmar aprovação
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Schedule confirmation */}
              {step === 'schedule' && (
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h2 className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Aprovar e Agendar
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="schedule-date">
                          Data <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="schedule-date"
                          type="date"
                          value={scheduleDate}
                          onChange={e => { setScheduleDate(e.target.value); setScheduleDateError(false); }}
                          className={scheduleDateError ? 'border-destructive' : ''}
                          min={format(new Date(), 'yyyy-MM-dd')}
                        />
                        {scheduleDateError && (
                          <p className="text-xs text-destructive">Selecione uma data.</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="schedule-time">Horário</Label>
                        <Input
                          id="schedule-time"
                          type="time"
                          value={scheduleTime}
                          onChange={e => setScheduleTime(e.target.value)}
                          placeholder="09:00"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="schedule-comment">
                        Comentário{' '}
                        <span className="text-xs text-muted-foreground">(opcional)</span>
                      </Label>
                      <Textarea
                        id="schedule-comment"
                        placeholder="Alguma observação para a equipe?"
                        rows={2}
                        value={scheduleComment}
                        onChange={e => setScheduleComment(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep('review')} disabled={submitting}>
                        Voltar
                      </Button>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 flex-1"
                        onClick={handleSchedule}
                        disabled={submitting}
                      >
                        {submitting
                          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          : <Calendar className="h-4 w-4 mr-2" />}
                        Confirmar agendamento
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Reject / request changes */}
              {step === 'reject' && (
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h2 className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Solicitar ajustes
                    </h2>
                    <div className="space-y-1.5">
                      <Label htmlFor="reject-feedback">
                        Feedback <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="reject-feedback"
                        placeholder="Descreva o que precisa ser ajustado. Ex: o texto está ótimo mas a plataforma deveria ser LinkedIn ao invés de Instagram."
                        rows={5}
                        value={feedback}
                        onChange={e => {
                          setFeedback(e.target.value);
                          if (e.target.value.trim()) setFeedbackError(false);
                        }}
                        className={feedbackError ? 'border-destructive' : ''}
                      />
                      {feedbackError && (
                        <p className="text-xs text-destructive">O feedback é obrigatório para solicitar ajustes.</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep('review')} disabled={submitting}>
                        Voltar
                      </Button>
                      <Button
                        variant="outline"
                        className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 flex-1"
                        onClick={handleReject}
                        disabled={submitting}
                      >
                        {submitting
                          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          : <AlertTriangle className="h-4 w-4 mr-2" />}
                        Enviar feedback
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
