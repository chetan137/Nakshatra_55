import React, { useState, useEffect } from 'react';
import './CrushReveal.css';

const CrushReveal = ({ children }) => {
  const [isCrushing, setIsCrushing] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsCrushing(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isCrushing) {
      const hideTimer = setTimeout(() => setIsVisible(false), 1400);
      return () => clearTimeout(hideTimer);
    }
  }, [isCrushing]);

  return (
    <div className="crush-reveal-container">
      {isVisible && (
        <div className={`crush-wrapper ${isCrushing ? 'crushing' : ''}`}>
          <div className="crush-logo">
            <img src="/logo.png" alt="Go Secure" className="crush-logo-img" />
            <h1>Go<br />Secure</h1>
          </div>
        </div>
      )}
      <main className="content-behind-crush">{children}</main>
    </div>
  );
};

export default CrushReveal;
