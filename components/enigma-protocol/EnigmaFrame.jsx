'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ENIGMA_NAV_ITEMS } from './enigma-data';

export default function EnigmaFrame({ activeKey, children, hideNav = false, className = '' }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => {
      setIsScrolled(window.scrollY > 18);
    };

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  return (
    <main className={`page-shell ${className}`}>
      <div className="bg-glow bg-glow-left" />
      <div className="bg-glow bg-glow-right" />
      {!hideNav ? (
        <nav className={`top-nav ${isScrolled ? 'top-nav-scrolled' : 'top-nav-top'}`}>
          <Link href="/enigma-protocol/lobby" className="top-nav-brand">
            <span className="top-nav-mark" aria-hidden="true" />
            <span>Enigma</span>
            <strong>Protocol</strong>
          </Link>
          <div className="top-nav-links">
            {ENIGMA_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.key === activeKey ? 'active' : ''}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
      {children}
    </main>
  );
}
