export type PlaybackSample = { position: number; playing: boolean; loaded: boolean; buffering: boolean; seeking: boolean; active: boolean }

/** Counts forward playback, bounded by elapsed real time; seeking never earns time. */
export class ListeningClock {
  private previous: { position: number; at: number; eligible: boolean } | null = null
  private seconds = 0

  sample(state: PlaybackSample, now: number) {
    const previous = this.previous
    const elapsed = previous ? (now - previous.at) / 1000 : 0
    const progress = previous ? state.position - previous.position : 0
    if (previous?.eligible && !state.seeking && Number.isFinite(progress) && elapsed > 0 && elapsed <= 2 && progress > 0 && progress <= elapsed + 0.25)
      this.seconds += Math.min(progress, elapsed)
    this.previous = { position: state.position, at: now, eligible: state.playing && state.loaded && !state.buffering && !state.seeking && state.active }
  }

  get totalSeconds() { return Math.floor(this.seconds + 0.000001) }
}

const failedReports = new Set<PlaybackReporter>()
const listeners = new Set<(failed: boolean) => void>()
const notify = () => { for (const listener of listeners) listener(failedReports.size > 0) }
export const hasFailedPlayReports = () => failedReports.size > 0
export function subscribeFailedPlayReports(listener: (failed: boolean) => void) {
  listeners.add(listener)
  listener(hasFailedPlayReports())
  return () => { listeners.delete(listener) }
}

/** Serialize completion/unmount flushes; only submit time not already acknowledged. */
export class PlaybackReporter {
  private acknowledged = 0
  private pending: Promise<void> | null = null
  constructor(private clock: ListeningClock, private send: (seconds: number) => Promise<unknown>) {}

  flush(): Promise<void> {
    if (this.pending) return this.pending
    this.pending = (async () => {
      try {
        while (this.clock.totalSeconds > this.acknowledged) {
          const duration = Math.min(86400, this.clock.totalSeconds - this.acknowledged)
          await this.send(duration)
          this.acknowledged += duration
        }
        failedReports.delete(this)
        notify()
      } catch (error) { failedReports.add(this); notify(); throw error }
    })().finally(() => { this.pending = null })
    return this.pending
  }
}

// Failed reports stay in memory for an explicit retry; access tokens never go to disk.
export async function retryFailedPlayReports() {
  await Promise.all([...failedReports].map(report => report.flush()))
}
