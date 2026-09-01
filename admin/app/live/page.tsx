import { getLiveEvents, getProducts } from '@/lib/api';
import { timestamp } from '@/lib/format';
import { LiveEventPanel } from './live-event-panel';
import { Studio } from './studio';
import { ScheduleForm } from './schedule-form';

export const dynamic = 'force-dynamic';

export default async function LivePage() {
  const [{ events }, { products }] = await Promise.all([getLiveEvents(), getProducts()]);
  const onAir = events.find((e) => e.isLive) ?? null;
  const upcoming = events.filter((e) => e.status === 'scheduled');
  const past = events.filter((e) => e.status === 'ended' || e.status === 'cancelled');

  // One event is the studio's subject; which panel it gets depends on how
  // it is fed. Only a browser-fed event can accept segments from here.
  const subject = onAir ?? upcoming[0] ?? null;
  const studioEvent = subject?.source === 'browser' ? subject : null;
  const encoderEvent = subject && subject.source !== 'browser' ? subject : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Go Live</h1>
          <p className="page-sub">
            A live event outranks whatever is programmed: while it is on air it
            <em> is</em> the main broadcast. Ending it hands the stage back to the
            programmed video automatically.
          </p>
        </div>
      </div>

      <div className={`panel ${onAir ? 'onair-live' : 'onair-empty'}`} style={{ marginBottom: 20 }}>
        <div className="panel-body">
          <div className="row" style={{ marginBottom: 8 }}>
            {onAir ? <span className="live-dot" /> : null}
            <span className="stat-label">{onAir ? 'On air now' : 'Nothing live'}</span>
          </div>
          {onAir ? (
            <>
              <div className="headline">{onAir.title}</div>
              <div className="stat-note">
                {onAir.productId}, started {timestamp(onAir.startedAt)}, peak {onAir.peakViewers} viewers
              </div>
            </>
          ) : (
            <div className="stat-note" style={{ maxWidth: '66ch' }}>
              No broadcast is running, so the stage is showing the programmed video.
              Schedule an event, point your encoder at it, and go on air.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-split" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          {/* The studio broadcasts whatever is on air, or the next scheduled
              event if nothing is - but only if that event is fed by a browser.

              It used to mount for any event at all. An event defaults to
              "external", so the common case was a studio offering to broadcast
              into an event the API would never accept: the camera opened, the
              preview looked correct, and every segment came back 409. Nothing
              reached the viewer and the counter sat at zero, with the only
              explanation in a rejected response nobody was reading. An encoder
              event gets the encoder's instructions instead. */}
          {studioEvent ? (
            <Studio event={studioEvent} />
          ) : encoderEvent ? (
            <div className="panel">
              <div className="panel-head"><h2>Broadcast</h2></div>
              <p className="stat-note" style={{ maxWidth: '66ch' }}>
                <strong>{encoderEvent.title}</strong> is fed by an external encoder,
                so it cannot be broadcast from this browser. Point OBS at the ingest
                URL below, or switch the event to <em>Broadcast from this browser</em>{' '}
                in its panel to use the camera instead.
              </p>
              {encoderEvent.ingestUrl ? (
                <p className="mono stat-note">{encoderEvent.ingestUrl}</p>
              ) : null}
            </div>
          ) : null}
          {onAir ? <LiveEventPanel event={onAir} /> : null}

          <div className="panel">
            <div className="panel-head">
              <h2>Scheduled</h2>
              <span className="mono">{upcoming.length}</span>
            </div>
            {upcoming.length === 0 ? (
              <div className="empty">Nothing scheduled.</div>
            ) : (
              <div className="panel-body stack" style={{ gap: 14 }}>
                {upcoming.map((event) => <LiveEventPanel key={event.id} event={event} compact />)}
              </div>
            )}
          </div>

          {past.length > 0 ? (
            <div className="panel">
              <div className="panel-head"><h2>Past broadcasts</h2></div>
              <table>
                <thead><tr><th>Event</th><th>Status</th><th>Started</th><th>Ended</th><th className="num-col">Peak</th></tr></thead>
                <tbody>
                  {past.map((event) => (
                    <tr key={event.id}>
                      <td style={{ fontWeight: 600 }}>{event.title}</td>
                      <td><span className={`pill pill-${event.status === 'ended' ? 'archived' : 'draft'}`}>{event.status}</span></td>
                      <td className="mono">{timestamp(event.startedAt)}</td>
                      <td className="mono">{timestamp(event.endedAt)}</td>
                      <td className="num num-col">{event.peakViewers || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Schedule an event</h2></div>
          <div className="panel-body">
            <ScheduleForm products={products} />
          </div>
        </div>
      </div>
    </>
  );
}
