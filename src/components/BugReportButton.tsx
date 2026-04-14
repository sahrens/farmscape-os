import { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { bugReports } from '../lib/api';

interface BugReportButtonProps {
  consoleLogs: React.RefObject<Array<{ level: string; message: string; timestamp: string }>>;
}

const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const;
const TAG_OPTIONS = ['ui', '3d', 'data', 'auth', 'performance', 'mobile', 'crash', 'other'] as const;

export function BugReportButton({ consoleLogs }: BugReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<string>('medium');
  const [tags, setTags] = useState<string[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Array<{ dataUrl: string; filename: string; mimeType: string; size: number }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const captureScreenshot = useCallback(async () => {
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 0.5,
        ignoreElements: (el) => el.id === 'bug-report-modal',
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      setScreenshot(dataUrl);
    } catch (e) {
      console.error('Screenshot capture failed:', e);
    }
  }, []);

  const handleOpen = useCallback(async () => {
    setOpen(true);
    setSubmitted(false);
    setError(null);
    setGithubUrl(null);
    await captureScreenshot();
  }, [captureScreenshot]);

  const handleClose = () => {
    setOpen(false);
    setTitle('');
    setDescription('');
    setSeverity('medium');
    setTags([]);
    setScreenshot(null);
    setAttachments([]);
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
    setGithubUrl(null);
  };

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`File ${file.name} is too large (max 10MB)`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [...prev, {
          dataUrl: reader.result as string,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        }]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const logs = consoleLogs.current || [];
      const route = window.location.pathname + window.location.hash;
      const viewport = `${window.innerWidth}x${window.innerHeight}`;
      const userAgent = navigator.userAgent;

      const result = await bugReports.submit({
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
        tags: tags.length > 0 ? tags : undefined,
        route,
        screenshot_url: screenshot || undefined,
        console_logs: JSON.stringify(logs.slice(-50)),
        user_agent: userAgent,
        viewport,
      });

      if (result.id && attachments.length > 0) {
        for (const att of attachments) {
          try {
            await bugReports.upload(att.dataUrl, att.filename, att.mimeType, result.id);
          } catch {
            // Non-critical
          }
        }
      }

      setSubmitted(true);
      setGithubUrl(result.github_issue_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Bug report nub — visible but not intrusive */}
      <button
        onClick={handleOpen}
        className="fixed z-50 w-9 h-9 rounded-full bg-earth-700/80 text-earth-400 hover:bg-earth-600 hover:text-earth-200 flex items-center justify-center backdrop-blur-sm active:scale-90 transition-all text-base shadow-md border border-earth-600/50"
        style={{ bottom: '1rem', right: '1rem' }}
        aria-label="Report a bug"
      >
        🪲
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          id="bug-report-modal"
          className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="bg-white dark:bg-zinc-900 w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[85vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {submitted ? 'Bug Reported' : 'Report a Bug'}
              </h2>
              <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">✕</button>
            </div>

            {submitted ? (
              <div className="p-4 space-y-4">
                <p className="text-zinc-700 dark:text-zinc-300">
                  Thanks for reporting! Your bug has been logged.
                </p>
                {githubUrl && (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-blue-600 dark:text-blue-400 underline text-sm"
                  >
                    View GitHub issue
                  </a>
                )}
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 bg-zinc-800 text-white rounded-lg font-medium"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    What went wrong? *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief description of the issue"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Details (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Steps to reproduce, expected vs actual behavior..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm resize-none"
                  />
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Severity
                  </label>
                  <div className="flex gap-2">
                    {SEVERITY_OPTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => setSeverity(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                          severity === s
                            ? s === 'critical' ? 'bg-red-600 text-white'
                            : s === 'high' ? 'bg-orange-500 text-white'
                            : s === 'medium' ? 'bg-yellow-500 text-white'
                            : 'bg-blue-500 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TAG_OPTIONS.map(t => (
                      <button
                        key={t}
                        onClick={() => toggleTag(t)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                          tags.includes(t)
                            ? 'bg-green-700 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Screenshot preview */}
                {screenshot && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Screenshot (auto-captured)
                    </label>
                    <div className="relative">
                      <img
                        src={screenshot}
                        alt="Screenshot"
                        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                      />
                      <button
                        onClick={() => setScreenshot(null)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-xs flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {/* File attachments */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Attachments
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileAdd}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 text-sm text-zinc-500 dark:text-zinc-400 w-full hover:border-zinc-400 transition-colors"
                  >
                    + Add images or videos
                  </button>
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                          <span className="truncate flex-1">{att.filename}</span>
                          <span className="text-xs text-zinc-400">{(att.size / 1024).toFixed(0)}KB</span>
                          <button onClick={() => removeAttachment(i)} className="text-red-400 hover:text-red-600">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim()}
                  className="w-full py-2.5 bg-earth-700 hover:bg-earth-600 text-earth-100 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Bug Report'}
                </button>

                {/* Auto-captured info note */}
                <p className="text-xs text-zinc-400 text-center">
                  Auto-captures: screenshot, console logs, route, viewport, user agent
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
