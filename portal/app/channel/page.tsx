import { redirect } from 'next/navigation';
import { getBalance, getMyChannel, getSession, getViewersChoice } from '@/lib/api';
import { coins, timestamp } from '@/lib/format';
import { BuyChannelForm, EditChannelForm } from './channel-forms';

export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(3, '0');

export default async function ChannelPage() {
  const user = await getSession();
  if (user && user.role !== 'creator' && user.role !== 'admin') redirect('/');

  const [mine, wallet, choice] = await Promise.all([getMyChannel(), getBalance(), getViewersChoice().catch(() => null)]);
  const myStanding = choice?.standings.find((s) => s.userId === user?.id) ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My channel</h1>
          <p className="page-sub">
            A decoder number is your place in the viewer&apos;s channels area,
            next to the network&apos;s own Vision channel on 1. Sold once, for
            KashCoin, and yours to name.
          </p>
        </div>
      </div>

      {mine.channel ? (
        <div className="panel onair" style={{ marginBottom: 20 }}>
          <div className="panel-body spread">
            <div>
              <span className="stat-label">Your decoder number</span>
              <div className="headline num">Ch {pad(mine.channel.number)}, {mine.channel.name}</div>
              <div className="stat-note">
                {mine.channel.tagline || 'No tagline yet.'} Bought {timestamp(mine.channel.createdAt)} for {coins(mine.channel.price)} KASH.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-split-narrow" style={{ alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head"><h2>{mine.channel ? 'Name and tagline' : 'Buy a decoder number'}</h2></div>
          <div className="panel-body">
            {mine.channel ? (
              <EditChannelForm name={mine.channel.name} tagline={mine.channel.tagline} />
            ) : (
              <BuyChannelForm
                price={mine.price}
                floor={mine.floor}
                ceiling={mine.ceiling}
                nextFree={mine.nextFree}
                taken={mine.taken}
                balance={wallet.balance}
              />
            )}
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="panel">
            <div className="panel-head"><h2>What a number does</h2></div>
            <div className="panel-body stack-loose">
              <p className="stat-note" style={{ marginTop: 0 }}>
                <strong>A fixed address.</strong> Viewers flip to your number in
                the channels area and get whatever you have up: your live
                session first, your latest published video otherwise.
              </p>
              <p className="stat-note" style={{ marginTop: 0 }}>
                <strong>Yours for good.</strong> One number per creator, one
                creator per number. The number stays on your card on the
                viewers&apos; choice board too.
              </p>
            </div>
          </div>
          {choice ? (
            <div className="panel stat">
              <div className="stat-label">Viewers&apos; choice, {choice.quarter}</div>
              <div className="stat-value num">{myStanding ? `#${myStanding.rank}` : 'unranked'}</div>
              <div className="stat-note">
                {myStanding ? `${myStanding.votes} of ${choice.totalVotes} votes. ` : `${choice.totalVotes} votes cast so far. `}
                The winner takes {choice.sharePct}% of the quarter&apos;s network revenue, <span className="num">{coins(choice.prize)} KASH</span> at the moment.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
