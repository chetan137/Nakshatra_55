/**
 * useNotifications.js
 *
 * Polls real API data every 30 seconds and emits notifications when:
 *  - A loan the user created gets funded (pending → active)
 *  - A loan the user funded gets repaid (active → repaid)
 *  - A loan gets defaulted / liquidated
 *  - A new loan appears on the marketplace (lender only)
 *  - A new guarantor request arrives in inbox
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getMyLoans, getAvailable, getGuarantorInbox } from '../api/loanApi';
import { useAuth } from '../context/AuthContext';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  // Snapshots of previous poll
  const prevMyLoans    = useRef(null); // Map<id, status>
  const prevMarket     = useRef(null); // Set<id>
  const prevInboxCount = useRef(null); // number

  const addNotif = useCallback((notif) => {
    const id = Date.now() + Math.random();
    setNotifications(n => [{ id, ...notif, time: new Date(), read: false }, ...n].slice(0, 50));
    setUnreadCount(c => c + 1);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(n => n.map(x => ({ ...x, read: true })));
    setUnreadCount(0);
  }, []);

  const dismiss = useCallback((id) => {
    setNotifications(n => {
      const notif = n.find(x => x.id === id);
      if (notif && !notif.read) setUnreadCount(c => Math.max(0, c - 1));
      return n.filter(x => x.id !== id);
    });
  }, []);

  const poll = useCallback(async () => {
    if (!user) return;

    try {
      // ── My Loans ─────────────────────────────────────────
      const myRes = await getMyLoans();
      const myLoans = myRes.data?.loans || [];

      if (prevMyLoans.current !== null) {
        const prev = prevMyLoans.current;

        for (const loan of myLoans) {
          const prevStatus = prev[loan._id];
          const curStatus  = loan.status;
          if (prevStatus === curStatus) continue; // no change

          const amt  = loan.principal ? `${Number(loan.principal).toFixed(4)} ETH` : '';
          const isBorrower = String(loan.borrower?._id || loan.borrower) === user._id;

          if (prevStatus === 'pending' && curStatus === 'active') {
            addNotif({
              type: 'funded',
              title: isBorrower ? '💸 Your loan was funded!' : '✅ Loan funded',
              body: `${amt} — loan is now active.`,
              link: '/history',
            });
          } else if (prevStatus === 'active' && curStatus === 'repaid') {
            addNotif({
              type: 'repaid',
              title: isBorrower ? '🎉 Loan fully repaid' : '💰 Repayment received',
              body: `${amt} repaid successfully.`,
              link: '/history',
            });
          } else if (curStatus === 'defaulted') {
            addNotif({
              type: 'default',
              title: '⚠️ Loan defaulted',
              body: `${amt} — this loan has been marked as defaulted.`,
              link: '/history',
            });
          } else if (curStatus === 'cancelled') {
            addNotif({
              type: 'cancelled',
              title: '❌ Loan cancelled',
              body: `${amt} — loan request was cancelled.`,
              link: '/history',
            });
          }
        }
      }
      // Update snapshot
      const newMap = {};
      for (const l of myLoans) newMap[l._id] = l.status;
      prevMyLoans.current = newMap;

      // ── Marketplace (lender only) ─────────────────────────
      if (user.role === 'lender') {
        const mktRes = await getAvailable();
        const available = mktRes.data?.loans || [];
        const newIds = new Set(available.map(l => l._id));

        if (prevMarket.current !== null) {
          const prevIds = prevMarket.current;
          const brandNew = available.filter(l => !prevIds.has(l._id));
          if (brandNew.length > 0) {
            addNotif({
              type: 'new_request',
              title: `📋 ${brandNew.length} new loan request${brandNew.length > 1 ? 's' : ''}`,
              body: `New borrow request${brandNew.length > 1 ? 's are' : ' is'} waiting to be funded.`,
              link: '/lend',
            });
          }
        }
        prevMarket.current = new Set([...newIds]);
      }

      // ── Guarantor inbox ───────────────────────────────────
      try {
        const inboxRes = await getGuarantorInbox();
        const pending  = (inboxRes.data?.requests || []).filter(r => r.status === 'pending').length;

        if (prevInboxCount.current !== null && pending > prevInboxCount.current) {
          const diff = pending - prevInboxCount.current;
          addNotif({
            type: 'guarantor',
            title: `🛡️ ${diff} new guarantor request${diff > 1 ? 's' : ''}`,
            body: 'Someone has asked you to be their guarantor.',
            link: '/guarantor-inbox',
          });
        }
        prevInboxCount.current = pending;
      } catch { /* inbox may 403 for non-guarantors */ }

    } catch {
      /* silently ignore network errors */
    }
  }, [user, addNotif]);

  useEffect(() => {
    if (!user) return;
    // First poll after 3s (let page load settle)
    const first = setTimeout(poll, 3000);
    // Then every 30s
    const interval = setInterval(poll, 30000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [user, poll]);

  return { notifications, unreadCount, markAllRead, dismiss };
}
