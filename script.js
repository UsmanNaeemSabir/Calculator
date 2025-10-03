(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', initCalculator);

  function initCalculator() {
    const primaryDisplayEl = document.getElementById('primaryDisplay');
    const secondaryDisplayEl = document.getElementById('secondaryDisplay');
    const keysContainerEl = document.querySelector('.keys');

    let currentExpression = '';

    keysContainerEl.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains('key')) return;

      const action = target.getAttribute('data-action');
      const value = target.getAttribute('data-value');

      if (action) {
        handleAction(action);
        flashKey(target);
        return;
      }

      if (value) {
        appendToExpression(value);
        flashKey(target);
      }
    });

    document.addEventListener('keydown', (event) => {
      const key = event.key;

      if (key === 'Enter' || key === '=') {
        event.preventDefault();
        handleAction('equals');
        highlightMatchingKey('[data-action="equals"]');
        return;
      }

      if (key === 'Escape' || key === 'Delete') {
        event.preventDefault();
        handleAction('all-clear');
        highlightMatchingKey('[data-action="all-clear"]');
        return;
      }

      if (key === 'Backspace') {
        event.preventDefault();
        handleAction('backspace');
        highlightMatchingKey('[data-action="backspace"]');
        return;
      }

      // Map keyboard inputs to values
      const map = {
        '/': '÷',
        '*': '×',
        'x': '×', 'X': '×',
        '-': '−',
        '+': '+',
        '.': '.',
        '(': '(',
        ')': ')'
      };

      if (/^[0-9]$/.test(key)) {
        appendToExpression(key);
        highlightMatchingKey(`[data-value="${key}"]`);
        return;
      }

      if (key in map) {
        appendToExpression(map[key]);
        const v = map[key];
        const selector = `[data-value="${cssEscape(v)}"]`;
        highlightMatchingKey(selector);
        return;
      }
    });

    function handleAction(action) {
      switch (action) {
        case 'all-clear':
          currentExpression = '';
          updateDisplays();
          break;
        case 'clear-entry':
          clearEntry();
          break;
        case 'backspace':
          deleteLast();
          break;
        case 'equals':
          evaluateAndCommit();
          break;
      }
    }

    function appendToExpression(input) {
      if (input === '.') {
        if (!canInsertDecimal()) return;
      }

      if (isOperator(input)) {
        // Normalize minus symbol for internal representation
        input = input === '−' ? '−' : input; // keep as is for display

        if (currentExpression.length === 0) {
          // Allow a leading minus for negative numbers
          if (input !== '−') return;
        }

        if (isOperator(getLastChar(currentExpression))) {
          // Replace the last operator with the new one
          currentExpression = currentExpression.slice(0, -1) + input;
        } else {
          currentExpression += input;
        }
      } else {
        currentExpression += input;
      }

      updateDisplays();
    }

    function clearEntry() {
      // Remove last continuous number or parenthesis group
      if (!currentExpression) return;

      const lastChar = getLastChar(currentExpression);
      if (isDigit(lastChar) || lastChar === '.') {
        currentExpression = currentExpression.replace(/([0-9]*\.?[0-9]+)$|\.$/, '');
      } else {
        // Pop last char (operator or bracket)
        currentExpression = currentExpression.slice(0, -1);
      }

      updateDisplays();
    }

    function deleteLast() {
      if (!currentExpression) return;
      currentExpression = currentExpression.slice(0, -1);
      updateDisplays();
    }

    function evaluateAndCommit() {
      const result = tryEvaluate(currentExpression);
      if (result === null || Number.isNaN(result) || !Number.isFinite(result)) {
        // Briefly show error
        secondaryDisplayEl.textContent = 'Error';
        return;
      }
      currentExpression = String(result);
      updateDisplays();
    }

    function updateDisplays() {
      primaryDisplayEl.textContent = currentExpression || '0';
      const preview = computePreview(currentExpression);
      secondaryDisplayEl.textContent = preview ?? '';
      autoFitPrimaryText();
    }

    function computePreview(expression) {
      if (!expression) return '';
      if (!isExpressionSafeToPreview(expression)) return '';

      const result = tryEvaluate(expression);
      if (result === null || Number.isNaN(result) || !Number.isFinite(result)) return '';
      return String(result);
    }

    function tryEvaluate(expression) {
      try {
        const sanitized = sanitizeExpression(expression);
        if (sanitized.trim() === '') return null;
        // eslint-disable-next-line no-new-func
        const fn = new Function(`return (${sanitized});`);
        return fn();
      } catch (e) {
        return null;
      }
    }

    function sanitizeExpression(raw) {
      let expr = raw
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/\s+/g, '');

      // Allow only digits, operators, parentheses, and decimal points
      expr = expr.replace(/[^0-9+\-*/().]/g, '');
      return expr;
    }

    function isExpressionSafeToPreview(expression) {
      const trimmed = expression.trim();
      if (!trimmed) return false;

      const last = getLastChar(trimmed);
      if (!(isDigit(last) || last === ')' )) return false;

      // Parentheses balance check
      let balance = 0;
      for (const ch of trimmed) {
        if (ch === '(') balance++;
        if (ch === ')') balance--;
        if (balance < 0) return false;
      }
      if (balance !== 0) return false;

      return true;
    }

    function isOperator(ch) {
      return ch === '+' || ch === '−' || ch === '×' || ch === '÷';
    }

    function isDigit(ch) {
      return /[0-9]/.test(ch);
    }

    function getLastChar(text) {
      return text[text.length - 1];
    }

    function canInsertDecimal() {
      // Only one decimal per number segment
      const lastNumber = (currentExpression.match(/([0-9]+\.?[0-9]*)$/) || [])[0] || '';
      return !lastNumber.includes('.');
    }

    function flashKey(keyEl) {
      keyEl.classList.add('active');
      setTimeout(() => keyEl.classList.remove('active'), 80);
    }

    function highlightMatchingKey(selector) {
      const el = document.querySelector(selector);
      if (el) {
        el.classList.add('active');
        setTimeout(() => el.classList.remove('active'), 100);
      }
    }

    function cssEscape(value) {
      // Minimal escape for selectors containing special chars
      return value.replace(/([.*+?^${}()|\[\]\\\/])/g, '\\$1');
    }

    function autoFitPrimaryText() {
      const el = primaryDisplayEl;
      const maxSize = 44; // px
      const minSize = 22; // px

      // Compute size based on length heuristics
      const len = el.textContent ? el.textContent.length : 1;
      let size = 40;
      if (len > 12) size = 34;
      if (len > 18) size = 30;
      if (len > 24) size = 26;
      if (len > 30) size = 22;

      size = Math.max(minSize, Math.min(maxSize, size));
      el.style.fontSize = size + 'px';
    }

    // Initial paint
    updateDisplays();
  }
})(); 