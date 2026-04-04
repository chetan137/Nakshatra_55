import React, { useRef, useState, useEffect } from 'react';

export default function OTPInput({ length = 6, onChange }) {
  const [values, setValues] = useState(Array(length).fill(''));
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    onChange?.(values.join(''));
  }, [values, onChange]);

  function handleChange(index, e) {
    const val = e.target.value;
    if (val && !/^\d$/.test(val)) return;

    const next = [...values];
    next[index] = val;
    setValues(next);

    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !values[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    const next = [...values];
    for (let i = 0; i < length; i++) {
      next[i] = pasted[i] || '';
    }
    setValues(next);

    const focusIndex = Math.min(pasted.length, length - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  return (
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
      {values.map((v, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={v}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="otp-box"
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}
